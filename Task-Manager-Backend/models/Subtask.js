const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const Subtask = sequelize.define(
  "Subtask",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },

    task_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },

    organization_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },

    title: {
      type: DataTypes.STRING(255),
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
        "completed"
      ),
      allowNull: false,
      defaultValue: "todo",
    },

    assigned_to: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },

    created_by: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },
  },
  {
    tableName: "subtasks",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

module.exports = Subtask;
