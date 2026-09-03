const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

/**
 * Derived, contiguous, non-overlapping classified partition of a device-day.
 * Also the data source for the timeline view. Rewritten on every recompute.
 */
const MonitoringInterval = sequelize.define(
  "MonitoringInterval",
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },

    pc_session_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },

    type: {
      type: DataTypes.ENUM("active", "idle", "screen_off", "untracked"),
      allowNull: false,
    },
    screen_off_reason: {
      type: DataTypes.ENUM("display_off", "locked", "sleep", "reboot"),
      allowNull: true,
    },
    reasons: { type: DataTypes.JSON, allowNull: true },

    started_at: { type: DataTypes.DATE(3), allowNull: false },
    ended_at: { type: DataTypes.DATE(3), allowNull: false },
    duration_seconds: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
  },
  {
    tableName: "monitoring_intervals",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false,
  }
);

module.exports = MonitoringInterval;
