"use strict";

/**
 * monitoring_web_sessions — DERIVED. One row per continuous span on a single
 * website domain, while a supported browser is the focused application.
 *
 *   - domain = NULL means the domain could not be determined, OR the window was
 *     private/incognito (is_private = true) — the UI labels those "Private
 *     Browsing" and captures nothing else about them.
 *   - Different browsers are tracked separately.
 *   - Split at screen_off / untracked boundaries and clipped to the day.
 *
 * Rewritten wholesale on every recompute (FK ON DELETE CASCADE from the parent).
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("monitoring_web_sessions", {
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

      browser: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      domain: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      is_private: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
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

    await queryInterface.addIndex("monitoring_web_sessions", {
      fields: ["pc_session_id", "started_at"],
      name: "ix_monitoring_web_sessions_session_started",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("monitoring_web_sessions");
  },
};
