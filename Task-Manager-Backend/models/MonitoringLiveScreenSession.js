const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

/**
 * One Live Screen viewing session — METADATA ONLY. No media, no frames, no
 * thumbnails are ever stored here or anywhere else; the video is peer-to-peer
 * WebRTC and exists only for the life of the session.
 *
 * status:
 *   requested   viewer asked; agent has not answered yet
 *   connecting  agent is capturing / SDP exchange in progress
 *   live        peer connection established, viewer is seeing the screen
 *   ended       finished normally
 *   error       finished on an error
 *
 * end_reason (set when status is ended/error):
 *   stopped_by_viewer | stopped_by_employee | viewer_disconnected |
 *   agent_unavailable | consent_missing | not_authorized | not_enabled |
 *   timeout | max_duration | error
 */
const MonitoringLiveScreenSession = sequelize.define(
  "MonitoringLiveScreenSession",
  {
    id: {
      type: DataTypes.CHAR(36),
      primaryKey: true,
    },

    organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    viewer_user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    target_user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
    agent_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },

    status: {
      type: DataTypes.ENUM("requested", "connecting", "live", "ended", "error"),
      allowNull: false,
      defaultValue: "requested",
    },
    end_reason: { type: DataTypes.STRING(40), allowNull: true },

    access_via: { type: DataTypes.ENUM("owner", "grant"), allowNull: true },
    viewer_ip: { type: DataTypes.STRING(45), allowNull: true },

    requested_at: {
      type: DataTypes.DATE(3),
      allowNull: false,
      defaultValue: sequelize.literal("CURRENT_TIMESTAMP(3)"),
    },
    connected_at: { type: DataTypes.DATE(3), allowNull: true },
    ended_at: { type: DataTypes.DATE(3), allowNull: true },
  },
  {
    tableName: "monitoring_live_screen_sessions",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

module.exports = MonitoringLiveScreenSession;
