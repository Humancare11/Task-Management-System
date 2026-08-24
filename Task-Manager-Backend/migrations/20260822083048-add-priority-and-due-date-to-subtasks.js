"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add priority column
    await queryInterface.addColumn("subtasks", "priority", {
      type: Sequelize.ENUM("low", "medium", "high", "urgent"),
      allowNull: false,
      defaultValue: "medium",
    });

    // Add due date column
    await queryInterface.addColumn("subtasks", "due_date", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    // Recreate status ENUM to include "review"
    await queryInterface.changeColumn("subtasks", "status", {
      type: Sequelize.ENUM(
        "todo",
        "in_progress",
        "review",
        "completed"
      ),
      allowNull: false,
      defaultValue: "todo",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("subtasks", "priority");

    await queryInterface.removeColumn("subtasks", "due_date");

    await queryInterface.changeColumn("subtasks", "status", {
      type: Sequelize.ENUM(
        "todo",
        "in_progress",
        "completed"
      ),
      allowNull: false,
      defaultValue: "todo",
    });
  },
};