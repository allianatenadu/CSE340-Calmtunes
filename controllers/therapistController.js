// controllers/therapistController.js - Updated with complete functionality and fixed bio column issue
const db = require("../config/database");
const path = require("path");
const fs = require("fs").promises;
const multer = require("multer");

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "public/uploads/");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});

const upload = multer({ storage: storage });

// Get therapist dashboard
exports.getDashboard = async (req, res) => {
  try {
    const userId = req.session.user.id;

    // Get therapist application
    const applicationQuery = `
            SELECT * FROM therapist_applications 
            WHERE user_id = $1 
            ORDER BY created_at DESC 
            LIMIT 1
        `;
    const applicationResult = await db.query(applicationQuery, [userId]);
    const application = applicationResult.rows[0] || null;

    // Get therapist statistics if approved
    let stats = null;
    if (application && application.status === "approved") {
      const statsQuery = `
                SELECT
                    COUNT(DISTINCT a.patient_id) as activePatients,
                    COUNT(CASE WHEN a.appointment_date >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as weekSessions,
                    COALESCE(AVG(r.rating), 0) as avgRating,
                    COALESCE(SUM(EXTRACT(EPOCH FROM (a.ended_at - a.started_at))/3600), 0) as totalHours,
                    COUNT(CASE WHEN a.appointment_date >= DATE_TRUNC('month', CURRENT_DATE) THEN 1 END) as monthlySessions,
                    COALESCE(AVG(CASE WHEN r.rating IS NOT NULL THEN r.rating END), 0) as satisfactionScore,
                    COALESCE(AVG(EXTRACT(EPOCH FROM (a.started_at - a.created_at))/3600), 0) as avgResponseTimeHours
                FROM appointments a
                LEFT JOIN reviews r ON a.id = r.appointment_id
                WHERE a.therapist_id = $1
                GROUP BY a.therapist_id
            `;
      const statsResult = await db.query(statsQuery, [userId]);
      const rawStats = statsResult.rows[0] || {
        activepatients: 0,
        weeksessions: 0,
        avgrating: "0.0",
        totalhours: 0,
        monthlysessions: 0,
        satisfactionscore: 0,
        avgresponsetimehours: 0,
      };

      // Format the stats for display
      stats = {
        activePatients: parseInt(rawStats.activepatients) || 0,
        weekSessions: parseInt(rawStats.weeksessions) || 0,
        avgRating: parseFloat(rawStats.avgrating) || 0.0,
        totalHours: Math.round(parseFloat(rawStats.totalhours)) || 0,
        monthlyEstimates: Math.round(
          (parseInt(rawStats.monthlysessions) || 0) * 1.2
        ), // Estimate based on current month
        patientSatisfaction: Math.round(
          (parseFloat(rawStats.satisfactionscore) || 0) * 20
        ), // Convert to percentage
        avgResponseTime:
          Math.round((parseFloat(rawStats.avgresponsetimehours) || 0) * 10) /
            10 +
          "hr", // Format as hours with 1 decimal
      };
    }

    // Get profile image URL
    let profileImageUrl = null;
    if (application && application.profile_image) {
      profileImageUrl = `/uploads/${application.profile_image}`;
    } else if (req.session.user.profile_image) {
      profileImageUrl = req.session.user.profile_image.startsWith("/")
        ? req.session.user.profile_image
        : `/uploads/profiles/${req.session.user.profile_image}`;
    }

    res.render("pages/therapist/dashboard", {
      title: "Dashboard",
      subtitle: "Welcome back, " + req.session.user.name.split(" ")[0] + "!",
      user: req.session.user,
      application: application,
      stats: stats,
      profileImageUrl: profileImageUrl,
      currentPage: "dashboard",
      layout: "layouts/therapist",
    });
  } catch (error) {
    console.error("Error loading therapist dashboard:", error);
    req.flash("error", "Failed to load dashboard");
    res.redirect("/dashboard");
  }
};

// Get application form
exports.getApplicationForm = async (req, res) => {
  try {
    const userId = req.session.user.id;

    // Check if user already has an application
    const existingApp = await db.query(
      "SELECT * FROM therapist_applications WHERE user_id = $1",
      [userId]
    );

    let application = null;
    if (existingApp.rows.length > 0) {
      application = existingApp.rows[0];
    }

    // Get profile image URL
    let profileImageUrl = null;
    if (application && application.profile_image) {
      profileImageUrl = `/uploads/${application.profile_image}`;
    } else if (req.session.user.profile_image) {
      profileImageUrl = req.session.user.profile_image.startsWith("/")
        ? req.session.user.profile_image
        : `/uploads/profiles/${req.session.user.profile_image}`;
    }

    res.render("pages/therapist/apply", {
      title: "Apply to be a Therapist",
      user: req.session.user,
      application: application,
      profileImageUrl: profileImageUrl,
      currentPage: "apply",
      layout: "layouts/therapist",
    });
  } catch (error) {
    console.error("Error loading application form:", error);
    req.flash("error", "Failed to load application form");
    res.redirect("/therapist");
  }
};

