// middleware/auth.js - Complete role-based authentication with API support

// Original middleware for web pages (returns redirects)
const requireAuth = (req, res, next) => {
  if (!req.session || !req.session.user) {
    req.flash('error', 'Please login to access this page');
    return res.redirect('/login');
  }
  next();
};

const requirePatient = (req, res, next) => {
  if (!req.session || !req.session.user) {
    req.flash('error', 'Please login to access this page');
    return res.redirect('/login');
  }
  
  const userRole = req.session.user.role;
  
  // Redirect non-patients to their appropriate dashboards
  if (userRole === 'therapist') {
    return res.redirect('/therapist');
  }
  if (userRole === 'admin') {
    return res.redirect('/admin');
  }
  if (userRole !== 'patient') {
    req.flash('error', 'Access denied. Patient account required.');
    return res.redirect('/');
  }
  
  next();
};

const requireTherapist = (req, res, next) => {
  if (!req.session || !req.session.user) {
    req.flash('error', 'Please login to access this page');
    return res.redirect('/login');
  }
  
  if (req.session.user.role !== 'therapist') {
    req.flash('error', 'Access denied. Therapist account required.');
    // Redirect patients to their dashboard
    if (req.session.user.role === 'patient') {
      return res.redirect('/dashboard');
    }
    // Redirect admins to admin panel
    if (req.session.user.role === 'admin') {
      return res.redirect('/admin');
    }
    return res.redirect('/');
  }
  next();
};

const requirePotentialTherapist = (req, res, next) => {
  if (!req.session || !req.session.user) {
    req.flash('error', 'Please login to access this page');
    return res.redirect('/login');
  }
  
  // Allow patients to apply to become therapists, or existing therapists to access
  const userRole = req.session.user.role;
  if (userRole !== 'patient' && userRole !== 'therapist') {
    req.flash('error', 'Access denied.');
    return res.redirect('/');
  }
  next();
};

const requireAdmin = (req, res, next) => {
  if (!req.session || !req.session.user) {
    req.flash('error', 'Please login to access this page');
    return res.redirect('/login');
  }
  
  if (req.session.user.role !== 'admin') {
    req.flash('error', 'Access denied. Admin privileges required.');
    // Redirect users to their appropriate dashboards
    if (req.session.user.role === 'therapist') {
      return res.redirect('/therapist');
    }
    if (req.session.user.role === 'patient') {
      return res.redirect('/dashboard');
    }
    return res.redirect('/');
  }
  next();
};

// Middleware to redirect already authenticated users from login/signup pages
const redirectIfAuthenticated = (req, res, next) => {
  if (req.session && req.session.user) {
    switch (req.session.user.role) {
      case 'admin':
        return res.redirect('/admin');
      case 'therapist':
        return res.redirect('/therapist');
      case 'patient':
        return res.redirect('/dashboard');
      default:
        return res.redirect('/dashboard');
    }
  }
  next();
};

// Middleware to allow access to general features for all authenticated users
const requireAuthGeneral = (req, res, next) => {
  if (!req.session || !req.session.user) {
    req.flash('error', 'Please login to access this page');
    return res.redirect('/login');
  }
  // Allow all authenticated users (patients, therapists, admins)
  next();
};

// NEW: API-compatible auth middleware (returns JSON instead of redirects)
const requireAuthAPI = (req, res, next) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      redirect: '/login'
    });
  }
  next();
};

const requirePatientAPI = (req, res, next) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      redirect: '/login'
    });
  }
  
  const userRole = req.session.user.role;
  
  if (userRole !== 'patient') {
    return res.status(403).json({
      success: false,
      error: 'Access denied. Patient account required.',
      redirect: userRole === 'therapist' ? '/therapist' : 
               userRole === 'admin' ? '/admin' : '/'
    });
  }
  
  next();
};

const requireTherapistAPI = (req, res, next) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      redirect: '/login'
    });
  }
  
  if (req.session.user.role !== 'therapist') {
    return res.status(403).json({
      success: false,
      error: 'Access denied. Therapist account required.',
      redirect: req.session.user.role === 'patient' ? '/dashboard' : 
               req.session.user.role === 'admin' ? '/admin' : '/'
    });
  }
  next();
};

const requireAdminAPI = (req, res, next) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      redirect: '/login'
    });
  }
  
  if (req.session.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Access denied. Admin privileges required.',
      redirect: req.session.user.role === 'therapist' ? '/therapist' : 
               req.session.user.role === 'patient' ? '/dashboard' : '/'
    });
  }
  next();
};

module.exports = {
  // Original web middleware (redirects)
  requireAuth,
  requirePatient,
  requireTherapist,
  requirePotentialTherapist,
  requireAdmin,
  redirectIfAuthenticated,
  requireAuthGeneral,
  // New API middleware (JSON responses)
  requireAuthAPI,
  requirePatientAPI,
  requireTherapistAPI,
  requireAdminAPI
};