const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

/**
 * Employee acknowledgment of §5b in-app content capture. SCHEMA ONLY in Phase 0
 * — the consent flow is deferred pending legal review and nothing reads/writes
 * this table yet.
 */
const MonitoringConsent = sequelize.define(
  "MonitoringConsent",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },

    organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },

    document_version: { type: DataTypes.STRING(32), allowNull: false },
    accepted_at: { type: DataTypes.DATE, allowNull: false },
    method: { type: DataTypes.STRING(20), allowNull: false },
    ip: { type: DataTypes.STRING(45), allowNull: true },
  },
  {
    tableName: "monitoring_consents",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false,
  }
);

module.exports = MonitoringConsent;
