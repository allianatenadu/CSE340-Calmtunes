// server.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const flash = require('connect-flash');
const expressLayouts = require('express-ejs-layouts');

const pool = require('./config/database'); // your Pool from config/database.js
const indexRoutes = require('./routes/index'); // your index routes (create/update later)
const authRoutes = require('./routes/auth');   // auth routes (we'll add next steps)

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
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session store using Postgres
app.use(session({
  store: new pgSession({
    pool: pool,                // Connection pool
    tableName: 'session'       // Use the 'session' table
  }),
  secret: process.env.SESSION_SECRET || 'change_this_in_production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // true only on HTTPS
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 1 day
  }
}));


// Flash messages
app.use(flash());

// Global locals (available in all views)
app.use((req, res, next) => {
  res.locals.user = req.session?.user || null;
  res.locals.success = req.flash('success') || [];
  res.locals.error = req.flash('error') || [];
  next();
});

// Routes (index + auth)
// If your ./routes/auth or ./routes/index doesn't exist yet, create empty ones for now.
app.use('/', indexRoutes);
app.use('/', authRoutes);

// 404 fallback
app.use((req, res) => {
  res.status(404).render('pages/404', { title: 'Not Found' });
});

// Test database connection first
pool.connect((err, client, release) => {
  if (err) {
    console.error("❌ Database connection error:", err.stack);
  } else {
    console.log("✅ Database connected successfully");
    release();

    // Start the server only after DB connection
    app.listen(PORT, () => {
      console.log(`🎵 CalmTunes server running on http://localhost:${PORT}`);
      console.log(`🌿 Mental health support at your fingertips`);
    });
  }
});

