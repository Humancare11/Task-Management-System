"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("attachments", "comment_id", {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: "comments",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });

    await queryInterface.addIndex("attachments", ["comment_id"]);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("attachments", ["comment_id"]);
    await queryInterface.removeColumn("attachments", "comment_id");
  },
};