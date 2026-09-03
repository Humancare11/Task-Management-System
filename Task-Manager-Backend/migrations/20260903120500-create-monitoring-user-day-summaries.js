"use strict";

/**
 * monitoring_user_day_summaries — DERIVED, one row per (user_id, local_date).
 * This is what the dashboard cards read.
 *
 * Multi-device merge rule (a user working on two machines the same day):
 * everything is a WALL-CLOCK UNION across that user's device-days, never a sum.
 *
 *   span_seconds     = max(final_pc_off) - min(first_pc_on)      "Total Session"
 *   covered_seconds  = union of every device's PC session        (>= 1 device on)
 *   gap_seconds      = span_seconds - covered_seconds            (no device on)
 *
 *   active/idle/screen_off/untracked  = cross-device union with precedence
 *     active > idle > screen_off > untracked, and:
 *       active + idle + screen_off + untracked == covered_seconds   (±rounding)
 *
 *   overlap_seconds  = Σ(device total_seconds) - covered_seconds
 *                      > 0  ⇒  the user was on two machines at once
 *
 * top_apps / top_domains are summed across devices and NOT clamped — on
 * concurrent use they can exceed covered_seconds; the UI shows a footnote only
 * when overlap_seconds > 0.
 *
 * Single-device day: gap_seconds = 0, overlap_seconds = 0, covered = span, and
 * this collapses to the plain 4-way invariant.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("monitoring_user_day_summaries", {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },

      organization_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: "organizations", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      user_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },

      local_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },

      device_count: {
        type: Sequelize.SMALLINT.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      multi_device: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      first_pc_on: {
        type: Sequelize.DATE(3),
        allowNull: false,
      },
      final_pc_off: {
        type: Sequelize.DATE(3),
        allowNull: false,
      },

      // "Total Session" headline (min first_pc_on -> max final_pc_off).
      span_seconds: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      // Wall-clock union of device PC sessions.
      covered_seconds: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      // span - covered: time no monitored device was on.
      gap_seconds: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },

      active_seconds: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      idle_seconds: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      screen_off_seconds: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      // Instants where EVERY on-device was untracked.
      untracked_seconds: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },

      // Σ(device total_seconds) - covered_seconds. > 0 ⇒ concurrent device use.
      overlap_seconds: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },

      idle_period_count: {
        type: Sequelize.SMALLINT.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      screen_off_period_count: {
        type: Sequelize.SMALLINT.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },

      unclean_shutdown: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      is_provisional: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      // [{ name, seconds, sessions }] — summed across devices, not clamped.
      top_apps: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      // [{ domain, seconds, sessions, is_private }] — summed, not clamped.
      top_domains: {
        type: Sequelize.JSON,
        allowNull: true,
      },

      // covered_seconds - (active + idle + screen_off + untracked). Expected ~0.
      reconciliation_delta_seconds: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },

      recomputed_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
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

    await queryInterface.addIndex("monitoring_user_day_summaries", {
      fields: ["user_id", "local_date"],
      unique: true,
      name: "ux_monitoring_user_day_summaries_user_date",
    });
    await queryInterface.addIndex("monitoring_user_day_summaries", {
      fields: ["organization_id", "local_date"],
      name: "ix_monitoring_user_day_summaries_org_date",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("monitoring_user_day_summaries");
  },
};