// Submit application
exports.submitApplication = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { bio, experience, specialty, phone } = req.body;

    // Check if user already has an application
    const existingApp = await db.query(
      "SELECT id FROM therapist_applications WHERE user_id = $1",
      [userId]
    );

    let query, values;

    if (existingApp.rows.length > 0) {
      // Update existing application
      query = `
                UPDATE therapist_applications 
                SET bio = $1, experience = $2, specialty = $3, phone = $4, 
                    status = 'pending', updated_at = CURRENT_TIMESTAMP
                WHERE user_id = $5
                RETURNING id
            `;
      values = [bio, experience, specialty, phone, userId];
    } else {
      // Create new application
      query = `
                INSERT INTO therapist_applications 
                (user_id, bio, experience, specialty, phone, status)
                VALUES ($1, $2, $3, $4, $5, 'pending')
                RETURNING id
            `;
      values = [userId, bio, experience, specialty, phone];
    }

    const result = await db.query(query, values);

    if (result.rows.length > 0) {
      req.flash(
        "success",
        "Application submitted successfully! You'll receive a notification once reviewed."
      );
      res.redirect("/therapist");
    } else {
      throw new Error("Failed to submit application");
    }
  } catch (error) {
    console.error("Error submitting application:", error);
    req.flash("error", "Failed to submit application. Please try again.");
    res.redirect("/therapist/apply");
  }
};

// Get therapist patients - FIXED bio column issue
exports.getPatients = async (req, res) => {
  try {
    const therapistId = req.session.user.id;

    // Get all patients who have appointments with this therapist
    const patientsQuery = `
            SELECT DISTINCT
                u.id, u.name, u.email, u.profile_image,
                COUNT(a.id) as total_appointments,
                MAX(a.appointment_date) as last_appointment,
                COUNT(CASE WHEN a.status = 'confirmed' AND a.appointment_date >= CURRENT_DATE THEN 1 END) as upcoming_appointments,
                c.id as conversation_id,
                MAX(c.updated_at) as last_message_time,
                COUNT(CASE WHEN m.is_read = false AND m.sender_id != $1 THEN 1 END) as unread_messages
            FROM users u
            INNER JOIN appointments a ON u.id = a.patient_id
            LEFT JOIN conversations c ON (c.patient_id = u.id AND c.therapist_id = $1)
            LEFT JOIN messages m ON c.id = m.conversation_id
            WHERE a.therapist_id = $1
            GROUP BY u.id, u.name, u.email, u.profile_image, c.id
            ORDER BY MAX(a.appointment_date) DESC
        `;

    const result = await db.query(patientsQuery, [therapistId]);
    const patients = result.rows || [];

    // Get profile image URL
    let profileImageUrl = null;
    if (req.session.user.profile_image) {
      profileImageUrl = req.session.user.profile_image.startsWith("/")
        ? req.session.user.profile_image
        : `/uploads/profiles/${req.session.user.profile_image}`;
    }

    res.render("pages/therapist/patients", {
      title: "Patients",
      subtitle: "Manage your patients",
      user: req.session.user,
      patients: patients,
      profileImageUrl: profileImageUrl,
      currentPage: "patients",
      layout: "layouts/therapist",
    });
  } catch (error) {
    console.error("Error loading patients:", error);
    req.flash("error", "Failed to load patients");
    res.redirect("/therapist");
  }
};

exports.getSchedule = async (req, res) => {
  try {
    const therapistId = req.session.user.id;

    // Get upcoming appointments (confirmed)
    const appointmentsQuery = `
            SELECT a.*,
                   u.name as patient_name,
                   u.email as patient_email,
                   u.profile_image as patient_image,
                   c.id as conversation_id
            FROM appointments a
            JOIN users u ON a.patient_id = u.id
            LEFT JOIN conversations c ON c.patient_id = a.patient_id AND c.therapist_id = a.therapist_id
            WHERE a.therapist_id = $1
            AND a.appointment_date >= CURRENT_DATE
            AND a.status = 'confirmed'
            ORDER BY a.appointment_date ASC, a.appointment_time ASC
        `;

    const result = await db.query(appointmentsQuery, [therapistId]);
    const appointments = result.rows || [];

    // Get appointment requests (pending)
    const pendingQuery = `
            SELECT a.*,
                   u.name as patient_name,
                   u.email as patient_email,
                   u.profile_image as patient_image,
                   c.id as conversation_id
            FROM appointments a
            JOIN users u ON a.patient_id = u.id
            LEFT JOIN conversations c ON c.patient_id = a.patient_id AND c.therapist_id = a.therapist_id
            WHERE a.therapist_id = $1
            AND a.status = 'pending'
            ORDER BY a.created_at DESC
        `;

    const pendingResult = await db.query(pendingQuery, [therapistId]);
    const pendingAppointments = pendingResult.rows || [];

    // Get completed appointments (past confirmed appointments)
    const completedQuery = `
            SELECT a.*,
                   u.name as patient_name,
                   u.email as patient_email,
                   u.profile_image as patient_image
            FROM appointments a
            JOIN users u ON a.patient_id = u.id
            WHERE a.therapist_id = $1
            AND a.appointment_date < CURRENT_DATE
            AND a.status = 'confirmed'
            ORDER BY a.appointment_date DESC, a.appointment_time DESC
            LIMIT 10
        `;

    const completedResult = await db.query(completedQuery, [therapistId]);
    const completedAppointments = completedResult.rows || [];

    // Get profile image URL
    let profileImageUrl = null;
    if (req.session.user.profile_image) {
      profileImageUrl = req.session.user.profile_image.startsWith("/")
        ? req.session.user.profile_image
        : `/uploads/profiles/${req.session.user.profile_image}`;
    }

    res.render("pages/therapist/schedule", {
      title: "Schedule",
      subtitle: "Manage your appointments",
      user: req.session.user,
      appointments: appointments,
      pendingAppointments: pendingAppointments,
      completedAppointments: completedAppointments,
      profileImageUrl: profileImageUrl,
      currentPage: "schedule",
      layout: "layouts/therapist",
    });
  } catch (error) {
    console.error("Error loading schedule:", error);
    req.flash("error", "Failed to load schedule");
    res.redirect("/therapist");
  }
};

