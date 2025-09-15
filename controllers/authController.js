const bcrypt = require('bcrypt');
const db = require('../config/database');

// Show signup form
exports.getSignup = (req, res) => {
  res.render('pages/signup', {
    title: 'Sign Up - CalmTunes',
    error: req.flash('error'),
    success: req.flash('success')
  });
};

// Handle signup
exports.postSignup = async (req, res) => {
  const { name, email, password, confirmPassword, role, terms } = req.body;
  
  try {
    // Validation
    if (!name || !email || !password || !confirmPassword || !role) {
      req.flash('error', 'All fields are required');
      return res.redirect('/signup');
    }
    
    if (password !== confirmPassword) {
      req.flash('error', 'Passwords do not match');
      return res.redirect('/signup');
    }
    
    if (password.length < 8) {
      req.flash('error', 'Password must be at least 8 characters long');
      return res.redirect('/signup');
    }
    
    if (!terms) {
      req.flash('error', 'You must accept the terms and conditions');
      return res.redirect('/signup');
    }
    
    // Validate role
    const validRoles = ['patient', 'therapist'];
    if (!validRoles.includes(role)) {
      req.flash('error', 'Invalid account type selected');
      return res.redirect('/signup');
    }
    
    // Check if user already exists
    const existingUser = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      req.flash('error', 'An account with this email already exists');
      return res.redirect('/signup');
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);
    
    // Create user
    const query = `
      INSERT INTO users (name, email, password_hash, role, created_at, updated_at)
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      RETURNING id, name, email, role, profile_image
    `;
    
    const result = await db.query(query, [name, email, passwordHash, role]);
    const newUser = result.rows[0];
    
    // Set up session
    req.session.user = {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      profile_image: newUser.profile_image
    };
    
    // Success message based on role
    if (role === 'therapist') {
      req.flash('success', 'Account created successfully! You can now apply to become a verified therapist.');
      res.redirect('/therapist/apply');
    } else {
      req.flash('success', 'Welcome to CalmTunes! Your account has been created successfully.');
      res.redirect('/dashboard');
    }
    
  } catch (error) {
    console.error('Signup error:', error);
    req.flash('error', 'An error occurred while creating your account. Please try again.');
    res.redirect('/signup');
  }
};

// Show login form
exports.getLogin = (req, res) => {
  res.render('pages/login', { 
    title: 'Login - CalmTunes',
    error: req.flash('error'),
    success: req.flash('success')
  });
};

// Handle login
exports.postLogin = async (req, res) => {
  const { email, password, remember } = req.body;
  
  try {
    if (!email || !password) {
      req.flash('error', 'Email and password are required');
      return res.redirect('/login');
    }
    
    // Find user
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    
    if (!user) {
      req.flash('error', 'Invalid email or password');
      return res.redirect('/login');
    }
    
    // Check password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      req.flash('error', 'Invalid email or password');
      return res.redirect('/login');
    }
    
    // Set up session
    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      profile_image: user.profile_image
    };
    
    // Extend session if remember me is checked
    if (remember) {
      req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
    }
    
    // Redirect based on role
    switch (user.role) {
      case 'admin':
        req.flash('success', 'Welcome back, Admin!');
        res.redirect('/admin');
        break;
      case 'therapist':
        req.flash('success', 'Welcome back!');
        res.redirect('/therapist');
        break;
      case 'patient':
        req.flash('success', 'Welcome back to CalmTunes!');
        res.redirect('/dashboard');
        break;
      default:
        req.flash('success', 'Login successful!');
        res.redirect('/dashboard');
    }
    
  } catch (error) {
    console.error('Login error:', error);
    req.flash('error', 'An error occurred during login. Please try again.');
    res.redirect('/login');
  }
};

// Handle logout
exports.logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
    }
    res.redirect('/');
  });
};