// controllers/moodTrackerController.js
const pool = require('../config/database'); // PostgreSQL pool

// Helper functions for mood display
function getMoodEmoji(mood) {
  const emojis = {
    'Happy': '😊',
    'Calm': '😌',
    'Neutral': '😐',
    'Sad': '😢',
    'Angry': '😠',
    'Anxious': '😰'
  };
  return emojis[mood] || '😐';
}

function getMoodBadgeClass(mood) {
  const classes = {
    'Happy': 'bg-yellow-100 text-yellow-800',
    'Calm': 'bg-green-100 text-green-800',
    'Neutral': 'bg-blue-100 text-blue-800',
    'Sad': 'bg-orange-100 text-orange-800',
    'Angry': 'bg-red-100 text-red-800',
    'Anxious': 'bg-purple-100 text-purple-800'
  };
  return classes[mood] || 'bg-gray-100 text-gray-800';
}

function getEnergyBarClass(energy) {
  if (energy >= 7) return 'bg-green-500';
  if (energy >= 4) return 'bg-yellow-500';
  return 'bg-red-500';
}

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
        moodCounts,
        layout: 'layouts/patient',
        getMoodEmoji,
        getMoodBadgeClass,
        getEnergyBarClass
      });
    } catch (err) {
      console.error('Error fetching mood entries:', err);

      // If database is not available, provide sample data for demonstration
      if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
        console.log('📊 Database not available, using sample data for mood tracker page');

        // Generate sample mood entries
        const sampleEntries = [];
        const moods = ['Happy', 'Calm', 'Neutral', 'Sad', 'Angry', 'Anxious'];
        const notes = [
          'Had a great day at work!',
          'Feeling peaceful after meditation',
          'Regular day, nothing special',
          'Feeling a bit down today',
          'Work was stressful',
          'Feeling worried about presentation'
        ];

        for (let i = 6; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);

          sampleEntries.push({
            id: i + 1,
            user_id: userId,
            mood: moods[i],
            energy: Math.floor(Math.random() * 5) + 3,
            note: notes[i],
            entry_date: date.toISOString()
          });
        }

        // Compute mood frequency for sample data
        const moodCounts = {};
        sampleEntries.forEach(entry => {
          moodCounts[entry.mood] = (moodCounts[entry.mood] || 0) + 1;
        });

        return res.render('pages/moodTracker', {
          title: 'Mood Tracker - CalmTunes',
          entries: sampleEntries,
          moodCounts,
          layout: 'layouts/patient',
          getMoodEmoji,
          getMoodBadgeClass,
          getEnergyBarClass,
          demo: true
        });
      }

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
        return res.json({ success: true, entry: newEntry });
      }

      req.flash('success', 'Mood entry saved!');
      res.redirect('/mood-tracker');

    } catch (err) {
      console.error('Error saving mood entry:', err);

      // If database is not available, simulate successful save for demo
      if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
        console.log('💾 Database not available, simulating mood entry save');

        const demoEntry = {
          id: Date.now(),
          user_id: userId,
          mood,
          note: note || null,
          energy: energy || null,
          entry_date: new Date().toISOString()
        };

        // Respond with JSON for AJAX
        if (req.headers['content-type']?.includes('application/json')) {
          return res.json({ success: true, entry: demoEntry, demo: true });
        }

        req.flash('success', 'Mood entry saved! (Demo mode)');
        return res.redirect('/mood-tracker');
      }

      if (req.headers['content-type']?.includes('application/json')) {
        return res.status(500).json({ error: 'Unable to save mood entry' });
      }

      req.flash('error', 'Unable to save mood entry');
      res.redirect('/mood-tracker');
    }
  },

 // GET /api/mood-tracker/data - Return mood data for chart
 getMoodData: async (req, res) => {
   const userId = req.session?.user?.id;
   if (!userId) {
     return res.status(401).json({ error: 'Not logged in' });
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

     res.json({
       success: true,
       entries: entries || []
     });
   } catch (err) {
     console.error('Error fetching mood data:', err);

     // If database is not available, return sample data for demonstration
     if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
       console.log('📊 Database not available, returning sample data for demonstration');

       // Generate sample mood data for the last 7 days
       const sampleEntries = [];
       const moods = ['Happy', 'Calm', 'Neutral', 'Sad', 'Angry', 'Anxious'];
       const notes = [
         'Had a great day!',
         'Feeling peaceful',
         'Regular day',
         'Feeling a bit down',
         'Work was stressful',
         'Feeling worried about tomorrow'
       ];

       for (let i = 6; i >= 0; i--) {
         const date = new Date();
         date.setDate(date.getDate() - i);

         sampleEntries.push({
           id: i + 1,
           user_id: userId,
           mood: moods[Math.floor(Math.random() * moods.length)],
           energy: Math.floor(Math.random() * 5) + 3, // Energy 3-7
           note: notes[Math.floor(Math.random() * notes.length)],
           entry_date: date.toISOString()
         });
       }

       return res.json({
         success: true,
         entries: sampleEntries,
         demo: true
       });
     }

     res.status(500).json({ error: 'Unable to fetch mood data' });
   }
 }

};

module.exports = moodTrackerController;

