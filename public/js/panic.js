console.log("🚨 Enhanced Automatic Panic Support with Audio Recording loaded");

// Audio recording variables
let mediaRecorder = null;
let audioChunks = [];
let recordingStream = null;
let isRecording = false;
let recordingStartTime = null;
let autoRecordingEnabled = false;
let sessionData = {
  sessionId: null,
  startTime: null,
  breathingUsed: false,
  audioRecordings: [],
  emergencyContactsUsed: [],
  duration: 0,
  triggerMethod: null // Track how session was started
};

// Original panic support variables
let breathingInterval;
let currentPhase = 'ready';
let phaseTime = 0;
let isBreathing = false;
let cyclesCompleted = 0;
let phaseDurations = { inhale: 4000, hold: 7000, exhale: 8000 };

const CONTACTS_STORAGE_KEY = 'calmtunes_personal_contacts';
const PANIC_SESSIONS_KEY = 'calmtunes_panic_sessions';
const AUDIO_CONSENT_KEY = 'calmtunes_audio_consent';

// Initialize panic session with automatic recording
function initializePanicSession(triggerMethod = 'manual') {
  sessionData.sessionId = 'panic_' + Date.now();
  sessionData.startTime = new Date().toISOString();
  sessionData.triggerMethod = triggerMethod;
  
  console.log("🚨 Panic session initialized:", sessionData.sessionId, "Trigger:", triggerMethod);
  
  // Mark active session in localStorage for recovery
  localStorage.setItem('active_panic_session', sessionData.startTime);
  
  // Automatically start recording if consent is given
  checkAndStartAutoRecording();
  
  // Show session info
  updateSessionUI();
  
  // Show panic session banner
  showPanicSessionBanner();
}

// Check consent and automatically start recording
async function checkAndStartAutoRecording() {
  const savedConsent = localStorage.getItem(AUDIO_CONSENT_KEY);
  
  if (savedConsent === 'granted') {
    // User has previously granted consent, start recording automatically
    await startAutomaticRecording();
  } else if (savedConsent === 'denied') {
    // User previously denied, show brief notification but don't interrupt
    showTempMessage("Audio recording disabled by your preference. Session will still be tracked.", "info");
  } else {
    // First time or unclear consent, ask for permission
    const userConsent = await showQuickRecordingConsentDialog();
    
    if (userConsent) {
      localStorage.setItem(AUDIO_CONSENT_KEY, 'granted');
      await startAutomaticRecording();
    } else {
      localStorage.setItem(AUDIO_CONSENT_KEY, 'denied');
      showTempMessage("Session tracking enabled without audio recording.", "info");
    }
  }
}

// Start automatic recording without interrupting user
async function startAutomaticRecording() {
  try {
    // Request microphone access
    recordingStream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 44100
      }
    });

    // Create MediaRecorder with optimal settings
    const options = {
      mimeType: 'audio/webm;codecs=opus',
      audioBitsPerSecond: 64000 // Lower bitrate for longer sessions
    };

    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options.mimeType = 'audio/webm';
    }

    mediaRecorder = new MediaRecorder(recordingStream, options);
    
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      saveAudioRecording();
    };

    // Start recording immediately
    startAudioRecording();
    autoRecordingEnabled = true;
    
    // Show discrete recording indicator
    updateRecordingUI(true);
    showTempMessage("Auto-recording started for your session", "success");
    
  } catch (error) {
    console.error("❌ Error starting automatic recording:", error);
    handleRecordingError(error);
  }
}

