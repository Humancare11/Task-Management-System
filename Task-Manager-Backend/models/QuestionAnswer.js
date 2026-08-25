const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const QuestionAnswer = sequelize.define(
    "QuestionAnswer",
    {
        id: {
            type: DataTypes.INTEGER.UNSIGNED,
            primaryKey: true,
            autoIncrement: true,
        },

        question_id: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: false,
        },

        organization_id: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: false,
        },

        user_id: {
            type: DataTypes.INTEGER.UNSIGNED,
            allowNull: false,
        },

        content: {
            type: DataTypes.TEXT,
            allowNull: false,
        },

        is_accepted: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
    },
    {
        tableName: "question_answers",
        timestamps: true,
        createdAt: "created_at",
        updatedAt: "updated_at",
    }
);

module.exports = QuestionAnswer;