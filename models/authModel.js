// models/authModel.js - Safe version with column existence checks
const pool = require('../config/database');
const bcrypt = require('bcrypt');

const authModel = {
  // Helper function to check if columns exist
  checkColumns: async () => {
    try {
      const result = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users'
      `);
      const columns = result.rows.map(row => row.column_name);
      
      const hasProfileImage = columns.includes('profile_image');
      const hasUpdatedAt = columns.includes('updated_at');
      const hasRole = columns.includes('role');
      
      return { hasProfileImage, hasUpdatedAt, hasRole, columns };
    } catch (error) {
      console.error('Error checking columns:', error);
      return { hasProfileImage: false, hasUpdatedAt: false, hasRole: false, columns: [] };
    }
  },

  // Find user by email (for login)
  findUserByEmail: async (email) => {
    try {
      const { hasProfileImage, hasRole } = await authModel.checkColumns();
      
      let query = 'SELECT id, name, email, password_hash, created_at';
      if (hasRole) query += ', role';
      if (hasProfileImage) query += ', profile_image';
      query += ' FROM users WHERE email = $1';
      
      const result = await pool.query(query, [email]);
      const user = result.rows[0];
      
      if (user && !user.role) {
        user.role = 'patient'; // Default role
      }
      
      return user || null;
    } catch (error) {
      console.error('Error finding user by email:', error);
      throw error;
    }
  },

  // Find user by ID (for account page)
  findUserById: async (id) => {
    try {
      const { hasProfileImage, hasRole, hasUpdatedAt } = await authModel.checkColumns();
      
      let query = 'SELECT id, name, email, created_at';
      if (hasRole) query += ', role';
      if (hasProfileImage) query += ', profile_image';
      if (hasUpdatedAt) query += ', updated_at';
      query += ' FROM users WHERE id = $1';
      
      const result = await pool.query(query, [id]);
      const user = result.rows[0];
      
      if (user && !user.role) {
        user.role = 'patient'; // Default role
      }
      
      return user || null;
    } catch (error) {
      console.error('Error finding user by ID:', error);
      throw error;
    }
  },

  // Create new user with proper role handling
  createUser: async (userData) => {
    try {
      const { hasProfileImage, hasRole } = await authModel.checkColumns();
      const { name, email, password_hash, role = 'patient' } = userData;
      
      let query = 'INSERT INTO users (name, email, password_hash, created_at';
      let values = [name, email, password_hash];
      let placeholders = '$1, $2, $3, CURRENT_TIMESTAMP';
      let paramCount = 4;
      
      if (hasRole) {
        query += ', role';
        placeholders += ', $' + paramCount;
        values.push(role);
        paramCount++;
      }
      
      if (hasProfileImage && userData.profile_image) {
        query += ', profile_image';
        placeholders += ', $' + paramCount;
        values.push(userData.profile_image);
        paramCount++;
      }
      
      query += ') VALUES (' + placeholders + ') RETURNING *';
      
      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  },

  // Update user information (for account page)
  updateUser: async (id, userData) => {
    try {
      const { hasProfileImage, hasRole, hasUpdatedAt } = await authModel.checkColumns();
      
      const fields = [];
      const values = [];
      let paramCount = 1;

      // Build dynamic update query with available fields
      const fieldMap = {
        'name': true,
        'email': true,
        'role': hasRole,
        'profile_image': hasProfileImage
      };

      for (const [key, value] of Object.entries(userData)) {
        if (fieldMap[key] && value !== undefined && value !== null) {
          fields.push(`${key} = $${paramCount}`);
          values.push(value);
          paramCount++;
        }
      }

      if (fields.length === 0) {
        throw new Error('No valid fields to update');
      }

      // Add updated_at timestamp if column exists
      if (hasUpdatedAt) {
        fields.push('updated_at = CURRENT_TIMESTAMP');
      }

      values.push(id);
      
      const query = `
        UPDATE users 
        SET ${fields.join(', ')} 
        WHERE id = $${paramCount} 
        RETURNING *
      `;
      
      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  },

  // Update user role specifically
  updateUserRole: async (userId, role) => {
    try {
      const { hasRole } = await authModel.checkColumns();
      
      if (!hasRole) {
        throw new Error('Role column does not exist in users table');
      }
      
      // Validate role
      if (!['patient', 'therapist'].includes(role)) {
        throw new Error('Invalid role. Must be either "patient" or "therapist"');
      }

      const query = `
        UPDATE users 
        SET role = $1 
        WHERE id = $2 
        RETURNING id, name, email, role, created_at
      `;
      const result = await pool.query(query, [role, userId]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error updating user role:', error);
      throw error;
    }
  },

  // Verify password for login
  verifyPassword: async (plainPassword, hashedPassword) => {
    try {
      return await bcrypt.compare(plainPassword, hashedPassword);
    } catch (error) {
      console.error('Error verifying password:', error);
      throw error;
    }
  },

  // Hash password for registration
  hashPassword: async (plainPassword) => {
    try {
      const saltRounds = 12;
      return await bcrypt.hash(plainPassword, saltRounds);
    } catch (error) {
      console.error('Error hashing password:', error);
      throw error;
    }
  },

  // Check if email already exists
  emailExists: async (email) => {
    try {
      const query = 'SELECT id FROM users WHERE email = $1';
      const result = await pool.query(query, [email]);
      return result.rows.length > 0;
    } catch (error) {
      console.error('Error checking email existence:', error);
      throw error;
    }
  },

  // Delete user account
  deleteUser: async (id) => {
    try {
      const query = 'DELETE FROM users WHERE id = $1 RETURNING id';
      const result = await pool.query(query, [id]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  },

  // Get all therapists (for patient to find therapists)
  getAllTherapists: async () => {
    try {
      const { hasRole, hasProfileImage } = await authModel.checkColumns();
      
      let query = 'SELECT id, name, email, created_at';
      if (hasProfileImage) query += ', profile_image';
      query += ' FROM users';
      
      if (hasRole) {
        query += ' WHERE role = $1 ORDER BY name ASC';
        const result = await pool.query(query, ['therapist']);
        return result.rows;
      } else {
        // If no role column, return empty array or all users
        query += ' ORDER BY name ASC';
        const result = await pool.query(query);
        return result.rows; // You might want to filter this differently
      }
    } catch (error) {
      console.error('Error fetching therapists:', error);
      throw error;
    }
  },

  // Get all patients (for therapist dashboard)
  getAllPatients: async () => {
    try {
      const { hasRole, hasProfileImage } = await authModel.checkColumns();
      
      let query = 'SELECT id, name, email, created_at';
      if (hasProfileImage) query += ', profile_image';
      query += ' FROM users';
      
      if (hasRole) {
        query += ' WHERE role = $1 ORDER BY name ASC';
        const result = await pool.query(query, ['patient']);
        return result.rows;
      } else {
        // If no role column, return empty array or all users
        query += ' ORDER BY name ASC';
        const result = await pool.query(query);
        return result.rows; // You might want to filter this differently
      }
    } catch (error) {
      console.error('Error fetching patients:', error);
      throw error;
    }
  }
};

module.exports = authModel;
