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

  res.render("pages/conversation", {
    title: "Chat",
    user: req.session.user,
    conversationId: null,
    showAdminChat: false,
    layout: "layouts/patient", // Use patient layout (hides navbar/footer for chat pages)
  });
});

// NEW ROUTE: Handle direct conversation access via URL parameter
router.get("/:conversationId", requireAuth, (req, res) => {
  console.log("=== DIRECT CONVERSATION ACCESS ===");
  console.log("Conversation ID:", req.params.conversationId);
  console.log("Session user:", req.session?.user);

  // Render the chat page with the conversationId pre-loaded
  res.render("pages/conversation", {
    title: "Chat",
    user: req.session.user,
    conversationId: req.params.conversationId, // Pass the conversationId to template
    showAdminChat: false,
    layout: "layouts/patient", // Use patient layout (hides navbar/footer for chat pages)
  });
});

// API routes for chat functionality
router.post("/start", requireAuth, chatController.startConversation);
router.get("/conversations", requireAuth, chatController.getConversations);
router.get("/conversations/:conversationId/messages", requireAuth, chatController.getMessages);
router.post("/conversations/:conversationId/messages", requireAuth, chatController.sendMessage);

// Enhanced chat features
router.post("/conversations/:conversationId/messages-with-file", requireAuth, chatController.upload.single('file'), chatController.sendMessageWithFile);
router.get("/conversations/:conversationId/enhanced-messages", requireAuth, chatController.getEnhancedMessages);

// Message reactions
router.post("/messages/:messageId/reactions", requireAuth, chatController.addMessageReaction);
router.delete("/messages/:messageId/reactions", requireAuth, chatController.removeMessageReaction);

// Typing indicators
router.post("/conversations/:conversationId/typing", requireAuth, chatController.updateTypingIndicator);

module.exports = router;