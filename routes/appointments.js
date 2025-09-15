// routes/appointments.js - Debug version with extensive logging
const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointmentController');
const chatController = require('../controllers/chatController');
const therapistController = require('../controllers/therapistController');
const { 
    requireAuth, 
    requireAuthAPI,
    requirePatientAPI,
    requireTherapistAPI 
} = require('../middleware/auth');

// API Routes (use requireAuthAPI - returns JSON errors)
router.post('/book', requireAuthAPI, appointmentController.bookAppointment);
router.get('/my-appointments', requireAuthAPI, appointmentController.getUserAppointments);
router.put('/:appointmentId/confirm', requireTherapistAPI, appointmentController.confirmAppointment);
router.put('/:appointmentId/reject', requireTherapistAPI, appointmentController.rejectAppointment);
router.put('/:appointmentId/cancel', requireAuthAPI, appointmentController.cancelAppointment);

// Enhanced location tracking routes
router.post('/:appointmentId/location', requireAuthAPI, appointmentController.updateLocationEnhanced || appointmentController.updateLocation);
router.get('/:appointmentId/proximity-check', requireAuthAPI, appointmentController.checkProximity);
router.post('/:appointmentId/location/stop', requireAuthAPI, appointmentController.stopLocationTracking);
router.get('/:appointmentId/location/status', requireAuthAPI, appointmentController.getLocationStatus);

// Chat API routes (use requireAuthAPI)
router.post('/chat/start', requireAuthAPI, chatController.startConversation);
router.get('/chat/conversations', requireAuthAPI, chatController.getConversations);
router.get('/chat/:conversationId/messages', requireAuthAPI, chatController.getMessages);
router.post('/chat/:conversationId/send', requireAuthAPI, chatController.sendMessage);

// Video call routes
router.post('/video/start', requireAuthAPI, chatController.startVideoCall);
router.post('/video/:videoCallId/join', requireAuthAPI, chatController.joinVideoCall);
router.post('/video/:videoCallId/end', requireAuthAPI, chatController.endVideoCall);

// Therapist availability routes
router.get('/therapist/:therapistId/availability', therapistController.getAvailability);