// Quick consent dialog that doesn't interrupt the panic response
function showQuickRecordingConsentDialog() {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'fixed top-4 right-4 bg-white rounded-xl shadow-2xl z-50 max-w-sm border border-gray-200';
    modal.innerHTML = `
      <div class="p-4">
        <div class="flex items-center mb-3">
          <div class="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mr-3">
            <i class="fas fa-microphone text-red-600"></i>
          </div>
          <div>
            <h3 class="font-bold text-gray-800">Auto-Record Session?</h3>
            <p class="text-xs text-gray-600">For therapeutic review</p>
          </div>
        </div>
        
        <div class="flex space-x-2">
          <button onclick="handleQuickConsent(false)" class="flex-1 px-3 py-2 bg-gray-300 text-gray-700 rounded text-sm hover:bg-gray-400">
            Skip
          </button>
          <button onclick="handleQuickConsent(true)" class="flex-1 px-3 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700">
            Yes, Record
          </button>
        </div>
        
        <p class="text-xs text-gray-500 mt-2">You can change this in settings</p>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Auto-dismiss after 10 seconds with default "no"
    const timeout = setTimeout(() => {
      handleQuickConsent(false);
    }, 10000);
    
    window.handleQuickConsent = (consent) => {
      clearTimeout(timeout);
      document.body.removeChild(modal);
      delete window.handleQuickConsent;
      resolve(consent);
    };
  });
}

// Handle recording errors gracefully
function handleRecordingError(error) {
  let errorMessage = "Recording unavailable: ";
  if (error.name === 'NotAllowedError') {
    errorMessage += "Microphone access denied";
  } else if (error.name === 'NotFoundError') {
    errorMessage += "No microphone found";
  } else {
    errorMessage += "Technical issue";
  }
  
  showTempMessage(errorMessage + ". Session tracking continues.", "warning");
}

// Start audio recording
function startAudioRecording() {
  if (mediaRecorder && mediaRecorder.state === 'inactive') {
    audioChunks = [];
    recordingStartTime = Date.now();
    mediaRecorder.start(5000); // Capture in 5-second chunks
    isRecording = true;
    
    console.log("🎙️ Audio recording started");
  }
}

// Enhanced breathing exercise with automatic session tracking
function startBreathing() {
  if (isBreathing) return;
  
  console.log("🫁 Starting breathing exercise");
  
  // Start session if not already started
  if (!sessionData.sessionId) {
    initializePanicSession('breathing_exercise');
  }
  
  sessionData.breathingUsed = true;
  
  // Original breathing logic
  isBreathing = true;
  currentPhase = 'inhale';
  phaseTime = 0;
  cyclesCompleted = 0;
  
  const circle = document.getElementById('breathing-circle');
  const text = document.getElementById('breath-text');
  const instruction = document.getElementById('instruction-text');
  const phaseDisplay = document.getElementById('phase-display');
  const timerDisplay = document.getElementById('timer-display');
  const stopBtn = document.getElementById('stop-btn');
  
  if (stopBtn) stopBtn.classList.remove('hidden');
  if (text) text.textContent = 'Inhale';
  if (instruction) instruction.textContent = 'Inhale deeply through your nose';
  if (phaseDisplay) phaseDisplay.textContent = 'Inhale';
  
  breathingInterval = setInterval(() => {
    phaseTime += 50;
    
    const progress = document.getElementById('breath-progress');
    if (progress) {
      const percent = (phaseTime / currentPhaseDuration()) * 100;
      progress.style.width = Math.min(percent, 100) + '%';
    }
    
    if (timerDisplay) {
      const seconds = Math.ceil(phaseTime / 1000);
      timerDisplay.textContent = seconds + 's';
    }
    
    if (phaseTime >= currentPhaseDuration()) {
      phaseTime = 0;
      if (progress) progress.style.width = '0%';
      
      switch (currentPhase) {
        case 'inhale':
          currentPhase = 'hold';
          if (text) text.textContent = 'Hold';
          if (instruction) instruction.textContent = 'Hold your breath';
          if (phaseDisplay) phaseDisplay.textContent = 'Hold';
          break;
        case 'hold':
          currentPhase = 'exhale';
          if (text) text.textContent = 'Exhale';
          if (instruction) instruction.textContent = 'Exhale slowly through your mouth';
          if (phaseDisplay) phaseDisplay.textContent = 'Exhale';
          break;
        case 'exhale':
          cyclesCompleted++;
          
          if (cyclesCompleted >= 4) {
            stopBreathing();
            if (text) text.textContent = 'Complete!';
            if (instruction) instruction.textContent = 'Great job! You completed 4 cycles. How do you feel?';
            if (phaseDisplay) phaseDisplay.textContent = 'Done';
            if (timerDisplay) timerDisplay.textContent = '4 cycles';
            
            // Ask user if they want to continue the session or end it
            setTimeout(() => {
              showSessionContinueDialog();
            }, 2000);
            
            return;
          } else {
            currentPhase = 'inhale';
            if (text) text.textContent = 'Inhale';
            if (instruction) instruction.textContent = `Cycle ${cyclesCompleted + 1}/4 - Inhale deeply`;
            if (phaseDisplay) phaseDisplay.textContent = 'Inhale';
          }
          break;
      }
    }
  }, 50);
}

// Enhanced emergency contact dialing with automatic session tracking
function dialEmergency(number) {
  console.log("📞 Emergency contact used:", number);
  
  // Start session if not already started - this is an emergency!
  if (!sessionData.sessionId) {
    initializePanicSession('emergency_call');
  }
  
  // Track emergency contact usage
  sessionData.emergencyContactsUsed.push({
    number: number,
    timestamp: new Date().toISOString()
  });
  
  // Show emergency session banner
  showEmergencyCallBanner(number);
  
  window.location.href = `tel:${number}`;
  
  if (!navigator.userAgent.match(/Android|iPhone|iPad/)) {
    showTempMessage('Opening phone dialer... If on desktop, copy the number: ' + number, 'info');
  }
}

// Show session continue dialog after breathing
function showSessionContinueDialog() {
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4';
  modal.innerHTML = `
    <div class="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
      <div class="text-center mb-6">
        <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <i class="fas fa-check-circle text-green-600 text-2xl"></i>
        </div>
        <h2 class="text-2xl font-bold text-gray-800 mb-2">Breathing Complete!</h2>
        <p class="text-gray-600">How are you feeling now?</p>
      </div>
      
      <div class="space-y-3 mb-6">
        <button onclick="handleSessionContinue('better')" class="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700">
          <i class="fas fa-smile mr-2"></i>I'm feeling better
        </button>
        <button onclick="handleSessionContinue('continue')" class="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700">
          <i class="fas fa-redo mr-2"></i>Continue session
        </button>
        <button onclick="handleSessionContinue('help')" class="w-full bg-red-600 text-white py-3 rounded-lg hover:bg-red-700">
          <i class="fas fa-phone mr-2"></i>I need more help
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  window.handleSessionContinue = (choice) => {
    document.body.removeChild(modal);
    delete window.handleSessionContinue;
    
    switch(choice) {
      case 'better':
        // User feels better, offer to end session
        setTimeout(() => {
          if (confirm('Great! Would you like to end this panic support session?')) {
            endPanicSession();
          }
        }, 500);
        break;
      case 'continue':
        // Continue session, maybe offer another breathing cycle
        showTempMessage('Session continues. Try another breathing cycle or contact someone.', 'info');
        break;
      case 'help':
        // User needs more help, scroll to emergency contacts
        scrollToEmergency();
        showTempMessage('Emergency contacts are ready. Your session is being recorded for support.', 'warning');
        break;
    }
  };
}