// Add these methods to therapistController.js

// Get patient info page
// Fixed getPatientInfo method with error handling for missing tables
exports.getPatientInfo = async (req, res) => {
  try {
    console.log("🔍 Patient info request received");
    console.log("👨‍⚕️ Therapist ID:", req.session.user.id);
    console.log("👤 Requested patient ID:", req.params.patientId);

    const therapistId = req.session.user.id;
    const patientId = req.params.patientId;

    // First verify that this patient belongs to this therapist
    const relationshipQuery = `
            SELECT DISTINCT u.id, u.name, u.email, u.profile_image
            FROM users u
            INNER JOIN appointments a ON u.id = a.patient_id
            WHERE a.therapist_id = $1 AND u.id = $2
            LIMIT 1
        `;

    const patientResult = await db.query(relationshipQuery, [
      therapistId,
      patientId,
    ]);

    if (patientResult.rows.length === 0) {
      req.flash("error", "Patient not found or access denied");
      return res.redirect("/therapist/patients");
    }

    const patient = patientResult.rows[0];

    // Get appointments for this patient with this therapist
    const appointmentsQuery = `
            SELECT *
            FROM appointments
            WHERE therapist_id = $1 AND patient_id = $2
            ORDER BY appointment_date DESC, appointment_time DESC
        `;
    const appointmentsResult = await db.query(appointmentsQuery, [
      therapistId,
      patientId,
    ]);
    const appointments = appointmentsResult.rows || [];

    // Count upcoming appointments
    const upcomingQuery = `
            SELECT COUNT(*) as count
            FROM appointments
            WHERE therapist_id = $1 AND patient_id = $2 
            AND appointment_date >= CURRENT_DATE 
            AND status = 'confirmed'
        `;
    const upcomingResult = await db.query(upcomingQuery, [
      therapistId,
      patientId,
    ]);
    const upcomingAppointments = parseInt(upcomingResult.rows[0]?.count) || 0;

    // Initialize data arrays
    let moodEntries = [];
    let drawings = [];
    let musicPreferences = [];
    let panicSessions = [];

    // MOOD ENTRIES QUERY - Fixed to match schema
    try {
      const moodQuery = `
                SELECT
                    id,
                    mood_level as mood,
                    mood_intensity as energy,
                    note,
                    triggers,
                    activities,
                    created_at as entry_date,
                    created_at
                FROM mood_entries
                WHERE user_id = $1
                ORDER BY created_at DESC
                LIMIT 20
            `;
      const moodResult = await db.query(moodQuery, [patientId]);
      moodEntries = moodResult.rows || [];
      console.log("✅ Found mood entries:", moodEntries.length);
    } catch (moodError) {
      console.log("❌ Mood entries table error:", moodError.message);
    }

    // ARTWORKS QUERY - Get actual patient artwork from artworks table
    try {
      const artworksQuery = `
                SELECT
                    id,
                    image_data,
                    created_at
                FROM artworks
                WHERE user_id = $1
                ORDER BY created_at DESC
                LIMIT 10
            `;
      console.log("🎨 Looking for patient artworks for user_id:", patientId);
      const artworksResult = await db.query(artworksQuery, [patientId]);
      drawings = artworksResult.rows || [];
      console.log("✅ Found artworks:", drawings.length);

      if (drawings.length > 0) {
        console.log(
          "🎨 Sample artwork data:",
          JSON.stringify(drawings[0], null, 2)
        );

        // Convert base64 image data to proper format for display
        drawings = drawings.map((artwork, index) => ({
          id: artwork.id,
          image_data: artwork.image_data,
          artwork_image: `data:image/png;base64,${artwork.image_data}`,
          session_name: `Patient Artwork #${index + 1}`,
          art_type: "digital_art",
          duration: null,
          mood_before: null,
          mood_after: null,
          tools_used: [],
          colors_used: [],
          canvas_size: "800x600",
          is_completed: true,
          session_date: artwork.created_at,
          artwork_date: artwork.created_at,
        }));
      } else {
        console.log("⚠️ No artworks found for user_id:", patientId);

        // Debug: Check if artworks table exists and has any data
        try {
          const debugCheck = await db.query(
            "SELECT COUNT(*) as total FROM artworks"
          );
          console.log(
            "📊 Total artworks in database:",
            debugCheck.rows[0].total
          );

          if (debugCheck.rows[0].total > 0) {
            const sampleData = await db.query(
              "SELECT user_id, COUNT(*) as count FROM artworks GROUP BY user_id"
            );
            console.log("👥 Artworks by user:", sampleData.rows);
          }
        } catch (debugError) {
          console.log("❌ Could not check artworks table:", debugError.message);
        }
      }
    } catch (artworksError) {
      console.log("❌ Artworks table error:", artworksError.message);
    }

    // MUSIC SESSIONS QUERY - Fixed to get all necessary fields
    try {
      const musicQuery = `
                SELECT
                    id,
                    title,
                    artist,
                    category,
                    duration,
                    playlist_name,
                    mood_before,
                    mood_after,
                    spotify_track_id,
                    session_date,
                    created_at
                FROM music_sessions
                WHERE user_id = $1
                ORDER BY session_date DESC
                LIMIT 10
            `;
      console.log("🎵 Looking for music sessions for user_id:", patientId);
      const musicResult = await db.query(musicQuery, [patientId]);
      musicPreferences = musicResult.rows || [];
      console.log("✅ Found music sessions:", musicPreferences.length);

      if (musicPreferences.length > 0) {
        console.log(
          "🎵 Sample music data:",
          JSON.stringify(musicPreferences[0], null, 2)
        );
      } else {
        console.log("⚠️ No music sessions found for user_id:", patientId);

        // Debug: Check if table exists and has any data
        try {
          const debugCheck = await db.query(
            "SELECT COUNT(*) as total FROM music_sessions"
          );
          console.log(
            "📊 Total music sessions in database:",
            debugCheck.rows[0].total
          );

          if (debugCheck.rows[0].total > 0) {
            const sampleData = await db.query(
              "SELECT user_id, COUNT(*) as count FROM music_sessions GROUP BY user_id"
            );
            console.log("👥 Music sessions by user:", sampleData.rows);
          }
        } catch (debugError) {
          console.log(
            "❌ Could not check music_sessions table:",
            debugError.message
          );
        }
      }
    } catch (musicError) {
      console.log("❌ Music sessions table error:", musicError.message);
    }
    // Safely query panic sessions

    try {
      const panicQuery = `
        SELECT 
            id,
            session_id,
            start_time,
            end_time,
            duration,
            trigger_method,
            breathing_used,
            emergency_contacts_used,
            audio_recordings,
            session_notes,
            created_at
        FROM panic_sessions
        WHERE user_id = $1
        ORDER BY start_time DESC
        LIMIT 10
    `;
      const panicResult = await db.query(panicQuery, [patientId]);
      panicSessions = panicResult.rows || [];

      // Process audio recordings to make them displayable
      panicSessions = panicSessions.map((session) => {
        let processedAudioRecordings = [];

        try {
          // Parse audio recordings if they exist
          if (session.audio_recordings) {
            const recordings =
              typeof session.audio_recordings === "string"
                ? JSON.parse(session.audio_recordings)
                : session.audio_recordings;

            processedAudioRecordings = recordings.map((recording) => ({
              id: recording.id,
              duration: recording.duration,
              timestamp: recording.timestamp,
              size: recording.size || 0,
              // Create a placeholder URL since we can't serve the actual blob
              hasAudio: true,
              durationFormatted: Math.round(recording.duration / 1000) + "s",
            }));
          }
        } catch (error) {
          console.log("Error processing audio recordings:", error.message);
        }

        // Process emergency contacts
        let emergencyContactsList = [];
        try {
          if (session.emergency_contacts_used) {
            const contacts =
              typeof session.emergency_contacts_used === "string"
                ? JSON.parse(session.emergency_contacts_used)
                : session.emergency_contacts_used;
            emergencyContactsList = contacts || [];
          }
        } catch (error) {
          console.log("Error processing emergency contacts:", error.message);
        }

        return {
          ...session,
          audio_recordings_processed: processedAudioRecordings,
          emergency_contacts_processed: emergencyContactsList,
          duration_formatted: session.duration
            ? Math.round(session.duration / 1000 / 60) + " minutes"
            : "Unknown",
          trigger_method_formatted: (session.trigger_method || "manual")
            .replace("_", " ")
            .replace(/\b\w/g, (l) => l.toUpperCase()),
        };
      });

      console.log(
        `Found ${panicSessions.length} panic sessions for user ${patientId}`
      );
    } catch (panicError) {
      console.log(
        "Panic sessions table doesn't exist or has issues:",
        panicError.message
      );
    }

    // Get profile image URL
    let profileImageUrl = null;
    if (req.session.user.profile_image) {
      profileImageUrl = req.session.user.profile_image.startsWith("/")
        ? req.session.user.profile_image
        : `/uploads/profiles/${req.session.user.profile_image}`;
    }

    console.log("🚀 Rendering patient info page for:", patient.name);
    console.log("👤 Patient ID:", patientId);
    console.log("👤 Patient details:", {
      id: patient.id,
      name: patient.name,
      email: patient.email,
    });
    console.log("📊 Data summary:");
    console.log("  - Appointments:", appointments.length);
    console.log("  - Drawings:", drawings.length);
    console.log("  - Music sessions:", musicPreferences.length);
    console.log("  - Mood entries:", moodEntries.length);
    console.log("  - Panic sessions:", panicSessions.length);

    // Debug: Check if data exists in tables for this user
    console.log("🔍 Checking raw table data for user_id:", patientId);
    try {
      const debugQueries = await Promise.all([
        db.query(
          "SELECT COUNT(*) as count FROM drawing_sessions WHERE user_id = $1",
          [patientId]
        ),
        db.query(
          "SELECT COUNT(*) as count FROM music_sessions WHERE user_id = $1",
          [patientId]
        ),
        db.query(
          "SELECT COUNT(*) as count FROM mood_entries WHERE user_id = $1",
          [patientId]
        ),
        db.query(
          "SELECT COUNT(*) as count FROM panic_sessions WHERE user_id = $1",
          [patientId]
        ),
      ]);

      console.log("📋 Raw table counts:");
      console.log("  - Drawing sessions in DB:", debugQueries[0].rows[0].count);
      console.log("  - Music sessions in DB:", debugQueries[1].rows[0].count);
      console.log("  - Mood entries in DB:", debugQueries[2].rows[0].count);
      console.log("  - Panic sessions in DB:", debugQueries[3].rows[0].count);
    } catch (debugError) {
      console.log("❌ Debug query error:", debugError.message);
    }

    // Debug: Check if data exists in tables for this user
    console.log("🔍 Checking raw table data for user_id:", patientId);
    try {
      const debugQueries = await Promise.all([
        db.query(
          "SELECT COUNT(*) as count FROM drawing_sessions WHERE user_id = $1",
          [patientId]
        ),
        db.query(
          "SELECT COUNT(*) as count FROM music_sessions WHERE user_id = $1",
          [patientId]
        ),
        db.query(
          "SELECT COUNT(*) as count FROM mood_entries WHERE user_id = $1",
          [patientId]
        ),
        db.query(
          "SELECT COUNT(*) as count FROM panic_sessions WHERE user_id = $1",
          [patientId]
        ),
      ]);

      console.log("📋 Raw table counts:");
      console.log("  - Drawing sessions in DB:", debugQueries[0].rows[0].count);
      console.log("  - Music sessions in DB:", debugQueries[1].rows[0].count);
      console.log("  - Mood entries in DB:", debugQueries[2].rows[0].count);
      console.log("  - Panic sessions in DB:", debugQueries[3].rows[0].count);
    } catch (debugError) {
      console.log("❌ Debug query error:", debugError.message);
    }

    res.render("pages/therapist/info", {
      title: `${patient.name} - Patient Info`,
      subtitle: "Patient overview and history",
      user: req.session.user,
      patient: patient,
      appointments: appointments,
      upcomingAppointments: upcomingAppointments,
      moodEntries: moodEntries,
      drawings: drawings,
      musicPreferences: musicPreferences,
      panicSessions: panicSessions,
      profileImageUrl: profileImageUrl,
      currentPage: "patients",
      layout: "layouts/therapist",
    });
  } catch (error) {
    console.error("❌ Error loading patient info:", error);
    console.error("❌ Error stack:", error.stack);
    req.flash("error", "Failed to load patient information");
    res.redirect("/therapist/patients");
  }
};
// API endpoint to save panic session
exports.savePanicSession = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const {
      sessionId,
      startTime,
      endTime,
      duration,
      triggerMethod,
      breathingUsed,
      emergencyContactsUsed,
      audioRecordings,
      sessionNotes,
    } = req.body;

    // Check if session already exists
    const existingQuery = `
            SELECT id FROM panic_sessions WHERE session_id = $1
        `;
    const existingResult = await db.query(existingQuery, [sessionId]);

    let query, values;

    if (existingResult.rows.length > 0) {
      // Update existing session
      query = `
                UPDATE panic_sessions 
                SET end_time = $2, duration = $3, trigger_method = $4, 
                    breathing_used = $5, emergency_contacts_used = $6, 
                    audio_recordings = $7, session_notes = $8, updated_at = CURRENT_TIMESTAMP
                WHERE session_id = $1
                RETURNING id
            `;
      values = [
        sessionId,
        endTime || null,
        duration || null,
        triggerMethod || "manual",
        breathingUsed || false,
        JSON.stringify(emergencyContactsUsed || []),
        JSON.stringify(audioRecordings || []),
        sessionNotes || null,
      ];
    } else {
      // Insert new session
      query = `
                INSERT INTO panic_sessions 
                (user_id, session_id, start_time, end_time, duration, trigger_method, 
                 breathing_used, emergency_contacts_used, audio_recordings, session_notes)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING id
            `;
      values = [
        userId,
        sessionId,
        startTime,
        endTime || null,
        duration || null,
        triggerMethod || "manual",
        breathingUsed || false,
        JSON.stringify(emergencyContactsUsed || []),
        JSON.stringify(audioRecordings || []),
        sessionNotes || null,
      ];
    }

    const result = await db.query(query, values);

    if (result.rows.length > 0) {
      res.json({
        success: true,
        message: "Panic session saved successfully",
        sessionId: sessionId,
      });
    } else {
      throw new Error("Failed to save panic session");
    }
  } catch (error) {
    console.error("Error saving panic session:", error);
    res.status(500).json({
      success: false,
      error: "Failed to save panic session",
    });
  }
};