// DEBUG VERSION: Add extensive logging to identify the issue
router.get('/chat/:conversationId', requireAuth, async (req, res) => {
    console.log('=== CHAT ROUTE DEBUG ===');
    console.log('Request URL:', req.originalUrl);
    console.log('Route params:', req.params);
    console.log('Query params:', req.query);
    console.log('Session user:', req.session?.user);
    console.log('User agent:', req.get('User-Agent'));
    console.log('Method:', req.method);
    
    let conversationId = req.params.conversationId;
    console.log('Conversation ID:', conversationId);
    
    if (conversationId === 'new') {
        console.log('Processing NEW conversation request');
        
        try {
            const userId = req.session?.user?.id;
            const userRole = req.session?.user?.role;
            
            console.log('User ID:', userId);
            console.log('User Role:', userRole);
            
            if (!userId || !userRole) {
                console.error('Missing session data - userId or userRole is undefined');
                return res.status(401).render('pages/error', {
                    title: 'Error',
                    message: 'Session expired. Please log in again.',
                    user: req.session?.user || null
                });
            }
            
            let otherId, patientId, therapistId;
            
            // Get the other user ID from query parameters
            if (userRole === 'patient') {
                otherId = req.query.therapistId;
                console.log('Patient requesting chat with therapist ID:', otherId);
                
                if (!otherId) {
                    console.error('Missing therapistId in query parameters');
                    // Redirect to find therapist page instead of showing error
                    return res.redirect('/find-therapist?action=chat');
                }
                patientId = userId;
                therapistId = otherId;
            } else if (userRole === 'therapist') {
                otherId = req.query.patientId;
                console.log('Therapist requesting chat with patient ID:', otherId);
                
                if (!otherId) {
                    console.error('Missing patientId in query parameters');
                    // Redirect to therapist patients page or chat list instead of showing error
                    return res.redirect('/therapist/patients?action=chat');
                }
                patientId = otherId;
                therapistId = userId;
            } else {
                console.error('Invalid user role:', userRole);
                return res.status(403).render('pages/error', {
                    title: 'Error',
                    message: 'Invalid user role. Please contact support.',
                    user: req.session.user
                });
            }

            console.log('Final IDs - Patient:', patientId, 'Therapist:', therapistId);

            const db = require('../config/database');
            const { v4: uuidv4 } = require('uuid');

            // Verify the other user exists and has the correct role
            let verifyQuery, verifyParams;
            if (userRole === 'patient') {
                // Verify therapist exists and is approved
                verifyQuery = `
                    SELECT u.id, u.name, u.email, ta.status
                    FROM users u
                    JOIN therapist_applications ta ON u.id = ta.user_id
                    WHERE u.id = $1 AND u.role = 'therapist' AND ta.status = 'approved'
                `;
                verifyParams = [therapistId];
            } else {
                // Verify patient exists
                verifyQuery = `
                    SELECT u.id, u.name, u.email
                    FROM users u
                    WHERE u.id = $1 AND u.role = 'patient'
                `;
                verifyParams = [patientId];
            }

            console.log('Verifying other user with query:', verifyQuery);
            console.log('Query params:', verifyParams);

            const verifyResult = await new Promise((resolve, reject) => {
                db.query(verifyQuery, verifyParams, (err, results) => {
                    if (err) {
                        console.error('Database error during verification:', err);
                        reject(err);
                    } else {
                        console.log('Verification result:', results.rows);
                        resolve(results);
                    }
                });
            });

            if (!verifyResult.rows || verifyResult.rows.length === 0) {
                const errorMsg = userRole === 'patient' ? 
                    'Therapist not found or not available for chat' : 
                    'Patient not found or not available for chat';
                console.error('Verification failed:', errorMsg);
                return res.status(404).render('pages/error', {
                    title: 'Error',
                    message: errorMsg,
                    user: req.session.user
                });
            }

            console.log('Other user verified successfully');

            // Check if conversation already exists
            const existingQuery = `
                SELECT id FROM conversations
                WHERE patient_id = $1 AND therapist_id = $2 AND status = 'active'
            `;
            
            console.log('Checking for existing conversation');
            const existingResult = await new Promise((resolve, reject) => {
                db.query(existingQuery, [patientId, therapistId], (err, results) => {
                    if (err) {
                        console.error('Database error checking existing conversation:', err);
                        reject(err);
                    } else {
                        console.log('Existing conversation check result:', results.rows);
                        resolve(results);
                    }
                });
            });

            if (existingResult.rows && existingResult.rows.length > 0) {
                const existingId = existingResult.rows[0].id;
                console.log('Found existing conversation:', existingId);
                return res.redirect(`/appointments/chat/${existingId}`);
            }

            // Create new conversation
            const newConversationId = uuidv4();
            console.log('Creating new conversation with ID:', newConversationId);
            
            const createQuery = `
                INSERT INTO conversations (id, patient_id, therapist_id, status, created_at, updated_at)
                VALUES ($1, $2, $3, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `;

            await new Promise((resolve, reject) => {
                db.query(createQuery, [newConversationId, patientId, therapistId], (err, results) => {
                    if (err) {
                        console.error('Database error creating conversation:', err);
                        reject(err);
                    } else {
                        console.log('Conversation created successfully');
                        resolve(results);
                    }
                });
            });

            console.log('Redirecting to new conversation:', newConversationId);
            return res.redirect(`/appointments/chat/${newConversationId}`);

        } catch (error) {
            console.error('Error in new conversation creation:', error);
            console.error('Stack trace:', error.stack);
            return res.status(500).render('pages/error', {
                title: 'Error',
                message: 'Failed to start conversation. Please try again later.',
                user: req.session?.user || null
            });
        }
    }
    
    console.log('Rendering conversation page for ID:', conversationId);
    res.render('pages/conversation', {
        title: 'Chat',
        user: req.session.user,
        conversationId: conversationId
    });
});

router.get('/chat', requireAuth, (req, res) => {
    console.log('Chat list route accessed by user:', req.session?.user?.id);
    res.render('pages/conversation', {
        title: 'Messages',
        user: req.session.user,
        conversationId: null // Set to null when showing conversation list
    });
});

router.get('/appointments', requireAuth, (req, res) => {
    console.log('Appointments route accessed by user:', req.session?.user?.id);
    res.render('pages/appointments', {
        title: 'My Appointments',
        user: req.session.user
    });
});

module.exports = router;