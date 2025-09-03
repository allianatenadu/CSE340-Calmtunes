const db = require("../config/database"); // postgresql connection

// render drawing page
exports.renderDrawingPage = (req, res) => {
  const query = "SELECT * FROM artworks ORDER BY created_at DESC";

  db.query(query, (err, results) => {
    if (err) {
      console.error("DB fetch error:", err);
      return res.render("pages/drawing", { title: "Drawing Studio", artworks: [] });
    }

    // In Postgres, results are inside results.rows
   res.render("pages/drawing", {
  title: "Drawing Studio",
  artworks: results.rows
});

  });
};

// save drawing
// save drawing
exports.saveDrawing = (req, res) => {
  try {
    let { imageData } = req.body;
    if (!imageData) {
      return res.status(400).json({ success: false, message: "No image data provided" });
    }

    // strip the prefix if present
    imageData = imageData.replace(/^data:image\/png;base64,/, "");

    const userId = req.user?.id || req.session?.userId || 1;

    const query = "INSERT INTO artworks (image_data, user_id) VALUES ($1, $2) RETURNING id";
    db.query(query, [imageData, userId], (err, result) => {
      if (err) {
        console.error("DB insert error:", err);
        return res.status(500).json({ success: false, message: "DB error" });
      }

      return res.json({ success: true, message: "Artwork saved!", id: result.rows[0].id });
    });
  } catch (error) {
    console.error("Save error:", error);
    res.status(500).json({ success: false, message: "Error saving artwork" });
  }
};

// delete drawing
exports.deleteDrawing = (req, res) => {
  const { id } = req.params;
  const query = "DELETE FROM artworks WHERE id = $1";

  db.query(query, [id], (err) => {
    if (err) {
      console.error("DB delete error:", err);
      return res.status(500).json({ success: false, message: "DB error" });
    }
    return res.json({ success: true, message: "Artwork deleted!" });
  });
};
