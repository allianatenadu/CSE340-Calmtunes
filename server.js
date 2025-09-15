require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const flash = require('connect-flash');
const expressLayouts = require('express-ejs-layouts');
const http = require('http');
const { Server } = require('socket.io');

// Import route files
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const therapistRoutes = require('./routes/therapist');
const findTherapistRoutes = require('./routes/findTherapist');
const indexRoutes = require('./routes/index');
const moodTrackerRoutes = require('./routes/moodTracker');
const musicRoutes = require('./routes/music');
const spotifyRoutes = require('./routes/authSpotify');
const drawingRoutes = require('./routes/drawingRoutes');
const accountRoutes = require('./routes/account');
const appointmentRoutes = require('./routes/appointments');

// Import middleware
const { requireAuth } = require('./middleware/auth');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3001",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3001;

// View engine and layouts
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layouts/main');

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Body parsing middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session configuration (using memory store for development)
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-this',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Flash messages
app.use(flash());

// Helper function to get profile image URL
const getProfileImageUrl = (user) => {
  if (user?.profile_image) {
    // If it's already a full URL, return as is
    if (user.profile_image.startsWith('http')) {
      return user.profile_image;
    }
    // If it already starts with /, return as is
    if (user.profile_image.startsWith('/')) {
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
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  res.locals.info = req.flash('info');
  
  // Add profile image URL for all pages
  if (req.session.user) {
    // If session doesn't have profile_image, fetch it from database
    if (req.session.user.profile_image === undefined) {
      try {
        const { Pool } = require('pg');
        const pool = new Pool({
          user: process.env.DB_USER || 'your_db_user',
          host: process.env.DB_HOST || 'localhost',
          database: process.env.DB_NAME || 'your_db_name',
          password: process.env.DB_PASSWORD || 'your_password',
          port: process.env.DB_PORT || 5432,
        });
        
        const result = await pool.query('SELECT profile_image FROM users WHERE id = $1', [req.session.user.id]);
        if (result.rows.length > 0) {
          req.session.user.profile_image = result.rows[0].profile_image;
        }
        pool.end();
      } catch (error) {
        console.error('Error fetching profile image:', error);
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
app.use('/', authRoutes);

// 2. Admin routes (protected)
app.use('/admin', adminRoutes);

// 3. Account management (authenticated users)
app.use('/account', accountRoutes);

// 4. Spotify OAuth routes
app.use('/spotify', spotifyRoutes);

// 5. API Routes for appointments and chat - BEFORE other routes
app.use('/api/appointments', appointmentRoutes);

// 6. Specific feature routes
app.use('/music', musicRoutes);
app.use('/drawing', drawingRoutes);

// 7. Therapist dashboard routes (MUST come before findTherapistRoutes)
app.use('/therapist', therapistRoutes);

// 8. Find therapist routes (includes therapist profiles)
app.use('/', findTherapistRoutes);

// 9. Mood tracking routes
app.use('/', moodTrackerRoutes);

// 10. Chat and appointment interface routes (with /api prefix)
app.use('/appointments', appointmentRoutes);
app.use('/chat', appointmentRoutes);

// 11. General routes and patient dashboard - LAST
app.use('/', indexRoutes);

// Database connection helper for notification routes

// Notification API routes
app.get('/api/notifications', requireAuth, async (req, res) => {
    const client = await pool.connect();
    try {
        const query = `
            SELECT * FROM notifications 
            WHERE user_id = $1 
            ORDER BY created_at DESC 
            LIMIT 20
        `;
        const result = await client.query(query, [req.session.user.id]);
        
        res.json({
            success: true,
            notifications: result.rows
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch notifications'
        });
    } finally {
        client.release();
    }
});

app.post('/api/notifications/:id/mark-read', requireAuth, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query(
            'UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2',
            [req.params.id, req.session.user.id]
        );
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to mark notification as read'
        });
    } finally {
        client.release();
    }
});

// Legacy booking route redirect
app.post('/book-consultation', (req, res) => {
    res.redirect(307, '/api/appointments/book');
});

// 404 Error handler
app.use((req, res, next) => {
  res.status(404).render('pages/404', {
    title: 'Page Not Found',
    layout: 'layouts/main'
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Server Error:', error);
  
  const errorMessage = process.env.NODE_ENV === 'production' 
    ? 'Something went wrong!' 
    : error.message;
    
  res.status(error.status || 500).render('pages/error', {
    title: 'Error',
    message: errorMessage,
    error: process.env.NODE_ENV === 'production' ? {} : error,
    layout: 'layouts/main',
    user: req.session && req.session.user ? req.session.user : null,
    success: req.flash ? req.flash('success') : [],
    error: req.flash ? req.flash('error') : [],
    info: req.flash ? req.flash('info') : []
  });
});

// Start server
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Authenticate user
  socket.on('authenticate', (userData) => {
    socket.userId = userData.userId;
    socket.role = userData.role;
    console.log(`User authenticated: ${userData.userId} (${userData.role})`);
  });

  // Join conversation room
  socket.on('join_conversation', (conversationId) => {
    socket.join(conversationId);
    console.log(`User ${socket.userId} joined conversation ${conversationId}`);
    // Emit online status to room
    socket.to(conversationId).emit('user_online', { userId: socket.userId, online: true });
  });

  // Typing indicator
  socket.on('typing', (data) => {
    socket.to(data.conversationId).emit('user_typing', { userId: socket.userId, typing: true });
  });

  socket.on('stop_typing', (data) => {
    socket.to(data.conversationId).emit('user_typing', { userId: socket.userId, typing: false });
  });

  // New message
  socket.on('new_message', (data) => {
    // Broadcast to room
    socket.to(data.conversationId).emit('new_message', data);
  });

  // Video/Phone call events
  socket.on('call_made', (data) => {
    socket.to(data.conversationId).emit('call_made', data);
  });

  socket.on('call_answered', (data) => {
    socket.to(data.conversationId).emit('call_answered', data);
  });

  socket.on('ice_candidate', (data) => {
    socket.to(data.conversationId).emit('ice_candidate', data);
  });

  socket.on('call_ended', (data) => {
    socket.to(data.conversationId).emit('call_ended', data);
  });

  // Disconnect
  socket.on('disconnect', () => {
    if (socket.userId) {
      console.log(`User disconnected: ${socket.userId}`);
      // Emit offline status to rooms user was in (simplified)
      io.emit('user_offline', { userId: socket.userId });
    }
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('⚠️  Using memory store for sessions (development only)');
  console.log('📊 Database: PostgreSQL');
  console.log('🎯 Routes configured: Auth, Admin, Therapist, Chat, Appointments');
  console.log('🔌 Socket.io enabled for real-time chat');
});

module.exports = app;