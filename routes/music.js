const express = require("express");
const router = express.Router();
const musicController = require("../controllers/musicController");
const { requireAuth, requirePatient } = require("../middleware/auth");

// only patients can access Music
router.get("/", requireAuth, requirePatient, musicController.getMusicPage);

module.exports = router;
