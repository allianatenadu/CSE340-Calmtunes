const db = require("../config/database");
const fs = require("fs").promises;
const path = require("path");

// Get panic page
module.exports.getPanicPage = async (req, res) => {
  try {
    const userId = req.session.user.id;

    // Fetch emergency contacts
    const contactsQuery =
      "SELECT * FROM user_contacts WHERE user_id = $1 ORDER BY created_at DESC";
    const contactsResult = await db.query(contactsQuery, [userId]);
    const emergencyContacts = contactsResult.rows;

    // Check if user has an assigned therapist
    const therapistQuery = `
      SELECT tpr.therapist_id, u.name as therapist_name
      FROM therapist_patient_relationships tpr
      JOIN users u ON tpr.therapist_id = u.id
      WHERE tpr.patient_id = $1 AND tpr.status = 'active'
      LIMIT 1
    `;
    const therapistResult = await db.query(therapistQuery, [userId]);
    const hasTherapist = therapistResult.rows.length > 0;
    const therapist = therapistResult.rows[0] || null;

    res.render("pages/panic", {
      title: "Panic Support",
      user: req.session.user,
      emergencyContacts: emergencyContacts,
      hasTherapist: hasTherapist,
      therapist: therapist,
      layout: "layouts/patient",
    });
  } catch (error) {
    console.error("Error loading panic page:", error);
    res.status(500).render("error", {
      title: "Error",
      message: "Failed to load panic support page",
      error: error.message,
    });
  }
};

// Enhanced savePanicSession method with proper audio file storage
module.exports.savePanicSession = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const {
      sessionId,
      startTime,
      endTime,
      duration,
      breathingUsed,
      emergencyContactsUsed,
      triggerMethod,
      audioRecordings, // This will now contain base64 audio data
      sessionNotes,
    } = req.body;

    console.log("Saving panic session for user:", userId);

    // Get user's assigned therapist
    const therapistQuery = `
      SELECT therapist_id FROM therapist_patient_relationships
      WHERE patient_id = $1 AND status = 'active'
      LIMIT 1
    `;
    const therapistResult = await db.query(therapistQuery, [userId]);
    const therapist_id = therapistResult.rows.length > 0 ? therapistResult.rows[0].therapist_id : null;

    // Process and save audio recordings to files
    let processedAudioRecordings = [];

    if (audioRecordings && audioRecordings.length > 0) {
      // Ensure audio directory exists
      const audioDir = path.join(__dirname, "../public/audio/panic_sessions");
      try {
        await fs.access(audioDir);
      } catch {
        await fs.mkdir(audioDir, { recursive: true });
      }

      for (let recording of audioRecordings) {
        try {
          if (recording.audioData) {
            // Expect base64 audio data
            const audioBuffer = Buffer.from(recording.audioData, "base64");
            const filename = `${sessionId}_${recording.id}_${Date.now()}.webm`;
            const filepath = path.join(audioDir, filename);

            // Save audio file
            await fs.writeFile(filepath, audioBuffer);

            // Store file reference instead of blob
            processedAudioRecordings.push({
              id: recording.id,
              filename: filename,
              duration: recording.duration,
              timestamp: recording.timestamp,
              size: audioBuffer.length,
              url: `/audio/panic_sessions/${filename}`,
            });

            console.log(`Audio file saved: ${filename}`);
          } else {
            // Keep metadata even if no audio data
            processedAudioRecordings.push({
              id: recording.id,
              duration: recording.duration,
              timestamp: recording.timestamp,
              size: recording.size || 0,
              filename: null,
              url: null,
            });
          }
        } catch (audioError) {
          console.error("Error processing audio recording:", audioError);
          // Continue with other recordings
        }
      }
    }

    // Check if session already exists
    let existingSession = null;
    if (sessionId) {
      const existingQuery =
        "SELECT id FROM panic_sessions WHERE session_id = $1";
      const existingResult = await db.query(existingQuery, [sessionId]);
      existingSession = existingResult.rows[0];
    }

    let query, values, result;

    if (existingSession) {
      // Update existing session
      query = `
        UPDATE panic_sessions 
        SET end_time = $2, duration = $3, breathing_used = $4, 
            emergency_contacts_used = $5, trigger_method = $6, 
            audio_recordings = $7, session_notes = $8, updated_at = CURRENT_TIMESTAMP
        WHERE session_id = $1
        RETURNING id
      `;
      values = [
        sessionId,
        endTime ? new Date(endTime) : null,
        duration || null,
        breathingUsed || false,
        JSON.stringify(emergencyContactsUsed || []),
        triggerMethod || "manual",
        JSON.stringify(processedAudioRecordings),
        sessionNotes || null,
      ];
    } else {
      // Insert new session
      const finalSessionId = sessionId || `panic_${Date.now()}_${userId}`;

      query = `
        INSERT INTO panic_sessions 
        (user_id, session_id, therapist_id, start_time, end_time, duration, 
         breathing_used, emergency_contacts_used, trigger_method, audio_recordings, session_notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id, session_id
      `;
      values = [
        userId,
        finalSessionId,
        therapist_id,
        new Date(startTime),
        endTime ? new Date(endTime) : null,
        duration || null,
        breathingUsed || false,
        JSON.stringify(emergencyContactsUsed || []),
        triggerMethod || "manual",
        JSON.stringify(processedAudioRecordings),
        sessionNotes || null,
      ];
    }

    result = await db.query(query, values);

    if (result.rows.length > 0) {
      console.log(
        "Panic session saved successfully with audio files:",
        result.rows[0]
      );

      let redirectUrl = "/dashboard";
      if (therapist_id) {
        redirectUrl = "/appointments";
      }

      res.json({
        success: true,
        sessionId: existingSession ? sessionId : result.rows[0].session_id,
        message: "Panic session saved successfully",
        audioFilesProcessed: processedAudioRecordings.length,
        redirectUrl,
      });
    } else {
      throw new Error("Failed to save panic session");
    }
  } catch (error) {
    console.error("Error saving panic session:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to save panic session",
    });
  }
};

