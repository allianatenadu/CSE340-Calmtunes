// controllers/moodTrackerController.js
const pool = require('../config/database'); // PostgreSQL pool

const moodTrackerController = {

  // GET /mood-tracker
  getMoodTracker: async (req, res) => {
    const userId = req.session?.user?.id;
    if (!userId) {
      req.flash('error', 'Please log in to access your mood tracker');
      return res.redirect('/login');
    }

    try {
      // Fetch user's mood entries
      const { rows: entries } = await pool.query(
        `SELECT id, user_id, mood, note, energy, entry_date
         FROM mood_entries
         WHERE user_id = $1
         ORDER BY entry_date DESC`,
        [userId]
      );

      // Compute mood frequency
      const moodCounts = {};
      entries.forEach(entry => {
        moodCounts[entry.mood] = (moodCounts[entry.mood] || 0) + 1;
      });

      res.render('pages/moodTracker', {
        title: 'Mood Tracker - CalmTunes',
        entries,
        moodCounts
      });
    } catch (err) {
      console.error('Error fetching mood entries:', err);
      req.flash('error', 'Unable to load mood tracker');
      res.redirect('/dashboard');
    }
  },

  // POST /mood-tracker
  
  postMoodEntry: async (req, res) => {
  const userId = req.session?.user?.id;
  if (!userId) return res.status(401).json({ error: 'Not logged in' });

  const { mood, note, energy } = req.body;

  try {
    const { rows } = await pool.query(
      `INSERT INTO mood_entries (user_id, mood, note, energy, entry_date)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING *`,
      [userId, mood, note || null, energy || null]
    );

    const newEntry = rows[0];

    // Respond with JSON for AJAX
    if (req.headers['content-type']?.includes('application/json')) {
      return res.json(newEntry);
    }

    req.flash('success', 'Mood entry saved!');
    res.redirect('/mood-tracker');

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to save mood entry' });
  }
}


};

module.exports = moodTrackerController;