// Upload profile image
exports.uploadProfileImage = async (req, res) => {
  try {
    const userId = req.session.user.id;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No file uploaded",
      });
    }

    const filename = req.file.filename;

    // Update therapist application with new profile image
    const updateQuery = `
            UPDATE therapist_applications 
            SET profile_image = $1, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $2
            RETURNING profile_image
        `;

    const result = await db.query(updateQuery, [filename, userId]);

    if (result.rows.length > 0) {
      res.json({
        success: true,
        imageUrl: `/uploads/${filename}`,
        message: "Profile image updated successfully",
      });
    } else {
      res.status(404).json({
        success: false,
        error: "Therapist application not found",
      });
    }
  } catch (error) {
    console.error("Error uploading profile image:", error);
    res.status(500).json({
      success: false,
      error: "Failed to upload image",
    });
  }
};

// Update therapist profile
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { bio, experience, specialty, phone } = req.body;

    const updateQuery = `
            UPDATE therapist_applications 
            SET bio = $1, experience = $2, specialty = $3, phone = $4,
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $5
            RETURNING *
        `;

    const result = await db.query(updateQuery, [
      bio,
      experience,
      specialty,
      phone,
      userId,
    ]);

    if (result.rows.length > 0) {
      res.json({
        success: true,
        message: "Profile updated successfully",
        profile: result.rows[0],
      });
    } else {
      res.status(404).json({
        success: false,
        error: "Profile not found",
      });
    }
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update profile",
    });
  }
};

