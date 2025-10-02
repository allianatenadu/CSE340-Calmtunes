const db = require("../config/database"); // postgresql connection

// render drawing page
exports.renderDrawingPage = (req, res) => {
  // Get user ID from session consistently with other controllers
  const userId = req.session?.user?.id;
  
  if (!userId) {
    return res.render("pages/drawing", { 
      title: "Drawing Studio", 
      artworks: [] 
    });
  }

  // Only show artworks for the current user
  const query = "SELECT * FROM artworks WHERE user_id = $1 ORDER BY created_at DESC";

  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error("DB fetch error:", err);
      return res.render("pages/drawing", { 
        title: "Drawing Studio", 
        artworks: [] 
      });
    }

    // In Postgres, results are inside results.rows
    res.render("pages/drawing", {
      title: "Drawing Studio",
      artworks: results.rows || []
    });
  });
};

// save drawing
exports.saveDrawing = (req, res) => {
  try {
    let { imageData } = req.body;
    if (!imageData) {
      return res.status(400).json({ success: false, message: "No image data provided" });
    }

    // strip the prefix if present
    imageData = imageData.replace(/^data:image\/png;base64,/, "");

    // Use consistent session structure
    const userId = req.session?.user?.id;
    
    if (!userId) {
      return res.status(401).json({ success: false, message: "User not authenticated" });
    }

    console.log('Saving drawing for user ID:', userId); // Debug log

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
  const userId = req.session?.user?.id;
  
  if (!userId) {
    return res.status(401).json({ success: false, message: "User not authenticated" });
  }

  // Only allow users to delete their own artworks
  const query = "DELETE FROM artworks WHERE id = $1 AND user_id = $2";

  db.query(query, [id, userId], (err, result) => {
    if (err) {
      console.error("DB delete error:", err);
      return res.status(500).json({ success: false, message: "DB error" });
    }
    
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Artwork not found" });
    }
    
    return res.json({ success: true, message: "Artwork deleted!" });
  });
};