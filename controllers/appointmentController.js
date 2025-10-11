// controllers/appointmentController.js
const db = require("../config/database");
const { v4: uuidv4 } = require('uuid');

// Book a new appointment
exports.bookAppointment = async (req, res) => {
    const { therapistId, preferredDate, preferredTime, sessionType = 'video', notes } = req.body;
    const patientId = req.session.user.id;
    
    try {
        // Check if therapist exists and is approved
        const therapistCheck = `
            SELECT u.id, u.name, u.email, ta.status
            FROM users u
            JOIN therapist_applications ta ON u.id = ta.user_id
            WHERE u.id = $1 AND u.role = 'therapist' AND ta.status = 'approved'
        `;
        
        const therapistResult = await db.query(therapistCheck, [therapistId]);
        
        if (!therapistResult.rows || therapistResult.rows.length === 0) {
            return res.json({ success: false, error: "Therapist not found or not available" });
        }
        
        const therapist = therapistResult.rows[0];
        
        // Check for scheduling conflicts
        const conflictCheck = `
            SELECT id FROM appointments
            WHERE therapist_id = $1
            AND appointment_date = $2
            AND appointment_time = $3
            AND status IN ('pending', 'confirmed')
        `;
        
        const conflictResult = await db.query(conflictCheck, [therapistId, preferredDate, preferredTime]);
        
        if (conflictResult.rows && conflictResult.rows.length > 0) {
            return res.json({ success: false, error: "This time slot is already booked. Please choose another time." });
        }
        
        // Generate meeting link for video sessions
        let meetingLink = null;
        if (sessionType === 'video') {
            meetingLink = `https://meet.yourtherapyapp.com/room/${uuidv4()}`;
        }
        
        // Create the appointment
        const insertQuery = `
            INSERT INTO appointments
            (patient_id, therapist_id, appointment_date, appointment_time, session_type, notes, meeting_link, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
            RETURNING *
        `;
        
        const result = await db.query(insertQuery, [
            patientId, therapistId, preferredDate, preferredTime, sessionType, notes, meetingLink
        ]);
        
        const appointment = result.rows[0];
        
        // Create notification for therapist
        await createNotification(
            therapistId,
            'appointment_request',
            'New Appointment Request',
            `${req.session.user.name} has requested an appointment for ${preferredDate} at ${preferredTime}`,
            { appointmentId: appointment.id }
        );
        
        // Create notification for patient
        await createNotification(
            patientId,
            'appointment_booked',
            'Appointment Request Sent',
            `Your appointment request with ${therapist.name} has been sent and is pending confirmation.`,
            { appointmentId: appointment.id }
        );
        
        res.json({ success: true, message: "Appointment request sent successfully! You'll be notified when the therapist confirms." });
        
    } catch (error) {
        console.error("Error booking appointment:", error);
        res.json({ success: false, error: "Failed to book appointment. Please try again." });
    }
};

// Get user's appointments
exports.getUserAppointments = async (req, res) => {
    const userId = req.session.user.id;
    const userRole = req.session.user.role;

    try {
        console.log(`Fetching appointments for user ${userId} with role ${userRole}`);

        let query;
        if (userRole === 'therapist') {
            query = `
                SELECT a.*,
                       u.name as patient_name,
                       u.email as patient_email,
                       u.profile_image as patient_image
                FROM appointments a
                JOIN users u ON a.patient_id = u.id
                WHERE a.therapist_id = $1
                ORDER BY a.appointment_date DESC, a.appointment_time DESC
            `;
        } else {
            query = `
                SELECT a.*,
                       u.name as therapist_name,
                       u.email as therapist_email,
                       ta.profile_image as therapist_image,
                       ta.specialty,
                       c.id as conversation_id
                FROM appointments a
                JOIN users u ON a.therapist_id = u.id
                LEFT JOIN therapist_applications ta ON u.id = ta.user_id
                LEFT JOIN conversations c ON c.patient_id = a.patient_id AND c.therapist_id = a.therapist_id
                WHERE a.patient_id = $1
                ORDER BY a.appointment_date DESC, a.appointment_time DESC
            `;
        }

        const result = await db.query(query, [userId]);
        const appointments = result.rows || [];

        console.log(`Found ${appointments.length} appointments for user ${userId}`);
        if (appointments.length > 0) {
            console.log('Sample appointment:', appointments[0]);
        }

        res.json({
            success: true,
            appointments
        });

    } catch (error) {
        console.error("Error fetching appointments:", error);
        res.status(500).json({
            success: false,
            error: "Failed to fetch appointments"
        });
    }
};

