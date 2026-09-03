const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

/**
 * Time-boxed named grant allowing a non-owner to review captured content
 * (§5b-5). Content viewing is owner-only by default; a grant is the only other
 * path, every read is audited, and every read re-checks expires_at / revoked_at.
 * target_user_id NULL = all employees in the org. Inert until Phase 4.
 */
const MonitoringContentGrant = sequelize.define(
  "MonitoringContentGrant",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },

    organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    grantee_user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    granted_by_user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    target_user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },

    expires_at: { type: DataTypes.DATE, allowNull: false },
    revoked_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    tableName: "monitoring_content_grants",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

module.exports = MonitoringContentGrant;
