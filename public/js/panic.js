// Check if user is authenticated before enabling panic detection
const isAuthenticated = document.querySelector('meta[name="user-authenticated"]')?.getAttribute('content') === 'true' ||
                       document.querySelector('.user-nav') !== null ||
                       document.querySelector('[data-user]') !== null;

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

// FIXED: Start recording immediately when session begins
async function initializePanicSession(triggerMethod = 'manual') {
  // Prevent multiple initializations
  if (sessionData.sessionId) {
    console.log("🚨 Panic session already active:", sessionData.sessionId);
    return;
  }

  sessionData.sessionId = 'panic_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  sessionData.startTime = new Date().toISOString();
  sessionData.triggerMethod = triggerMethod;

  console.log("🚨 Panic session initialized:", sessionData.sessionId, "Trigger:", triggerMethod);

  // Mark active session
  localStorage.setItem('active_panic_session', sessionData.startTime);

  // IMMEDIATELY start recording - no consent check, just record
  await startImmediateRecording();

  // Show session info
  updateSessionUI();
  startSessionUIUpdates();

  // Show recording controls
  showRecordingControls();

  showTempMessage('Session started - Recording audio automatically', 'success');
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

// FIXED: Start recording immediately without asking
async function startImmediateRecording() {
  try {
    console.log("🎙️ Starting immediate audio recording...");

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
      audioBitsPerSecond: 128000
    };

    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options.mimeType = 'audio/webm';
    }

    mediaRecorder = new MediaRecorder(recordingStream, options);
    audioChunks = []; // Reset chunks

    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        audioChunks.push(event.data);
        console.log("📦 Audio chunk received:", event.data.size, "bytes", "Total chunks:", audioChunks.length);
      } else {
        console.log("⚠️ Empty audio chunk received");
      }
    };

    mediaRecorder.onstop = () => {
      console.log("⏹️ MediaRecorder stopped, saving recording...");
      saveAudioRecording();
    };

    mediaRecorder.onerror = (error) => {
      console.error("❌ MediaRecorder error:", error);
      showTempMessage("Recording error: " + error.message, "error");
    };

    // Start recording with 10-second chunks
    mediaRecorder.start(10000);
    isRecording = true;
    recordingStartTime = Date.now();

    // Update UI
    updateRecordingUI(true);
    console.log("✅ Recording started successfully");

  } catch (error) {
    console.error("❌ Error starting recording:", error);

    let errorMessage = "Could not start recording: ";
    if (error.name === 'NotAllowedError') {
      errorMessage += "Microphone access denied. Please allow microphone access.";
    } else if (error.name === 'NotFoundError') {
      errorMessage += "No microphone found.";
    } else {
      errorMessage += error.message;
    }

    showTempMessage(errorMessage, "error");

    // Continue session without recording
    sessionData.recordingFailed = true;
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

  // Start recording when breathing begins
  if (!isRecording) {
    checkAndStartAutoRecording();
  }
  
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

  // Add breathing animation class
  if (circle) {
    circle.classList.add('breathing');
  }

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

// Show recording controls in the session panel
function showRecordingControls() {
  // Update the session recording controls section
  const startButton = document.querySelector('.session-recording-controls .bg-green-600');
  const stopButton = document.getElementById('stop-recording-btn');

  if (startButton) startButton.classList.add('hidden');
  if (stopButton) stopButton.classList.remove('hidden');

  // Show recording status
  updateRecordingStatus();

  // Start panic attack audio if available
  startPanicAttackAudio();
}

// Global function to start panic attack audio (can be called from onclick)
function startPanicAttackAudioGuide() {
  if (!sessionData.sessionId) {
    initializePanicSession('panic_audio_guide');
  }
  startPanicAttackAudio();
  showRecordingControls();
}

// Panic attack audio variables
let panicAttackAudio = null;
let patientRecordingAudio = null;

// Start panic attack audio with female voice guidance
function startPanicAttackAudio() {
  try {
    // Create audio context for patient recording
    patientRecordingAudio = new (window.AudioContext || window.webkitAudioContext)();

    // Use the dedicated panic attack audio file
    const panicAudio = document.getElementById('panic-attack-audio');
    if (panicAudio) {
      panicAudio.volume = 0.4; // Moderate volume for guidance
      panicAudio.play().catch(e => {
        console.log('Panic attack audio play failed:', e);
        // Fallback to ambient audio if panic audio fails
        const ambientAudio = document.getElementById('ambient-sound');
        if (ambientAudio) {
          ambientAudio.volume = 0.3;
          ambientAudio.play().catch(e2 => console.log('Ambient audio fallback failed:', e2));
        }
      });
    } else {
      // Fallback to ambient audio
      const ambientAudio = document.getElementById('ambient-sound');
      if (ambientAudio) {
        ambientAudio.volume = 0.3;
        ambientAudio.play().catch(e => console.log('Ambient audio play failed:', e));
      }
    }

    // Start recording patient audio simultaneously
    startPatientAudioRecording();

    console.log("🎵 Panic attack audio started with patient recording");
  } catch (error) {
    console.error("Error starting panic attack audio:", error);
  }
}

// Record patient audio during panic attack
async function startPatientAudioRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 44100
      }
    });

    // Create a gain node to monitor audio levels
    const source = patientRecordingAudio.createMediaStreamSource(stream);
    const analyser = patientRecordingAudio.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);

    // Monitor audio levels to detect when patient is speaking
    monitorPatientAudio(analyser);

    console.log("🎙️ Patient audio recording started");
  } catch (error) {
    console.error("Error starting patient audio recording:", error);
  }
}

