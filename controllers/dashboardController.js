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

  // GET /music - Updated with Spotify integration support
  getMusic: async (req, res) => {
    try {
      // Initialize with empty data
      let playlists = [];
      let featuredPlaylist = null;
      let genres = [];

      try {
        // Try to get playlists if the table exists (PostgreSQL syntax)
        const playlistsQuery = `
          SELECT p.*, 
                 COUNT(ps.song_id) as song_count
          FROM playlists p
          LEFT JOIN playlist_songs ps ON p.id = ps.playlist_id
          WHERE p.is_public = true OR p.is_public IS NULL
          GROUP BY p.id, p.title, p.description, p.image, p.category_id, p.created_by, p.is_public, p.created_at, p.updated_at
          ORDER BY p.created_at DESC
        `;
        
        const playlistResult = await pool.query(playlistsQuery);
        playlists = playlistResult.rows || [];

        // Get featured playlist (first one with songs, or create a default one)
        featuredPlaylist = playlists.find(p => parseInt(p.song_count) > 0) || {
          id: 'default',
          title: 'Peaceful Mornings',
          description: 'Start your day with gentle, uplifting melodies designed to promote positive energy and mental clarity.',
          image: 'https://images.pexels.com/photos/1021876/pexels-photo-1021876.jpeg?auto=compress&cs=tinysrgb&w=400'
        };

        // Get genres from songs table
        genres = await SongModel.getDistinctGenres();
        
      } catch (dbError) {
        console.log('Note: Database tables may not exist yet, using default data:', dbError.message);
        
        // Provide default data for initial setup
        playlists = [
          {
            id: 1,
            title: 'Meditation Sounds',
            description: 'Calming sounds for meditation and relaxation',
            image: 'https://images.pexels.com/photos/1021876/pexels-photo-1021876.jpeg?auto=compress&cs=tinysrgb&w=400',
            song_count: 0,
            is_favorite: false,
            created_by: 1
          },
          {
            id: 2,
            title: 'Nature Therapy',
            description: 'Therapeutic nature sounds for stress relief',
            image: 'https://images.pexels.com/photos/1021876/pexels-photo-1021876.jpeg?auto=compress&cs=tinysrgb&w=400',
            song_count: 0,
            is_favorite: false,
            created_by: 1
          }
        ];

        featuredPlaylist = {
          id: 'default',
          title: 'Peaceful Mornings',
          description: 'Start your day with gentle, uplifting melodies designed to promote positive energy and mental clarity.',
          image: 'https://images.pexels.com/photos/1021876/pexels-photo-1021876.jpeg?auto=compress&cs=tinysrgb&w=400'
        };

        genres = ['Ambient', 'Meditation', 'Nature', 'Classical'];
      }

      res.render('pages/music', {
        title: 'Therapeutic Music - CalmTunes',
        user: req.session.user || null,
        playlists: playlists,
        featuredPlaylist: featuredPlaylist,
        genres: genres
      });
      
    } catch (error) {
      console.error('Error in getMusic:', error);
      res.render('pages/music', {
        title: 'Therapeutic Music - CalmTunes',
        user: req.session.user || null,
        playlists: [],
        featuredPlaylist: null,
        genres: [],
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

  // GET /mood-tracker
  getMoodTracker: async (req, res) => {
    try {
      const userId = req.session.user.id; // use session
      const { rows: moodEntries } = await pool.query(
        `SELECT id, user_id, mood, note, energy, entry_date
         FROM public.mood_entries
         WHERE user_id = $1
         ORDER BY entry_date DESC`,
        [userId]
      );

      res.render('pages/moodTracker', {
        title: 'Mood Tracker - CalmTunes',
        moodEntries
      });
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  },

  // POST /mood-tracker
  postMoodEntry: async (req, res) => {
    try {
      const { mood, note, energy } = req.body;
      const userId = req.session.user.id; // use session

      await pool.query(
        `INSERT INTO public.mood_entries (user_id, mood, note, energy)
         VALUES ($1, $2, $3, $4)`,
        [userId, mood, note, energy]
      );

      req.flash('success', 'Mood entry saved successfully!');
      res.redirect('/mood-tracker');
    } catch (err) {
      console.error(err);
      res.status(500).send('Server Error');
    }
  },

  // GET /therapists
  getTherapists: (req, res) => {
    const therapists = [ /* your existing therapists */ ];
    res.render('pages/therapists', { title: 'Find Therapists - CalmTunes', therapists });
  }
};

module.exports = dashboardController;