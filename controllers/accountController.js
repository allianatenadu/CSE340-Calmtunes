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

// Helper function to get profile image URL
const getProfileImageUrl = (user) => {
  if (user?.profile_image) {
    // If it's already a full URL, return as is
    if (user.profile_image.startsWith('http')) {
      return user.profile_image;
    }
    // If it already starts with /, return as is
    if (user.profile_image.startsWith('/')) {
      return user.profile_image;
    }
    // Otherwise, prepend the uploads path
    return `/uploads/profiles/${user.profile_image}`;
  }
  return null;
};

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

      // Generate profile image URL
      const profileImageUrl = getProfileImageUrl(user);
      console.log("Profile image URL:", profileImageUrl);

      console.log("Rendering account page for:", user.name, `(${user.role})`);

      res.render("pages/account", {
        title: "My Account - CalmTunes",
        user: user,
        success: req.flash('success'),
        error: req.flash('error'),
        profileImageUrl: profileImageUrl
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
      const { name, email, profile_image, role, bio } = req.body;

      // Validate required fields
      if (!name || !email) {
        req.flash("error", "Name and email are required.");
        return res.redirect("/account");
      }

      // Validate bio for therapists
      if (validatedRole === 'therapist' && (!bio || bio.trim().length < 50)) {
        req.flash("error", "A professional bio of at least 50 characters is required for therapists.");
        return res.redirect("/account");
      }

      // Handle role - it might come as an array from form submission
      let validatedRole = role;
      if (Array.isArray(role)) {
        // Take the last selected role (most recent selection)
        validatedRole = role[role.length - 1];
      }
      
      console.log("Original role:", role);
      console.log("Validated role:", validatedRole);
      
      // Validate role if provided
      if (validatedRole && !['patient', 'therapist', 'admin'].includes(validatedRole)) {
        req.flash("error", "Invalid account type selected.");
        return res.redirect("/account");
      }

      // Prepare update data
      const updateData = {
        name: name.trim(),
        email: email.trim().toLowerCase()
      };

      // Add bio if provided (for therapists)
      if (bio !== undefined) {
        updateData.bio = bio.trim() || null;
      }

      // Handle profile image
      if (req.file) {
        // File was uploaded
        try {
          // Check if sharp is available for optimization
          if (sharp) {
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
          } else {
            // Use original file if Sharp is not available
            updateData.profile_image = `/uploads/profiles/${req.file.filename}`;
          }

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
        // URL was provided - normalize it
        updateData.profile_image = normalizeProfileImagePath(profile_image.trim());
      }

      // Add role to update data if provided
      if (validatedRole) {
        updateData.role = validatedRole;
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

      console.log("Database update successful:", updatedUser);

      // Update session with new info
      req.session.user.name = updatedUser.name;
      req.session.user.email = updatedUser.email;
      if (updatedUser.profile_image) {
        req.session.user.profile_image = updatedUser.profile_image;
      }
      if (updatedUser.role) {
        req.session.user.role = updatedUser.role;
      }
      if (updatedUser.bio !== undefined) {
        req.session.user.bio = updatedUser.bio;
      }

      // Save the session explicitly
      req.session.save((err) => {
        if (err) {
          console.error('Session save error:', err);
        } else {
          console.log('Session updated successfully');
        }
      });

      console.log("User updated successfully:", updatedUser.name);
      console.log("Updated session user:", req.session.user);
      
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

// Helper function to normalize profile image paths
const normalizeProfileImagePath = (imagePath) => {
  if (!imagePath) return null;
  
  // If it's already a full URL, return as is
  if (imagePath.startsWith('http')) return imagePath;
  
  // If it already starts with /uploads, return as is
  if (imagePath.startsWith('/uploads')) return imagePath;
  
  // If it's just a filename, prepend the proper path
  if (!imagePath.startsWith('/')) {
    return `/uploads/profiles/${imagePath}`;
  }
  
  return imagePath;
};

module.exports = accountController;