// Get therapist availability
exports.getAvailability = async (req, res) => {
  try {
    const therapistId = req.params.therapistId;
    const { date } = req.query;

    // Get existing appointments for the date
    const appointmentsQuery = `
            SELECT appointment_time, session_type 
            FROM appointments 
            WHERE therapist_id = $1 
            AND appointment_date = $2 
            AND status IN ('pending', 'confirmed')
            ORDER BY appointment_time
        `;

    const result = await db.query(appointmentsQuery, [therapistId, date]);
    const bookedSlots = result.rows.map((row) => row.appointment_time);

    // Define available time slots (you can make this dynamic per therapist)
    const allSlots = [
      "09:00",
      "10:00",
      "11:00",
      "12:00",
      "14:00",
      "15:00",
      "16:00",
      "17:00",
      "18:00",
    ];

    const availableSlots = allSlots.filter(
      (slot) => !bookedSlots.includes(slot)
    );

    res.json({
      success: true,
      date: date,
      availableSlots: availableSlots,
      bookedSlots: bookedSlots,
    });
  } catch (error) {
    console.error("Error getting availability:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get availability",
    });
  }
};

// Get patients API for therapist (for dropdowns, etc.)
exports.getPatientsAPI = async (req, res) => {
  try {
    const therapistId = req.session.user.id;

    // Get all patients who have appointments with this therapist
    const patientsQuery = `
            SELECT DISTINCT
                u.id, u.name, u.email, u.profile_image
            FROM users u
            INNER JOIN appointments a ON u.id = a.patient_id
            WHERE a.therapist_id = $1
            ORDER BY u.name ASC
        `;

    const result = await db.query(patientsQuery, [therapistId]);
    const patients = result.rows || [];

    res.json({
      success: true,
      patients: patients,
    });
  } catch (error) {
    console.error("Error loading patients API:", error);
    res.status(500).json({
      success: false,
      error: "Failed to load patients",
    });
  }
};

