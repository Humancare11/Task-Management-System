const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

/**
 * Append-only raw event from the desktop agent — the single source of truth for
 * the monitoring system. Do NOT update or delete rows in application code.
 *
 * payload shape by `type`:
 *   agent_start    { agent_version, os, os_boot_time, run_id }
 *   heartbeat      {}
 *   agent_stop     { reason: "tray_exit" | "quit" }
 *   session_end    { signal: "windows_session_end" }
 *   input_state    { state: "active" | "idle", last_input_at }
 *   screen_state   { state: "on" | "off", reason: "display_off" | "locked" | "sleep" }
 *   app_focus      { application_name, window_title }
 *   browser_state  { browser, domain | null, is_private }
 *
 * Content capture (search terms / prompts) never lands here — it has its own
 * encrypted table, monitoring_content_events.
 */
const MonitoringEvent = sequelize.define(
  "MonitoringEvent",
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },

    organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    agent_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },

    type: { type: DataTypes.STRING(40), allowNull: false },
    payload: { type: DataTypes.JSON, allowNull: true },

    occurred_at: { type: DataTypes.DATE(3), allowNull: false },
    monotonic_ms: { type: DataTypes.DOUBLE, allowNull: true },
    run_id: { type: DataTypes.CHAR(36), allowNull: false },
    os_boot_time: { type: DataTypes.BIGINT, allowNull: true },

    client_event_id: { type: DataTypes.CHAR(36), allowNull: false },
    client_seq: { type: DataTypes.BIGINT, allowNull: true },

    local_date: { type: DataTypes.DATEONLY, allowNull: false },
    received_at: {
      type: DataTypes.DATE(3),
      allowNull: false,
      defaultValue: sequelize.literal("CURRENT_TIMESTAMP(3)"),
    },
    clock_suspect: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    tableName: "monitoring_events",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false,
  }
);

module.exports = MonitoringEvent;
