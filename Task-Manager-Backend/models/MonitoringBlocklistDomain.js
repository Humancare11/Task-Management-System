const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

/**
 * Domains from which in-app content is NEVER captured (§5b-1). See the migration
 * header for `pattern` matching semantics. A hard-coded constant list is the
 * always-on fallback.
 */
const MonitoringBlocklistDomain = sequelize.define(
  "MonitoringBlocklistDomain",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },

    pattern: { type: DataTypes.STRING(255), allowNull: false },
    category: {
      type: DataTypes.ENUM("banking", "payment", "health", "government"),
      allowNull: false,
    },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  {
    tableName: "monitoring_blocklist_domains",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

module.exports = MonitoringBlocklistDomain;
