const db = require("../config/database");
const multer = require('multer');
const path = require('path');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    // Allow only PDF, DOC, DOCX, and image files
    const allowedTypes = /pdf|doc|docx|jpg|jpeg|png/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only PDF, DOC, DOCX, and image files are allowed'));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

exports.getDashboard = (req, res) => {
  const userId = req.session.user.id;
  
  // Get therapist application status and profile info
  const query = `
    SELECT 
      ta.id as application_id,
      ta.status,
      ta.resume_file,
      ta.certification_file,
      ta.profile_image,
      ta.created_at,
      ta.updated_at,
      u.name,
      u.email,
      u.role
    FROM users u
    LEFT JOIN therapist_applications ta ON u.id = ta.user_id
    WHERE u.id = $1
  `;

  db.query(query, [userId], (err, results) => {
    if (err) {
      console.error("DB fetch error:", err);
      return res.render("pages/therapist/dashboard", {
        title: "Therapist Dashboard",
        user: req.session.user,
        application: null,
        error: "Failed to load dashboard data"
      });
    }

    const application = results.rows ? results.rows[0] : results[0];
    
    res.render("pages/therapist/dashboard", {
      title: "Therapist Dashboard",
      user: req.session.user,
      application: application || null
    });
  });
};

exports.getApplicationForm = (req, res) => {
  const userId = req.session.user.id;
  
  // Check if user already has an application
  const checkQuery = `
    SELECT id, status FROM therapist_applications 
    WHERE user_id = $1
  `;

  db.query(checkQuery, [userId], (err, results) => {
    if (err) {
      console.error("DB check error:", err);
      req.flash("error", "Database error occurred");
      return res.redirect("/therapist");
    }

    const existingApplication = results.rows && results.rows[0] ? results.rows[0] : null;
    
    if (existingApplication && existingApplication.status === 'pending') {
      req.flash("info", "You already have a pending application");
      return res.redirect("/therapist");
    }

    if (existingApplication && existingApplication.status === 'approved') {
      req.flash("info", "Your application has already been approved");
      return res.redirect("/therapist");
    }

    res.render("pages/therapist/apply", { 
      title: "Therapist Application",
      existingApplication
    });
  });
};

exports.submitApplication = (req, res) => {
  const uploadFiles = upload.fields([
    { name: 'resume', maxCount: 1 },
    { name: 'certifications', maxCount: 1 },
    { name: 'profileImage', maxCount: 1 }
  ]);

  uploadFiles(req, res, (err) => {
    if (err) {
      console.error("Upload error:", err);
      req.flash("error", err.message || "File upload failed");
      return res.redirect("/therapist/apply");
    }

    const { specialty, bio, experience } = req.body;
    const userId = req.session.user.id;
    
    const resumeFile = req.files.resume ? req.files.resume[0].filename : null;
    const certificationFile = req.files.certifications ? req.files.certifications[0].filename : null;
    const profileImage = req.files.profileImage ? req.files.profileImage[0].filename : null;

    if (!resumeFile) {
      req.flash("error", "Resume file is required");
      return res.redirect("/therapist/apply");
    }

    // Check if user already has a pending application
    const checkQuery = `
      SELECT id FROM therapist_applications 
      WHERE user_id = $1 AND status = 'pending'
    `;

    db.query(checkQuery, [userId], (err, results) => {
      if (err) {
        console.error("DB check error:", err);
        req.flash("error", "Database error occurred");
        return res.redirect("/therapist/apply");
      }

      if (results.rows && results.rows.length > 0) {
        req.flash("error", "You already have a pending application");
        return res.redirect("/therapist");
      }

      // Insert new application
      const insertQuery = `
        INSERT INTO therapist_applications 
        (user_id, specialty, bio, experience, resume_file, certification_file, profile_image, status, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', NOW())
        RETURNING id
      `;

      db.query(insertQuery, [
        userId, 
        specialty, 
        bio, 
        experience, 
        resumeFile, 
        certificationFile, 
        profileImage
      ], (err, result) => {
        if (err) {
          console.error("DB insert error:", err);
          req.flash("error", "Failed to submit application");
          return res.redirect("/therapist/apply");
        }

        req.flash("success", "Application submitted successfully! Please wait for admin approval.");
        res.redirect("/therapist");
      });
    });
  });
};

exports.getPatients = (req, res) => {
  // Only approved therapists can access this
  if (req.session.user.role !== 'therapist') {
    req.flash("error", "Access denied. You must be an approved therapist.");
    return res.redirect("/therapist");
  }

  // Get therapist's assigned patients (you'll need to implement patient assignment logic)
  const query = `
    SELECT u.id, u.name, u.email, u.created_at
    FROM users u
    WHERE u.role = 'patient'
    ORDER BY u.name
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error("DB fetch error:", err);
      req.flash("error", "Failed to load patients");
      return res.redirect("/therapist");
    }

    const patients = results.rows || results;
    res.render("pages/therapist/patients", {
      title: "My Patients",
      patients
    });
  });
};