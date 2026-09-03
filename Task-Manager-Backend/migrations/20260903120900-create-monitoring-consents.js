"use strict";

/**
 * monitoring_consents — record of an employee's written acknowledgment of §5b
 * in-app content capture.
 *
 * SCHEMA ONLY in Phase 0. The consent flow itself (HR / portal signed
 * acknowledgment) is deferred and must pass an actual legal review before it is
 * built. Nothing writes to or reads from this table yet, and content capture
 * stays hard-disabled by config/contentCaptureGate.js regardless.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("monitoring_consents", {
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

      document_version: {
        type: Sequelize.STRING(32),
        allowNull: false,
      },

      accepted_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },

      method: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },

      ip: {
        type: Sequelize.STRING(45),
        allowNull: true,
      },

      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    await queryInterface.addIndex("monitoring_consents", {
      fields: ["user_id", "document_version"],
      name: "ix_monitoring_consents_user_version",
    });
    await queryInterface.addIndex("monitoring_consents", {
      fields: ["organization_id", "user_id"],
      name: "ix_monitoring_consents_org_user",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("monitoring_consents");
  },
};
