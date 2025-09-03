const authModel = require("../models/authModel");
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp'); // Optional: for image optimization

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = 'public/uploads/profiles';
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    // Generate unique filename: userId_timestamp.extension
    const userId = req.session.user.id;
    const timestamp = Date.now();
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `user_${userId}_${timestamp}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  // Check file type
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files (JPEG, JPG, PNG, GIF, WebP) are allowed!'));
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: fileFilter
});

const accountController = {
  // Middleware for handling image upload
  uploadProfileImage: upload.single('profile_image_file'),

  // GET /account - Show account page
  getAccount: async (req, res) => {
    try {
      // Debug logging
      console.log("=== ACCOUNT PAGE DEBUG ===");
      console.log("Session exists:", !!req.session);
      console.log("Session user:", req.session?.user);
      console.log("Session ID:", req.sessionID);
      
      // Check if user session exists
      if (!req.session || !req.session.user || !req.session.user.id) {
        console.log("No valid session found");
        req.flash("error", "Session expired. Please log in again.");
        return res.redirect("/login");
      }

      const userId = req.session.user.id;
      console.log("Looking for user ID:", userId);

      // Fetch user from database
      const user = await authModel.findUserById(userId);
      console.log("User found in database:", !!user);
      console.log("User data:", user ? { 
        id: user.id, 
        name: user.name, 
        email: user.email, 
        role: user.role,
        profile_image: user.profile_image 
      } : 'null');

      if (!user) {
        console.log("User not found in database");
        req.flash("error", "User account not found. Please contact support.");
        return res.redirect("/login");
      }

      // Ensure user has a role (default to patient if missing)
      if (!user.role) {
        console.log("User missing role, setting to patient");
        user.role = 'patient';
        await authModel.updateUser(userId, { role: 'patient' });
      }

      console.log("Rendering account page for:", user.name, `(${user.role})`);

      res.render("pages/account", {
        title: "My Account - CalmTunes",
        user: user,
        success: req.flash('success'),
        error: req.flash('error')
      });
    } catch (err) {
      console.error("Error loading account:", err);
      console.error("Stack trace:", err.stack);
      req.flash("error", "Unable to load account information. Please try again.");
      res.redirect("/dashboard");
    }
  },

  // POST /account - Update account details with image upload
  postAccount: async (req, res) => {
    try {
      console.log("=== ACCOUNT UPDATE DEBUG ===");
      console.log("Session user:", req.session?.user);
      console.log("Form data:", req.body);
      console.log("Uploaded file:", req.file);

      if (!req.session.user || !req.session.user.id) {
        console.log("No valid session for update");
        req.flash("error", "Session expired. Please log in again.");
        return res.redirect("/login");
      }

      const userId = req.session.user.id;
      const { name, email, profile_image, role } = req.body;

      // Validate required fields
      if (!name || !email) {
        req.flash("error", "Name and email are required.");
        return res.redirect("/account");
      }

      // Validate role if provided
      if (role && !['patient', 'therapist'].includes(role)) {
        req.flash("error", "Invalid account type selected.");
        return res.redirect("/account");
      }

      // Prepare update data
      const updateData = { 
        name: name.trim(), 
        email: email.trim().toLowerCase()
      };

      // Handle profile image
      if (req.file) {
        // File was uploaded
        try {
          // Optional: Optimize image using Sharp
          const optimizedPath = `public/uploads/profiles/optimized_${req.file.filename}`;
          await sharp(req.file.path)
            .resize(300, 300, { 
              fit: 'cover',
              position: 'center'
            })
            .jpeg({ quality: 90 })
            .toFile(optimizedPath);

          // Use optimized image path
          updateData.profile_image = `/uploads/profiles/optimized_${req.file.filename}`;

          // Delete original unoptimized file
          fs.unlink(req.file.path, (err) => {
            if (err) console.log('Error deleting original file:', err);
          });

          // Delete old profile image if it exists
          const currentUser = await authModel.findUserById(userId);
          if (currentUser.profile_image && currentUser.profile_image.startsWith('/uploads/')) {
            const oldImagePath = `public${currentUser.profile_image}`;
            fs.unlink(oldImagePath, (err) => {
              if (err) console.log('Error deleting old image:', err);
            });
          }

        } catch (imageError) {
          console.error('Error processing image:', imageError);
          // Use original file if optimization fails
          updateData.profile_image = `/uploads/profiles/${req.file.filename}`;
        }
      } else if (profile_image && profile_image.trim()) {
        // URL was provided
        updateData.profile_image = profile_image.trim();
      }

      if (role) {
        updateData.role = role;
      }

      console.log("Updating user with data:", updateData);

      // Check if email is already taken by another user
      if (email.trim().toLowerCase() !== req.session.user.email.toLowerCase()) {
        const existingUser = await authModel.findUserByEmail(email.trim().toLowerCase());
        if (existingUser && existingUser.id !== userId) {
          req.flash("error", "Email address is already in use.");
          return res.redirect("/account");
        }
      }

      // Update user in database
      const updatedUser = await authModel.updateUser(userId, updateData);
      
      if (!updatedUser) {
        throw new Error("User update failed - no user returned");
      }

      // Update session with new info
      req.session.user.name = updatedUser.name;
      req.session.user.email = updatedUser.email;
      req.session.user.profile_image = updatedUser.profile_image;
      if (updatedUser.role) {
        req.session.user.role = updatedUser.role;
      }

      console.log("User updated successfully:", updatedUser.name);
      req.flash("success", "Account updated successfully!");
      res.redirect("/account");
    } catch (err) {
      console.error("Error updating account:", err);
      console.error("Stack trace:", err.stack);
      
      // Clean up uploaded file if there was an error
      if (req.file) {
        fs.unlink(req.file.path, (unlinkErr) => {
          if (unlinkErr) console.log('Error deleting uploaded file:', unlinkErr);
        });
      }
      
      if (err.code === '23505') { // Postgres unique constraint error
        req.flash("error", "Email address is already in use.");
      } else if (err.message && err.message.includes('image files')) {
        req.flash("error", err.message);
      } else {
        req.flash("error", "Something went wrong while updating your account. Please try again.");
      }
      res.redirect("/account");
    }
  },

  // DELETE /account/delete - Delete user account
  deleteAccount: async (req, res) => {
    try {
      if (!req.session.user || !req.session.user.id) {
        req.flash("error", "Session expired. Please log in again.");
        return res.redirect("/login");
      }

      const userId = req.session.user.id;
      console.log("Deleting account for user ID:", userId);

      // Get user data to delete associated files
      const user = await authModel.findUserById(userId);
      
      // Delete profile image file if it exists and is stored locally
      if (user && user.profile_image && user.profile_image.startsWith('/uploads/')) {
        const imagePath = `public${user.profile_image}`;
        fs.unlink(imagePath, (err) => {
          if (err) console.log('Error deleting profile image:', err);
        });
      }

      await authModel.deleteUser(userId);
      
      // Destroy session
      req.session.destroy((err) => {
        if (err) {
          console.error("Error destroying session:", err);
        }
        res.redirect("/?message=account_deleted");
      });
    } catch (err) {
      console.error("Error deleting account:", err);
      req.flash("error", "Unable to delete account. Please contact support.");
      res.redirect("/account");
    }
  }
};

module.exports = accountController;