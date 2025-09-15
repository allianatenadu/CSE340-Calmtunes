// controllers/therapistController.js - Updated with complete functionality and fixed bio column issue
const db = require("../config/database");
const path = require('path');
const fs = require('fs').promises;
const multer = require('multer');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/')
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
    }
});

const upload = multer({ storage: storage });

// Get therapist dashboard
exports.getDashboard = async (req, res) => {
    try {
        const userId = req.session.user.id;
        
        // Get therapist application
        const applicationQuery = `
            SELECT * FROM therapist_applications 
            WHERE user_id = $1 
            ORDER BY created_at DESC 
            LIMIT 1
        `;
        const applicationResult = await db.query(applicationQuery, [userId]);
        const application = applicationResult.rows[0] || null;

        // Get therapist statistics if approved
        let stats = null;
        if (application && application.status === 'approved') {
            const statsQuery = `
                SELECT 
                    COUNT(DISTINCT a.patient_id) as activePatients,
                    COUNT(CASE WHEN a.appointment_date >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as weekSessions,
                    COALESCE(AVG(r.rating), 0) as avgRating,
                    COALESCE(SUM(EXTRACT(EPOCH FROM (a.ended_at - a.started_at))/3600), 0) as totalHours
                FROM appointments a
                LEFT JOIN reviews r ON a.id = r.appointment_id
                WHERE a.therapist_id = $1
                GROUP BY a.therapist_id
            `;
            const statsResult = await db.query(statsQuery, [userId]);
            stats = statsResult.rows[0] || {
                activepatients: 0,
                weeksessions: 0,
                avgrating: '0.0',
                totalhours: 0
            };
        }

        res.render("pages/therapist/dashboard", {
            title: "Therapist Dashboard",
            user: req.session.user,
            application: application,
            stats: stats
        });

    } catch (error) {
        console.error("Error loading therapist dashboard:", error);
        req.flash("error", "Failed to load dashboard");
        res.redirect("/dashboard");
    }
};

// Get application form
exports.getApplicationForm = async (req, res) => {
    try {
        const userId = req.session.user.id;
        
        // Check if user already has an application
        const existingApp = await db.query(
            "SELECT * FROM therapist_applications WHERE user_id = $1", 
            [userId]
        );
        
        let application = null;
        if (existingApp.rows.length > 0) {
            application = existingApp.rows[0];
        }

        res.render("pages/therapist/apply", {
            title: "Therapist Application",
            user: req.session.user,
            application: application
        });

    } catch (error) {
        console.error("Error loading application form:", error);
        req.flash("error", "Failed to load application form");
        res.redirect("/therapist");
    }
};

// Submit application
exports.submitApplication = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { bio, experience, specialty, phone } = req.body;

        // Check if user already has an application
        const existingApp = await db.query(
            "SELECT id FROM therapist_applications WHERE user_id = $1", 
            [userId]
        );

        let query, values;
        
        if (existingApp.rows.length > 0) {
            // Update existing application
            query = `
                UPDATE therapist_applications 
                SET bio = $1, experience = $2, specialty = $3, phone = $4, 
                    status = 'pending', updated_at = CURRENT_TIMESTAMP
                WHERE user_id = $5
                RETURNING id
            `;
            values = [bio, experience, specialty, phone, userId];
        } else {
            // Create new application
            query = `
                INSERT INTO therapist_applications 
                (user_id, bio, experience, specialty, phone, status)
                VALUES ($1, $2, $3, $4, $5, 'pending')
                RETURNING id
            `;
            values = [userId, bio, experience, specialty, phone];
        }

        const result = await db.query(query, values);
        
        if (result.rows.length > 0) {
            req.flash("success", "Application submitted successfully! You'll receive a notification once reviewed.");
            res.redirect("/therapist");
        } else {
            throw new Error("Failed to submit application");
        }

    } catch (error) {
        console.error("Error submitting application:", error);
        req.flash("error", "Failed to submit application. Please try again.");
        res.redirect("/therapist/apply");
    }
};

// Get therapist patients - FIXED bio column issue
exports.getPatients = async (req, res) => {
    try {
        const therapistId = req.session.user.id;
        
        // Get all patients who have appointments with this therapist
        const patientsQuery = `
            SELECT DISTINCT
                u.id, u.name, u.email, u.profile_image,
                COUNT(a.id) as total_appointments,
                MAX(a.appointment_date) as last_appointment,
                COUNT(CASE WHEN a.status = 'confirmed' AND a.appointment_date >= CURRENT_DATE THEN 1 END) as upcoming_appointments,
                c.id as conversation_id,
                MAX(c.updated_at) as last_message_time,
                COUNT(CASE WHEN m.is_read = false AND m.sender_id != $1 THEN 1 END) as unread_messages
            FROM users u
            INNER JOIN appointments a ON u.id = a.patient_id
            LEFT JOIN conversations c ON (c.patient_id = u.id AND c.therapist_id = $1)
            LEFT JOIN messages m ON c.id = m.conversation_id
            WHERE a.therapist_id = $1
            GROUP BY u.id, u.name, u.email, u.profile_image, c.id
            ORDER BY MAX(a.appointment_date) DESC
        `;

        const result = await db.query(patientsQuery, [therapistId]);
        const patients = result.rows || [];

        res.render("pages/therapist/patients", {
            title: "My Patients",
            user: req.session.user,
            patients: patients
        });

    } catch (error) {
        console.error("Error loading patients:", error);
        req.flash("error", "Failed to load patients");
        res.redirect("/therapist");
    }
};

