const express = require("express");
const router = express.Router();
const drawingController = require("../controllers/drawingController");

// Page
router.get("/", drawingController.renderDrawingPage);

// Save
router.post("/save", drawingController.saveDrawing);

// Delete
router.delete("/:id", drawingController.deleteDrawing);

module.exports = router;