// Monitor patient audio levels
function monitorPatientAudio(analyser) {
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  function checkAudioLevels() {
    if (!sessionData.sessionId) return; // Stop if session ended

    analyser.getByteFrequencyData(dataArray);

    // Calculate average volume
    const average = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;

    // If patient is speaking (volume > threshold), show visual feedback
    if (average > 10) {
      showPatientSpeakingIndicator();
    }

    requestAnimationFrame(checkAudioLevels);
  }

  checkAudioLevels();
}

// Show visual indicator when patient is speaking
function showPatientSpeakingIndicator() {
  let indicator = document.getElementById('patient-speaking-indicator');

  if (!indicator) {
    indicator = document.createElement('div');
    indicator.id = 'patient-speaking-indicator';
    indicator.className = 'fixed bottom-20 left-4 bg-green-100 text-green-700 px-3 py-2 rounded-lg shadow-lg z-40';
    indicator.innerHTML = `
      <div class="flex items-center">
        <div class="w-3 h-3 bg-green-500 rounded-full mr-2 animate-pulse"></div>
        <span class="text-sm font-medium">Recording your voice...</span>
      </div>
    `;
    document.body.appendChild(indicator);
  }

  // Auto-hide after 3 seconds of no speech
  setTimeout(() => {
    if (indicator && document.body.contains(indicator)) {
      document.body.removeChild(indicator);
    }
  }, 3000);
}

// Show panic session banner (legacy function - keeping for compatibility)
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
  
  // Timer functionality moved to updateSessionUI() in panic.ejs
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

