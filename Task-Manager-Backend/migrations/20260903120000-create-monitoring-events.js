"use strict";

/**
 * monitoring_events — APPEND-ONLY raw event stream from the desktop agent.
 *
 * This table is the single source of truth for the monitoring system. Every
 * derived table (pc_sessions, intervals, app/web sessions, daily summaries) is
 * recomputed from these rows and is disposable. Nothing in application code may
 * UPDATE or DELETE a row here — rows leave only via organization / user / agent
 * cascade.
 *
 * Idempotency is on (agent_id, client_event_id) only. client_seq is an ordering
 * hint and MAY legitimately restart at 0 after an agent reinstall / secure-store
 * wipe, so it is deliberately NOT unique. Ordering within a single agent run is
 * (run_id, monotonic_ms) with client_seq as a tiebreaker; ordering across runs
 * uses occurred_at (wall clock).
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("monitoring_events", {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },

      organization_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: "organizations", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      user_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      agent_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: "monitoring_agents", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      // agent_start | heartbeat | agent_stop | session_end | input_state |
      // screen_state | app_focus | browser_state  (see docs/monitoring events).
      type: {
        type: Sequelize.STRING(40),
        allowNull: false,
      },

      // Type-specific body. See the event payload contract in the models layer.
      payload: {
        type: Sequelize.JSON,
        allowNull: true,
      },

      // Agent wall clock at the moment the event was emitted.
      occurred_at: {
        type: Sequelize.DATE(3),
        allowNull: false,
      },

      // performance.now() since agent process start. Comparable ONLY within the
      // same run_id. Used for tamper-resistant duration math during derivation.
      monotonic_ms: {
        type: Sequelize.DOUBLE,
        allowNull: true,
      },

      // New UUID per agent process start.
      run_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
      },

      // Epoch ms of the last OS boot (Date.now() - os.uptime()*1000). Lets the
      // derivation engine tell a real reboot (screen_off/reboot) from a mere
      // agent restart within the same boot (untracked).
      os_boot_time: {
        type: Sequelize.BIGINT,
        allowNull: true,
      },

      // Idempotency key (UUID v4), unique per agent.
      client_event_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
      },

      // Ordering hint only; NOT unique; may restart at 0 on reinstall.
      client_seq: {
        type: Sequelize.BIGINT,
        allowNull: true,
      },

      // Server-assigned from occurred_at in the server's local timezone. This is
      // the recompute partition key (Decision 5: no per-employee timezone).
      local_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },

      received_at: {
        type: Sequelize.DATE(3),
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP(3)"),
      },

      // Set when |occurred_at - received_at| exceeds the RTT + skew budget. The
      // derivation engine still trusts monotonic_ms for durations; only the
      // displayed wall time is clamped toward received_at.
      clock_suspect: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    await queryInterface.addIndex("monitoring_events", {
      fields: ["agent_id", "client_event_id"],
      unique: true,
      name: "ux_monitoring_events_agent_client_event",
    });
    await queryInterface.addIndex("monitoring_events", {
      fields: ["agent_id", "run_id", "client_seq"],
      name: "ix_monitoring_events_agent_run_seq",
    });
    await queryInterface.addIndex("monitoring_events", {
      fields: ["agent_id", "local_date"],
      name: "ix_monitoring_events_agent_local_date",
    });
    await queryInterface.addIndex("monitoring_events", {
      fields: ["user_id", "occurred_at"],
      name: "ix_monitoring_events_user_occurred",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("monitoring_events");
  },
};
