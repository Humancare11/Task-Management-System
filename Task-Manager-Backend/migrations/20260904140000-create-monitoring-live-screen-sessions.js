"use strict";

/**
 * monitoring_live_screen_sessions — audit metadata for Live Screen viewing
 * sessions. METADATA ONLY: no media, frames, or thumbnails are ever stored.
 * See models/MonitoringLiveScreenSession.js.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("monitoring_live_screen_sessions", {
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
        type: Sequelize.ENUM("requested", "connecting", "live", "ended", "error"),
        allowNull: false,
        defaultValue: "requested",
      },
      end_reason: { type: Sequelize.STRING(40), allowNull: true },
      access_via: { type: Sequelize.ENUM("owner", "grant"), allowNull: true },
      viewer_ip: { type: Sequelize.STRING(45), allowNull: true },

      requested_at: {
        type: Sequelize.DATE(3),
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP(3)"),
      },
      connected_at: { type: Sequelize.DATE(3), allowNull: true },
      ended_at: { type: Sequelize.DATE(3), allowNull: true },

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

    await queryInterface.addIndex("monitoring_live_screen_sessions", {
      fields: ["organization_id", "target_user_id", "requested_at"],
      name: "ix_live_screen_org_target_time",
    });
    await queryInterface.addIndex("monitoring_live_screen_sessions", {
      fields: ["status"],
      name: "ix_live_screen_status",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("monitoring_live_screen_sessions");
  },
};
