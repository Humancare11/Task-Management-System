const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");


const MonitoringEnrollment = sequelize.define(
    "MonitoringEnrollment",
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

        token_hash: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },

        expires_at: {
            type: DataTypes.DATE,
            allowNull: false,
        },

        used_at: {
            type: DataTypes.DATE,
            allowNull: true,
        },

        created_by: {
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
        tableName: "monitoring_enrollments",
        timestamps: true,
        createdAt: "created_at",
        updatedAt: "updated_at",
    },
);

module.exports = MonitoringEnrollment;