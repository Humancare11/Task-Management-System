"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("organization_invitations", {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },

      organization_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
          model: "organizations",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      email: {
        type: Sequelize.STRING(190),
        allowNull: false,
      },

      role: {
        type: Sequelize.ENUM(
          "admin",
          "manager",
          "member",
          "client"
        ),
        allowNull: false,
        defaultValue: "member",
      },

      token: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true,
      },

      invited_by: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },

      status: {
        type: Sequelize.ENUM(
          "pending",
          "accepted",
          "expired",
          "cancelled"
        ),
        allowNull: false,
        defaultValue: "pending",
      },

      expires_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },

      accepted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },

      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("organization_invitations");
  },
};