// Confirm appointment (therapist only)
exports.confirmAppointment = async (req, res) => {
    const { appointmentId } = req.params;
    const therapistId = req.session.user.id;
    
    try {
        // Verify appointment belongs to this therapist
        const verifyQuery = `
            SELECT a.*, u.name as patient_name 
            FROM appointments a 
            JOIN users u ON a.patient_id = u.id 
            WHERE a.id = $1 AND a.therapist_id = $2
        `;
        
        const verifyResult = await db.query(verifyQuery, [appointmentId, therapistId]);
        
        if (!verifyResult.rows || verifyResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: "Appointment not found"
            });
        }
        
        const appointment = verifyResult.rows[0];
        
        // Update appointment status
        const updateQuery = `
            UPDATE appointments
            SET status = 'confirmed', updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING *
        `;

        const result = await db.query(updateQuery, [appointmentId]);

        // Create or get existing conversation between therapist and patient
        const conversationId = await ensureConversationExists(appointment.patient_id, therapistId);

        // Notify patient
        await createNotification(
            appointment.patient_id,
            'appointment_confirmed',
            'Appointment Confirmed',
            `Your appointment with ${req.session.user.name} on ${appointment.appointment_date} at ${appointment.appointment_time} has been confirmed.`,
            { appointmentId: appointmentId, conversationId: conversationId }
        );
        
        res.json({
            success: true,
            message: "Appointment confirmed successfully",
            appointment: result.rows[0]
        });
        
    } catch (error) {
        console.error("Error confirming appointment:", error);
        res.status(500).json({
            success: false,
            error: "Failed to confirm appointment"
        });
    }
};

// Update location for in-person appointments
exports.updateLocation = async (req, res) => {
    const { appointmentId, latitude, longitude } = req.body;
    const userId = req.session.user.id;
    const userRole = req.session.user.role;
    
    try {
        // Verify user is part of this appointment
        const verifyQuery = `
            SELECT * FROM appointments 
            WHERE id = $1 AND (patient_id = $2 OR therapist_id = $2)
            AND session_type = 'in-person'
            AND status = 'confirmed'
        `;
        
        const verifyResult = await db.query(verifyQuery, [appointmentId, userId]);
        
        if (!verifyResult.rows || verifyResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: "Appointment not found or not authorized"
            });
        }
        
        const appointment = verifyResult.rows[0];
        
        // Update location based on user role
        const locationField = userRole === 'therapist' ? 'therapist_location' : 'patient_location';
        const locationData = {
            lat: latitude,
            lng: longitude,
            timestamp: new Date().toISOString()
        };
        
        const updateQuery = `
            UPDATE appointments 
            SET ${locationField} = $1, updated_at = CURRENT_TIMESTAMP 
            WHERE id = $2
            RETURNING *
        `;
        
        const result = await db.query(updateQuery, [JSON.stringify(locationData), appointmentId]);
        const updatedAppointment = result.rows[0];
        
        // Check proximity if both locations are available
        if (updatedAppointment.patient_location && updatedAppointment.therapist_location) {
            const patientLoc = JSON.parse(updatedAppointment.patient_location);
            const therapistLoc = JSON.parse(updatedAppointment.therapist_location);
            
            const distance = calculateDistance(
                patientLoc.lat, patientLoc.lng,
                therapistLoc.lat, therapistLoc.lng
            );
            
            // If within 100 meters and alert not sent
            if (distance <= 0.1 && !updatedAppointment.proximity_alert_sent) {
                // Send proximity alerts to both parties
                const otherUserId = userRole === 'therapist' ? updatedAppointment.patient_id : updatedAppointment.therapist_id;
                const otherUserRole = userRole === 'therapist' ? 'patient' : 'therapist';
                
                await createNotification(
                    otherUserId,
                    'proximity_alert',
                    `Your ${otherUserRole} is nearby!`,
                    `Your ${otherUserRole} for the appointment is within 100 meters of your location.`,
                    { appointmentId: appointmentId, distance: Math.round(distance * 1000) }
                );
                
                await createNotification(
                    userId,
                    'proximity_alert',
                    `Your ${otherUserRole} is nearby!`,
                    `Your ${otherUserRole} for the appointment is within 100 meters of your location.`,
                    { appointmentId: appointmentId, distance: Math.round(distance * 1000) }
                );
                
                // Mark alert as sent
                await db.query(
                    'UPDATE appointments SET proximity_alert_sent = TRUE WHERE id = $1',
                    [appointmentId]
                );
            }
        }
        
        res.json({
            success: true,
            location: locationData,
            proximity_check: updatedAppointment.patient_location && updatedAppointment.therapist_location
        });
        
    } catch (error) {
        console.error("Error updating location:", error);
        res.status(500).json({
            success: false,
            error: "Failed to update location"
        });
    }
};

