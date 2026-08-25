const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const Question = sequelize.define(
    "Question",
    {
        id: {
            type: DataTypes.INTEGER.UNSIGNED,
            primaryKey: true,
            autoIncrement: true,
        },

        organization_id: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: false,
        },

        project_id: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: true,
        },

        created_by: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: false,
        },

        assigned_to: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: true,
        },

        title: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },

        description: {
            type: DataTypes.TEXT,
            allowNull: false,
        },

        category: {
            type: DataTypes.ENUM(
                "technical",
                "bug",
                "task_related",
                "project",
                "account",
                "general",
                "other"
            ),
            allowNull: false,
            defaultValue: "general",
        },

        priority: {
            type: DataTypes.ENUM(
                "low",
                "medium",
                "high",
                "urgent"
            ),
            allowNull: false,
            defaultValue: "medium",
        },

        visibility: {
            type: DataTypes.ENUM(
                "organization",
                "project",
                "private"
            ),
            allowNull: false,
            defaultValue: "organization",
        },

        status: {
            type: DataTypes.ENUM(
                "open",
                "in_progress",
                "resolved",
                "closed"
            ),
            allowNull: false,
            defaultValue: "open",
        },

        resolved_by: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: true,
        },

        resolved_at: {
            type: DataTypes.DATE,
            allowNull: true,
        },
    },
    {
        tableName: "questions",
        timestamps: true,
        createdAt: "created_at",
        updatedAt: "updated_at",
    }
);

module.exports = Question;