// Show panic session banner
function showPanicSessionBanner() {
  const banner = document.createElement('div');
  banner.id = 'panic-session-banner';
  banner.className = 'fixed bottom-4 right-4 bg-red-600 text-white p-4 rounded-xl shadow-2xl z-40 max-w-sm';
  banner.innerHTML = `
    <div class="flex items-center justify-between">
      <div class="flex items-center">
        <div class="w-3 h-3 bg-yellow-400 rounded-full mr-3 animate-pulse"></div>
        <div>
          <p class="font-bold text-sm">Panic Session Active</p>
          <p class="text-xs opacity-90" id="session-timer">0:00</p>
        </div>
      </div>
      <button onclick="endPanicSession()" class="bg-red-800 hover:bg-red-900 px-3 py-1 rounded text-xs">
        End
      </button>
    </div>
  `;
  
  document.body.appendChild(banner);
  
  // Update timer every second
  const updateTimer = () => {
    if (!sessionData.startTime) return;
    
    const elapsed = Math.floor((Date.now() - new Date(sessionData.startTime).getTime()) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    
    const timerElement = document.getElementById('session-timer');
    if (timerElement) {
      timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    
    if (document.getElementById('panic-session-banner')) {
      setTimeout(updateTimer, 1000);
    }
  };
  
  updateTimer();
}

// Show emergency call banner
function showEmergencyCallBanner(number) {
  const banner = document.createElement('div');
  banner.className = 'fixed top-20 left-4 right-4 bg-red-700 text-white p-4 rounded-xl shadow-2xl z-40';
  banner.innerHTML = `
    <div class="text-center">
      <div class="flex items-center justify-center mb-2">
        <i class="fas fa-phone text-2xl mr-3 animate-pulse"></i>
        <div>
          <p class="font-bold">Emergency Call Initiated</p>
          <p class="text-sm opacity-90">Calling ${number} - Session recording active</p>
        </div>
      </div>
      <p class="text-xs bg-red-800 px-3 py-1 rounded-full inline-block">
        Your session is being documented for follow-up care
      </p>
    </div>
  `;
  
  document.body.appendChild(banner);
  
  // Remove banner after 5 seconds
  setTimeout(() => {
    if (document.body.contains(banner)) {
      document.body.removeChild(banner);
    }
  }, 5000);
}

// Stop audio recording
function stopAudioRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
    isRecording = false;
    
    // Stop the stream
    if (recordingStream) {
      recordingStream.getTracks().forEach(track => track.stop());
    }
    
    console.log("⏹️ Audio recording stopped");
    updateRecordingUI(false);
  }
}

