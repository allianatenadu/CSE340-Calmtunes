const express = require("express");
const router = express.Router();
const chatController = require("../controllers/chatController");
const { requireAuth, requireAdmin } = require("../middleware/auth");

// Chat page - handles both regular and admin chat
router.get("/", requireAuth, (req, res) => {
  console.log("=== CHAT ROUTE ACCESSED ===");
  console.log("Request URL:", req.originalUrl);
  console.log("Query params:", req.query);
  console.log("Session user:", req.session?.user);

  // Check if admin=true parameter is present
  const showAdminChat = req.query.admin === "true";
  console.log("showAdminChat flag:", showAdminChat);

  if (showAdminChat) {
    // Admin chat - render admin chat interface directly
    return res.render("pages/admin/admin-chat-list", {
      title: "Admin Chat",
      user: req.session.user,
    });
  }

  res.render("pages/chat", {
    title: "Chat",
    user: req.session.user,
    conversationId: null,
    showAdminChat: false,
  });
});

// API routes for chat functionality
router.post("/start", requireAuth, chatController.startConversation);
router.get("/conversations", requireAuth, chatController.getConversations);
router.get("/conversations/:conversationId/messages", requireAuth, chatController.getMessages);
router.post("/conversations/:conversationId/messages", requireAuth, chatController.sendMessage);

module.exports = router;