"use strict";

/**
 * monitoring_intervals — DERIVED. The contiguous, non-overlapping classified
 * partition of a device-day, and the data source for the timeline view.
 *
 * Intervals under one pc_session_id cover [first_pc_on, final_pc_off) exactly,
 * with each instant classified as exactly one of active | idle | screen_off |
 * untracked. Precedence during derivation: screen_off > untracked > idle >
 * active.
 *
 * Every interval is clipped to [dayStart, dayEnd); an interval that crosses
 * midnight is split so each local_date's invariant holds independently.
 *
 * Rewritten wholesale on every recompute (FK ON DELETE CASCADE from the parent).
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("monitoring_intervals", {
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

      type: {
        type: Sequelize.ENUM("active", "idle", "screen_off", "untracked"),
        allowNull: false,
      },

      // Only meaningful when type = 'screen_off'.
      screen_off_reason: {
        type: Sequelize.ENUM("display_off", "locked", "sleep", "reboot"),
        allowNull: true,
      },

      // When several screen-off reasons overlap (e.g. display_off + locked),
      // the union interval keeps the full reason set here.
      reasons: {
        type: Sequelize.JSON,
        allowNull: true,
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

      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    await queryInterface.addIndex("monitoring_intervals", {
      fields: ["pc_session_id", "started_at"],
      name: "ix_monitoring_intervals_session_started",
    });
    await queryInterface.addIndex("monitoring_intervals", {
      fields: ["pc_session_id", "type"],
      name: "ix_monitoring_intervals_session_type",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("monitoring_intervals");
  },
};
