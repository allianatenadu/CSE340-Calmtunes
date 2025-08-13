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

      req.session.user = {
        id: user.id,
        name: user.name,
        email: user.email,
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

  // POST /signup
  postSignup: async (req, res) => {
    try {
      const { name, email, password, confirmPassword } = req.body;

      if (!name || !email || !password || !confirmPassword) {
        req.flash("error", "All fields are required");
        return res.redirect("/signup");
      }

      if (password !== confirmPassword) {
        req.flash("error", "Passwords do not match");
        return res.redirect("/signup");
      }

      const existingUser = await authModel.findUserByEmail(email);
      if (existingUser) {
        req.flash("error", "Email already registered");
        return res.redirect("/signup");
      }

      const hashedPassword = await bcrypt.hash(password, 12);
      const newUser = await authModel.createUser({
        name,
        email,
        password_hash: hashedPassword,
      });

      req.session.user = {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
      };

      req.flash("success", `Welcome to CalmTunes, ${newUser.name}!`);
      res.redirect("/dashboard");
    } catch (err) {
      console.error("Signup error:", err);
      req.flash("error", "Something went wrong. Please try again.");
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
