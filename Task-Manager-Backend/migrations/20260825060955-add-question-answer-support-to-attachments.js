"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Allow attachments that don't belong to a task
    await queryInterface.changeColumn("attachments", "task_id", {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: "tasks",
        key: "id",
      },
      onDelete: "CASCADE",
    });

    // Question attachment
    await queryInterface.addColumn("attachments", "question_id", {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: "questions",
        key: "id",
      },
      onDelete: "CASCADE",
    });

    // Answer attachment
    await queryInterface.addColumn("attachments", "question_answer_id", {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: "question_answers",
        key: "id",
      },
      onDelete: "CASCADE",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn(
      "attachments",
      "question_answer_id"
    );

    await queryInterface.removeColumn(
      "attachments",
      "question_id"
    );

    await queryInterface.changeColumn("attachments", "task_id", {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: "tasks",
        key: "id",
      },
      onDelete: "CASCADE",
    });
  },
};