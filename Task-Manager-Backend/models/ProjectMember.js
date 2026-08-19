const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const ProjectMember = sequelize.define(
  "ProjectMember",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },

    project_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },

    user_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },

    role: {
      type: DataTypes.ENUM("manager", "member", "viewer"),
      allowNull: false,
      defaultValue: "member",
    },

    joined_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "project_members",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

module.exports = ProjectMember;