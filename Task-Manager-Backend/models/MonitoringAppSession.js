const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

/**
 * Derived application focus session. One row per continuous foreground span of
 * an application within a device-day. Rewritten on every recompute.
 */
const MonitoringAppSession = sequelize.define(
  "MonitoringAppSession",
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },

    pc_session_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },

    application_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: "Unknown",
    },

    started_at: { type: DataTypes.DATE(3), allowNull: false },
    ended_at: { type: DataTypes.DATE(3), allowNull: false },
    duration_seconds: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    active_seconds: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
  },
  {
    tableName: "monitoring_app_sessions",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false,
  }
);

module.exports = MonitoringAppSession;
