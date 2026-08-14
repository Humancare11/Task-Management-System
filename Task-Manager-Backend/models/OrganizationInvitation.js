const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const OrganizationInvitation = sequelize.define(
  "OrganizationInvitation",
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

    email: {
      type: DataTypes.STRING(190),
      allowNull: false,
      validate: {
        isEmail: true,
      },
    },

    role: {
      type: DataTypes.ENUM(
        "admin",
        "manager",
        "member",
        "client"
      ),
      allowNull: false,
      defaultValue: "member",
    },

    token: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },

    invited_by: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },

    status: {
      type: DataTypes.ENUM(
        "pending",
        "accepted",
        "expired",
        "cancelled"
      ),
      allowNull: false,
      defaultValue: "pending",
    },

    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },

    accepted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "organization_invitations",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

module.exports = OrganizationInvitation;