// Helper function to create notifications
async function createNotification(userId, type, title, message, data = {}) {
    const query = `
        INSERT INTO notifications (user_id, type, title, message, data)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
    `;

    try {
        await db.query(query, [userId, type, title, message, JSON.stringify(data)]);
    } catch (error) {
        console.error("Error creating notification:", error);
    }
}

// Helper function to ensure conversation exists between patient and therapist
async function ensureConversationExists(patientId, therapistId) {
    try {
        // Check if conversation already exists
        const existingQuery = `
            SELECT id FROM conversations
            WHERE patient_id = $1 AND therapist_id = $2
                AND (status IS NULL OR status = 'active')
        `;

        const existingResult = await db.query(existingQuery, [patientId, therapistId]);

        if (existingResult.rows && existingResult.rows.length > 0) {
            return existingResult.rows[0].id;
        }

        // Create new conversation
        const conversationId = uuidv4();
        const createQuery = `
            INSERT INTO conversations (id, patient_id, therapist_id, status, created_at, updated_at)
            VALUES ($1, $2, $3, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            RETURNING id
        `;

        const result = await db.query(createQuery, [conversationId, patientId, therapistId]);
        return result.rows[0].id;

    } catch (error) {
        console.error("Error ensuring conversation exists:", error);
        return null;
    }
}

// Helper function to calculate distance between two points
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the Earth in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in kilometers
    return distance;
}

// Cancel appointment
exports.cancelAppointment = async (req, res) => {
    const { appointmentId } = req.params;
    const { reason } = req.body;
    const userId = req.session.user.id;
    
    try {
        // Verify user is part of this appointment
        const verifyQuery = `
            SELECT a.*, 
                   p.name as patient_name, 
                   t.name as therapist_name
            FROM appointments a
            JOIN users p ON a.patient_id = p.id
            JOIN users t ON a.therapist_id = t.id
            WHERE a.id = $1 AND (a.patient_id = $2 OR a.therapist_id = $2)
            AND a.status IN ('pending', 'confirmed')
        `;
        
        const result = await db.query(verifyQuery, [appointmentId, userId]);
        
        if (!result.rows || result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: "Appointment not found or cannot be cancelled"
            });
        }
        
        const appointment = result.rows[0];
        
        // Update appointment status
        await db.query(
            'UPDATE appointments SET status = $1, notes = COALESCE(notes, \'\') || $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
            ['cancelled', `\n\nCancellation reason: ${reason || 'No reason provided'}`, appointmentId]
        );
        
        // Notify the other party
        const otherUserId = userId === appointment.patient_id ? appointment.therapist_id : appointment.patient_id;
        const cancellerName = userId === appointment.patient_id ? appointment.patient_name : appointment.therapist_name;
        const otherUserRole = userId === appointment.patient_id ? 'therapist' : 'patient';
        
        await createNotification(
            otherUserId,
            'appointment_cancelled',
            'Appointment Cancelled',
            `Your appointment on ${appointment.appointment_date} at ${appointment.appointment_time} has been cancelled by ${cancellerName}.`,
            { appointmentId: appointmentId, reason: reason }
        );
        
        res.json({
            success: true,
            message: "Appointment cancelled successfully"
        });
        
    } catch (error) {
        console.error("Error cancelling appointment:", error);
        res.status(500).json({
            success: false,
            error: "Failed to cancel appointment"
        });
    }
};
// Add these routes to your appointmentController.js or create a separate locationController.js

