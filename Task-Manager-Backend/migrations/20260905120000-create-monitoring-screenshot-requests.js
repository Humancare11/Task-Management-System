"use strict";

/**
 * monitoring_screenshot_requests — audit metadata for one-time Screenshot
 * captures. METADATA ONLY: there is no column for image data anywhere in this
 * table, and the application code that writes to it never holds image bytes
 * in a variable that could reach here. See services/monitoringScreenshot.js.
 *
 * This is a feature separate from Live Screen (monitoring_live_screen_sessions):
 * a single request/response, not a connection with a duration.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("monitoring_screenshot_requests", {
      id: { type: Sequelize.CHAR(36), primaryKey: true, allowNull: false },

      organization_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: "organizations", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      viewer_user_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      target_user_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      agent_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        references: { model: "monitoring_agents", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },

      status: {
        type: Sequelize.ENUM("requested", "delivered", "denied", "expired", "error"),
        allowNull: false,
        defaultValue: "requested",
      },
      error_reason: { type: Sequelize.STRING(40), allowNull: true },
      access_via: { type: Sequelize.ENUM("owner", "grant"), allowNull: true },
      viewer_ip: { type: Sequelize.STRING(45), allowNull: true },

      requested_at: {
        type: Sequelize.DATE(3),
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP(3)"),
      },
      delivered_at: { type: Sequelize.DATE(3), allowNull: true },

      created_at: {
        type: Sequelize.DATE(3),
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP(3)"),
      },
      updated_at: {
        type: Sequelize.DATE(3),
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP(3)"),
      },
    });

    await queryInterface.addIndex("monitoring_screenshot_requests", {
      fields: ["organization_id", "target_user_id", "requested_at"],
      name: "ix_screenshot_requests_org_target_time",
    });
    await queryInterface.addIndex("monitoring_screenshot_requests", {
      fields: ["status"],
      name: "ix_screenshot_requests_status",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("monitoring_screenshot_requests");
  },
};
