const express = require("express");
const router = express.Router();
const drawingController = require("../controllers/drawingController");
const { requireAuth, requirePatient } = require("../middleware/auth");

// only patients can access Drawing
router.get("/", requireAuth, requirePatient, drawingController.renderDrawingPage);
router.post("/save", requireAuth, requirePatient, drawingController.saveDrawing);
router.delete("/:id", requireAuth, requirePatient, drawingController.deleteDrawing);

module.exports = router;