// Enhanced location update with proximity checking
exports.updateLocationEnhanced = async (req, res) => {
    const { appointmentId } = req.params;
    const { latitude, longitude, accuracy, timestamp } = req.body;
    const userId = req.session.user.id;
    const userRole = req.session.user.role;
    
    try {
        // Verify user is part of this appointment
        const verifyQuery = `
            SELECT * FROM appointments 
            WHERE id = $1 AND (patient_id = $2 OR therapist_id = $2)
            AND session_type = 'in-person'
            AND status = 'confirmed'
        `;
        
        const verifyResult = await db.query(verifyQuery, [appointmentId, userId]);
        
        if (!verifyResult.rows || verifyResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: "Appointment not found or not authorized"
            });
        }
        
        const appointment = verifyResult.rows[0];
        
        // Update location based on user role
        const locationField = userRole === 'therapist' ? 'therapist_location' : 'patient_location';
        const locationData = {
            lat: latitude,
            lng: longitude,
            accuracy: accuracy,
            timestamp: timestamp || new Date().toISOString(),
            lastUpdate: new Date().toISOString()
        };
        
        const updateQuery = `
            UPDATE appointments 
            SET ${locationField} = $1, updated_at = CURRENT_TIMESTAMP 
            WHERE id = $2
            RETURNING *
        `;
        
        const result = await db.query(updateQuery, [JSON.stringify(locationData), appointmentId]);
        const updatedAppointment = result.rows[0];
        
        // Check proximity and send notifications if both locations are available
        let proximityInfo = null;
        if (updatedAppointment.patient_location && updatedAppointment.therapist_location) {
            const patientLoc = JSON.parse(updatedAppointment.patient_location);
            const therapistLoc = JSON.parse(updatedAppointment.therapist_location);
            
            const distance = calculateDistance(
                patientLoc.lat, patientLoc.lng,
                therapistLoc.lat, therapistLoc.lng
            );
            
            proximityInfo = {
                distance: distance,
                isNearby: distance <= 0.1, // 100 meters
                formattedDistance: `${Math.round(distance * 1000)}m`
            };
            
            // Send proximity alerts if within 100 meters and not already sent recently
            if (distance <= 0.1 && shouldSendProximityAlert(updatedAppointment)) {
                await sendProximityAlerts(updatedAppointment, distance, userId);
                
                // Mark proximity alert as sent with timestamp
                await db.query(
                    'UPDATE appointments SET proximity_alert_sent = TRUE, proximity_alert_time = CURRENT_TIMESTAMP WHERE id = $1',
                    [appointmentId]
                );
            }
        }
        
        res.json({
            success: true,
            location: locationData,
            proximityInfo: proximityInfo,
            appointmentStatus: updatedAppointment.status
        });
        
    } catch (error) {
        console.error("Error updating location:", error);
        res.status(500).json({
            success: false,
            error: "Failed to update location"
        });
    }
};

// Check proximity between patient and therapist
exports.checkProximity = async (req, res) => {
    const { appointmentId } = req.params;
    const userId = req.session.user.id;
    const userRole = req.session.user.role;
    
    try {
        // Get appointment with location data
        const appointmentQuery = `
            SELECT a.*, 
                   p.name as patient_name,
                   t.name as therapist_name
            FROM appointments a
            JOIN users p ON a.patient_id = p.id
            JOIN users t ON a.therapist_id = t.id
            WHERE a.id = $1 AND (a.patient_id = $2 OR a.therapist_id = $2)
            AND a.session_type = 'in-person'
        `;
        
        const result = await db.query(appointmentQuery, [appointmentId, userId]);
        
        if (!result.rows || result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: "Appointment not found"
            });
        }
        
        const appointment = result.rows[0];
        let proximityInfo = null;
        
        if (appointment.patient_location && appointment.therapist_location) {
            const patientLoc = JSON.parse(appointment.patient_location);
            const therapistLoc = JSON.parse(appointment.therapist_location);
            
            const distance = calculateDistance(
                patientLoc.lat, patientLoc.lng,
                therapistLoc.lat, therapistLoc.lng
            );
            
            const otherUserName = userRole === 'therapist' ? appointment.patient_name : appointment.therapist_name;
            const otherUserRole = userRole === 'therapist' ? 'patient' : 'therapist';
            
            proximityInfo = {
                distance: distance,
                isNearby: distance <= 0.1,
                formattedDistance: `${Math.round(distance * 1000)}m`,
                otherUserName: otherUserName,
                otherUserRole: otherUserRole,
                lastUpdated: Math.max(
                    new Date(patientLoc.lastUpdate || patientLoc.timestamp).getTime(),
                    new Date(therapistLoc.lastUpdate || therapistLoc.timestamp).getTime()
                )
            };
        }
        
        res.json({
            success: true,
            proximityInfo: proximityInfo
        });
        
    } catch (error) {
        console.error("Error checking proximity:", error);
        res.status(500).json({
            success: false,
            error: "Failed to check proximity"
        });
    }
};

