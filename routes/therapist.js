const express = require("express");
const router = express.Router();
const therapistController = require("../controllers/therapistController");
const { requireAuth, requireTherapist, requirePotentialTherapist } = require("../middleware/auth");

// Therapist dashboard - main route (for approved therapists)
router.get("/", requireAuth, requireTherapist, therapistController.getDashboard);

// Application routes - allow any authenticated user to apply
router.get("/apply", requireAuth, requirePotentialTherapist, therapistController.getApplicationForm);
router.post("/apply", requireAuth, requirePotentialTherapist, therapistController.submitApplication);

// Patient management (for approved therapists)
router.get("/patients", requireAuth, requireTherapist, therapistController.getPatients);

module.exports = router;