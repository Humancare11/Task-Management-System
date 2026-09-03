const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

/**
 * Audit trail of every read of captured content (§5b-5). Written BEFORE the
 * content response is returned. viewer_user_id / target_user_id are ON DELETE
 * SET NULL so the audit row survives user deletion. Inert until Phase 4.
 */
const MonitoringContentAccessLog = sequelize.define(
  "MonitoringContentAccessLog",
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },

    organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    viewer_user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    target_user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },

    date_from: { type: DataTypes.DATEONLY, allowNull: false },
    date_to: { type: DataTypes.DATEONLY, allowNull: false },
    row_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    ip: { type: DataTypes.STRING(45), allowNull: true },

    accessed_at: {
      type: DataTypes.DATE(3),
      allowNull: false,
      defaultValue: sequelize.literal("CURRENT_TIMESTAMP(3)"),
    },
  },
  {
    tableName: "monitoring_content_access_logs",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false,
  }
);

module.exports = MonitoringContentAccessLog;