// Stop location tracking
exports.stopLocationTracking = async (req, res) => {
    const { appointmentId } = req.params;
    const userId = req.session.user.id;
    const userRole = req.session.user.role;
    
    try {
        // Verify user is part of this appointment
        const verifyQuery = `
            SELECT id FROM appointments 
            WHERE id = $1 AND (patient_id = $2 OR therapist_id = $2)
        `;
        
        const verifyResult = await db.query(verifyQuery, [appointmentId, userId]);
        
        if (!verifyResult.rows || verifyResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: "Appointment not found"
            });
        }
        
        // Clear location data for the user
        const locationField = userRole === 'therapist' ? 'therapist_location' : 'patient_location';
        
        const updateQuery = `
            UPDATE appointments 
            SET ${locationField} = NULL, updated_at = CURRENT_TIMESTAMP 
            WHERE id = $1
        `;
        
        await db.query(updateQuery, [appointmentId]);
        
        res.json({
            success: true,
            message: "Location tracking stopped"
        });
        
    } catch (error) {
        console.error("Error stopping location tracking:", error);
        res.status(500).json({
            success: false,
            error: "Failed to stop location tracking"
        });
    }
};

// Get appointment location status
exports.getLocationStatus = async (req, res) => {
    const { appointmentId } = req.params;
    const userId = req.session.user.id;
    
    try {
        const appointmentQuery = `
            SELECT patient_location, therapist_location, patient_id, therapist_id
            FROM appointments 
            WHERE id = $1 AND (patient_id = $2 OR therapist_id = $2)
            AND session_type = 'in-person'
        `;
        
        const result = await db.query(appointmentQuery, [appointmentId, userId]);
        
        if (!result.rows || result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: "Appointment not found"
            });
        }
        
        const appointment = result.rows[0];
        const userRole = req.session.user.role;
        
        const locationStatus = {
            userHasSharedLocation: userRole === 'therapist' ? 
                !!appointment.therapist_location : !!appointment.patient_location,
            otherHasSharedLocation: userRole === 'therapist' ? 
                !!appointment.patient_location : !!appointment.therapist_location
        };
        
        res.json({
            success: true,
            locationStatus: locationStatus
        });
        
    } catch (error) {
        console.error("Error getting location status:", error);
        res.status(500).json({
            success: false,
            error: "Failed to get location status"
        });
    }
};

// Helper function to determine if proximity alert should be sent
function shouldSendProximityAlert(appointment) {
    if (!appointment.proximity_alert_sent) {
        return true;
    }
    
    // Send alert again if it's been more than 30 minutes since last alert
    if (appointment.proximity_alert_time) {
        const lastAlert = new Date(appointment.proximity_alert_time);
        const now = new Date();
        const timeDiff = now - lastAlert;
        return timeDiff > 30 * 60 * 1000; // 30 minutes
    }
    
    return false;
}

// Send proximity alerts to both users
async function sendProximityAlerts(appointment, distance, currentUserId) {
    const distanceMeters = Math.round(distance * 1000);
    
    // Get user names
    const usersQuery = `
        SELECT p.name as patient_name, t.name as therapist_name
        FROM appointments a
        JOIN users p ON a.patient_id = p.id
        JOIN users t ON a.therapist_id = t.id
        WHERE a.id = $1
    `;
    
    const usersResult = await db.query(usersQuery, [appointment.id]);
    const { patient_name, therapist_name } = usersResult.rows[0];
    
    // Send notification to patient
    if (currentUserId !== appointment.patient_id) {
        await createNotification(
            appointment.patient_id,
            'proximity_alert',
            `${therapist_name} is nearby!`,
            `Your therapist is within ${distanceMeters}m of your location.`,
            { 
                appointmentId: appointment.id, 
                distance: distanceMeters,
                otherUserName: therapist_name,
                type: 'therapist_nearby'
            }
        );
    }
    
    // Send notification to therapist
    if (currentUserId !== appointment.therapist_id) {
        await createNotification(
            appointment.therapist_id,
            'proximity_alert',
            `${patient_name} is nearby!`,
            `Your patient is within ${distanceMeters}m of your location.`,
            { 
                appointmentId: appointment.id, 
                distance: distanceMeters,
                otherUserName: patient_name,
                type: 'patient_nearby'
            }
        );
    }
}

