"use strict";

/**
 * monitoring_org_settings — per-organization monitoring configuration.
 *
 * content_capture_enabled is the org-level switch for §5b in-app content
 * capture. It is NOT sufficient on its own: capture also requires the global
 * hard legal gate (config/contentCaptureGate.js, currently false) and a
 * configured encryption key registry. All three must be true.
 *
 * content_retention_days is clamped to [30, 90] in application code (default 30).
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("monitoring_org_settings", {
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

      content_capture_enabled: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      content_retention_days: {
        type: Sequelize.SMALLINT.UNSIGNED,
        allowNull: false,
        defaultValue: 30,
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

    await queryInterface.addIndex("monitoring_org_settings", {
      fields: ["organization_id"],
      unique: true,
      name: "ux_monitoring_org_settings_organization",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("monitoring_org_settings");
  },
};
