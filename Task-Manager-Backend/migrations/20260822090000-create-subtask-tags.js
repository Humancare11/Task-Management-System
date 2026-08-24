"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("subtask_tags", {
      subtask_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: "subtasks", key: "id" },
        onDelete: "CASCADE",
      },
      tag_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: "tags", key: "id" },
        onDelete: "CASCADE",
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
    await queryInterface.dropTable("subtask_tags");
  },
};
