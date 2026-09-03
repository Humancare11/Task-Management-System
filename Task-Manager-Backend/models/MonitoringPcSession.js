const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

/**
 * Derived daily PC session — one row per (agent_id, local_date). Rewritten by
 * the derivation engine on every recompute.
 *
 * Per-device invariant:
 *   active_seconds + idle_seconds + screen_off_seconds + untracked_seconds
 *     == total_seconds   (±1s per interval boundary; residual in
 *                         reconciliation_delta_seconds)
 */
const MonitoringPcSession = sequelize.define(
  "MonitoringPcSession",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },

    organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    agent_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },

    local_date: { type: DataTypes.DATEONLY, allowNull: false },

    first_pc_on: { type: DataTypes.DATE(3), allowNull: false },
    final_pc_off: { type: DataTypes.DATE(3), allowNull: false },

    total_seconds: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    active_seconds: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    idle_seconds: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    screen_off_seconds: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
    untracked_seconds: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },

    idle_period_count: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: false, defaultValue: 0 },
    screen_off_period_count: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: false, defaultValue: 0 },

    unclean_shutdown: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    is_provisional: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },

    reconciliation_delta_seconds: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    source_event_count: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },

    recomputed_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    tableName: "monitoring_pc_sessions",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

module.exports = MonitoringPcSession;
