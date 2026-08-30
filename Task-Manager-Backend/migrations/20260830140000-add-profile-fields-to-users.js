"use strict";

/**
 * Adds self-service profile fields to `users` for the Profile settings page.
 * All nullable, no defaults — existing rows are unaffected.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("users", "job_title", {
      type: Sequelize.STRING(150),
      allowNull: true,
    });

    await queryInterface.addColumn("users", "department", {
      type: Sequelize.STRING(150),
      allowNull: true,
    });

    await queryInterface.addColumn("users", "bio", {
      type: Sequelize.STRING(1000),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("users", "bio");
    await queryInterface.removeColumn("users", "department");
    await queryInterface.removeColumn("users", "job_title");
  },
};
