const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const expressLayouts = require('express-ejs-layouts');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Set EJS as templating engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Configure EJS layouts
app.use(expressLayouts);
app.set('layout', 'layouts/main');
app.set('layout extractScripts', true);
app.set('layout extractStyles', true);

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session configuration
app.use(session({
  secret: 'calmtunes-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

app.use(flash());

// Global middleware for flash messages and user session
app.use((req, res, next) => {
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  res.locals.user = req.session.user || null;
  next();
});

// Routes
const indexRoutes = require('./routes/index');
app.use('/', indexRoutes);

// Error handling middleware
app.use((req, res) => {
  res.status(404).render('layouts/main', {
    title: 'Page Not Found - CalmTunes',
    body: '<div class="text-center py-20"><h1 class="text-4xl font-bold text-textMain mb-4">404 - Page Not Found</h1><p class="text-gray-600">The page you are looking for does not exist.</p></div>'
  });
});

app.listen(PORT, () => {
  console.log(`🎵 CalmTunes server running on http://localhost:${PORT}`);
  console.log(`🌿 Mental health support at your fingertips`);
});