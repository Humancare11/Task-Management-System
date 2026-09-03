"use strict";

/**
 * Additive columns on monitoring_agents for the events pipeline. Purely
 * additive — no existing column, index, or behaviour changes.
 *
 *   last_heartbeat_at   updated by the heartbeat handler; kept DISTINCT from the
 *                       existing last_seen_at so nothing that reads last_seen_at
 *                       today is affected
 *   current_run_id      the agent's current process-run UUID
 *   last_os_boot_time   epoch ms of the agent host's last OS boot
 *   content_consent_at  mirror of the latest monitoring_consents.accepted_at for
 *                       quick checks (still NULL everywhere until Phase 4)
 *
 * NOTE: `agent_version` already exists (migration 20260826000000) and is left
 * untouched here.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("monitoring_agents", "last_heartbeat_at", {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn("monitoring_agents", "current_run_id", {
      type: Sequelize.CHAR(36),
      allowNull: true,
    });
    await queryInterface.addColumn("monitoring_agents", "last_os_boot_time", {
      type: Sequelize.BIGINT,
      allowNull: true,
    });
    await queryInterface.addColumn("monitoring_agents", "content_consent_at", {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("monitoring_agents", "content_consent_at");
    await queryInterface.removeColumn("monitoring_agents", "last_os_boot_time");
    await queryInterface.removeColumn("monitoring_agents", "current_run_id");
    await queryInterface.removeColumn("monitoring_agents", "last_heartbeat_at");
  },
};
