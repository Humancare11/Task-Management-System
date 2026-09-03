"use strict";

/**
 * monitoring_content_access_logs — audit trail of every read of captured content
 * (§5b-5). A row is written BEFORE the content response is returned. Retained
 * ~12 months (longer than the content itself), pruned by the retention job.
 *
 * viewer_user_id / target_user_id use ON DELETE SET NULL (not CASCADE): if a
 * user is later deleted we keep the audit row and simply drop the pointer.
 * organization_id keeps CASCADE (deleting the org legitimately removes its
 * monitoring data).
 *
 * Inert until Phase 4.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("monitoring_content_access_logs", {
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

      date_from: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      date_to: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      row_count: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      ip: {
        type: Sequelize.STRING(45),
        allowNull: true,
      },

      accessed_at: {
        type: Sequelize.DATE(3),
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP(3)"),
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    await queryInterface.addIndex("monitoring_content_access_logs", {
      fields: ["organization_id", "accessed_at"],
      name: "ix_monitoring_content_access_logs_org_accessed",
    });
    await queryInterface.addIndex("monitoring_content_access_logs", {
      fields: ["target_user_id", "accessed_at"],
      name: "ix_monitoring_content_access_logs_target_accessed",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("monitoring_content_access_logs");
  },
};
