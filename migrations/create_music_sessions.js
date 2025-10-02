"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("music_sessions", {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      title: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      artist: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      category: {
        type: Sequelize.ENUM(
          "calm",
          "energetic",
          "meditation",
          "nature",
          "classical",
          "ambient",
          "focus",
          "sleep"
        ),
        allowNull: false,
      },
      duration: {
        type: Sequelize.INTEGER,
        allowNull: true, // in seconds
      },
      playlist_name: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      mood_before: {
        type: Sequelize.ENUM("very_low", "low", "neutral", "good", "excellent"),
        allowNull: true,
      },
      mood_after: {
        type: Sequelize.ENUM("very_low", "low", "neutral", "good", "excellent"),
        allowNull: true,
      },
      spotify_track_id: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      session_date: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn("NOW"),
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn("NOW"),
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn("NOW"),
      },
    });

    // Add indexes for faster queries
    await queryInterface.addIndex("music_sessions", [
      "user_id",
      "session_date",
    ]);
    await queryInterface.addIndex("music_sessions", ["category"]);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("music_sessions");
  },
};
