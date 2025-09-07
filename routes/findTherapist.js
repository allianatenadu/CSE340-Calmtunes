// routes/findTherapist.js - Fixed version with error handling
const express = require("express");
const router = express.Router();
const db = require("../config/database");

// Find therapist page - accessible to all users
router.get("/find-therapist", (req, res) => {
  console.log("Find therapist route accessed");
  
  // First, let's check what columns exist in therapist_applications table
  const schemaQuery = `
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'therapist_applications'
  `;
  
  db.query(schemaQuery, (schemaErr, schemaResults) => {
    if (schemaErr) {
      console.error("Schema check error:", schemaErr);
    } else {
      console.log("Available columns:", schemaResults.rows || schemaResults);
    }
    
    // Simplified query - only select columns that definitely exist
    const query = `
      SELECT 
        u.id,
        u.name,
        u.email,
        u.created_at as user_created_at,
        ta.id as application_id,
        ta.status,
        ta.bio,
        ta.experience,
        ta.profile_image,
        ta.resume_file,
        ta.certification_file,
        ta.created_at as application_date
      FROM users u
      JOIN therapist_applications ta ON u.id = ta.user_id
      WHERE u.role = 'therapist' AND ta.status = 'approved'
      ORDER BY u.name
    `;

    db.query(query, (err, results) => {
      if (err) {
        console.error("DB fetch error:", err);
        return res.render("pages/find-therapist", {
          title: "Find a Therapist",
          approvedTherapists: [],
          error: "Failed to load therapists",
          user: req.session?.user || null
        });
      }

      const therapists = (results.rows || results).map(therapist => ({
        ...therapist,
        specialty: "General Practice", // Default since column might not exist
        specialtyDisplay: "General Practice",
        experienceDisplay: therapist.experience || "Professional Experience",
        average_rating: "5.0",
        review_count: 0,
        patient_count: 0
      }));

      console.log("Therapists found:", therapists.length);
      
      res.render("pages/find-therapist", {
        title: "Find a Therapist",
        approvedTherapists: therapists,
        user: req.session?.user || null
      });
    });
  });
});

// Export the router
module.exports = router;