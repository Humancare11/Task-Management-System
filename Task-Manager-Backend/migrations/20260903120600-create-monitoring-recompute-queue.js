"use strict";

/**
 * monitoring_recompute_queue — durable debounce for the derivation engine.
 *
 * On ingest, one row is upserted per distinct (agent_id, local_date) touched by
 * the batch — keyed on the event's OWN local_date, so a week-old offline sync
 * re-derives each of those older days (the nightly pass is only a safety net).
 * Repeated enqueues coalesce onto the same row (UNIQUE agent_id+local_date) and
 * push `not_before` forward.
 *
 * SINGLE-INSTANCE ASSUMPTION: the runner (Phase 2) claims rows with a plain
 * UPDATE ... WHERE status='pending' AND not_before <= NOW(). If the backend is
 * ever scaled beyond one process, switch to SELECT ... FOR UPDATE SKIP LOCKED
 * (or a real job system) so two instances never derive the same key at once.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("monitoring_recompute_queue", {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
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

      not_before: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },

      status: {
        type: Sequelize.ENUM("pending", "running", "done", "error"),
        allowNull: false,
        defaultValue: "pending",
      },

      attempts: {
        type: Sequelize.SMALLINT.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },

      last_error: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      enqueued_at: {
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

    await queryInterface.addIndex("monitoring_recompute_queue", {
      fields: ["agent_id", "local_date"],
      unique: true,
      name: "ux_monitoring_recompute_queue_agent_date",
    });
    await queryInterface.addIndex("monitoring_recompute_queue", {
      fields: ["status", "not_before"],
      name: "ix_monitoring_recompute_queue_status_not_before",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("monitoring_recompute_queue");
  },
};
