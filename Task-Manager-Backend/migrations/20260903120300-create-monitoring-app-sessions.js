"use strict";

/**
 * monitoring_app_sessions — DERIVED. One row per continuous foreground-focus
 * span of an application within a device-day.
 *
 *   - A window-title change alone does NOT start a new row.
 *   - An application switch DOES.
 *   - Focus spans are split at screen_off / untracked boundaries (no foreground
 *     application then) and clipped to [dayStart, dayEnd).
 *   - duration_seconds is the wall span; active_seconds is the portion that
 *     overlaps `active` intervals.
 *
 * Rewritten wholesale on every recompute (FK ON DELETE CASCADE from the parent).
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("monitoring_app_sessions", {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },

      pc_session_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: "monitoring_pc_sessions", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      application_name: {
        type: Sequelize.STRING(255),
        allowNull: false,
        defaultValue: "Unknown",
      },

      started_at: {
        type: Sequelize.DATE(3),
        allowNull: false,
      },
      ended_at: {
        type: Sequelize.DATE(3),
        allowNull: false,
      },
      duration_seconds: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      active_seconds: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },

      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    await queryInterface.addIndex("monitoring_app_sessions", {
      fields: ["pc_session_id", "started_at"],
      name: "ix_monitoring_app_sessions_session_started",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("monitoring_app_sessions");
  },
};
