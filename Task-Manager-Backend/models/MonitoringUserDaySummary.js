const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

/**
 * Derived per-user-per-day summary — what the dashboard cards read. Built by a
 * wall-clock UNION merge across the user's device-days (never a sum).
 *
 *   span_seconds    = max(final_pc_off) - min(first_pc_on)   ("Total Session")
 *   covered_seconds = union of device PC sessions
 *   gap_seconds     = span_seconds - covered_seconds
 *   active + idle + screen_off + untracked == covered_seconds  (±rounding)
 *   overlap_seconds = Σ(device total_seconds) - covered_seconds  (>0 ⇒ concurrent)
 *
 * top_apps / top_domains are summed across devices and NOT clamped.
 */
const MonitoringUserDaySummary = sequelize.define(
  "MonitoringUserDaySummary",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },

    organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    local_date: { type: DataTypes.DATEONLY, allowNull: false },

    device_count: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: false, defaultValue: 0 },
    multi_device: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },

    first_pc_on: { type: DataTypes.DATE(3), allowNull: false },
    final_pc_off: { type: DataTypes.DATE(3), allowNull: false },

    span_seconds: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    covered_seconds: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    gap_seconds: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },

    active_seconds: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    idle_seconds: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    screen_off_seconds: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    untracked_seconds: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },

    overlap_seconds: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },

    idle_period_count: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: false, defaultValue: 0 },
    screen_off_period_count: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: false, defaultValue: 0 },

    unclean_shutdown: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    is_provisional: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },

    top_apps: { type: DataTypes.JSON, allowNull: true },
    top_domains: { type: DataTypes.JSON, allowNull: true },

    reconciliation_delta_seconds: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },

    recomputed_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    tableName: "monitoring_user_day_summaries",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

module.exports = MonitoringUserDaySummary;
