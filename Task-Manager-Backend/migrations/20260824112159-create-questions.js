"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("questions", {
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

      project_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        references: {
          model: "projects",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },

      created_by: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },

      assigned_to: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },

      title: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },

      description: {
        type: Sequelize.TEXT,
        allowNull: false,
      },

      category: {
        type: Sequelize.ENUM(
          "technical",
          "bug",
          "task_related",
          "project",
          "account",
          "general",
          "other"
        ),
        allowNull: false,
        defaultValue: "general",
      },

      priority: {
        type: Sequelize.ENUM(
          "low",
          "medium",
          "high",
          "urgent"
        ),
        allowNull: false,
        defaultValue: "medium",
      },

      visibility: {
        type: Sequelize.ENUM(
          "organization",
          "project",
          "private"
        ),
        allowNull: false,
        defaultValue: "organization",
      },

      status: {
        type: Sequelize.ENUM(
          "open",
          "in_progress",
          "resolved",
          "closed"
        ),
        allowNull: false,
        defaultValue: "open",
      },

      resolved_by: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },

      resolved_at: {
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

    await queryInterface.addIndex("questions", ["organization_id"]);
    await queryInterface.addIndex("questions", ["project_id"]);
    await queryInterface.addIndex("questions", ["created_by"]);
    await queryInterface.addIndex("questions", ["assigned_to"]);
    await queryInterface.addIndex("questions", ["status"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("questions");
  },
};