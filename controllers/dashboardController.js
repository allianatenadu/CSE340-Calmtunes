// Dashboard controller for private pages
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

  // GET /music
  getMusic: (req, res) => {
    const playlists = [
      {
        title: 'Peaceful Mornings',
        description: 'Start your day with calming melodies',
        image: 'https://images.pexels.com/photos/1021876/pexels-photo-1021876.jpeg?auto=compress&cs=tinysrgb&w=400'
      },
      {
        title: 'Focus & Flow',
        description: 'Enhance concentration and productivity',
        image: 'https://images.pexels.com/photos/762687/pexels-photo-762687.jpeg?auto=compress&cs=tinysrgb&w=400'
      },
      {
        title: 'Evening Relaxation',
        description: 'Unwind and prepare for peaceful sleep',
        image: 'https://images.pexels.com/photos/1619317/pexels-photo-1619317.jpeg?auto=compress&cs=tinysrgb&w=400'
      },
      {
        title: 'Anxiety Relief',
        description: 'Soothing sounds to ease worried minds',
        image: 'https://images.pexels.com/photos/1181292/pexels-photo-1181292.jpeg?auto=compress&cs=tinysrgb&w=400'
      }
    ];

    res.render('pages/music', {
      title: 'Therapeutic Music - CalmTunes',
      playlists: playlists
    });
  },

  // GET /drawing
  getDrawing: (req, res) => {
    res.render('pages/drawing', {
      title: 'Art Therapy - CalmTunes'
    });
  },

  // GET /panic
  getPanic: (req, res) => {
    res.render('pages/panic', {
      title: 'Panic Relief - CalmTunes'
    });
  },

  // GET /mood-tracker
  getMoodTracker: (req, res) => {
    // Demo mood entries - replace with real database
    const moodEntries = [
      { date: '2024-01-15', mood: 'Happy', note: 'Had a great day at work', energy: 8 },
      { date: '2024-01-14', mood: 'Anxious', note: 'Worried about upcoming presentation', energy: 5 },
      { date: '2024-01-13', mood: 'Calm', note: 'Relaxing weekend', energy: 7 }
    ];

    res.render('pages/moodTracker', {
      title: 'Mood Tracker - CalmTunes',
      moodEntries: moodEntries
    });
  },

  // POST /mood-tracker
  postMoodEntry: (req, res) => {
    const { mood, note, energy } = req.body;
    // Here you would save to database
    req.flash('success', 'Mood entry saved successfully!');
    res.redirect('/mood-tracker');
  },

  // GET /therapists
  getTherapists: (req, res) => {
    const therapists = [
      {
        name: 'Dr. Sarah Johnson',
        specialty: 'Anxiety & Depression',
        image: 'https://images.pexels.com/photos/5327656/pexels-photo-5327656.jpeg?auto=compress&cs=tinysrgb&w=200',
        rating: 4.9
      },
      {
        name: 'Dr. Michael Chen',
        specialty: 'Cognitive Behavioral Therapy',
        image: 'https://images.pexels.com/photos/5327585/pexels-photo-5327585.jpeg?auto=compress&cs=tinysrgb&w=200',
        rating: 4.8
      },
      {
        name: 'Dr. Emily Rodriguez',
        specialty: 'Trauma & PTSD',
        image: 'https://images.pexels.com/photos/5327921/pexels-photo-5327921.jpeg?auto=compress&cs=tinysrgb&w=200',
        rating: 4.9
      }
    ];

    res.render('pages/therapists', {
      title: 'Find Therapists - CalmTunes',
      therapists: therapists
    });
  }
};

module.exports = dashboardController;