// Get user's panic sessions for display
module.exports.getPanicSessions = async (req, res) => {
  try {
    const userId = req.session.user.id;

    const query = `
      SELECT
        id,
        session_id,
        start_time,
        end_time,
        duration,
        breathing_used,
        emergency_contacts_used,
        trigger_method,
        audio_recordings,
        session_notes,
        created_at
      FROM panic_sessions
      WHERE user_id = $1
      ORDER BY start_time DESC
      LIMIT 50
    `;

    const result = await db.query(query, [userId]);

    res.json({
      success: true,
      sessions: result.rows.map(session => ({
        ...session,
        start_time: session.start_time.toISOString(),
        end_time: session.end_time ? session.end_time.toISOString() : null,
        created_at: session.created_at.toISOString(),
        audio_recordings: Array.isArray(session.audio_recordings) ? session.audio_recordings : []
      }))
    });
  } catch (error) {
    console.error("Error fetching panic sessions:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch panic sessions",
    });
  }
};

// Delete a panic session
module.exports.deletePanicSession = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const sessionId = req.params.id;

    // First check if the session belongs to the user
    const checkQuery = "SELECT id FROM panic_sessions WHERE id = $1 AND user_id = $2";
    const checkResult = await db.query(checkQuery, [sessionId, userId]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Session not found or access denied",
      });
    }

    // Delete the session
    const deleteQuery = "DELETE FROM panic_sessions WHERE id = $1 AND user_id = $2";
    await db.query(deleteQuery, [sessionId, userId]);

    res.json({
      success: true,
      message: "Session deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting panic session:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to delete panic session",
    });
  }
};

// Get specific session for audio playback
module.exports.getSessionForPlayback = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const sessionId = req.params.sessionId;

    const query = `
      SELECT
        id,
        session_id,
        start_time,
        end_time,
        duration,
        breathing_used,
        emergency_contacts_used,
        trigger_method,
        audio_recordings,
        session_notes,
        created_at
      FROM panic_sessions
      WHERE user_id = $1 AND session_id = $2
      LIMIT 1
    `;

    const result = await db.query(query, [userId, sessionId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Session not found",
      });
    }

    const session = result.rows[0];

    res.json({
      success: true,
      session: {
        ...session,
        start_time: session.start_time.toISOString(),
        end_time: session.end_time ? session.end_time.toISOString() : null,
        created_at: session.created_at.toISOString(),
        audio_recordings: Array.isArray(session.audio_recordings) ? session.audio_recordings : []
      }
    });
  } catch (error) {
    console.error("Error fetching session for playback:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch session",
    });
  }
};

// Add route to serve audio files
module.exports.serveAudioFile = async (req, res) => {
  try {
    const filename = req.params.filename;
    const userId = req.session.user.id;
    const userRole = req.session.user.role;

    // Security check: ensure user can access this audio file
    const sessionQuery = `
      SELECT ps.user_id, ps.therapist_id 
      FROM panic_sessions ps 
      WHERE ps.audio_recordings::text LIKE '%${filename}%'
    `;

    const sessionResult = await db.query(sessionQuery);

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: "Audio file not found" });
    }

    const session = sessionResult.rows[0];

    // Check access permissions
    const hasAccess =
      userRole === "admin" ||
      (userRole === "patient" && session.user_id === userId) ||
      (userRole === "therapist" && session.therapist_id === userId);

    if (!hasAccess) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Serve the audio file
    const audioPath = path.join(
      __dirname,
      "../public/audio/panic_sessions",
      filename
    );

    try {
      await fs.access(audioPath);
      res.setHeader("Content-Type", "audio/webm");
      res.setHeader("Cache-Control", "private, max-age=3600");
      res.sendFile(audioPath);
    } catch {
      res.status(404).json({ error: "Audio file not found on disk" });
    }
  } catch (error) {
    console.error("Error serving audio file:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
