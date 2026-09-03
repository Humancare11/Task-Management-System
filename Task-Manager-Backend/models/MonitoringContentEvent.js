const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

/**
 * §5b captured search terms / AI prompts. Stored separately from every other
 * monitoring table and extra-encrypted (AES-256-GCM, versioned keys — see
 * utils/contentCrypto.js). No plaintext column. Inert until Phase 4.
 *
 * Retention: a daily job hard-deletes rows past expires_at.
 */
const MonitoringContentEvent = sequelize.define(
  "MonitoringContentEvent",
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },

    organization_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
    agent_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },

    app: { type: DataTypes.STRING(100), allowNull: false },
    kind: { type: DataTypes.ENUM("search", "prompt"), allowNull: false },
    domain: { type: DataTypes.STRING(255), allowNull: true },

    ciphertext: { type: DataTypes.BLOB, allowNull: false },
    iv: { type: DataTypes.BLOB("tiny"), allowNull: false },
    auth_tag: { type: DataTypes.BLOB("tiny"), allowNull: false },
    key_version: { type: DataTypes.STRING(16), allowNull: false },

    source: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "uia" },

    captured_at: { type: DataTypes.DATE(3), allowNull: false },
    expires_at: { type: DataTypes.DATE, allowNull: false },
  },
  {
    tableName: "monitoring_content_events",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false,
  }
);

module.exports = MonitoringContentEvent;
