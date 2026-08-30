"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("monitoring_agents", {
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

      agent_uuid: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        unique: true,
      },

      device_name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },

      platform: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },

      agent_version: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },

      status: {
        type: Sequelize.ENUM("active", "revoked"),
        allowNull: false,
        defaultValue: "active",
      },

      last_seen_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      enrolled_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
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

    await queryInterface.addIndex("monitoring_agents", ["organization_id"]);
    await queryInterface.addIndex("monitoring_agents", ["user_id"]);
    await queryInterface.addIndex("monitoring_agents", ["status"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("monitoring_agents");
  },
};
