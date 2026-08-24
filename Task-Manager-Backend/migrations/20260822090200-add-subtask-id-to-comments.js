"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("comments", "subtask_id", {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: "subtasks", key: "id" },
      onDelete: "CASCADE",
    });

    await queryInterface.addIndex("comments", ["subtask_id"]);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("comments", ["subtask_id"]);
    await queryInterface.removeColumn("comments", "subtask_id");
  },
};
