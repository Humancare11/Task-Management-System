'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('projects', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER.UNSIGNED
      },

      organization_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
          model: 'organizations',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },

      name: {
        type: Sequelize.STRING(150),
        allowNull: false
      },

      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },

      status: {
        type: Sequelize.ENUM(
          'planned',
          'active',
          'on_hold',
          'completed',
          'archived'
        ),
        allowNull: false,
        defaultValue: 'planned'
      },

      priority: {
        type: Sequelize.ENUM(
          'low',
          'medium',
          'high',
          'urgent'
        ),
        allowNull: false,
        defaultValue: 'medium'
      },

      start_date: {
        type: Sequelize.DATE,
        allowNull: true
      },

      due_date: {
        type: Sequelize.DATE,
        allowNull: true
      },

      created_by: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },

      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      },

      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW
      }
    });

    await queryInterface.addIndex(
      'projects',
      ['organization_id'],
      {
        name: 'projects_organization_id_index'
      }
    );

    await queryInterface.addIndex(
      'projects',
      ['created_by'],
      {
        name: 'projects_created_by_index'
      }
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('projects');
  }
};