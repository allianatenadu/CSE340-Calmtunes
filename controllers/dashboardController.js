const pool = require("../config/database");
const authModel = require("../models/authModel");

const dashboardController = {
  // GET /dashboard - Enhanced with role-based content
  getDashboard: async (req, res) => {
    try {
      const user = req.session.user;
      
      const quotes = [
        "Every day is a new beginning. Take a deep breath and start again.",
        "You are stronger than you think and more capable than you imagine.",
        "Progress, not perfection, is what we should strive for.",
        "Your mental health is just as important as your physical health.",
        "It's okay to not be okay. What matters is that you're trying.",
      ];
      
      const therapistQuotes = [
        "The greatest healing therapy is friendship and love.",
        "Your compassion makes a difference in someone's life today.",
        "Every person you help is a victory against suffering.",
        "Mental health is not a destination, but a process. Guide them well.",
        "You hold space for others' healing. Thank you for your service.",
      ];
      
      const quotesToUse = user.role === 'therapist' ? therapistQuotes : quotes;
      const randomQuote = quotesToUse[Math.floor(Math.random() * quotesToUse.length)];

      // Get role-specific data
      let dashboardData = {
        title: "Dashboard - CalmTunes",
        quote: randomQuote,
        user: user,
        role: user.role || 'patient'
      };

      // Add therapist-specific data
      if (user.role === 'therapist') {
        try {
          const patients = await authModel.getAllPatients();
          dashboardData.patientCount = patients.length;
          dashboardData.recentPatients = patients.slice(0, 5); // Show latest 5
        } catch (error) {
          console.error('Error fetching therapist data:', error);
          dashboardData.patientCount = 0;
          dashboardData.recentPatients = [];
        }
      }

      // Add patient-specific data
      if (user.role === 'patient') {
        try {
          // Get recent mood entries for patient
          const recentMoods = await pool.query(
            'SELECT mood, entry_date FROM mood_entries WHERE user_id = $1 ORDER BY entry_date DESC LIMIT 7',
            [user.id]
          );
          dashboardData.recentMoods = recentMoods.rows;
        } catch (error) {
          console.error('Error fetching patient mood data:', error);
          dashboardData.recentMoods = [];
        }
      }

      res.render("pages/dashboard", dashboardData);
    } catch (error) {
      console.error('Dashboard error:', error);
      res.render("pages/dashboard", {
        title: "Dashboard - CalmTunes",
        quote: "Welcome to your mental health journey.",
        user: req.session.user,
        role: req.session.user?.role || 'patient'
      });
    }
  },

  // GET /music - Fixed for PostgreSQL and proper template data
  getMusic: async (req, res) => {
    try {
      // Categories list
      const categories = [
        {
          id: "sleep",
          title: "Sleep Therapy",
          description: "Calming music for better sleep",
          cover_url: "https://images.pexels.com/photos/1021876/pexels-photo-1021876.jpeg?auto=compress&cs=tinysrgb&w=400"
        },
        {
          id: "anxiety",
          title: "Anxiety Relief", 
          description: "Therapeutic sounds for stress and anxiety relief",
          cover_url: "https://images.pexels.com/photos/1054218/pexels-photo-1054218.jpeg?auto=compress&cs=tinysrgb&w=400"
        },
        {
          id: "focus",
          title: "Focus & Concentration",
          description: "Background music to enhance focus and productivity",
          cover_url: "https://images.pexels.com/photos/1181248/pexels-photo-1181248.jpeg?auto=compress&cs=tinysrgb&w=400"
        }
      ];

      // Local songs
      const localSongs = [
        {
          id: 'local1',
          title: 'Local Calm Track',
          artist: 'Unknown Artist1',
          preview_url: '/audio/Fido-Joy-Is-Coming.mp3',
          category: 'sleep'
        },
        {
          id: 'local2',
          title: 'Local Focus Track',
          artist: 'Unknown Artist2',
          preview_url: '/audio/Omah-Lay-Soso-feat-Ozuna.mp3',
          category: 'focus'
        }
      ];

      // Group songs by category id
      const allSongs = {};
      localSongs.forEach(song => {
        if (!allSongs[song.category]) {
          allSongs[song.category] = [];
        }
        allSongs[song.category].push(song);
      });

      res.render("pages/music", {
        title: "Music Therapy",
        user: req.session.user || null,
        categories,
        allSongs,
      });

    } catch (error) {
      console.error("Error in getMusic:", error);
      res.render("pages/music", {
        title: "Music Therapy",
        user: req.session.user || null,
        categories: [],
        allSongs: [],
        error: "Failed to load music library",
      });
    }
  },

  // GET /drawing
  getDrawing: (req, res) => {
    res.render("pages/drawing", { 
      title: "Art Therapy - CalmTunes",
      user: req.session.user
    });
  },

  // GET /panic
  getPanic: (req, res) => {
    res.render("pages/panic", { 
      title: "Panic Relief - CalmTunes",
      user: req.session.user
    });
  },

  // GET /mood-tracker - Fixed for PostgreSQL
  getMoodTracker: async (req, res) => {
    try {
      const userId = req.session.user.id;

      // Check if mood_entries table exists, if not provide empty data
      let moodEntries = [];
      try {
        const result = await pool.query(
          `SELECT id, user_id, mood, note, energy, entry_date
           FROM mood_entries
           WHERE user_id = $1
           ORDER BY entry_date DESC`,
          [userId]
        );
        moodEntries = result.rows;
      } catch (tableError) {
        console.log(
          "Mood entries table may not exist yet:",
          tableError.message
        );
      }

      res.render("pages/moodTracker", {
        title: "Mood Tracker - CalmTunes",
        moodEntries,
        user: req.session.user
      });
    } catch (err) {
      console.error(err);
      res.render("pages/moodTracker", {
        title: "Mood Tracker - CalmTunes",
        moodEntries: [],
        user: req.session.user,
        error: "Failed to load mood tracker",
      });
    }
  },

  // POST /mood-tracker - Fixed for PostgreSQL
  postMoodEntry: async (req, res) => {
    try {
      const { mood, note, energy } = req.body;
      const userId = req.session.user.id;

      await pool.query(
        `INSERT INTO mood_entries (user_id, mood, note, energy, entry_date)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
        [userId, mood, note, energy]
      );

      req.flash("success", "Mood entry saved successfully!");
      res.redirect("/mood-tracker");
    } catch (err) {
      console.error(err);
      req.flash("error", "Failed to save mood entry");
      res.redirect("/mood-tracker");
    }
  },

  // GET /therapists - Enhanced with role-based access
  getTherapists: async (req, res) => {
    try {
      const user = req.session.user;
      
      // If user is a therapist, show patient management instead
      if (user.role === 'therapist') {
        const patients = await authModel.getAllPatients();
        return res.render("pages/therapist-patients", {
          title: "My Patients - CalmTunes",
          patients,
          user: user
        });
      }

      // For patients, show available therapists
      let therapists = [];
      try {
        therapists = await authModel.getAllTherapists();
      } catch (error) {
        console.error('Error fetching therapists:', error);
        // Fallback to static data if database fails
        therapists = [
          {
            id: 1,
            name: "Dr. Sarah Johnson",
            specialization: "Anxiety & Depression",
            rating: 4.8,
            location: "Downtown",
            profile_image: "https://images.pexels.com/photos/5452201/pexels-photo-5452201.jpeg?auto=compress&cs=tinysrgb&w=400",
          },
          {
            id: 2,
            name: "Dr. Michael Chen", 
            specialization: "Stress Management",
            rating: 4.9,
            location: "Midtown",
            profile_image: "https://images.pexels.com/photos/5452274/pexels-photo-5452274.jpeg?auto=compress&cs=tinysrgb&w=400",
          },
        ];
      }

      res.render("pages/therapists", {
        title: "Find Therapists - CalmTunes",
        therapists,
        user: user
      });
    } catch (error) {
      console.error('Error in getTherapists:', error);
      res.render("pages/therapists", {
        title: "Find Therapists - CalmTunes",
        therapists: [],
        user: req.session.user,
        error: "Failed to load therapists"
      });
    }
  },

  // GET /patients - Therapist-only route to view patients
  getPatients: async (req, res) => {
    try {
      // Check if user is a therapist
      if (req.session.user.role !== 'therapist') {
        req.flash('error', 'Access denied. Therapist account required.');
        return res.redirect('/dashboard');
      }

      const patients = await authModel.getAllPatients();
      
      res.render("pages/therapist-patients", {
        title: "My Patients - CalmTunes",
        patients,
        user: req.session.user
      });
    } catch (error) {
      console.error('Error fetching patients:', error);
      res.render("pages/therapist-patients", {
        title: "My Patients - CalmTunes",
        patients: [],
        user: req.session.user,
        error: "Failed to load patient list"
      });
    }
  }
};

module.exports = dashboardController;
