const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const { requireAuth, requireAdmin } = require("../middleware/auth");

// Admin dashboard
router.get("/", requireAuth, requireAdmin, adminController.getDashboard);

// Applications management
router.get("/applications", requireAuth, requireAdmin, adminController.getApplications);
router.post("/applications/:id/approve", requireAuth, requireAdmin, adminController.approveApplication);
router.post("/applications/:id/reject", requireAuth, requireAdmin, adminController.rejectApplication);

module.exports = router;