
require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
// Remove or comment out pgSession for now
// const pgSession = require('connect-pg-simple')(session);
const flash = require('connect-flash');
const expressLayouts = require('express-ejs-layouts');

const pool = require('./config/database');

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

const { requireAuth } = require('./middleware/auth');

const app = express();
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

// TEMPORARY: Use memory store for sessions (development only)
// This avoids the database session table issue
app.use(session({
  // Using default memory store (not suitable for production)
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-this',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Note: In production, you should use a persistent session store
// Once you fix the database issue, you can uncomment this:
/*
const pgSession = require('connect-pg-simple')(session);
app.use(session({
  store: new pgSession({
    pool: pool,
    tableName: 'user_sessions',
    createTableIfMissing: true
  }),
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-this',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000
  }
}));
*/

// Flash messages
app.use(flash());

// Global variables middleware
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  res.locals.info = req.flash('info');
  next();
});

// ROUTE REGISTRATION (Order is CRITICAL - specific routes first!)

// 1. Authentication routes (public access)
app.use('/', authRoutes);

// 2. Admin routes (protected)
app.use('/admin', adminRoutes);

// 3. Account management (authenticated users)
app.use('/account', accountRoutes);

// 4. Spotify OAuth routes
app.use('/spotify', spotifyRoutes);

// 5. SPECIFIC ROUTES FIRST - these must come before general '/' routes
app.use('/music', musicRoutes);
app.use('/drawing', drawingRoutes);

// 6. Find therapist routes - MOVE UP before other '/' routes
app.use('/', findTherapistRoutes);

// 7. Therapist dashboard routes
app.use('/therapist', therapistRoutes);

// 8. Mood tracking routes
app.use('/', moodTrackerRoutes);

// 9. General routes and patient dashboard - LAST to avoid conflicts
app.use('/', indexRoutes);

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
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📁 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('⚠️  Using memory store for sessions (development only)');
});

module.exports = app;