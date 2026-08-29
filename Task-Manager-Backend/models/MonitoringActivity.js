const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");


const MonitoringActivity = sequelize.define(
    "MonitoringActivity",
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

        agent_id: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: false,
        },

        user_id: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: false,
        },

        activity_type: {
            type: DataTypes.ENUM("application", "website", "idle"),
            allowNull: false,
        },

        application_name: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },

        window_title: {
            type: DataTypes.STRING(500),
            allowNull: true,
        },

        domain: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },

        started_at: {
            type: DataTypes.DATE,
            allowNull: false,
        },

        ended_at: {
            type: DataTypes.DATE,
            allowNull: false,
        },

        duration_seconds: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: false,
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
        tableName: "monitoring_activities",
        timestamps: true,
        createdAt: "created_at",
        updatedAt: "updated_at",
    },
);

module.exports = MonitoringActivity;
