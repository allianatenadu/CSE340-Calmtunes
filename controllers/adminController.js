const db = require("../config/database");

// Admin dashboard
exports.getDashboard = (req, res) => {
  // Get comprehensive stats for the dashboard
  const statsQuery = `
    SELECT 
      COUNT(*) as total_applications,
      COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_applications,
      COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_applications,
      COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_applications,
      COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as applications_this_week,
      COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as applications_this_month
    FROM therapist_applications
  `;
  
  // Get user stats as well
  const userStatsQuery = `
    SELECT 
      COUNT(*) as total_users,
      COUNT(CASE WHEN role = 'patient' THEN 1 END) as total_patients,
      COUNT(CASE WHEN role = 'therapist' THEN 1 END) as total_therapists,
      COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as new_users_this_month
    FROM users
  `;
  
  db.query(statsQuery, (err, appResults) => {
    if (err) {
      console.error("DB stats error:", err);
      return res.render("pages/admin/dashboard", { 
        title: "Admin Dashboard",
        stats: null,
        userStats: null,
        user: req.session.user
      });
    }
    
    db.query(userStatsQuery, (err, userResults) => {
      if (err) {
        console.error("DB user stats error:", err);
        return res.render("pages/admin/dashboard", { 
          title: "Admin Dashboard",
          stats: appResults.rows ? appResults.rows[0] : appResults[0],
          userStats: null,
          user: req.session.user
        });
      }
      
      const stats = appResults.rows ? appResults.rows[0] : appResults[0];
      const userStats = userResults.rows ? userResults.rows[0] : userResults[0];
      
      res.render("pages/admin/dashboard", { 
        title: "Admin Dashboard",
        stats,
        userStats,
        user: req.session.user
      });
    });
  });
};

exports.getApplications = (req, res) => {
  const query = `
    SELECT 
      a.id,
      a.user_id,
      a.specialty,
      a.bio,
      a.experience,
      a.resume_file,
      a.certification_file,
      a.profile_image,
      a.status,
      a.created_at,
      a.updated_at,
      u.name,
      u.email 
    FROM therapist_applications a
    JOIN users u ON a.user_id = u.id
    ORDER BY 
      CASE 
        WHEN a.status = 'pending' THEN 1
        WHEN a.status = 'approved' THEN 2
        WHEN a.status = 'rejected' THEN 3
      END,
      a.created_at DESC
  `;
  
  db.query(query, (err, results) => {
    if (err) {
      console.error("DB fetch error:", err);
      req.flash("error", "Failed to load applications");
      return res.render("pages/admin/applications", { 
        title: "Therapist Applications",
        applications: [] 
      });
    }
    
    const applications = results.rows || results;
    res.render("pages/admin/applications", { 
      title: "Therapist Applications",
      applications 
    });
  });
};

exports.getApplicationDetail = (req, res) => {
  const { id } = req.params;
  
  const query = `
    SELECT 
      a.*,
      u.name,
      u.email,
      u.created_at as user_created_at
    FROM therapist_applications a
    JOIN users u ON a.user_id = u.id
    WHERE a.id = $1
  `;
  
  db.query(query, [id], (err, results) => {
    if (err) {
      console.error("DB fetch error:", err);
      req.flash("error", "Failed to load application details");
      return res.redirect("/admin/applications");
    }
    
    const application = results.rows ? results.rows[0] : results[0];
    
    if (!application) {
      req.flash("error", "Application not found");
      return res.redirect("/admin/applications");
    }
    
    res.render("pages/admin/application-detail", { 
      title: "Application Details",
      application 
    });
  });
};

exports.approveApplication = (req, res) => {
  const { id } = req.params;
  const { feedback } = req.body; // Optional approval feedback
  
  // Start transaction
  db.query('BEGIN', (err) => {
    if (err) {
      console.error("Transaction start error:", err);
      req.flash("error", "Database error occurred");
      return res.redirect("/admin/applications");
    }
    
    // Update application status
    const updateAppQuery = `
      UPDATE therapist_applications 
      SET status='approved', updated_at=NOW(), admin_feedback=$2
      WHERE id=$1
      RETURNING user_id
    `;
    
    db.query(updateAppQuery, [id, feedback], (err, appResult) => {
      if (err) {
        console.error("DB approve error:", err);
        return db.query('ROLLBACK', () => {
          req.flash("error", "Failed to approve application");
          res.redirect("/admin/applications");
        });
      }
      
      const userId = appResult.rows ? appResult.rows[0].user_id : appResult[0].user_id;
      
      // Update user role to therapist
      const updateUserQuery = `UPDATE users SET role='therapist' WHERE id=$1`;
      
      db.query(updateUserQuery, [userId], (err) => {
        if (err) {
          console.error("DB user update error:", err);
          return db.query('ROLLBACK', () => {
            req.flash("error", "Failed to update user role");
            res.redirect("/admin/applications");
          });
        }
        
        // Commit transaction
        db.query('COMMIT', (err) => {
          if (err) {
            console.error("Transaction commit error:", err);
            req.flash("error", "Failed to complete approval");
          } else {
            req.flash("success", "Application approved successfully! User is now a therapist.");
          }
          res.redirect("/admin/applications");
        });
      });
    });
  });
};

exports.rejectApplication = (req, res) => {
  const { id } = req.params;
  const { reason } = req.body; // Rejection reason
  
  const query = `
    UPDATE therapist_applications 
    SET status='rejected', updated_at=NOW(), admin_feedback=$2
    WHERE id=$1
  `;
  
  db.query(query, [id, reason], (err) => {
    if (err) {
      console.error("DB reject error:", err);
      req.flash("error", "Failed to reject application");
    } else {
      req.flash("success", "Application rejected successfully");
    }
    res.redirect("/admin/applications");
  });
};

exports.getTherapists = (req, res) => {
  const query = `
    SELECT 
      u.id,
      u.name,
      u.email,
      u.created_at,
      a.specialty,
      a.experience,
      a.profile_image,
      a.bio,
      COUNT(p.id) as patient_count
    FROM users u
    JOIN therapist_applications a ON u.id = a.user_id
    LEFT JOIN patient_therapist_assignments p ON u.id = p.therapist_id
    WHERE u.role = 'therapist' AND a.status = 'approved'
    GROUP BY u.id, u.name, u.email, u.created_at, a.specialty, a.experience, a.profile_image, a.bio
    ORDER BY u.name
  `;
  
  db.query(query, (err, results) => {
    if (err) {
      console.error("DB fetch error:", err);
      req.flash("error", "Failed to load therapists");
      return res.render("pages/admin/therapists", { 
        title: "Manage Therapists",
        therapists: [] 
      });
    }
    
    const therapists = results.rows || results;
    res.render("pages/admin/therapists", { 
      title: "Manage Therapists",
      therapists 
    });
  });
};

exports.toggleTherapistStatus = (req, res) => {
  const { id } = req.params;
  const { action } = req.body; // 'activate' or 'deactivate'
  
  const newRole = action === 'activate' ? 'therapist' : 'user';
  
  const query = `UPDATE users SET role = $1 WHERE id = $2`;
  
  db.query(query, [newRole, id], (err) => {
    if (err) {
      console.error("DB update error:", err);
      req.flash("error", "Failed to update therapist status");
    } else {
      const message = action === 'activate' ? 'Therapist activated' : 'Therapist deactivated';
      req.flash("success", message);
    }
    res.redirect("/admin/therapists");
  });
};