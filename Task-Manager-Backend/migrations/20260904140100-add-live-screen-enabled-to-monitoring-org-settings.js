"use strict";

/**
 * Per-org switch for the Live Screen feature. Additive, defaults false — no
 * behaviour change on deploy. Live screen also requires the hard legal gate
 * (config/liveScreenGate.js) and per-employee consent.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("monitoring_org_settings", "live_screen_enabled", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("monitoring_org_settings", "live_screen_enabled");
  },
};
