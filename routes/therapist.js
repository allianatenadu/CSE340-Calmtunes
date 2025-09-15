// routes/therapist.js - Updated with profile routes, chat, and schedule
const express = require("express");
const router = express.Router();
const therapistController = require("../controllers/therapistController");
const chatController = require("../controllers/chatController");
const appointmentController = require("../controllers/appointmentController");
const { requireAuth, requireTherapist, requirePotentialTherapist } = require("../middleware/auth");

// Therapist dashboard - main route (for approved therapists)
router.get("/", requireAuth, requireTherapist, therapistController.getDashboard);

// Application routes - allow any authenticated user to apply
router.get("/apply", requireAuth, requirePotentialTherapist, therapistController.getApplicationForm);
router.post("/apply", requireAuth, requirePotentialTherapist, therapistController.submitApplication);

// Patient management (for approved therapists)
router.get("/patients", requireAuth, requireTherapist, therapistController.getPatients);

// Schedule management (for approved therapists)
router.get("/schedule", requireAuth, requireTherapist, therapistController.getSchedule);

// Chat routes (for approved therapists)
router.get("/chat", requireAuth, requireTherapist, (req, res) => {
    res.render("pages/therapist/chat", {
        title: "Patient Chat",
        user: req.session.user
    });
});

// API routes for chat functionality
router.get("/api/conversations", requireAuth, requireTherapist, chatController.getConversations);
router.get("/api/conversations/:conversationId/messages", requireAuth, requireTherapist, chatController.getMessages);
router.post("/api/conversations/:conversationId/messages", requireAuth, requireTherapist, chatController.sendMessage);
router.post("/api/conversations/start", requireAuth, requireTherapist, chatController.startConversation);

// API routes for video calls
router.post("/api/video-call/start", requireAuth, requireTherapist, chatController.startVideoCall);
router.post("/api/video-call/:videoCallId/join", requireAuth, requireTherapist, chatController.joinVideoCall);
router.post("/api/video-call/:videoCallId/end", requireAuth, requireTherapist, chatController.endVideoCall);

// Appointment management API routes
router.get("/api/appointments", requireAuth, requireTherapist, appointmentController.getUserAppointments);
router.post("/api/appointments/create", requireAuth, requireTherapist, appointmentController.createAppointment);
router.post("/api/appointments/:appointmentId/confirm", requireAuth, requireTherapist, appointmentController.confirmAppointment);
router.post("/api/appointments/:appointmentId/reject", requireAuth, requireTherapist, appointmentController.rejectAppointment);
router.post("/api/appointments/:appointmentId/cancel", requireAuth, requireTherapist, appointmentController.cancelAppointment);

// API route to get patients for therapist
router.get("/api/patients", requireAuth, requireTherapist, therapistController.getPatientsAPI);

// API routes for availability
router.get("/api/:therapistId/availability", therapistController.getAvailability);

module.exports = router;