// Get therapist requests for therapist dashboard
exports.getTherapistRequests = async (req, res) => {
  try {
    const therapistId = req.session.user.id;

    const requestsQuery = `
        SELECT
          tr.id,
          tr.patient_id,
          tr.status,
          tr.created_at,
          tr.responded_at,
          u.name as patient_name,
          u.email as patient_email,
          u.profile_image as patient_image
        FROM therapist_requests tr
        JOIN users u ON tr.patient_id = u.id
        WHERE tr.therapist_id = $1
        ORDER BY tr.created_at DESC
      `;

    const result = await db.query(requestsQuery, [therapistId]);
    const requests = result.rows || [];

    res.json({
      success: true,
      requests: requests,
    });
  } catch (error) {
    console.error("Error fetching therapist requests:", error);
    res.status(500).json({
      success: false,
      error: "Failed to load requests",
    });
  }
};

// Respond to therapist request
exports.respondToRequest = async (req, res) => {
  try {
    const therapistId = req.session.user.id;
    const { requestId, action } = req.body;

    if (!requestId || !action || !["approve", "reject"].includes(action)) {
      return res.status(400).json({
        success: false,
        error: "Request ID and valid action are required",
      });
    }

    // Get request details
    const requestQuery = `
        SELECT patient_id FROM therapist_requests
        WHERE id = $1 AND therapist_id = $2
      `;
    const requestResult = await db.query(requestQuery, [
      requestId,
      therapistId,
    ]);

    if (requestResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Request not found",
      });
    }

    const patientId = requestResult.rows[0].patient_id;

    if (action === "approve") {
      // Update request status
      const updateQuery = `
          UPDATE therapist_requests
          SET status = 'approved', responded_at = CURRENT_TIMESTAMP
          WHERE id = $1
        `;
      await db.query(updateQuery, [requestId]);

      // Create or update therapist-patient relationship
      const relationshipQuery = `
          INSERT INTO therapist_patient_relationships (therapist_id, patient_id, status, created_at)
          VALUES ($1, $2, 'active', CURRENT_TIMESTAMP)
          ON CONFLICT (therapist_id, patient_id)
          DO UPDATE SET status = 'active', updated_at = CURRENT_TIMESTAMP
        `;
      await db.query(relationshipQuery, [therapistId, patientId]);

      // Notify patient
      const patientNotificationQuery = `
          INSERT INTO notifications (user_id, type, title, message, created_at)
          VALUES ($1, 'request_approved', 'Therapist Request Approved',
                  'Your therapist request has been approved! You can now schedule appointments.',
                  CURRENT_TIMESTAMP)
        `;
      await db.query(patientNotificationQuery, [patientId]);
    } else {
      // Reject request
      const updateQuery = `
          UPDATE therapist_requests
          SET status = 'rejected', responded_at = CURRENT_TIMESTAMP
          WHERE id = $1
        `;
      await db.query(updateQuery, [requestId]);

      // Notify patient
      const patientNotificationQuery = `
          INSERT INTO notifications (user_id, type, title, message, created_at)
          VALUES ($1, 'request_rejected', 'Therapist Request Update',
                  'Your therapist request was not approved at this time. You can try requesting another therapist.',
                  CURRENT_TIMESTAMP)
        `;
      await db.query(patientNotificationQuery, [patientId]);
    }

    res.json({
      success: true,
      message: `Request ${action}d successfully`,
    });
  } catch (error) {
    console.error("Error responding to therapist request:", error);
    res.status(500).json({
      success: false,
      error: "Failed to process request",
    });
  }
};

