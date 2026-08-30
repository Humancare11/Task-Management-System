"use strict";

/**
 * The original `activities` table created project_id / task_id foreign keys with
 * ON DELETE CASCADE. That silently wipes the entire activity history for a
 * project (and every task/subtask/comment/attachment/member activity under it)
 * the moment the project is deleted — and likewise for a deleted task.
 *
 * The controllers already treat these columns as "best effort context" (the
 * delete-activity rows are written with project_id/task_id = null and the real
 * ids preserved in entity_id / metadata), so the correct behaviour is
 * ON DELETE SET NULL: keep the audit row, just drop the dangling reference.
 *
 * organization_id / user_id keep their CASCADE behaviour (deleting the org or
 * the actor legitimately removes their activity rows).
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP FOREIGN KEY `activities_ibfk_2`"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP FOREIGN KEY `activities_ibfk_3`"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD CONSTRAINT `activities_ibfk_2` " +
        "FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) " +
        "ON UPDATE CASCADE ON DELETE SET NULL"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD CONSTRAINT `activities_ibfk_3` " +
        "FOREIGN KEY (`task_id`) REFERENCES `tasks` (`id`) " +
        "ON UPDATE CASCADE ON DELETE SET NULL"
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP FOREIGN KEY `activities_ibfk_2`"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` DROP FOREIGN KEY `activities_ibfk_3`"
    );

    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD CONSTRAINT `activities_ibfk_2` " +
        "FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) " +
        "ON UPDATE CASCADE ON DELETE CASCADE"
    );
    await queryInterface.sequelize.query(
      "ALTER TABLE `activities` ADD CONSTRAINT `activities_ibfk_3` " +
        "FOREIGN KEY (`task_id`) REFERENCES `tasks` (`id`) " +
        "ON UPDATE CASCADE ON DELETE CASCADE"
    );
  },
};
