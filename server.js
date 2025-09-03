// server.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const flash = require('connect-flash');
const expressLayouts = require('express-ejs-layouts');

const pool = require('./config/database');

// Route files
const indexRoutes = require('./routes/index');
const authRoutes = require('./routes/auth');

const moodTrackerRoutes = require('./routes/moodTracker');
const musicRoutes = require('./routes/music');
const spotifyRoutes = require('./routes/authSpotify'); 
const drawingRoutes = require("./routes/drawingRoutes");

const app = express();
const PORT = process.env.PORT || 3001;

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// EJS layouts
app.use(expressLayouts);
app.set('layout', 'layouts/main');
app.set('layout extractScripts', true);
app.set('layout extractStyles', true);

// Static & parsers
app.use(express.json({ limit: "10mb" }));
app.use('/audio', express.static(path.join(__dirname, 'public/audio')));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ✅ Trust proxy for production (needed for secure cookies on Render)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// ✅ Dynamic cookie settings based on environment
const isProduction = process.env.NODE_ENV === 'production';

app.use(
  session({
    store: new pgSession({
      pool: pool,
      tableName: 'session',
    }),
    secret: process.env.SESSION_SECRET || 'change_this_in_production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: isProduction, // true on Render, false locally
      sameSite: isProduction ? 'none' : 'lax',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

// Flash messages
app.use(flash());

// Global locals
app.use((req, res, next) => {
  res.locals.user = req.session?.user || null;
  res.locals.success = req.flash('success') || [];
  res.locals.error = req.flash('error') || [];
  next();
});

// Routes
app.use('/', indexRoutes);
app.use('/', authRoutes);
app.use('/', moodTrackerRoutes);
app.use('/music', musicRoutes);
app.use('/spotify', spotifyRoutes);
app.use("/drawing", drawingRoutes);

// 404 fallback
app.use((req, res) => {
  res.status(404).render('pages/404', { title: 'Not Found' });
});

// Test DB connection and start server
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Database connection error:', err.stack);
  } else {
    console.log('✅ Database connected successfully');
    release();

    app.listen(PORT, () => {
      console.log(`🎵 CalmTunes server running on http://localhost:${PORT}`);
      console.log(`🌿 Mental health support at your fingertips`);
      console.log(
        `🔑 Spotify Redirect URI in use: ${
          process.env.NODE_ENV === 'production'
            ? process.env.SPOTIFY_REDIRECT_URI_PROD
            : process.env.SPOTIFY_REDIRECT_URI_LOCAL
        }`
      );
    });
  }
});
