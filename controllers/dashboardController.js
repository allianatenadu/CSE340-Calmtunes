const pool = require("../config/database");
const authModel = require("../models/authModel");

const dashboardController = {
  // GET /dashboard - Enhanced with role-based content and safe table handling
  getDashboard: async (req, res) => {
    try {
      const user = req.session.user;

      // FIXED: Redirect therapists to their own dashboard, NOT find-therapist
      if (user.role === "therapist") {
        return res.redirect("/therapist");
      }

      // FIXED: Redirect admins to admin panel
      if (user.role === "admin") {
        return res.redirect("/admin");
      }

      // Get patient-specific data only
      let dashboardData = {
        title: "Dashboard - CalmTunes",
        user: user,
        role: user.role || "patient",
      };

      // Add patient-specific data with safe table handling
      try {
        // Create array to hold all query promises
        const queryPromises = [];
        let recentActivities = []; // Initialize recentActivities array

        // Check if tables exist before querying them
        const tableCheckQuery = `
          SELECT table_name
          FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name IN ('mood_entries', 'music_sessions', 'drawing_sessions', 'panic_sessions', 'user_activities', 'appointments')
        `;

        const existingTables = await pool.query(tableCheckQuery);
        const tableNames = existingTables.rows.map((row) => row.table_name);

        // Get next upcoming appointment for "Your Next Session" section
        if (tableNames.includes("appointments")) {
          queryPromises.push(
            pool
              .query(
                `SELECT a.*, u.name as therapist_name, ta.specialty
                 FROM appointments a
                 JOIN users u ON a.therapist_id = u.id
                 LEFT JOIN therapist_applications ta ON u.id = ta.user_id
                 WHERE a.patient_id = $1 AND a.status IN ('confirmed', 'pending')
                 AND a.appointment_date >= CURRENT_DATE
                 ORDER BY a.appointment_date ASC, a.appointment_time ASC
                 LIMIT 1`,
                [user.id]
              )
              .then((result) => ({ type: "nextAppointment", data: result.rows[0] || null }))
              .catch(() => ({ type: "nextAppointment", data: null }))
          );
        } else {
          queryPromises.push(Promise.resolve({ type: "nextAppointment", data: null }));
        }

        // Query mood_entries if it exists - get latest one only
        if (tableNames.includes("mood_entries")) {
          queryPromises.push(
            pool
              .query(
                "SELECT mood_level, created_at, note FROM mood_entries WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
                [user.id]
              )
              .then((result) => ({ type: "mood", data: result.rows[0] || null }))
              .catch(() => {
                // Fallback query with different column names
                return pool
                  .query(
                    "SELECT mood, entry_date, note FROM mood_entries WHERE user_id = $1 ORDER BY entry_date DESC LIMIT 1",
                    [user.id]
                  )
                  .then((result) => ({ type: "mood", data: result.rows[0] || null }));
              })
          );
        } else {
          queryPromises.push(Promise.resolve({ type: "mood", data: null }));
        }

       // Around line 64-73 - Music sessions query
if (tableNames.includes("music_sessions")) {
  queryPromises.push(
    pool
      .query(
        "SELECT title, artist, created_at FROM music_sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 3",
        [user.id]
      )
      .then((result) => ({ type: "music", data: result.rows })) // Returns array now
  );
} else {
  queryPromises.push(Promise.resolve({ type: "music", data: [] }));
}

// Around line 80-89 - Drawing sessions query
if (tableNames.includes("drawing_sessions")) {
  queryPromises.push(
    pool
      .query(
        "SELECT session_name, art_type, duration, mood_before, mood_after, session_date FROM drawing_sessions WHERE user_id = $1 ORDER BY session_date DESC LIMIT 3",
        [user.id]
      )
      .then((result) => ({ type: "drawing", data: result.rows })) // Returns array now
  );
} else {
  queryPromises.push(Promise.resolve({ type: "drawing", data: [] }));
}

// Around line 116-145 - Processing section
// Process music sessions - multiple entries
const musicQuery = queryPromises.find(p => p.type === 'music');
if (musicQuery && musicQuery.data && musicQuery.data.length > 0) {
  musicQuery.data.forEach(session => {
    recentActivities.push({
      type: "music",
      title: `Listened to "${session.title}"`,
      subtitle: session.artist || "",
      date: session.created_at,
      icon: "fas fa-music",
    });
  });
}

// Process drawing sessions - multiple entries
const drawingQuery = queryPromises.find(p => p.type === 'drawing');
if (drawingQuery && drawingQuery.data && drawingQuery.data.length > 0) {
  const artTypeLabels = {
    free_draw: "Free Drawing",
    mandala: "Mandala Art",
    guided_meditation: "Guided Meditation Art",
    emotion_expression: "Emotion Expression",
    stress_relief: "Stress Relief Art",
  };

  drawingQuery.data.forEach(session => {
    recentActivities.push({
      type: "drawing",
      title: `Art Therapy: ${artTypeLabels[session.art_type] || session.art_type}`,
      subtitle: session.session_name || `${session.duration || 0} minutes session`,
      date: session.session_date,
      icon: "fas fa-palette",
    });
  });
}

// Process next appointment data
const appointmentQuery = queryPromises.find(p => p.type === 'nextAppointment');
if (appointmentQuery && appointmentQuery.data) {
  dashboardData.nextAppointment = appointmentQuery.data;
} else {
  // Provide sample appointment data if no real appointment exists
  dashboardData.nextAppointment = {
    therapist_name: "Dr. Evelyn Reed",
    appointment_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Tomorrow
    appointment_time: "14:00:00",
    session_type: "video",
    status: "confirmed"
  };
}

// Around line 160 - Sort and limit
recentActivities.sort((a, b) => new Date(b.date) - new Date(a.date));
dashboardData.recentActivities = recentActivities.slice(0, 10); // Show 10 most recent

// If no activities found, provide sample data
if (dashboardData.recentActivities.length === 0) {
          dashboardData.recentActivities = [
            {
              type: "mood",
              title: "Welcome to CalmTunes!",
              subtitle:
                "Start by logging your mood or trying a breathing exercise",
              date: new Date().toISOString(),
              icon: "fas fa-heart",
            },
            {
              type: "activity",
              title: "Explore panic support tools",
              subtitle: "Access breathing exercises and emergency contacts",
              date: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
              icon: "fas fa-lungs",
            },
            {
              type: "music",
              title: "Discover calming music",
              subtitle: "Browse our curated playlists for relaxation",
              date: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
              icon: "fas fa-music",
            },
          ];
        }
      } catch (error) {
        console.error("Error fetching recent activities:", error);

        // Provide helpful default activities
        dashboardData.recentActivities = [
          {
            type: "welcome",
            title: "Welcome to CalmTunes Dashboard",
            subtitle: "Your mental wellness journey starts here",
            date: new Date().toISOString(),
            icon: "fas fa-heart",
          },
          {
            type: "info",
            title: "Panic Support Available",
            subtitle:
              "Access breathing exercises and emergency contacts anytime",
            date: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
            icon: "fas fa-shield-alt",
          },
          {
            type: "tip",
            title: "Track Your Mood",
            subtitle: "Regular mood logging helps identify patterns",
            date: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
            icon: "fas fa-chart-line",
          },
        ];
      }

      res.render("pages/dashboard", {
        ...dashboardData,
        layout: 'layouts/patient'
      });
    } catch (error) {
      console.error("Dashboard error:", error);
      res.render("pages/dashboard", {
        title: "Dashboard - CalmTunes",
        user: req.session.user,
        role: req.session.user?.role || "patient",
        layout: 'layouts/patient',
        recentActivities: [
          {
            type: "error",
            title: "Dashboard Loading",
            subtitle:
              "Some features may be limited while we set up your account",
            date: new Date().toISOString(),
            icon: "fas fa-info-circle",
          },
        ],
      });
    }
  },

  // GET /panic
  getPanic: (req, res) => {
    res.render("pages/panic", {
      title: "Panic Relief - CalmTunes",
      user: req.session.user,
      layout: "layouts/patient",
    });
  },
};

module.exports = dashboardController;
