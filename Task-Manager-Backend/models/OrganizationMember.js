const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const OrganizationMember = sequelize.define(
  "OrganizationMember",
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

    user_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },

    role: {
      type: DataTypes.ENUM(
        "owner",
        "admin",
        "manager",
        "member",
        "client"
      ),
      allowNull: false,
      defaultValue: "member",
    },

    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },

    joined_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "organization_members",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

module.exports = OrganizationMember;