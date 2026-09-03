const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

/**
 * Derived website session. One row per continuous span on a single domain while
 * a supported browser is focused. domain = NULL means unknown or private
 * (is_private = true → "Private Browsing"). Rewritten on every recompute.
 */
const MonitoringWebSession = sequelize.define(
  "MonitoringWebSession",
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },

    pc_session_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },

    browser: { type: DataTypes.STRING(50), allowNull: false },
    domain: { type: DataTypes.STRING(255), allowNull: true },
    is_private: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },

    started_at: { type: DataTypes.DATE(3), allowNull: false },
    ended_at: { type: DataTypes.DATE(3), allowNull: false },
    duration_seconds: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    active_seconds: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
  },
  {
    tableName: "monitoring_web_sessions",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false,
  }
);

module.exports = MonitoringWebSession;
