const bcrypt = require('bcryptjs');

// Authentication controller
const authController = {
  // GET /login
  getLogin: (req, res) => {
    if (req.session.user) {
      return res.redirect('/dashboard');
    }
    res.render('pages/login', {
      title: 'Login - CalmTunes'
    });
  },

  // GET /signup
  getSignup: (req, res) => {
    if (req.session.user) {
      return res.redirect('/dashboard');
    }
    res.render('pages/signup', {
      title: 'Sign Up - CalmTunes'
    });
  },

  // POST /login
  postLogin: async (req, res) => {
    const { email, password } = req.body;
    
    // Demo authentication - replace with real database logic
    if (email === 'demo@calmtunes.com' && password === 'demo123') {
      req.session.user = {
        id: 1,
        email: email,
        name: 'Demo User'
      };
      req.flash('success', 'Welcome back! You have successfully logged in.');
      res.redirect('/dashboard');
    } else {
      req.flash('error', 'Invalid email or password');
      res.redirect('/login');
    }
  },

  // POST /signup
  postSignup: async (req, res) => {
    const { name, email, password, confirmPassword } = req.body;
    
    if (password !== confirmPassword) {
      req.flash('error', 'Passwords do not match');
      return res.redirect('/signup');
    }

    // Demo signup - replace with real database logic
    req.session.user = {
      id: Date.now(),
      email: email,
      name: name
    };
    
    req.flash('success', 'Account created successfully! Welcome to CalmTunes.');
    res.redirect('/dashboard');
  },

  // GET /logout
  getLogout: (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        req.flash('error', 'Error logging out');
        return res.redirect('/dashboard');
      }
      res.redirect('/');
    });
  }
};

module.exports = authController;