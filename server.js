require("dotenv").config();
const express = require("express");
const path = require("path");
const session = require("express-session");
const flash = require("connect-flash");
const expressLayouts = require("express-ejs-layouts");
const http = require("http");
const { Server } = require("socket.io");
// const getPort = require("get-port");

// Import route files
const authRoutes = require("./routes/auth");
const socialAuthRoutes = require("./routes/socialAuth");
const adminRoutes = require("./routes/admin");
const therapistRoutes = require("./routes/therapist");
const findTherapistRoutes = require("./routes/findTherapist");
const indexRoutes = require("./routes/index");
const moodTrackerRoutes = require("./routes/moodTracker");
const musicRoutes = require("./routes/music");
const panicRoutes = require("./routes/panic");
const spotifyRoutes = require("./routes/authSpotify");
const drawingRoutes = require("./routes/drawingRoutes");
const accountRoutes = require("./routes/account");
const appointmentRoutes = require("./routes/appointments");
const therapistRequestsRoutes = require("./routes/therapistRequests");
const notificationsRoutes = require("./routes/notifications");
const chatRoutes = require("./routes/chat");
const supportRoutes = require("./routes/support");

// Import middleware
const { requireAuth } = require("./middleware/auth");
const basicAuth = require("./middleware/basicAuth");

// Import database configuration
const db = require("./config/database");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: function (origin, callback) {
      // Allow requests from localhost during development and production domain
      const allowedOrigins = [
        "http://localhost:3000",
        "https://ces40-calmtunes.onrender.com",
        "https://www.ces40-calmtunes.onrender.com"
      ];

      // Allow requests with no origin (mobile apps, etc.)
      if (!origin) return callback(null, true);

      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Attach Socket.IO instance to the app for use in controllers
app.set("io", io);

const PORT = process.env.PORT || 3000;

// View engine and layouts
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(expressLayouts);
// Note: Layout is set dynamically per route, no global layout

// Static files
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));
app.use("/uploads/profiles", express.static(path.join(__dirname, "public/uploads/profiles")));
app.use("/uploads/chat-files", express.static(path.join(__dirname, "public/uploads/chat-files")));

// Serve panic session audio files (add this BEFORE your general routes)
app.use('/audio/panic_sessions', express.static(path.join(__dirname, 'public/audio/panic_sessions'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.webm')) {
      res.set('Content-Type', 'audio/webm');
      res.set('Accept-Ranges', 'bytes');
    }
  }
}));

// Body parsing middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Basic authentication middleware (secures entire server)
// app.use(basicAuth); // COMMENTED OUT - Basic auth disabled in .env

