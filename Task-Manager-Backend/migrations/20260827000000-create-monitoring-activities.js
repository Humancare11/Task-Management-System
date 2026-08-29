"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("monitoring_activities", {
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

      agent_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
          model: "monitoring_agents",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
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

      activity_type: {
        type: Sequelize.ENUM("application", "website", "idle"),
        allowNull: false,
      },

      application_name: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },

      window_title: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },

      domain: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },

      started_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },

      ended_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },

      duration_seconds: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
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

    await queryInterface.addIndex("monitoring_activities", ["organization_id"]);
    await queryInterface.addIndex("monitoring_activities", ["agent_id"]);
    await queryInterface.addIndex("monitoring_activities", ["user_id"]);
    await queryInterface.addIndex("monitoring_activities", ["activity_type"]);
    await queryInterface.addIndex("monitoring_activities", ["started_at"]);
    await queryInterface.addIndex("monitoring_activities", ["ended_at"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("monitoring_activities");
  },
};
