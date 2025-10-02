"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable("drawing_sessions", {
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
      session_name: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      art_type: {
        type: Sequelize.ENUM(
          "free_draw",
          "mandala",
          "guided_meditation",
          "emotion_expression",
          "stress_relief"
        ),
        allowNull: false,
        defaultValue: "free_draw",
      },
      duration: {
        type: Sequelize.INTEGER,
        allowNull: true, // in minutes
      },
      mood_before: {
        type: Sequelize.ENUM(
          "very_stressed",
          "stressed",
          "neutral",
          "calm",
          "very_calm"
        ),
        allowNull: true,
      },
      mood_after: {
        type: Sequelize.ENUM(
          "very_stressed",
          "stressed",
          "neutral",
          "calm",
          "very_calm"
        ),
        allowNull: true,
      },
      tools_used: {
        type: Sequelize.JSON,
        defaultValue: [], // array of tools like 'brush', 'pencil', 'eraser', etc.
      },
      colors_used: {
        type: Sequelize.JSON,
        defaultValue: [], // array of color hex codes or names
      },
      canvas_size: {
        type: Sequelize.STRING(20),
        defaultValue: "800x600",
      },
      is_completed: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
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
    await queryInterface.addIndex("drawing_sessions", [
      "user_id",
      "session_date",
    ]);
    await queryInterface.addIndex("drawing_sessions", ["art_type"]);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable("drawing_sessions");
  },
};