// Session configuration (using memory store for development)
app.use(
  session({
    secret: process.env.SESSION_SECRET || "your-secret-key-change-this",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

// Flash messages
app.use(flash());

// Helper function to get profile image URL
const getProfileImageUrl = (user) => {
  if (user?.profile_image) {
    // If it's already a full URL, return as is
    if (user.profile_image.startsWith("http")) {
      return user.profile_image;
    }
    // If it already starts with /, return as is
    if (user.profile_image.startsWith("/")) {
      return user.profile_image;
    }
    // Otherwise, prepend the uploads path
    return `/uploads/profiles/${user.profile_image}`;
  }
  return null;
};

// Global variables middleware
app.use(async (req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.info = req.flash("info");

  // Add profile image URL for all pages
  if (req.session.user) {
    // If session doesn't have profile_image, fetch it from database
    if (req.session.user.profile_image === undefined) {
      try {
        const result = await db.query(
          "SELECT profile_image FROM users WHERE id = $1",
          [req.session.user.id]
        );
        if (result.rows.length > 0) {
          req.session.user.profile_image = result.rows[0].profile_image;
        }
      } catch (error) {
        console.error("Error fetching profile image:", error);
      }
    }

    res.locals.profileImageUrl = getProfileImageUrl(req.session.user);
  } else {
    res.locals.profileImageUrl = null;
  }

  next();
});

// ROUTE REGISTRATION (Order is critical!)

// 1. Authentication routes (public access)
app.use("/", authRoutes);
app.use("/auth", socialAuthRoutes);

// 2. Admin routes (protected)
app.use("/admin", adminRoutes);

// 3. Account management (authenticated users)
app.use("/account", accountRoutes);

// 4. Chat routes - BEFORE appointment routes to handle /chat properly
app.use("/chat", chatRoutes);

// 5. Support routes
app.use("/support", supportRoutes);

// 6. Appointment interface routes
app.use("/appointments", appointmentRoutes);

// 5. Spotify OAuth routes
app.use("/spotify", spotifyRoutes);

// 6. API Routes for appointments and chat - BEFORE other routes
app.use("/api/appointments", appointmentRoutes);

// 7. Specific feature routes
app.use("/music", musicRoutes);
app.use("/panic", panicRoutes);
app.use("/drawing", drawingRoutes);

// 7. Therapist dashboard routes (MUST come before findTherapistRoutes)
app.use("/therapist", therapistRoutes);

// 8. Find therapist routes (includes therapist profiles) - BEFORE general routes
app.use("/", findTherapistRoutes);

// 9. Mood tracking routes - BEFORE general routes
app.use("/", moodTrackerRoutes);

// 10. Therapist requests routes - BEFORE general routes
app.use("/", therapistRequestsRoutes);

// 11. Notifications routes - BEFORE general routes
app.use("/", notificationsRoutes);
// Session validation endpoint - MUST be before general routes
app.get("/api/session/validate", (req, res) => {
  if (req.session && req.session.user && req.session.user.id) {
    res.json({
      success: true,
      user: {
        id: req.session.user.id,
        name: req.session.user.name,
        email: req.session.user.email,
        role: req.session.user.role,
      },
    });
  } else {
    res.status(401).json({
      success: false,
      error: "Session invalid or expired",
    });
  }
});

// 12. General routes and patient dashboard - LAST
app.use("/", indexRoutes);

// Health check endpoint for database connectivity
app.get("/api/health", async (req, res) => {
  try {
    const client = await db.connect();
    await client.query("SELECT 1");
    client.release();

    res.json({
      success: true,
      status: "healthy",
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Health check failed:", error);
    res.status(503).json({
      success: false,
      status: "unhealthy",
      database: "disconnected",
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Database connection helper for notification routes

// Notification API routes
app.get("/api/notifications", requireAuth, async (req, res) => {
  let client;
  try {
    client = await db.connect();
    const query = `
            SELECT * FROM notifications
            WHERE user_id = $1
            ORDER BY created_at DESC
            LIMIT 20
        `;
    const result = await client.query(query, [req.session.user.id]);

    res.json({
      success: true,
      notifications: result.rows,
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch notifications",
    });
  } finally {
    if (client) client.release();
  }
});

app.post("/api/notifications/:id/mark-read", requireAuth, async (req, res) => {
  let client;
  try {
    client = await db.connect();
    await client.query(
      "UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2",
      [req.params.id, req.session.user.id]
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({
      success: false,
      error: "Failed to mark notification as read",
    });
  } finally {
    if (client) client.release();
  }
});

// Legacy booking route redirect
app.post("/book-consultation", (req, res) => {
  res.redirect(307, "/api/appointments/book");
});

// 404 Error handler
app.use((req, res, next) => {
  res.status(404).render("pages/404", {
    title: "Page Not Found",
    layout: "layouts/main",
  });
});

// Global error handler - Skip API routes to preserve JSON responses
app.use((error, req, res, next) => {
  // Skip API routes to preserve JSON error responses
  if (req.path.startsWith("/api/") || req.path.startsWith("/appointments/") || req.path.startsWith("/admin/")) {
    return next(error);
  }

  console.error("Server Error:", error);

  const errorMessage =
    process.env.NODE_ENV === "production"
      ? "Something went wrong!"
      : error.message;

  res.status(error.status || 500).render("pages/error", {
    title: "Error",
    message: errorMessage,
    error: process.env.NODE_ENV === "production" ? {} : error,
    layout: "layouts/main",
    user: req.session && req.session.user ? req.session.user : null,
    success: req.flash ? req.flash("success") : [],
    error: req.flash ? req.flash("error") : [],
    info: req.flash ? req.flash("info") : [],
  });
});

// Start server
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Authenticate user
  socket.on("authenticate", (userData) => {
    socket.userId = userData.userId;
    socket.role = userData.role;
    console.log(`User authenticated: ${userData.userId} (${userData.role})`);
  });

  // Join conversation room
  socket.on("join_conversation", (conversationId) => {
    socket.join(conversationId);
    console.log(`User ${socket.userId} joined conversation ${conversationId}`);
    // Emit online status to room
    socket
      .to(conversationId)
      .emit("user_online", { userId: socket.userId, online: true });
  });

  // Leave conversation room
  socket.on("leave_conversation", (conversationId) => {
    socket.leave(conversationId);
    console.log(`User ${socket.userId} left conversation ${conversationId}`);
    // Emit offline status to room
    socket.to(conversationId).emit("user_offline", { userId: socket.userId });
  });

  // Enhanced typing indicator
  socket.on("typing", (data) => {
    console.log("📝 User started typing:", {
      userId: socket.userId,
      userName: data.userName,
      conversationId: data.conversationId
    });

    if (data.conversationId && socket.userId) {
      socket
        .to(data.conversationId)
        .emit("user_typing", {
          userId: socket.userId,
          conversationId: data.conversationId,
          userName: data.userName || "Someone",
          typing: true
        });
    } else {
      console.error("❌ Invalid typing data:", data);
    }
  });

  socket.on("stop_typing", (data) => {
    console.log("📝 User stopped typing:", {
      userId: socket.userId,
      conversationId: data.conversationId
    });

    if (data.conversationId && socket.userId) {
      socket
        .to(data.conversationId)
        .emit("user_stopped_typing", {
          userId: socket.userId,
          conversationId: data.conversationId,
          typing: false
        });
    } else {
      console.error("❌ Invalid stop typing data:", data);
    }
  });

  // Message reactions
  socket.on("message_reaction", (data) => {
    socket.to(data.conversationId).emit("message_reaction", data);
  });

  socket.on("message_reaction_removed", (data) => {
    socket.to(data.conversationId).emit("message_reaction_removed", data);
  });

  // New message
  socket.on("new_message", (data) => {
    console.log("New message received:", data);
    // Broadcast to room (excluding sender)
    socket.to(data.conversationId).emit("new_message", {
      conversationId: data.conversationId,
      message: data.message,
    });
  });

  // Video/Phone call events - WebRTC Signaling
  socket.on("webrtc_offer", (data) => {
    console.log("WebRTC offer received:", data);
    socket.to(data.conversationId).emit("webrtc_offer", data);
  });

  socket.on("webrtc_answer", (data) => {
    console.log("WebRTC answer received:", data);
    socket.to(data.conversationId).emit("webrtc_answer", data);
  });

  socket.on("webrtc_ice_candidate", (data) => {
    console.log("ICE candidate received:", data);
    socket.to(data.conversationId).emit("webrtc_ice_candidate", data);
  });

  socket.on("call_ended", (data) => {
    console.log("Call ended:", data);
    socket.to(data.conversationId).emit("call_ended", data);
  });

  // Incoming call signaling
  socket.on("incoming_call", (data) => {
    console.log("Incoming call:", data);
    socket.to(data.conversationId).emit("incoming_call", data);
  });

  // Disconnect
  socket.on("disconnect", () => {
    if (socket.userId) {
      console.log(`User disconnected: ${socket.userId}`);
      // Emit offline status to rooms user was in (simplified)
      io.emit("user_offline", { userId: socket.userId });
    }
  });
});

// Handle port conflicts gracefully and start server
server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`❌ Port ${PORT} is already in use!`);
    console.error(`🔍 Run this command to find the process:`);
    console.error(`   netstat -ano | findstr :${PORT}`);
    console.error(`💀 Then kill it with:`);
    console.error(`   taskkill /PID <PID_NUMBER> /F`);
    console.error(`🔄 Or restart your computer to clear all processes`);
    process.exit(1);
  } else {
    console.error("❌ Server error:", error.message);
    process.exit(1);
  }
});

// Start server with proper port handling
server.listen(PORT, async () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log("⚠️  Using memory store for sessions (development only)");
  console.log("📊 Database: PostgreSQL");
  console.log(
    "🎯 Routes configured: Auth, Admin, Therapist, Chat, Appointments"
  );
  console.log("🔌 Socket.io enabled for real-time chat");

  // Initialize database tables on server startup
  try {
    const db = require("./config/database");

    // Create unified chat tables (required for patient-therapist chat)
    await db.createUnifiedChatTables();
    console.log("✅ Unified chat tables initialized successfully");

    // Create admin chat tables (for admin-specific features)
    await db.createAdminChatTables();
    console.log("✅ Admin chat tables initialized successfully");

    console.log("🎉 All database tables initialized successfully");
  } catch (error) {
    console.error("❌ Failed to initialize database tables:", error.message);
    console.log(
      "💡 You can manually create tables by visiting: /admin/test-database"
    );
  }
});

module.exports = app;
