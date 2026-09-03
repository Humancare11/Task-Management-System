"use strict";

/**
 * monitoring_content_grants — time-boxed, named grants that let a non-owner
 * review captured content (§5b-5). Content viewing is OWNER-ONLY by default; a
 * grant is the only other way in, every read is still audited, and every read
 * re-checks expires_at / revoked_at.
 *
 * Created in Phase 0 for schema stability; inert until Phase 4 (no endpoint
 * references it yet). If the reviewer model changes during legal review, that is
 * an isolated ALTER on an unused table.
 *
 *   target_user_id = NULL  → grant covers every employee in the organization
 *   target_user_id set     → grant is scoped to that one employee
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("monitoring_content_grants", {
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

      grantee_user_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      granted_by_user_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      // NULL = all employees in the organization.
      target_user_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      expires_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      revoked_at: {
        type: Sequelize.DATE,
        allowNull: true,
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

    await queryInterface.addIndex("monitoring_content_grants", {
      fields: ["organization_id", "grantee_user_id", "expires_at"],
      name: "ix_monitoring_content_grants_org_grantee_expires",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("monitoring_content_grants");
  },
};