// FIXED: Save audio recording with proper blob conversion
function saveAudioRecording() {
  if (audioChunks.length === 0) {
    console.log("⚠️ No audio chunks to save");
    return;
  }

  console.log("💾 Saving audio recording with", audioChunks.length, "chunks");

  try {
    // Create proper blob from audio chunks
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

    console.log("✅ Audio recording saved:", {
      id: recording.id,
      duration: Math.round(duration/1000) + "s",
      size: Math.round(audioBlob.size/1024) + "KB",
      chunks: audioChunks.length,
      blobType: audioBlob.type,
      blobSize: audioBlob.size
    });

    // Show in UI immediately
    displayRecordingInUI(recording);

    // Reset for next recording
    audioChunks = [];
  } catch (error) {
    console.error("❌ Error creating audio blob:", error);
    showTempMessage("Error saving audio recording", "error");
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

// FIXED: Enhanced end session with proper recording stop
function endPanicSession() {
  console.log("🏁 Ending panic session:", sessionData.sessionId);

  // Stop recording if active
  if (isRecording && mediaRecorder) {
    console.log("⏹️ Stopping active recording...");
    mediaRecorder.stop();
    isRecording = false;

    // Stop the stream
    if (recordingStream) {
      recordingStream.getTracks().forEach(track => {
        track.stop();
        console.log("   Stopped track:", track.kind);
      });
      recordingStream = null;
    }
  }

  // Stop breathing exercise if active
  if (isBreathing) {
    stopBreathing();
  }

  // Stop audio guides
  const panicAudio = document.getElementById('panic-attack-audio');
  if (panicAudio) {
    panicAudio.pause();
    panicAudio.currentTime = 0;
  }

  const ambientAudio = document.getElementById('ambient-sound');
  if (ambientAudio) {
    ambientAudio.pause();
    ambientAudio.currentTime = 0;
  }

  // Calculate total duration
  sessionData.duration = Date.now() - new Date(sessionData.startTime).getTime();

  console.log("📊 Session summary:", {
    duration: Math.round(sessionData.duration / 1000) + "s",
    recordings: sessionData.audioRecordings.length,
    breathing: sessionData.breathingUsed,
    emergencyContacts: sessionData.emergencyContactsUsed.length
  });

  // Wait a moment for final recording to be saved
  setTimeout(() => {
    // Upload to server
    uploadSessionToServer(sessionData);

    // NO MODAL - Just show a simple success message
    showTempMessage(`Session ended! ${sessionData.audioRecordings.length} recording(s) saved`, 'success');

    // Hide recording controls
    hideRecordingControls();

    // Clean up
    localStorage.removeItem('active_panic_session');

    // Reset session data
    resetSessionData();

    // Stop duration updates
    stopDurationUpdates();

    // Refresh recordings list after 2 seconds
    setTimeout(() => {
      loadSessionRecordings();
    }, 2000);
  }, 1000);
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
  
  // Hide recording panel
  hideRecordingPanel();
  
  // Show session summary
  showSessionSummary();

  // Stop duration updates
  stopDurationUpdates();

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

// FIXED: Convert blob to base64 for server upload
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    try {
      // Ensure it's a proper blob
      if (!(blob instanceof Blob)) {
        console.error("Invalid blob object:", blob);
        reject(new Error("Invalid blob object"));
        return;
      }

      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Failed to read blob"));
      reader.readAsDataURL(blob);
    } catch (error) {
      console.error("Blob conversion error:", error);
      reject(error);
    }
  });
}

// FIXED: Upload session to server with audio data
async function uploadSessionToServer(sessionData) {
  try {
    console.log("📤 Uploading session to server:", sessionData.sessionId);
    console.log("   Audio recordings:", sessionData.audioRecordings.length);

    // Convert audio recordings to base64
    const processedAudioRecordings = await Promise.all(
      sessionData.audioRecordings.map(async (recording) => {
        let audioData = null;

        if (recording.blob) {
          try {
            console.log("   Processing recording blob:", {
              type: recording.blob.type,
              size: recording.blob.size,
              isBlob: recording.blob instanceof Blob
            });

            // Convert blob to base64
            const base64String = await blobToBase64(recording.blob);

            if (base64String && base64String.includes(',')) {
              // Remove data URL prefix (data:audio/webm;base64,)
              audioData = base64String.split(',')[1];
              console.log("   Converted recording to base64:", Math.round(audioData.length / 1024), "KB");
            } else {
              console.error("   Invalid base64 string format:", base64String?.substring(0, 50));
            }
          } catch (error) {
            console.error("   Error converting audio to base64:", error);
            console.error("   Blob details:", {
              type: recording.blob?.type,
              size: recording.blob?.size,
              constructor: recording.blob?.constructor?.name
            });
          }
        } else {
          console.log("   No blob data for recording:", recording.id);
        }

        return {
          id: recording.id,
          duration: recording.duration,
          timestamp: recording.timestamp,
          size: recording.size,
          triggerMethod: recording.triggerMethod,
          breathingUsed: recording.breathingUsed,
          emergencyContactsCount: recording.emergencyContactsCount,
          audioData: audioData
        };
      })
    );

    // Filter out recordings that failed to convert
    const validAudioRecordings = processedAudioRecordings.filter(rec => rec.audioData !== null);
    const failedCount = processedAudioRecordings.length - validAudioRecordings.length;

    if (failedCount > 0) {
      console.log(`⚠️ ${failedCount} audio recording(s) failed to convert, saving session without them`);
    }

    // Prepare session data
    const serverData = {
      sessionId: sessionData.sessionId,
      startTime: sessionData.startTime,
      endTime: new Date().toISOString(),
      duration: sessionData.duration,
      breathingUsed: sessionData.breathingUsed,
      emergencyContactsUsed: sessionData.emergencyContactsUsed,
      triggerMethod: sessionData.triggerMethod,
      audioRecordings: validAudioRecordings,
      sessionNotes: `Session completed. Trigger: ${sessionData.triggerMethod}. Breathing: ${sessionData.breathingUsed}. Emergency contacts: ${sessionData.emergencyContactsUsed.length}. Audio recordings: ${validAudioRecordings.length}/${processedAudioRecordings.length} successful.`
    };

    console.log("📤 Sending to server:", {
      sessionId: serverData.sessionId,
      audioCount: processedAudioRecordings.length,
      totalSize: processedAudioRecordings.reduce((sum, rec) => sum + (rec.size || 0), 0)
    });

    const response = await fetch('/panic/save-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(serverData)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    if (result.success) {
      console.log("✅ Session uploaded successfully:", result.sessionId);
      console.log("   Audio files processed:", result.audioFilesProcessed);

      // Clear any failed sessions from localStorage
      try {
        const sessions = JSON.parse(localStorage.getItem(PANIC_SESSIONS_KEY) || '[]');
        const updatedSessions = sessions.filter(session => session.sessionId !== sessionData.sessionId);
        localStorage.setItem(PANIC_SESSIONS_KEY, JSON.stringify(updatedSessions));
      } catch (e) {
        console.log("Could not clean localStorage");
      }

      showTempMessage(`Session saved! ${result.audioFilesProcessed} audio file(s) uploaded`, 'success');

      // Reload recordings list after a short delay
      setTimeout(() => {
        loadSessionRecordings();
      }, 1000);
    } else {
      console.error("❌ Server upload failed:", result.error);
      showTempMessage('Session saved locally. Server sync failed.', 'warning');
    }
  } catch (error) {
    console.error("❌ Upload error:", error);
    showTempMessage('Session saved locally. Will retry upload later.', 'warning');

    // Save to localStorage as backup
    try {
      const sessions = JSON.parse(localStorage.getItem(PANIC_SESSIONS_KEY) || '[]');
      sessions.push({
        ...sessionData,
        needsSync: true,
        uploadError: error.message
      });
      localStorage.setItem(PANIC_SESSIONS_KEY, JSON.stringify(sessions));
    } catch (localError) {
      console.error("Failed to save locally:", localError);
    }
  }
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
  
  // Reset circle appearance and remove breathing animation
  if (circle) {
    circle.classList.remove('breathing');
    circle.style.transform = 'scale(1)';
    circle.style.transition = 'transform 0.3s ease';
  }
}

