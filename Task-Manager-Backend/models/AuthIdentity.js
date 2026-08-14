const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const AuthIdentity = sequelize.define(
  "AuthIdentity",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },

    user_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },

    provider: {
      type: DataTypes.ENUM("local", "google"),
      allowNull: false,
    },

    provider_user_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    password_hash: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
  },
  {
    tableName: "auth_identities",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

module.exports = AuthIdentity;