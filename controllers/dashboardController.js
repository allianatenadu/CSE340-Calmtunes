const pool = require('../config/database'); 
const SongModel = require('../models/songModel');

const dashboardController = {
  // GET /dashboard
  getDashboard: (req, res) => {
    const quotes = [
      "Every day is a new beginning. Take a deep breath and start again.",
      "You are stronger than you think and more capable than you imagine.",
      "Progress, not perfection, is what we should strive for.",
      "Your mental health is just as important as your physical health.",
      "It's okay to not be okay. What matters is that you're trying."
    ];
    const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];

    res.render('pages/dashboard', {
      title: 'Dashboard - CalmTunes',
      quote: randomQuote
    });
  },

  // GET /music - Fixed for MySQL and proper template data
  getMusic: async (req, res) => {
    try {
      // Initialize with empty data
      let playlists = [];
      let featuredSongs = [];

      try {
        // Get playlists from MySQL (fixed syntax)
        const [playlistRows] = await pool.execute(`
          SELECT p.*, 
                 COUNT(ps.song_id) as song_count
          FROM playlists p
          LEFT JOIN playlist_songs ps ON p.id = ps.playlist_id
          WHERE p.is_public = 1
          GROUP BY p.id, p.title, p.description, p.cover_url, p.user_id, p.is_public, p.created_at
          ORDER BY p.created_at DESC
        `);
        playlists = playlistRows || [];

        // Get featured songs (what the template actually expects)
        const [songRows] = await pool.execute(`
          SELECT * FROM songs 
          ORDER BY created_at DESC 
          LIMIT 10
        `);
        featuredSongs = songRows || [];
        
      } catch (dbError) {
        console.log('Note: Database tables may not exist yet, using default data:', dbError.message);
        
        // Provide default data for initial setup
        playlists = [
          {
            id: 1,
            title: 'Sleep Therapy',
            description: 'Calming music for better sleep',
            cover_url: 'https://images.pexels.com/photos/1021876/pexels-photo-1021876.jpeg?auto=compress&cs=tinysrgb&w=400',
            song_count: 0,
            is_public: 1,
            user_id: null
          },
          {
            id: 2,
            title: 'Anxiety Relief',
            description: 'Therapeutic sounds for stress and anxiety relief',
            cover_url: 'https://images.pexels.com/photos/1054218/pexels-photo-1054218.jpeg?auto=compress&cs=tinysrgb&w=400',
            song_count: 0,
            is_public: 1,
            user_id: null
          },
          {
            id: 3,
            title: 'Focus & Concentration',
            description: 'Background music to enhance focus and productivity',
            cover_url: 'https://images.pexels.com/photos/1181248/pexels-photo-1181248.jpeg?auto=compress&cs=tinysrgb&w=400',
            song_count: 0,
            is_public: 1,
            user_id: null
          }
        ];

        // Default featured songs (empty for now)
        featuredSongs = [];
      }

      res.render('pages/music', {
        title: 'Music Therapy',
        user: req.session.user || null,
        playlists: playlists,
        featuredSongs: featuredSongs // This is what the template expects
      });
      
    } catch (error) {
      console.error('Error in getMusic:', error);
      res.render('pages/music', {
        title: 'Music Therapy',
        user: req.session.user || null,
        playlists: [],
        featuredSongs: [], // Always provide this even if empty
        error: 'Failed to load music library'
      });
    }
  },

  // GET /drawing
  getDrawing: (req, res) => {
    res.render('pages/drawing', { title: 'Art Therapy - CalmTunes' });
  },

  // GET /panic
  getPanic: (req, res) => {
    res.render('pages/panic', { title: 'Panic Relief - CalmTunes' });
  },

  // GET /mood-tracker - Fixed for MySQL
  getMoodTracker: async (req, res) => {
    try {
      const userId = req.session.user.id;
      
      // Check if mood_entries table exists, if not provide empty data
      let moodEntries = [];
      try {
        const [rows] = await pool.execute(
          `SELECT id, user_id, mood, note, energy, entry_date
           FROM mood_entries
           WHERE user_id = ?
           ORDER BY entry_date DESC`,
          [userId]
        );
        moodEntries = rows;
      } catch (tableError) {
        console.log('Mood entries table may not exist yet:', tableError.message);
      }

      res.render('pages/moodTracker', {
        title: 'Mood Tracker - CalmTunes',
        moodEntries
      });
    } catch (err) {
      console.error(err);
      res.render('pages/moodTracker', {
        title: 'Mood Tracker - CalmTunes',
        moodEntries: [],
        error: 'Failed to load mood tracker'
      });
    }
  },

  // POST /mood-tracker - Fixed for MySQL
  postMoodEntry: async (req, res) => {
    try {
      const { mood, note, energy } = req.body;
      const userId = req.session.user.id;

      await pool.execute(
        `INSERT INTO mood_entries (user_id, mood, note, energy)
         VALUES (?, ?, ?, ?)`,
        [userId, mood, note, energy]
      );

      req.flash('success', 'Mood entry saved successfully!');
      res.redirect('/mood-tracker');
    } catch (err) {
      console.error(err);
      req.flash('error', 'Failed to save mood entry');
      res.redirect('/mood-tracker');
    }
  },

  // GET /therapists
  getTherapists: (req, res) => {
    const therapists = [
      {
        id: 1,
        name: "Dr. Sarah Johnson",
        specialization: "Anxiety & Depression",
        rating: 4.8,
        location: "Downtown",
        image: "https://images.pexels.com/photos/5452201/pexels-photo-5452201.jpeg?auto=compress&cs=tinysrgb&w=400"
      },
      {
        id: 2,
        name: "Dr. Michael Chen",
        specialization: "Stress Management",
        rating: 4.9,
        location: "Midtown",
        image: "https://images.pexels.com/photos/5452274/pexels-photo-5452274.jpeg?auto=compress&cs=tinysrgb&w=400"
      }
    ];
    res.render('pages/therapists', { 
      title: 'Find Therapists - CalmTunes', 
      therapists 
    });
  }
};

module.exports = dashboardController;