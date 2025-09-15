const db = require("../config/database");

// Admin dashboard
exports.getDashboard = (req, res) => {
  console.log("=== DEBUG: Admin Dashboard Called ===");
  
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
    
    const stats = appResults.rows ? appResults.rows[0] : appResults[0];
    console.log("=== DEBUG: Stats result ===", stats);
    
    db.query(userStatsQuery, (err, userResults) => {
      if (err) {
        console.error("DB user stats error:", err);
        return res.render("pages/admin/dashboard", { 
          title: "Admin Dashboard",
          stats: stats,
          userStats: null,
          user: req.session.user
        });
      }
      
      const userStats = userResults.rows ? userResults.rows[0] : userResults[0];
      console.log("=== DEBUG: User stats result ===", userStats);
      
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
  console.log("=== DEBUG: Get Applications Called ===");
  
  // First check what columns exist in the therapist_applications table
  const checkColumnsQuery = `
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'therapist_applications'
  `;
  
  db.query(checkColumnsQuery, (err, columnResults) => {
    if (err) {
      console.error("Error checking columns:", err);
      return res.render("pages/admin/applications", { 
        title: "Therapist Applications",
        applications: [],
        error: "Failed to load applications"
      });
    }
    
    const existingColumns = columnResults?.rows?.map(row => row.column_name) || [];
    console.log("=== DEBUG: Available columns ===", existingColumns);
    
    // Build dynamic query based on existing columns
    let selectColumns = [
      'a.id',
      'a.user_id', 
      'a.status',
      'a.created_at',
      'a.updated_at',
      'u.name',
      'u.email'
    ];
    
    // Add optional columns if they exist
    if (existingColumns.includes('specialty')) {
      selectColumns.push('a.specialty');
    }
    if (existingColumns.includes('bio')) {
      selectColumns.push('a.bio');
    }
    if (existingColumns.includes('experience')) {
      selectColumns.push('a.experience');
    }
    if (existingColumns.includes('resume_file')) {
      selectColumns.push('a.resume_file');
    }
    if (existingColumns.includes('certification_file')) {
      selectColumns.push('a.certification_file');
    }
    if (existingColumns.includes('profile_image')) {
      selectColumns.push('a.profile_image');
    }
    if (existingColumns.includes('admin_feedback')) {
      selectColumns.push('a.admin_feedback');
    }
    
    const query = `
      SELECT ${selectColumns.join(', ')}
      FROM therapist_applications a
      LEFT JOIN users u ON a.user_id = u.id
      ORDER BY 
        CASE 
          WHEN a.status = 'pending' THEN 1
          WHEN a.status = 'approved' THEN 2
          WHEN a.status = 'rejected' THEN 3
        END,
        a.created_at DESC
    `;
    
    console.log("=== DEBUG: Applications query ===", query);
    
    db.query(query, (err, results) => {
      if (err) {
        console.error("=== DEBUG: Applications fetch error ===", err);
        return res.render("pages/admin/applications", { 
          title: "Therapist Applications",
          applications: [],
          error: "Failed to load applications"
        });
      }
      
      const applications = (results.rows || results).map(app => ({
        ...app,
        // Provide defaults for missing columns
        specialty: app.specialty || 'General Practice',
        bio: app.bio || 'No bio provided',
        experience: app.experience || 'Experience details not provided',
        resume_file: app.resume_file || null,
        certification_file: app.certification_file || null,
        profile_image: app.profile_image || null,
        admin_feedback: app.admin_feedback || null
      }));
      
      console.log("=== DEBUG: Applications found ===", applications.length);
      
      res.render("pages/admin/applications", { 
        title: "Therapist Applications",
        applications 
      });
    });
  });
};

exports.getApplicationDetail = (req, res) => {
  const { id } = req.params;
  
  // First check what columns exist
  const checkColumnsQuery = `
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'therapist_applications'
  `;
  
  db.query(checkColumnsQuery, (err, columnResults) => {
    if (err) {
      console.error("Error checking columns:", err);
      req.flash("error", "Failed to load application details");
      return res.redirect("/admin/applications");
    }
    
    const existingColumns = columnResults?.rows?.map(row => row.column_name) || [];
    
    // Build dynamic query
    let selectColumns = [
      'a.id',
      'a.user_id',
      'a.status', 
      'a.created_at',
      'a.updated_at',
      'u.name',
      'u.email',
      'u.created_at as user_created_at'
    ];
    
    // Add optional columns if they exist
    if (existingColumns.includes('specialty')) selectColumns.push('a.specialty');
    if (existingColumns.includes('bio')) selectColumns.push('a.bio');
    if (existingColumns.includes('experience')) selectColumns.push('a.experience');
    if (existingColumns.includes('resume_file')) selectColumns.push('a.resume_file');
    if (existingColumns.includes('certification_file')) selectColumns.push('a.certification_file');
    if (existingColumns.includes('profile_image')) selectColumns.push('a.profile_image');
    if (existingColumns.includes('admin_feedback')) selectColumns.push('a.admin_feedback');
    
    const query = `
      SELECT ${selectColumns.join(', ')}
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
      
      // Provide defaults for missing fields
      application.specialty = application.specialty || 'General Practice';
      application.bio = application.bio || 'No bio provided';
      application.experience = application.experience || 'Experience details not provided';
      application.resume_file = application.resume_file || null;
      application.certification_file = application.certification_file || null;
      application.profile_image = application.profile_image || null;
      application.admin_feedback = application.admin_feedback || null;
      
      res.render("pages/admin/application-detail", { 
        title: "Application Details",
        application 
      });
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
    
    // Check if admin_feedback column exists
    const checkColumnQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'therapist_applications' AND column_name = 'admin_feedback'
    `;
    
    db.query(checkColumnQuery, (err, columnResult) => {
      const hasAdminFeedback = columnResult?.rows?.length > 0;
      
      // Update application status
      let updateAppQuery;
      let params;
      
      if (hasAdminFeedback && feedback) {
        updateAppQuery = `
          UPDATE therapist_applications 
          SET status='approved', updated_at=NOW(), admin_feedback=$2
          WHERE id=$1
          RETURNING user_id
        `;
        params = [id, feedback];
      } else {
        updateAppQuery = `
          UPDATE therapist_applications 
          SET status='approved', updated_at=NOW()
          WHERE id=$1
          RETURNING user_id
        `;
        params = [id];
      }
      
      db.query(updateAppQuery, params, (err, appResult) => {
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
  });
};

exports.rejectApplication = (req, res) => {
  const { id } = req.params;
  const { reason } = req.body; // Rejection reason
  
  // Check if admin_feedback column exists
  const checkColumnQuery = `
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'therapist_applications' AND column_name = 'admin_feedback'
  `;
  
  db.query(checkColumnQuery, (err, columnResult) => {
    const hasAdminFeedback = columnResult?.rows?.length > 0;
    
    let query;
    let params;
    
    if (hasAdminFeedback && reason) {
      query = `
        UPDATE therapist_applications 
        SET status='rejected', updated_at=NOW(), admin_feedback=$2
        WHERE id=$1
      `;
      params = [id, reason];
    } else {
      query = `
        UPDATE therapist_applications 
        SET status='rejected', updated_at=NOW()
        WHERE id=$1
      `;
      params = [id];
    }
    
    db.query(query, params, (err) => {
      if (err) {
        console.error("DB reject error:", err);
        req.flash("error", "Failed to reject application");
      } else {
        req.flash("success", "Application rejected successfully");
      }
      res.redirect("/admin/applications");
    });
  });
};

exports.getTherapists = (req, res) => {
  // Check available columns first
  const checkColumnsQuery = `
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'therapist_applications'
  `;
  
  db.query(checkColumnsQuery, (err, columnResults) => {
    if (err) {
      console.error("Error checking columns:", err);
      return res.render("pages/admin/therapists", { 
        title: "Manage Therapists",
        therapists: [],
        error: "Failed to load therapists"
      });
    }
    
    const existingColumns = columnResults?.rows?.map(row => row.column_name) || [];
    
    // Build dynamic query
    let selectColumns = [
      'u.id',
      'u.name',
      'u.email', 
      'u.created_at'
    ];
    
    // Add optional columns if they exist
    if (existingColumns.includes('specialty')) selectColumns.push('a.specialty');
    if (existingColumns.includes('experience')) selectColumns.push('a.experience');
    if (existingColumns.includes('profile_image')) selectColumns.push('a.profile_image');
    if (existingColumns.includes('bio')) selectColumns.push('a.bio');
    
    const query = `
      SELECT 
        ${selectColumns.join(', ')},
        COUNT(p.id) as patient_count
      FROM users u
      JOIN therapist_applications a ON u.id = a.user_id
      LEFT JOIN patient_therapist_assignments p ON u.id = p.therapist_id
      WHERE u.role = 'therapist' AND a.status = 'approved'
      GROUP BY u.id, u.name, u.email, u.created_at${existingColumns.includes('specialty') ? ', a.specialty' : ''}${existingColumns.includes('experience') ? ', a.experience' : ''}${existingColumns.includes('profile_image') ? ', a.profile_image' : ''}${existingColumns.includes('bio') ? ', a.bio' : ''}
      ORDER BY u.name
    `;
    
    db.query(query, (err, results) => {
      if (err) {
        console.error("DB fetch error:", err);
        return res.render("pages/admin/therapists", { 
          title: "Manage Therapists",
          therapists: [],
          error: "Failed to load therapists"
        });
      }
      
      const therapists = (results.rows || results).map(therapist => ({
        ...therapist,
        specialty: therapist.specialty || 'General Practice',
        experience: therapist.experience || 'Professional Experience',
        profile_image: therapist.profile_image || null,
        bio: therapist.bio || 'No bio available'
      }));
      
      res.render("pages/admin/therapists", { 
        title: "Manage Therapists",
        therapists 
      });
    });
  });
};

exports.toggleTherapistStatus = (req, res) => {
  const { id } = req.params;
  const { action } = req.body; // 'activate' or 'deactivate'
  
  const newRole = action === 'activate' ? 'therapist' : 'patient';
  
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