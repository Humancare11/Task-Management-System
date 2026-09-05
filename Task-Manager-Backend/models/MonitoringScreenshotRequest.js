const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

/**
 * One Screenshot capture request — METADATA ONLY. There is no column here for
 * image bytes, a file path, or a URL, and none is ever added: the captured
 * PNG lives only in server RAM for the few hundred milliseconds it takes to
 * relay it to the requesting viewer's browser, then it is discarded. This
 * table exists purely for the same audit trail Live Screen already has (who
 * requested a look at whose screen, when, and whether it succeeded).
 *
 * A separate feature from Live Screen (monitoring_live_screen_sessions): a
 * single request/response, not a connection with a duration.
 */
const MonitoringScreenshotRequest = sequelize.define(
  "MonitoringScreenshotRequest",
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
      type: DataTypes.ENUM("requested", "delivered", "denied", "expired", "error"),
      allowNull: false,
      defaultValue: "requested",
    },
    error_reason: { type: DataTypes.STRING(40), allowNull: true },
    access_via: { type: DataTypes.ENUM("owner", "grant"), allowNull: true },
    viewer_ip: { type: DataTypes.STRING(45), allowNull: true },

    requested_at: {
      type: DataTypes.DATE(3),
      allowNull: false,
      defaultValue: sequelize.literal("CURRENT_TIMESTAMP(3)"),
    },
    delivered_at: { type: DataTypes.DATE(3), allowNull: true },
  },
  {
    tableName: "monitoring_screenshot_requests",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

module.exports = MonitoringScreenshotRequest;
