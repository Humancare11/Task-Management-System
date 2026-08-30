"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("activities", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER.UNSIGNED,
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
        // SET NULL, not CASCADE: keep the audit row when its project is deleted.
        onDelete: "SET NULL",
      },

      task_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        references: {
          model: "tasks",
          key: "id",
        },
        onUpdate: "CASCADE",
        // SET NULL, not CASCADE: keep the audit row when its task is deleted.
        onDelete: "SET NULL",
      },

      user_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      entity_type: {
        type: Sequelize.ENUM(
          "project",
          "task",
          "subtask",
          "comment",
          "attachment",
          "member",
          "invitation"
        ),
        allowNull: false,
      },

      entity_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
      },

      action: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },

      description: {
        type: Sequelize.STRING(500),
        allowNull: false,
      },

      metadata: {
        type: Sequelize.JSON,
        allowNull: true,
      },

      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },

      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
    });

    await queryInterface.addIndex("activities", ["organization_id"]);
    await queryInterface.addIndex("activities", ["project_id"]);
    await queryInterface.addIndex("activities", ["task_id"]);
    await queryInterface.addIndex("activities", ["user_id"]);
    await queryInterface.addIndex("activities", ["entity_type"]);
    await queryInterface.addIndex("activities", ["entity_id"]);
    await queryInterface.addIndex("activities", ["action"]);
    await queryInterface.addIndex("activities", ["created_at"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("activities");
  },
};