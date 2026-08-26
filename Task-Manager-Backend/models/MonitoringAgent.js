const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");


const MonitoringAgent = sequelize.define(
    "MonitoringAgent",
    {
        id: {
            type: DataTypes.INTEGER.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },

        organization_id: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: false,
        },

        user_id: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: false,
        },

        agent_uuid: {
            type: DataTypes.CHAR(36),
            allowNull: false,
            unique: true,
        },

        device_name: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },

        platform: {
            type: DataTypes.STRING(50),
            allowNull: false,
        },

        agent_version: {
            type: DataTypes.STRING(50),
            allowNull: true,
        },

        status: {
            type: DataTypes.ENUM("active", "revoked"),
            allowNull: false,
            defaultValue: "active",
        },

        agent_secret_hash: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },

        last_seen_at: {
            type: DataTypes.DATE,
            allowNull: true,
        },

        enrolled_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
        },

        created_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
        },

        updated_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
        },
    },
    {
        tableName: "monitoring_agents",
        timestamps: true,
        createdAt: "created_at",
        updatedAt: "updated_at",
    },
);

module.exports = MonitoringAgent;