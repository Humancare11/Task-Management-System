"use strict";

/**
 * monitoring_pc_sessions — DERIVED, one row per (agent_id, local_date).
 *
 * This is where the per-device daily invariant is enforced:
 *
 *   active_seconds + idle_seconds + screen_off_seconds + untracked_seconds
 *     == total_seconds            (±1s per interval boundary)
 *
 * It is a 4-way partition (not 3-way): `untracked` covers gaps where the agent
 * process was stopped and restarted within the same OS boot — the PC may have
 * been on and in use, so folding that into screen_off would be dishonest. A real
 * reboot gap IS classified screen_off (reason "reboot") and does NOT split the
 * daily session (§1).
 *
 * Rewritten wholesale (delete + insert of its children) on every recompute.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("monitoring_pc_sessions", {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
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

      local_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },

      // Clamped to [dayStart, dayEnd) — or to `now` while provisional.
      first_pc_on: {
        type: Sequelize.DATE(3),
        allowNull: false,
      },
      final_pc_off: {
        type: Sequelize.DATE(3),
        allowNull: false,
      },

      total_seconds: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      active_seconds: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      idle_seconds: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      screen_off_seconds: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      // Agent-stopped gaps within the day (same os_boot_time, different run_id).
      untracked_seconds: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },

      idle_period_count: {
        type: Sequelize.SMALLINT.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      screen_off_period_count: {
        type: Sequelize.SMALLINT.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },

      // No agent_stop / session_end seen — final_pc_off is the last heartbeat.
      unclean_shutdown: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      // Current day, agent still beating; final_pc_off will move.
      is_provisional: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      // total_seconds - (active + idle + screen_off + untracked). Expected ~0;
      // stored for observability, surfaced if it grows.
      reconciliation_delta_seconds: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },

      source_event_count: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },

      recomputed_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    await queryInterface.addIndex("monitoring_pc_sessions", {
      fields: ["agent_id", "local_date"],
      unique: true,
      name: "ux_monitoring_pc_sessions_agent_local_date",
    });
    await queryInterface.addIndex("monitoring_pc_sessions", {
      fields: ["user_id", "local_date"],
      name: "ix_monitoring_pc_sessions_user_local_date",
    });
    await queryInterface.addIndex("monitoring_pc_sessions", {
      fields: ["organization_id", "local_date"],
      name: "ix_monitoring_pc_sessions_org_local_date",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("monitoring_pc_sessions");
  },
};