// Enhanced distance calculation with accuracy consideration
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the Earth in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in kilometers
    return distance;
}

// Create notification helper (reusing existing function)
async function createNotification(userId, type, title, message, data = {}) {
    const query = `
        INSERT INTO notifications (user_id, type, title, message, data)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
    `;
    
    try {
        await db.query(query, [userId, type, title, message, JSON.stringify(data)]);
    } catch (error) {
        console.error("Error creating notification:", error);
    }
}

// Create appointment (for therapists)
exports.createAppointment = async (req, res) => {
    try {
        const therapistId = req.session.user.id;
        const { patientId, appointmentDate, appointmentTime, sessionType, notes } = req.body;

        // Validate required fields
        if (!patientId || !appointmentDate || !appointmentTime || !sessionType) {
            return res.status(400).json({
                success: false,
                error: "Missing required fields"
            });
        }

        // Check if slot is available
        const existingQuery = `
            SELECT id FROM appointments 
            WHERE therapist_id = $1 AND appointment_date = $2 AND appointment_time = $3
            AND status IN ('pending', 'confirmed')
        `;
        const existingResult = await db.query(existingQuery, [therapistId, appointmentDate, appointmentTime]);
        
        if (existingResult.rows.length > 0) {
            return res.status(400).json({
                success: false,
                error: "Time slot is already booked"
            });
        }

        // Generate meeting link for video sessions
        let meetingLink = null;
        if (sessionType === 'video') {
            meetingLink = `https://meet.yourtherapyapp.com/room/${uuidv4()}`;
        }

        // Create appointment
        const insertQuery = `
            INSERT INTO appointments (patient_id, therapist_id, appointment_date, appointment_time, session_type, notes, meeting_link, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'confirmed')
            RETURNING id
        `;
        
        const result = await db.query(insertQuery, [patientId, therapistId, appointmentDate, appointmentTime, sessionType, notes, meetingLink]);
        
        if (result.rows.length > 0) {
            // Notify patient
            await createNotification(
                patientId,
                'appointment_created',
                'New Appointment Scheduled',
                `Your therapist has scheduled an appointment for ${appointmentDate} at ${appointmentTime}.`,
                { appointmentId: result.rows[0].id }
            );

            res.json({
                success: true,
                message: "Appointment created successfully",
                appointmentId: result.rows[0].id
            });
        } else {
            throw new Error("Failed to create appointment");
        }

    } catch (error) {
        console.error("Error creating appointment:", error);
        res.status(500).json({
            success: false,
            error: "Failed to create appointment"
        });
    }
};

// Reject appointment
exports.rejectAppointment = async (req, res) => {
    try {
        const { appointmentId } = req.params;
        const { reason } = req.body;
        const therapistId = req.session.user.id;

        // Verify appointment belongs to this therapist
        const verifyQuery = `
            SELECT a.*, u.name as patient_name 
            FROM appointments a 
            JOIN users u ON a.patient_id = u.id 
            WHERE a.id = $1 AND a.therapist_id = $2
        `;
        
        const verifyResult = await db.query(verifyQuery, [appointmentId, therapistId]);
        
        if (!verifyResult.rows || verifyResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: "Appointment not found"
            });
        }
        
        const appointment = verifyResult.rows[0];

        // Update appointment status
        const updateQuery = `
            UPDATE appointments
            SET status = 'rejected',
                cancellation_reason = $1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $2 AND therapist_id = $3
            RETURNING id
        `;

        const result = await db.query(updateQuery, [reason || 'Rejected by therapist', appointmentId, therapistId]);

        if (result.rows.length > 0) {
            // Create conversation for patient-therapist communication even for rejected appointments
            const conversationId = await ensureConversationExists(appointment.patient_id, therapistId);

            // Notify patient
            await createNotification(
                appointment.patient_id,
                'appointment_rejected',
                'Appointment Request Rejected',
                `Your appointment request for ${appointment.appointment_date} at ${appointment.appointment_time} has been rejected. ${reason ? 'Reason: ' + reason : ''}`,
                { appointmentId: appointmentId, reason: reason, conversationId: conversationId }
            );

            res.json({
                success: true,
                message: "Appointment rejected successfully"
            });
        } else {
            res.status(404).json({
                success: false,
                error: "Appointment not found"
            });
        }

    } catch (error) {
        console.error("Error rejecting appointment:", error);
        res.status(500).json({
            success: false,
            error: "Failed to reject appointment"
        });
    }
};