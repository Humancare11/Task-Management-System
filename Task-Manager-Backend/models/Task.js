const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const Task = sequelize.define(
  "Task",
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
      allowNull: false,
    },

    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },

    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    status: {
      type: DataTypes.ENUM(
        "todo",
        "in_progress",
        "review",
        "completed"
      ),
      allowNull: false,
      defaultValue: "todo",
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

    assigned_to: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },

    created_by: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },

    due_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "tasks",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

module.exports = Task;