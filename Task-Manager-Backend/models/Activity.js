const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const Activity = sequelize.define(
  "Activity",
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

    project_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },

    task_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },

    user_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },

    entity_type: {
      type: DataTypes.ENUM(
        "project",
        "task",
        "subtask",
        "comment",
        "attachment",
        "member",
        "invitation"
      ),
      allowNull: false,
    },

    entity_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },

    action: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },

    description: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },

    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    tableName: "activities",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

module.exports = Activity;