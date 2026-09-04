const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

/**
 * Per-organization monitoring configuration. content_capture_enabled is only
 * one of three conditions for §5b capture (also: global legal gate + configured
 * key registry). content_retention_days is clamped to [30, 90] in app code.
 */
const MonitoringOrgSetting = sequelize.define(
  "MonitoringOrgSetting",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },

    organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },

    content_capture_enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    content_retention_days: {
      type: DataTypes.SMALLINT.UNSIGNED,
      allowNull: false,
      defaultValue: 30,
    },
    live_screen_enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    tableName: "monitoring_org_settings",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

module.exports = MonitoringOrgSetting;
