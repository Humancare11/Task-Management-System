const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

/**
 * Durable debounce for the derivation engine. One row per (agent_id,
 * local_date); repeated enqueues coalesce and push not_before forward.
 *
 * SINGLE-INSTANCE ASSUMPTION — see the migration header. The Phase 2 runner
 * claims rows with a plain UPDATE; multi-instance would need
 * SELECT ... FOR UPDATE SKIP LOCKED.
 */
const MonitoringRecomputeQueue = sequelize.define(
  "MonitoringRecomputeQueue",
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },

    agent_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    local_date: { type: DataTypes.DATEONLY, allowNull: false },

    not_before: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    status: {
      type: DataTypes.ENUM("pending", "running", "done", "error"),
      allowNull: false,
      defaultValue: "pending",
    },
    attempts: { type: DataTypes.SMALLINT.UNSIGNED, allowNull: false, defaultValue: 0 },
    last_error: { type: DataTypes.TEXT, allowNull: true },

    enqueued_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    tableName: "monitoring_recompute_queue",
    timestamps: true,
    createdAt: "enqueued_at",
    updatedAt: "updated_at",
  }
);

module.exports = MonitoringRecomputeQueue;
