// controllers/authController.js
const bcrypt = require("bcryptjs");
const authModel = require("../models/authModel");

const authController = {
  // GET /login
  getLogin: (req, res) => {
    if (req.session.user) {
      return res.redirect("/dashboard");
    }
    res.render("pages/login", { title: "Login - CalmTunes" });
  },

  // POST /login
  postLogin: async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        req.flash("error", "Email and password are required");
        return res.redirect("/login");
      }

      const user = await authModel.findUserByEmail(email);
      if (!user) {
        req.flash("error", "Invalid email or password");
        return res.redirect("/login");
      }

      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (!isMatch) {
        req.flash("error", "Invalid email or password");
        return res.redirect("/login");
      }

      // ✅ FIXED: Include role in session data
      req.session.user = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role || 'patient' // Include role, default to 'patient' if null
      };

      req.flash("success", `Welcome back, ${user.name}!`);
      res.redirect("/dashboard");
    } catch (err) {
      console.error("Login error:", err);
      req.flash("error", "Something went wrong. Please try again.");
      res.redirect("/login");
    }
  },

  // GET /signup
  getSignup: (req, res) => {
    if (req.session.user) {
      return res.redirect("/dashboard");
    }
    res.render("pages/signup", { title: "Sign Up - CalmTunes" });
  },

  // POST /signup - UPDATED to handle role selection
  postSignup: async (req, res) => {
    try {
      const { name, email, password, confirmPassword, role } = req.body;

      // Validation
      if (!name || !email || !password || !confirmPassword) {
        req.flash("error", "All fields are required");
        return res.redirect("/signup");
      }

      if (password !== confirmPassword) {
        req.flash("error", "Passwords do not match");
        return res.redirect("/signup");
      }

      // Validate password strength
      if (password.length < 8) {
        req.flash("error", "Password must be at least 8 characters long");
        return res.redirect("/signup");
      }

      // Validate role
      const validRoles = ['patient', 'therapist'];
      const userRole = role && validRoles.includes(role) ? role : 'patient';

      const existingUser = await authModel.findUserByEmail(email);
      if (existingUser) {
        req.flash("error", "Email already registered");
        return res.redirect("/signup");
      }

      const hashedPassword = await bcrypt.hash(password, 12);
      const newUser = await authModel.createUser({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password_hash: hashedPassword,
        role: userRole // ✅ NEW: Pass role to createUser
      });

      // ✅ UPDATED: Include role in session data for new users
      req.session.user = {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role || userRole
      };

      // Different welcome messages based on role
      const welcomeMessage = userRole === 'therapist' 
        ? `Welcome to CalmTunes, Dr. ${newUser.name}! Your therapist account is ready.`
        : `Welcome to CalmTunes, ${newUser.name}! Your wellness journey begins now.`;

      req.flash("success", welcomeMessage);
      res.redirect("/dashboard");
    } catch (err) {
      console.error("Signup error:", err);
      
      // Handle specific database errors
      if (err.code === '23505') { // PostgreSQL unique constraint error
        req.flash("error", "Email address is already registered");
      } else if (err.message && err.message.includes('role')) {
        req.flash("error", "Invalid account type selected");
      } else {
        req.flash("error", "Something went wrong. Please try again.");
      }
      
      res.redirect("/signup");
    }
  },

  // GET /logout
  getLogout: (req, res, next) => {
    req.flash("success", "You have been logged out.");
    req.session.destroy((err) => {
      if (err) {
        console.error("Logout error:", err);
        return next(err);
      }
      res.clearCookie("connect.sid", { path: "/" });
      res.redirect("/");
    });
  }
};

module.exports = authController;