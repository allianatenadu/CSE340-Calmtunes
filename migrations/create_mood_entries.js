'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('mood_entries', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      mood_level: {
        type: Sequelize.ENUM('very_low', 'low', 'neutral', 'good', 'excellent'),
        allowNull: false
      },
      mood_intensity: {
        type: Sequelize.INTEGER,
        defaultValue: 5,
        validate: {
          min: 1,
          max: 10
        }
      },
      note: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      triggers: {
        type: Sequelize.JSON,
        defaultValue: []
      },
      activities: {
        type: Sequelize.JSON,
        defaultValue: []
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW')
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW')
      }
    });

    // Add index for faster queries
    await queryInterface.addIndex('mood_entries', ['user_id', 'created_at']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('mood_entries');
  }
};