// Save audio recording with session context
function saveAudioRecording() {
  if (audioChunks.length === 0) return;
  
  const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
  const audioUrl = URL.createObjectURL(audioBlob);
  const duration = Date.now() - recordingStartTime;
  
  const recording = {
    id: 'recording_' + Date.now(),
    sessionId: sessionData.sessionId,
    blob: audioBlob,
    url: audioUrl,
    duration: duration,
    timestamp: new Date().toISOString(),
    size: audioBlob.size,
    triggerMethod: sessionData.triggerMethod,
    breathingUsed: sessionData.breathingUsed,
    emergencyContactsCount: sessionData.emergencyContactsUsed.length
  };
  
  sessionData.audioRecordings.push(recording);
  
  console.log("💾 Audio recording saved:", recording.id, "Duration:", Math.round(duration/1000) + "s");
}

// End panic session with comprehensive save
function endPanicSession() {
  console.log("🏁 Ending panic session:", sessionData.sessionId);
  
  // Stop recording if active
  if (isRecording) {
    stopAudioRecording();
  }
  
  // Stop breathing exercise if active
  if (isBreathing) {
    stopBreathing();
  }
  
  // Calculate total duration
  sessionData.duration = Date.now() - new Date(sessionData.startTime).getTime();
  
  // Save session data
  savePanicSession();
  
  // Remove session banner
  const banner = document.getElementById('panic-session-banner');
  if (banner) {
    document.body.removeChild(banner);
  }
  
  // Show session summary
  showSessionSummary();
  
  // Clean up
  localStorage.removeItem('active_panic_session');
  resetSessionData();
}

