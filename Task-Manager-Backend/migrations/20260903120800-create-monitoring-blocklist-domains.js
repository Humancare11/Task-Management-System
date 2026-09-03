"use strict";

/**
 * monitoring_blocklist_domains — domains from which in-app content (search terms
 * / prompts) is NEVER captured (§5b-1), regardless of consent or org settings.
 *
 * `pattern` matching semantics (implemented in Phase 4, agent + server):
 *   - "example.com"   → that registrable domain and any subdomain
 *   - "*.example.com" → any subdomain of example.com (and example.com itself)
 *   - "*.gov"         → any host under the .gov TLD (TLD-level wildcard)
 *
 * A hard-coded constant list is the always-on fallback if this table is empty or
 * unreachable. Password / masked fields are blocked separately at the agent and
 * are not represented here.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("monitoring_blocklist_domains", {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },

      pattern: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },

      category: {
        type: Sequelize.ENUM("banking", "payment", "health", "government"),
        allowNull: false,
      },

      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },

      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    await queryInterface.addIndex("monitoring_blocklist_domains", {
      fields: ["pattern"],
      unique: true,
      name: "ux_monitoring_blocklist_domains_pattern",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("monitoring_blocklist_domains");
  },
};
