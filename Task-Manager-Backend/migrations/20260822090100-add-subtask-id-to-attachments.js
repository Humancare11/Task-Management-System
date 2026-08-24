"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("attachments", "subtask_id", {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: "subtasks", key: "id" },
      onDelete: "CASCADE",
    });

    await queryInterface.addIndex("attachments", ["subtask_id"]);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("attachments", ["subtask_id"]);
    await queryInterface.removeColumn("attachments", "subtask_id");
  },
};
