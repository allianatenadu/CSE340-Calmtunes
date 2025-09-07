const pool = require("../config/database");
const authModel = require("../models/authModel");

const dashboardController = {
  // GET /dashboard - Enhanced with role-based content
  getDashboard: async (req, res) => {
    try {
      const user = req.session.user;
      
      // FIXED: Redirect therapists to their own dashboard, NOT find-therapist
      if (user.role === 'therapist') {
        return res.redirect('/therapist');
      }
      
      // FIXED: Redirect admins to admin panel
      if (user.role === 'admin') {
        return res.redirect('/admin');
      }
      
      const quotes = [
        "Every day is a new beginning. Take a deep breath and start again.",
        "You are stronger than you think and more capable than you imagine.",
        "Progress, not perfection, is what we should strive for.",
        "Your mental health is just as important as your physical health.",
        "It's okay to not be okay. What matters is that you're trying.",
      ];
      
      const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];

      // Get patient-specific data only
      let dashboardData = {
        title: "Dashboard - CalmTunes",
        quote: randomQuote,
        user: user,
        role: user.role || 'patient'
      };

      // Add patient-specific data
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

  // GET /panic
  getPanic: (req, res) => {
    res.render("pages/panic", { 
      title: "Panic Relief - CalmTunes",
      user: req.session.user
    });
  }
};

module.exports = dashboardController;