// Update recording status in the session panel
function updateRecordingStatus() {
  const statusElement = document.getElementById('recording-status');
  const durationElement = document.getElementById('session-duration');

  if (statusElement) {
    statusElement.textContent = isRecording ? 'Recording' : 'Ready';
    statusElement.className = isRecording
      ? 'text-2xl font-bold text-red-600 recording-pulse'
      : 'text-2xl font-bold text-green-600';
  }

  if (durationElement && sessionData.startTime) {
    const elapsed = Math.floor((Date.now() - new Date(sessionData.startTime).getTime()) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    durationElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
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

  // Update recording status display
  const recordingStatusEl = document.getElementById('recording-status');
  if (recordingStatusEl) {
    recordingStatusEl.textContent = recording ? 'Recording' : 'Ready';
    recordingStatusEl.className = recording ? 'text-2xl font-bold text-red-600 recording-pulse' : 'text-2xl font-bold text-green-600';
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

// Update session duration display
function updateSessionDuration() {
  const durationEl = document.getElementById('session-duration');
  if (!durationEl || !sessionData.startTime || !sessionData.sessionId) return;

  const elapsed = Math.floor((Date.now() - new Date(sessionData.startTime).getTime()) / 1000);
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  durationEl.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// FIXED: Display recording in UI with proper audio player
function displayRecordingInUI(recording) {
  const recordingsList = document.getElementById("session-recordings");
  const placeholder = document.getElementById("no-recordings-placeholder");

  if (!recordingsList) return;

  // Hide placeholder
  if (placeholder) {
    placeholder.style.display = "none";
  }

  const recordingElement = document.createElement("div");
  recordingElement.className = "bg-gray-50 border border-gray-200 rounded-lg p-4 mb-3";
  recordingElement.innerHTML = `
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center flex-1">
        <div class="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mr-4">
          <i class="fas fa-microphone text-blue-600"></i>
        </div>
        <div class="flex-1">
          <p class="font-semibold text-gray-800">Recording ${sessionData.audioRecordings.length}</p>
          <p class="text-sm text-gray-600">
            ${Math.round(recording.duration / 1000)}s •
            ${Math.round(recording.size / 1024)}KB •
            ${new Date(recording.timestamp).toLocaleTimeString()}
          </p>
        </div>
      </div>
      <div class="flex space-x-2">
        <button onclick="togglePlayRecording('${recording.id}')"
                class="bg-blue-500 text-white px-3 py-2 rounded hover:bg-blue-600 text-sm">
          <i class="fas fa-play mr-1"></i>Play
        </button>
      </div>
    </div>
    <audio id="audio-${recording.id}" class="w-full mt-2" controls style="height: 40px;">
      <source src="${recording.url}" type="audio/webm">
    </audio>
  `;

  recordingsList.insertBefore(recordingElement, recordingsList.firstChild);
}

// FIXED: Toggle play recording
function togglePlayRecording(recordingId) {
  const audio = document.getElementById(`audio-${recordingId}`);
  if (audio) {
    if (audio.paused) {
      audio.play();
    } else {
      audio.pause();
    }
  }
}

// Add this helper function to stop duration updates
function stopDurationUpdates() {
  if (window.durationInterval) {
    clearInterval(window.durationInterval);
    window.durationInterval = null;
  }
}

// REMOVE/DISABLE the session summary modal completely
// Override the showSessionSummary function to do nothing
function showSessionSummary() {
  // DO NOTHING - Modal removed
  console.log("Session summary disabled - no modal will appear");
  return;
}

// Also remove any existing modals if they're already on the page
function removeExistingModals() {
  // Remove any existing session summary modals
  const modals = document.querySelectorAll('[class*="fixed inset-0 bg-black bg-opacity"]');
  modals.forEach(modal => {
    if (modal.textContent.includes('Session Complete') ||
        modal.textContent.includes('Session Summary')) {
      modal.remove();
      console.log("Removed existing session modal");
    }
  });
}

// Call this when the page loads
document.addEventListener('DOMContentLoaded', function() {
  removeExistingModals();
  console.log("Session summary modals disabled");
});

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

  // Track rapid clicking (anxiety indicator) - ONLY for authenticated users
  if (isAuthenticated) {
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
  }

  // Track multiple visits to panic-related pages - ONLY for authenticated users
  if (isAuthenticated) {
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
  }

  // Track long periods of inactivity followed by sudden activity - ONLY for authenticated users
  if (isAuthenticated) {
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
  }

  // Track navigation patterns - ONLY for authenticated users
  if (isAuthenticated) {
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
  }

  // Check for previous rapid navigation on page load - ONLY for authenticated users
  if (isAuthenticated && localStorage.getItem('panic_navigation_detected') === 'true') {
    localStorage.removeItem('panic_navigation_detected');
    if (!sessionData.sessionId) {
      setTimeout(() => {
        if (confirm('Previous rapid navigation detected. Start panic support session?')) {
          initializePanicSession('auto_detected_rapid_navigation');
        }
      }, 10000);
    }
  }

  // Track keyboard patterns that might indicate distress (ONLY for authenticated users)
   let keyPressCount = 0;
   let lastKeyTime = 0;
   let repeatedKeys = 0;
   let lastKey = '';

   if (isAuthenticated) {
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
  }

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
  // Only update if we have an active session
  if (!sessionData.sessionId) {
    console.log("Session UI updated for: null (no active session)");
    return;
  }

  // Update session duration every second
  updateSessionDuration();

  // Update recording status
  updateRecordingUI(isRecording);

  console.log("Session UI updated for:", sessionData.sessionId);
}

// Start periodic UI updates when session is active
function startSessionUIUpdates() {
  if (sessionData.sessionId) {
    setInterval(updateSessionUI, 1000);
  }
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

  // Log failed sessions to console instead of showing on page
  const sessions = JSON.parse(localStorage.getItem(PANIC_SESSIONS_KEY) || '[]');
  const failedSessions = sessions.filter(session => session.needsSync);

  if (failedSessions.length > 0) {
    console.log(`⚠️ Found ${failedSessions.length} failed session(s) that need syncing:`, failedSessions.map(s => s.sessionId));
    console.log('💡 Sessions will be synced automatically in the background');

    // Auto-sync failed sessions in background (don't show UI)
    setTimeout(() => {
      syncFailedSessions();
    }, 5000); // Sync after 5 seconds
  }

  console.log("✅ Enhanced automatic panic support ready");
});