// Enhanced session summary with recording info
function showSessionSummary() {
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4';
  modal.innerHTML = `
    <div class="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl">
      <div class="text-center mb-6">
        <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <i class="fas fa-heart text-green-600 text-2xl"></i>
        </div>
        <h2 class="text-2xl font-bold text-gray-800 mb-2">Session Complete</h2>
        <p class="text-gray-600">Your panic support session has been saved for review.</p>
      </div>
      
      <div class="space-y-4 mb-6">
        <div class="bg-gray-50 rounded-lg p-4">
          <h3 class="font-semibold text-gray-800 mb-2">Session Summary</h3>
          <div class="space-y-2 text-sm text-gray-600">
            <p><strong>Duration:</strong> ${Math.round(sessionData.duration / 60000)} minutes ${Math.round((sessionData.duration % 60000) / 1000)} seconds</p>
            <p><strong>Trigger:</strong> ${sessionData.triggerMethod?.replace('_', ' ') || 'Manual'}</p>
            <p><strong>Breathing Exercise:</strong> ${sessionData.breathingUsed ? 'Completed' : 'Not used'}</p>
            <p><strong>Emergency Contacts:</strong> ${sessionData.emergencyContactsUsed.length} contacted</p>
            <p><strong>Audio Recordings:</strong> ${sessionData.audioRecordings.length} recordings (${Math.round(sessionData.audioRecordings.reduce((total, rec) => total + rec.duration, 0) / 1000)}s total)</p>
          </div>
        </div>
        
        ${sessionData.audioRecordings.length > 0 ? `
        <div class="bg-blue-50 rounded-lg p-4">
          <h3 class="font-semibold text-blue-800 mb-2">Recorded for Care</h3>
          <ul class="text-sm text-blue-700 space-y-1">
            <li>• Audio automatically saved securely</li>
            <li>• Available for therapist review</li>
            <li>• Helps track progress over time</li>
            <li>• You control access and deletion</li>
          </ul>
        </div>
        ` : ''}
        
        <div class="bg-green-50 rounded-lg p-4">
          <h3 class="font-semibold text-green-800 mb-2">You're Safe Now</h3>
          <ul class="text-sm text-green-700 space-y-1">
            <li>• Take your time to recover</li>
            <li>• Consider reaching out for support</li>
            <li>• Practice self-care activities</li>
            <li>• Remember: panic attacks are temporary</li>
          </ul>
        </div>
      </div>
      
      <div class="flex space-x-3">
        <button onclick="shareWithTherapist()" class="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          <i class="fas fa-share mr-2"></i>Share with Therapist
        </button>
        <button onclick="closeSummaryModal()" class="flex-1 px-4 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors">
          Close
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  window.closeSummaryModal = () => {
    document.body.removeChild(modal);
    delete window.closeSummaryModal;
    delete window.shareWithTherapist;
  };
  
  window.shareWithTherapist = async () => {
    try {
      // Get the current session data
      const sessionDataToShare = {
        sessionId: sessionData.sessionId,
        startTime: sessionData.startTime,
        duration: sessionData.duration,
        triggerMethod: sessionData.triggerMethod,
        breathingUsed: sessionData.breathingUsed,
        emergencyContactsUsed: sessionData.emergencyContactsUsed,
        audioRecordingsCount: sessionData.audioRecordings.length,
        notes: `Panic session shared by patient for therapist review. Duration: ${Math.round(sessionData.duration / 60000)} minutes.`
      };

      // Share with therapist via API
      const response = await fetch('/panic/share-with-therapist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sessionDataToShare)
      });

      const result = await response.json();

      if (result.success) {
        showTempMessage('Session shared with your therapist successfully!', 'success');
      } else {
        showTempMessage('Failed to share session with therapist. You can try again later.', 'warning');
      }
    } catch (error) {
      console.error('Error sharing session with therapist:', error);
      showTempMessage('Failed to share session with therapist. Please try again.', 'error');
    }

    closeSummaryModal();
  };
}

// FIXED: Save panic session to localStorage and server
function savePanicSession() {
  try {
    const sessions = JSON.parse(localStorage.getItem(PANIC_SESSIONS_KEY) || '[]');
    
    // Create session record for localStorage (without blob data)
    const sessionRecord = {
      ...sessionData,
      audioRecordings: sessionData.audioRecordings.map(recording => ({
        id: recording.id,
        duration: recording.duration,
        timestamp: recording.timestamp,
        size: recording.size,
        triggerMethod: recording.triggerMethod,
        hasAudio: true
      }))
    };
    
    sessions.push(sessionRecord);
    localStorage.setItem(PANIC_SESSIONS_KEY, JSON.stringify(sessions));
    
    console.log("💾 Panic session saved locally:", sessionData.sessionId);
    
    // Upload to server immediately
    uploadSessionToServer(sessionData);
    
  } catch (error) {
    console.error("❌ Error saving panic session:", error);
    showTempMessage('Session data saved locally. Server sync pending.', 'warning');
  }
}

// Enhanced uploadSessionToServer function with proper audio data
async function uploadSessionToServer(sessionData) {
  try {
    const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';

    // Convert audio recordings to base64 for upload
    const processedAudioRecordings = await Promise.all(
      sessionData.audioRecordings.map(async (recording) => {
        let audioData = null;

        if (recording.blob) {
          try {
            // Convert blob to base64
            audioData = await blobToBase64(recording.blob);
            // Remove data:audio/webm;base64, prefix
            audioData = audioData.split(',')[1];
          } catch (error) {
            console.error("Error converting audio to base64:", error);
          }
        }

        return {
          id: recording.id,
          duration: recording.duration,
          timestamp: recording.timestamp,
          size: recording.size,
          triggerMethod: recording.triggerMethod,
          breathingUsed: recording.breathingUsed,
          emergencyContactsCount: recording.emergencyContactsCount,
          audioData: audioData // This is the base64 audio data
        };
      })
    );

    // Ensure we have a valid session ID
    const finalSessionId = sessionData.sessionId || `panic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Prepare session data in the format expected by the server
    const serverData = {
      sessionId: finalSessionId,
      startTime: sessionData.startTime,
      endTime: new Date().toISOString(),
      duration: sessionData.duration,
      breathingUsed: sessionData.breathingUsed,
      emergencyContactsUsed: sessionData.emergencyContactsUsed,
      triggerMethod: sessionData.triggerMethod,
      audioRecordings: processedAudioRecordings,
      sessionNotes: `Session completed. Trigger: ${sessionData.triggerMethod}. Breathing used: ${sessionData.breathingUsed}. Emergency contacts called: ${sessionData.emergencyContactsUsed.length}. Session ID: ${finalSessionId}`
    };

    console.log("Uploading session data with audio files:", {
      sessionId: serverData.sessionId,
      audioRecordingsCount: processedAudioRecordings.length,
      totalAudioSize: processedAudioRecordings.reduce((total, rec) => total + (rec.size || 0), 0)
    });

    const response = await fetch('/panic/save-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-TOKEN': token
      },
      body: JSON.stringify(serverData)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    if (result.success) {
      console.log("Session uploaded to server:", result.sessionId);
      console.log("Audio files processed:", result.audioFilesProcessed);
      showTempMessage(`Panic session recorded and ${result.audioFilesProcessed} audio files saved for therapist review`, 'success');
      
      // Redirect after a short delay if redirect URL provided
      if (result.redirectUrl) {
        setTimeout(() => {
          window.location.href = result.redirectUrl;
        }, 3000);
      }
    } else {
      console.error("Server upload failed:", result.error);
      showTempMessage('Session saved locally. You can sync later.', 'warning');
    }
  } catch (error) {
    console.error("Upload error:", error);

    // Try to save to localStorage as backup
    try {
      const sessions = JSON.parse(localStorage.getItem(PANIC_SESSIONS_KEY) || '[]');
      const backupSessionId = finalSessionId || sessionData.sessionId || `panic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const sessionRecord = {
        ...sessionData,
        audioRecordings: sessionData.audioRecordings.map(recording => ({
          id: recording.id,
          duration: recording.duration,
          timestamp: recording.timestamp,
          size: recording.size,
          triggerMethod: recording.triggerMethod,
          hasAudio: true,
          uploadFailed: true,
          error: error.message
        })),
        savedAt: new Date().toISOString(),
        needsSync: true
      };

      sessions.push(sessionRecord);
      localStorage.setItem(PANIC_SESSIONS_KEY, JSON.stringify(sessions));
      console.log("Session saved locally as backup:", backupSessionId);
    } catch (localError) {
      console.error("Failed to save locally:", localError);
    }

    showTempMessage('Session saved locally. Please try syncing later.', 'warning');
  }
}

// Helper function to convert blob to base64
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Enhanced save audio recording to include blob data
function saveAudioRecording() {
  if (audioChunks.length === 0) return;
  
  const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
  const audioUrl = URL.createObjectURL(audioBlob);
  const duration = Date.now() - recordingStartTime;
  
  const recording = {
    id: 'recording_' + Date.now(),
    sessionId: sessionData.sessionId,
    blob: audioBlob, // Keep the blob for upload
    url: audioUrl, // Keep URL for local preview
    duration: duration,
    timestamp: new Date().toISOString(),
    size: audioBlob.size,
    triggerMethod: sessionData.triggerMethod,
    breathingUsed: sessionData.breathingUsed,
    emergencyContactsCount: sessionData.emergencyContactsUsed.length
  };
  
  sessionData.audioRecordings.push(recording);
  
  console.log("Audio recording saved with blob data:", recording.id, "Duration:", Math.round(duration/1000) + "s", "Size:", Math.round(audioBlob.size/1024) + "KB");
  
  // Display in UI immediately
  displayRecordingInUI(recording);
}
// Get current phase duration
function currentPhaseDuration() {
  switch (currentPhase) {
    case 'inhale':
      return phaseDurations.inhale;
    case 'hold':
      return phaseDurations.hold;
    case 'exhale':
      return phaseDurations.exhale;
    default:
      return phaseDurations.inhale;
  }
}

// Stop breathing exercise
function stopBreathing() {
  if (!isBreathing) return;
  
  console.log("🛑 Stopping breathing exercise");
  
  // Clear the interval
  if (breathingInterval) {
    clearInterval(breathingInterval);
    breathingInterval = null;
  }
  
  // Reset state
  isBreathing = false;
  currentPhase = 'ready';
  phaseTime = 0;
  
  // Update UI elements
  const circle = document.getElementById('breathing-circle');
  const text = document.getElementById('breath-text');
  const instruction = document.getElementById('instruction-text');
  const phaseDisplay = document.getElementById('phase-display');
  const timerDisplay = document.getElementById('timer-display');
  const stopBtn = document.getElementById('stop-btn');
  const progress = document.getElementById('breath-progress');
  
  if (text) text.textContent = 'Click to Start';
  if (instruction) instruction.textContent = 'Get ready to breathe';
  if (phaseDisplay) phaseDisplay.textContent = 'Ready';
  if (timerDisplay) timerDisplay.textContent = '0s';
  if (stopBtn) stopBtn.classList.add('hidden');
  if (progress) progress.style.width = '0%';
  
  // Reset circle appearance
  if (circle) {
    circle.style.transform = 'scale(1)';
    circle.style.transition = 'transform 0.3s ease';
  }
}

// Update recording UI indicator
function updateRecordingUI(recording) {
  let indicator = document.getElementById('recording-indicator');
  
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.id = 'recording-indicator';
    indicator.className = 'fixed top-4 left-4 z-40';
    document.body.appendChild(indicator);
  }
  
  if (recording) {
    indicator.innerHTML = `
      <div class="flex items-center bg-red-100 text-red-700 px-3 py-2 rounded-lg shadow-lg">
        <div class="w-3 h-3 bg-red-500 rounded-full mr-2 animate-pulse"></div>
        <span class="text-sm font-medium">Auto-Recording</span>
      </div>
    `;
    indicator.classList.remove('hidden');
  } else {
    indicator.classList.add('hidden');
  }
}

// Reset session data
function resetSessionData() {
  // Clean up blob URLs to prevent memory leaks
  sessionData.audioRecordings.forEach(recording => {
    if (recording.url) {
      URL.revokeObjectURL(recording.url);
    }
  });
  
  sessionData = {
    sessionId: null,
    startTime: null,
    breathingUsed: false,
    audioRecordings: [],
    emergencyContactsUsed: [],
    duration: 0,
    triggerMethod: null
  };
  
  autoRecordingEnabled = false;
}

// Utility function to show temporary messages
function showTempMessage(message, type = 'info') {
  let msgDiv = document.getElementById('temp-message');
  if (!msgDiv) {
    msgDiv = document.createElement('div');
    msgDiv.id = 'temp-message';
    msgDiv.className = 'fixed top-16 right-4 z-50';
    document.body.appendChild(msgDiv);
  }
  
  const colors = {
    info: 'bg-blue-100 border-blue-500 text-blue-700',
    success: 'bg-green-100 border-green-500 text-green-700',
    warning: 'bg-yellow-100 border-yellow-500 text-yellow-700',
    error: 'bg-red-100 border-red-500 text-red-700'
  };
  
  msgDiv.innerHTML = `
    <div class="p-3 border-l-4 rounded shadow-lg max-w-sm ${colors[type] || colors.info}">
      ${message}
    </div>
  `;
  msgDiv.style.display = 'block';
  
  setTimeout(() => {
    msgDiv.style.display = 'none';
  }, 4000);
}

// Auto-detect potential panic indicators and offer help
function detectPanicIndicators() {
  let rapidClicks = 0;
  let lastClickTime = 0;
  let pageVisits = 0;
  let lastVisitTime = 0;
  let inactivityStart = Date.now();

  // Track rapid clicking (anxiety indicator)
  document.addEventListener('click', () => {
    const now = Date.now();
    if (now - lastClickTime < 1000) {
      rapidClicks++;
      if (rapidClicks > 5 && !sessionData.sessionId) {
        showTempMessage('Detected rapid activity. Would you like panic support?', 'warning');
        setTimeout(() => {
          if (confirm('It looks like you might be feeling distressed. Start a panic support session with automatic recording?')) {
            initializePanicSession('auto_detected_rapid_clicks');
          }
        }, 2000);
      }
    } else {
      rapidClicks = 0;
    }
    lastClickTime = now;
  });

  // Track multiple visits to panic-related pages
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      const now = Date.now();
      pageVisits++;

      // If user visits panic page multiple times quickly
      if (pageVisits > 2 && (now - lastVisitTime) < 300000 && !sessionData.sessionId) { // 5 minutes
        showTempMessage('Multiple visits detected. Need panic support?', 'warning');
        // Removed automatic prompt - users can start sessions manually if needed
      }

      lastVisitTime = now;
    } else {
      // Track when user switches away (might be feeling overwhelmed)
      inactivityStart = Date.now();
    }
  });

  // Track long periods of inactivity followed by sudden activity
  document.addEventListener('focus', () => {
    const now = Date.now();
    const inactiveTime = now - inactivityStart;

    // If inactive for more than 10 minutes then suddenly active
    if (inactiveTime > 600000 && !sessionData.sessionId) { // 10 minutes
      showTempMessage('Welcome back! Everything okay?', 'info');
      setTimeout(() => {
        if (confirm('You were away for a while. Would you like panic support?')) {
          initializePanicSession('auto_detected_after_inactivity');
        }
      }, 5000);
    }
  });

  // Track navigation patterns
  let navigationCount = 0;
  let lastNavigationTime = 0;

  window.addEventListener('beforeunload', () => {
    const now = Date.now();
    if (now - lastNavigationTime < 5000) {
      navigationCount++;
      if (navigationCount > 3 && !sessionData.sessionId) {
        // Save indication of rapid navigation for next session
        localStorage.setItem('panic_navigation_detected', 'true');
      }
    }
    lastNavigationTime = now;
  });

  // Check for previous rapid navigation on page load
  if (localStorage.getItem('panic_navigation_detected') === 'true') {
    localStorage.removeItem('panic_navigation_detected');
    if (!sessionData.sessionId) {
      setTimeout(() => {
        if (confirm('Previous rapid navigation detected. Start panic support session?')) {
          initializePanicSession('auto_detected_rapid_navigation');
        }
      }, 10000);
    }
  }

  // Track keyboard patterns that might indicate distress
  let keyPressCount = 0;
  let lastKeyTime = 0;
  let repeatedKeys = 0;
  let lastKey = '';

  document.addEventListener('keydown', (event) => {
    const now = Date.now();

    // Check for repeated key presses (like mashing keys in distress)
    if (event.key === lastKey && (now - lastKeyTime) < 200) {
      repeatedKeys++;
      if (repeatedKeys > 10 && !sessionData.sessionId) {
        showTempMessage('Multiple key repeats detected. Need help?', 'warning');
        setTimeout(() => {
          if (confirm('It looks like you might be distressed. Start panic support?')) {
            initializePanicSession('auto_detected_key_mashing');
          }
        }, 3000);
      }
    } else {
      repeatedKeys = 0;
    }

    // Check for rapid typing
    if (now - lastKeyTime < 100) {
      keyPressCount++;
      if (keyPressCount > 20 && !sessionData.sessionId) {
        showTempMessage('Rapid typing detected. Everything okay?', 'info');
        setTimeout(() => {
          if (confirm('You seem to be typing very quickly. Would you like panic support?')) {
            initializePanicSession('auto_detected_rapid_typing');
          }
        }, 5000);
      }
    } else {
      keyPressCount = 0;
    }

    lastKey = event.key;
    lastKeyTime = now;
  });

  // Ensure sessions are saved even if page is closed unexpectedly
  window.addEventListener('beforeunload', () => {
    if (sessionData.sessionId && sessionData.startTime) {
      // Mark session as interrupted
      sessionData.triggerMethod = sessionData.triggerMethod || 'interrupted';
      sessionData.endTime = new Date().toISOString();
      sessionData.duration = Date.now() - new Date(sessionData.startTime).getTime();
      sessionData.interrupted = true;

      // Try to save immediately
      try {
        savePanicSession();
      } catch (error) {
        console.error('Failed to save interrupted session:', error);
      }
    }
  });

  // Periodic session check to ensure active sessions are tracked
  setInterval(() => {
    if (sessionData.sessionId && sessionData.startTime) {
      const duration = Date.now() - new Date(sessionData.startTime).getTime();
      if (duration > 3600000) { // 1 hour
        showTempMessage('Session has been active for over an hour. Consider ending it.', 'info');
      }
    }
  }, 600000); // Check every 10 minutes
}

// Scroll to emergency section
function scrollToEmergency() {
  const emergencySection = document.getElementById('emergency-contacts') || document.querySelector('.emergency-contacts');
  if (emergencySection) {
    emergencySection.scrollIntoView({ behavior: 'smooth' });
  }
}

// Update session UI (placeholder for any session UI updates)
function updateSessionUI() {
  // Can be used to update any session-related UI elements
  console.log("Session UI updated for:", sessionData.sessionId);
}

// Sync failed sessions to server
async function syncFailedSessions() {
  try {
    const sessions = JSON.parse(localStorage.getItem(PANIC_SESSIONS_KEY) || '[]');
    const failedSessions = sessions.filter(session => session.needsSync);

    if (failedSessions.length === 0) {
      showTempMessage('All sessions are synced!', 'success');
      return;
    }

    let syncedCount = 0;
    for (const session of failedSessions) {
      try {
        await uploadSessionToServer(session);
        session.needsSync = false;
        session.syncedAt = new Date().toISOString();
        syncedCount++;
      } catch (error) {
        console.error("Failed to sync session:", session.sessionId, error);
      }
    }

    // Update localStorage
    localStorage.setItem(PANIC_SESSIONS_KEY, JSON.stringify(sessions));

    showTempMessage(`Synced ${syncedCount} of ${failedSessions.length} sessions`, 'success');

  } catch (error) {
    console.error("Error syncing sessions:", error);
    showTempMessage('Failed to sync sessions. Please try again.', 'error');
  }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
  console.log("🚨 Automatic panic support with audio recording initialized");

  // Set up panic detection
  detectPanicIndicators();

  // Check URL hash for emergency start
  if (window.location.hash === '#emergency-start') {
    setTimeout(() => {
      initializePanicSession('emergency_link');
    }, 500);
  }

  // Add breathing exercise click handler
  const circle = document.getElementById('breathing-circle');
  if (circle) {
    circle.addEventListener('click', () => {
      if (!isBreathing) {
        startBreathing();
      } else {
        stopBreathing();
      }
    });
  }

  // Add sync button to panic page if there are failed sessions
  const sessions = JSON.parse(localStorage.getItem(PANIC_SESSIONS_KEY) || '[]');
  const failedSessions = sessions.filter(session => session.needsSync);

  if (failedSessions.length > 0) {
    const syncButton = document.createElement('button');
    syncButton.innerHTML = `<i class="fas fa-sync mr-2"></i>Sync ${failedSessions.length} Failed Session${failedSessions.length !== 1 ? 's' : ''}`;
    syncButton.className = 'bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-lg hover:bg-orange-700 transition-all fixed bottom-4 left-4 z-40';
    syncButton.onclick = syncFailedSessions;

    document.body.appendChild(syncButton);
  }

  console.log("✅ Enhanced automatic panic support ready");
});