// Get patient therapist page
exports.getPatientTherapistPage = async (req, res) => {
  try {
    const patientId = req.session.user.id;

    // Get active therapist relationship
    const relationshipQuery = `
        SELECT
          tpr.id,
          tpr.therapist_id,
          tpr.created_at as relationship_date,
          u.name as therapist_name,
          u.email as therapist_email,
          u.profile_image as therapist_image,
          ta.bio,
          ta.specialty,
          ta.experience,
          ta.phone as therapist_phone
        FROM therapist_patient_relationships tpr
        JOIN users u ON tpr.therapist_id = u.id
        LEFT JOIN therapist_applications ta ON u.id = ta.user_id
        WHERE tpr.patient_id = $1 AND tpr.status = 'active'
        LIMIT 1
      `;

    const relationshipResult = await db.query(relationshipQuery, [patientId]);

    if (relationshipResult.rows.length === 0) {
      // Get profile image URL
      let profileImageUrl = null;
      if (req.session.user.profile_image) {
        profileImageUrl = req.session.user.profile_image.startsWith("/")
          ? req.session.user.profile_image
          : `/uploads/profiles/${req.session.user.profile_image}`;
      }

      return res.render("pages/my-therapist", {
        title: "My Therapist",
        user: req.session.user,
        therapist: null,
        hasTherapist: false,
        error:
          "You don't have an active therapist yet. Find one on our therapist directory.",
        profileImageUrl: profileImageUrl,
        currentPage: "therapist",
        layout: "layouts/therapist",
      });
    }

    const therapist = relationshipResult.rows[0];

    // Ensure therapist name starts with "Dr."
    if (therapist.therapist_name) {
      if (!therapist.therapist_name.toLowerCase().startsWith("dr.")) {
        therapist.therapist_name = "Dr. " + therapist.therapist_name;
      } else {
        // Remove existing "Dr." and add it properly to avoid duplication
        therapist.therapist_name = "Dr. " + therapist.therapist_name.substring(4).trim();
      }
    }

    // Get upcoming appointments with this therapist
    const appointmentsQuery = `
        SELECT *
        FROM appointments
        WHERE patient_id = $1 AND therapist_id = $2
        AND appointment_date >= CURRENT_DATE
        AND status = 'confirmed'
        ORDER BY appointment_date ASC, appointment_time ASC
        LIMIT 5
      `;

    const appointmentsResult = await db.query(appointmentsQuery, [
      patientId,
      therapist.therapist_id,
    ]);
    const upcomingAppointments = appointmentsResult.rows || [];

    // Get conversation history
    const conversationQuery = `
        SELECT id as conversation_id
        FROM conversations
        WHERE patient_id = $1 AND therapist_id = $2
        LIMIT 1
      `;

    const conversationResult = await db.query(conversationQuery, [
      patientId,
      therapist.therapist_id,
    ]);
    const conversation = conversationResult.rows[0] || null;

    // Get profile image URL
    let profileImageUrl = null;
    if (req.session.user.profile_image) {
      profileImageUrl = req.session.user.profile_image.startsWith("/")
        ? req.session.user.profile_image
        : `/uploads/profiles/${req.session.user.profile_image}`;
    }

    res.render("pages/my-therapist", {
      title: "My Therapist",
      subtitle: "Your assigned therapist",
      user: req.session.user,
      therapist: therapist,
      hasTherapist: true,
      upcomingAppointments: upcomingAppointments,
      conversation: conversation,
      profileImageUrl: profileImageUrl,
      currentPage: "therapist",
      layout: "layouts/therapist",
    });
  } catch (error) {
    console.error("Error loading patient therapist page:", error);
    // Get profile image URL
    let profileImageUrl = null;
    if (req.session.user.profile_image) {
      profileImageUrl = req.session.user.profile_image.startsWith("/")
        ? req.session.user.profile_image
        : `/uploads/profiles/${req.session.user.profile_image}`;
    }

    res.render("pages/my-therapist", {
      title: "My Therapist",
      user: req.session.user,
      therapist: null,
      hasTherapist: false,
      error: "Failed to load therapist information. Please try again.",
      profileImageUrl: profileImageUrl,
      currentPage: "therapist",
      layout: "layouts/therapist",
    });
  }
};

// Get therapist profile for public viewing
exports.getTherapistProfile = async (req, res) => {
  try {
    const therapistId = req.params.therapistId;

    const query = `
        SELECT
          u.id, u.name, u.email, u.profile_image as user_profile_image, u.bio as user_bio,
          ta.specialty, ta.experience, ta.bio as application_bio, ta.profile_image as application_profile_image, ta.phone,
          ta.created_at, ta.status
        FROM users u
        JOIN therapist_applications ta ON u.id = ta.user_id
        WHERE u.id = $1 AND u.role = 'therapist' AND ta.status = 'approved'
      `;

    const result = await db.query(query, [therapistId]);
    const therapist = result.rows[0] || null;

    if (!therapist) {
      return res.status(404).json({
        success: false,
        error: "Therapist not found or not approved",
      });
    }

    // Use bio from users table (where it's actually saved) with fallback to application bio
    therapist.bio =
      therapist.user_bio || therapist.application_bio || "No bio available.";
    therapist.profile_image =
      therapist.application_profile_image || therapist.user_profile_image;

    // Ensure therapist name starts with "Dr."
    if (therapist.name && !therapist.name.toLowerCase().startsWith("dr.")) {
      therapist.name = "Dr. " + therapist.name;
    }

    res.json({
      success: true,
      therapist: therapist,
    });
  } catch (error) {
    console.error("Error fetching therapist profile:", error);
    res.status(500).json({
      success: false,
      error: "Failed to load therapist profile",
    });
  }
};