// Get therapist schedule
exports.getSchedule = async (req, res) => {
    try {
        const therapistId = req.session.user.id;
        
        // Get upcoming appointments
        const appointmentsQuery = `
            SELECT a.*, 
                   u.name as patient_name, 
                   u.email as patient_email,
                   u.profile_image as patient_image
            FROM appointments a
            JOIN users u ON a.patient_id = u.id
            WHERE a.therapist_id = $1
            AND a.appointment_date >= CURRENT_DATE
            AND a.status IN ('pending', 'confirmed')
            ORDER BY a.appointment_date ASC, a.appointment_time ASC
        `;

        const result = await db.query(appointmentsQuery, [therapistId]);
        const appointments = result.rows || [];

        // Get appointment requests (pending)
        const pendingQuery = `
            SELECT a.*, 
                   u.name as patient_name, 
                   u.email as patient_email,
                   u.profile_image as patient_image
            FROM appointments a
            JOIN users u ON a.patient_id = u.id
            WHERE a.therapist_id = $1
            AND a.status = 'pending'
            ORDER BY a.created_at DESC
        `;

        const pendingResult = await db.query(pendingQuery, [therapistId]);
        const pendingAppointments = pendingResult.rows || [];

        res.render("pages/therapist/schedule", {
            title: "My Schedule",
            user: req.session.user,
            appointments: appointments,
            pendingAppointments: pendingAppointments
        });

    } catch (error) {
        console.error("Error loading schedule:", error);
        req.flash("error", "Failed to load schedule");
        res.redirect("/therapist");
    }
};


// Upload profile image
exports.uploadProfileImage = async (req, res) => {
    try {
        const userId = req.session.user.id;
        
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: "No file uploaded"
            });
        }

        const filename = req.file.filename;
        
        // Update therapist application with new profile image
        const updateQuery = `
            UPDATE therapist_applications 
            SET profile_image = $1, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $2
            RETURNING profile_image
        `;

        const result = await db.query(updateQuery, [filename, userId]);

        if (result.rows.length > 0) {
            res.json({
                success: true,
                imageUrl: `/uploads/${filename}`,
                message: "Profile image updated successfully"
            });
        } else {
            res.status(404).json({
                success: false,
                error: "Therapist application not found"
            });
        }

    } catch (error) {
        console.error("Error uploading profile image:", error);
        res.status(500).json({
            success: false,
            error: "Failed to upload image"
        });
    }
};

// Update therapist profile
exports.updateProfile = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { bio, experience, specialty, phone } = req.body;

        const updateQuery = `
            UPDATE therapist_applications 
            SET bio = $1, experience = $2, specialty = $3, phone = $4,
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $5
            RETURNING *
        `;

        const result = await db.query(updateQuery, [bio, experience, specialty, phone, userId]);

        if (result.rows.length > 0) {
            res.json({
                success: true,
                message: "Profile updated successfully",
                profile: result.rows[0]
            });
        } else {
            res.status(404).json({
                success: false,
                error: "Profile not found"
            });
        }

    } catch (error) {
        console.error("Error updating profile:", error);
        res.status(500).json({
            success: false,
            error: "Failed to update profile"
        });
    }
};

// Get therapist availability
exports.getAvailability = async (req, res) => {
    try {
        const therapistId = req.params.therapistId;
        const { date } = req.query;

        // Get existing appointments for the date
        const appointmentsQuery = `
            SELECT appointment_time, session_type 
            FROM appointments 
            WHERE therapist_id = $1 
            AND appointment_date = $2 
            AND status IN ('pending', 'confirmed')
            ORDER BY appointment_time
        `;

        const result = await db.query(appointmentsQuery, [therapistId, date]);
        const bookedSlots = result.rows.map(row => row.appointment_time);

        // Define available time slots (you can make this dynamic per therapist)
        const allSlots = [
            '09:00', '10:00', '11:00', '12:00', 
            '14:00', '15:00', '16:00', '17:00', '18:00'
        ];

        const availableSlots = allSlots.filter(slot => !bookedSlots.includes(slot));

        res.json({
            success: true,
            date: date,
            availableSlots: availableSlots,
            bookedSlots: bookedSlots
        });

    } catch (error) {
        console.error("Error getting availability:", error);
        res.status(500).json({
            success: false,
            error: "Failed to get availability"
        });
    }
};

// Get patients API for therapist (for dropdowns, etc.)
exports.getPatientsAPI = async (req, res) => {
    try {
        const therapistId = req.session.user.id;
        
        // Get all patients who have appointments with this therapist
        const patientsQuery = `
            SELECT DISTINCT
                u.id, u.name, u.email, u.profile_image
            FROM users u
            INNER JOIN appointments a ON u.id = a.patient_id
            WHERE a.therapist_id = $1
            ORDER BY u.name ASC
        `;

        const result = await db.query(patientsQuery, [therapistId]);
        const patients = result.rows || [];

        res.json({
            success: true,
            patients: patients
        });

    } catch (error) {
        console.error("Error loading patients API:", error);
        res.status(500).json({
            success: false,
            error: "Failed to load patients"
        });
    }
};

module.exports = exports;