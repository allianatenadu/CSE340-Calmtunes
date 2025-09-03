const express = require("express");
const router = express.Router();
const musicController = require("../controllers/musicController");

// auth gate
function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  req.flash("error", "Please log in to access Music");
  res.redirect("/login");
}

router.get("/", requireAuth, musicController.getMusicPage);

module.exports = router;