// Rate a therapist
exports.rateTherapist = async (req, res) => {
  try {
    const therapistId = req.params.therapistId;
    const patientId = req.session.user.id;
    const { rating, review_text, is_anonymous } = req.body;

    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        error: "Rating must be between 1 and 5",
      });
    }

    // Check if patient has already rated this therapist
    const existingRatingQuery = `
        SELECT id FROM therapist_ratings
        WHERE therapist_id = $1 AND patient_id = $2
      `;
    const existingResult = await db.query(existingRatingQuery, [
      therapistId,
      patientId,
    ]);

    if (existingResult.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: "You have already rated this therapist",
      });
    }

    // Check if patient has had an appointment with this therapist
    const appointmentCheckQuery = `
        SELECT id FROM appointments
        WHERE therapist_id = $1 AND patient_id = $2 AND status = 'confirmed'
      `;
    const appointmentResult = await db.query(appointmentCheckQuery, [
      therapistId,
      patientId,
    ]);

    if (appointmentResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: "You can only rate therapists you have had appointments with",
      });
    }

    // Insert the rating
    const insertQuery = `
        INSERT INTO therapist_ratings (therapist_id, patient_id, rating, review_text, is_anonymous)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `;

    const result = await db.query(insertQuery, [
      therapistId,
      patientId,
      rating,
      review_text || null,
      is_anonymous || false,
    ]);

    if (result.rows.length > 0) {
      res.json({
        success: true,
        message: "Rating submitted successfully",
      });
    } else {
      throw new Error("Failed to insert rating");
    }
  } catch (error) {
    console.error("Error rating therapist:", error);
    res.status(500).json({
      success: false,
      error: "Failed to submit rating",
    });
  }
};

// Get therapist reviews and ratings
exports.getTherapistReviews = async (req, res) => {
  try {
    const therapistId = req.params.therapistId;

    // Get all reviews for this therapist
    const reviewsQuery = `
        SELECT
          tr.rating,
          tr.review_text,
          tr.is_anonymous,
          tr.created_at,
          CASE
            WHEN tr.is_anonymous THEN 'Anonymous Patient'
            ELSE CONCAT('Patient ', SUBSTRING(u.name FROM 1 FOR 1), '***')
          END as patient_name
        FROM therapist_ratings tr
        JOIN users u ON tr.patient_id = u.id
        WHERE tr.therapist_id = $1
        ORDER BY tr.created_at DESC
      `;

    const reviewsResult = await db.query(reviewsQuery, [therapistId]);
    const reviews = reviewsResult.rows || [];

    // Calculate rating statistics
    const statsQuery = `
        SELECT
          COUNT(*) as total_ratings,
          AVG(rating) as average_rating,
          COUNT(CASE WHEN rating = 5 THEN 1 END) as rating_5_count,
          COUNT(CASE WHEN rating = 4 THEN 1 END) as rating_4_count,
          COUNT(CASE WHEN rating = 3 THEN 1 END) as rating_3_count,
          COUNT(CASE WHEN rating = 2 THEN 1 END) as rating_2_count,
          COUNT(CASE WHEN rating = 1 THEN 1 END) as rating_1_count
        FROM therapist_ratings
        WHERE therapist_id = $1
      `;

    const statsResult = await db.query(statsQuery, [therapistId]);
    const stats = statsResult.rows[0] || {
      total_ratings: 0,
      average_rating: 0,
      rating_5_count: 0,
      rating_4_count: 0,
      rating_3_count: 0,
      rating_2_count: 0,
      rating_1_count: 0,
    };

    res.json({
      success: true,
      reviews: reviews,
      ratingStats: {
        totalRatings: parseInt(stats.total_ratings),
        averageRating: parseFloat(stats.average_rating) || 0,
        rating5Count: parseInt(stats.rating_5_count),
        rating4Count: parseInt(stats.rating_4_count),
        rating3Count: parseInt(stats.rating_3_count),
        rating2Count: parseInt(stats.rating_2_count),
        rating1Count: parseInt(stats.rating_1_count),
      },
    });
  } catch (error) {
    console.error("Error fetching therapist reviews:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch reviews",
    });
  }
};

// Get approved therapists API (for booking page)
exports.getApprovedTherapistsAPI = async (req, res) => {
  try {
    const query = `
        SELECT
          u.id, u.name, u.email,
          ta.specialty, ta.experience, ta.bio, ta.profile_image
        FROM users u
        JOIN therapist_applications ta ON u.id = ta.user_id
        WHERE u.role = 'therapist' AND ta.status = 'approved'
        ORDER BY u.name ASC
      `;

    const result = await db.query(query);
    const therapists = (result.rows || []).map((therapist) => {
      // Ensure therapist name starts with "Dr."
      let therapistName = therapist.name || "Therapist";
      if (!therapistName.toLowerCase().startsWith("dr.")) {
        therapistName = "Dr. " + therapistName;
      }
      return {
        ...therapist,
        name: therapistName,
      };
    });

    res.json({
      success: true,
      therapists: therapists,
    });
  } catch (error) {
    console.error("Error fetching approved therapists:", error);
    res.status(500).json({
      success: false,
      error: "Failed to load therapists",
    });
  }
};

module.exports = exports;
