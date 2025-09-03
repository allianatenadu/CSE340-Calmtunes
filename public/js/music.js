console.log("🎵 Music.js loaded - Enhanced Version with Preview Fix");

let currentTrackUri = null;
let isPlaying = false;
let player;
let deviceId;
let playerInitialized = false;
let currentAudio = null; // Track current HTML5 audio element

// Spotify SDK callback
window.onSpotifyWebPlaybackSDKReady = initializeSpotifyPlayer;

document.addEventListener("DOMContentLoaded", () => {
  loadDataFromDivs();
  initializeApp();
});

function initializeApp() {
  const token = getValidSpotifyToken();

  // ✅ ALWAYS set up core functionality regardless of token status
  setupModalFunctionality();
  setupPreviewPlayback();

  if (!token) {
    console.log("ℹ️ No Spotify token - Preview mode only");
    updatePlayerStatus("preview");
    return;
  }

  console.log("✅ Spotify token found, initializing SDK...");
  updatePlayerStatus("connecting");
  window.SPOTIFY_TOKEN = token;

  if (!window.Spotify) {
    loadSpotifySDK();
  } else {
    initializeSpotifyPlayer();
  }
}

function getValidSpotifyToken() {
  let token = null;

  if (window.SPOTIFY_TOKEN && window.SPOTIFY_TOKEN.trim() !== "") {
    token = window.SPOTIFY_TOKEN;
  } else if (window.spotifyToken && window.spotifyToken.trim() !== "") {
    token = window.spotifyToken;
  } else if (document.body.dataset.spotifyToken) {
    token = document.body.dataset.spotifyToken;
  }

  return token || null;
}

function loadSpotifySDK() {
  const script = document.createElement("script");
  script.src = "https://sdk.scdn.co/spotify-player.js";
  script.async = true;
  document.head.appendChild(script);
}

function updatePlayerStatus(status, message = null) {
  const playerStatus = document.getElementById("player-status");
  if (!playerStatus) return;

  if (status === "preview") {
    playerStatus.innerHTML = `
      <div class="p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p class="text-blue-700 font-medium">🎵 Preview Mode</p>
        <p class="text-sm text-gray-500">Play 30s previews or open tracks in Spotify</p>
        <a href="/spotify/login" class="mt-2 inline-block px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
          🎧 Connect Spotify
        </a>
      </div>
    `;
    return;
  }

  if (status === "connecting") {
    playerStatus.innerHTML = `<p class="text-yellow-600">🔄 Connecting to Spotify...</p>`;
    return;
  }

  if (status === "ready") {
    playerStatus.innerHTML = `<p class="text-green-700">✅ Spotify Connected</p>`;
    return;
  }

  if (status === "error") {
    playerStatus.innerHTML = `<p class="text-red-700">❌ ${message || "Spotify error"}</p>`;
  }
}

function initializeSpotifyPlayer() {
  const token = getValidSpotifyToken();
  if (!token) {
    console.log("ℹ️ Running without Spotify SDK (preview mode only).");
    return;
  }

  if (playerInitialized) return;
  playerInitialized = true;

  player = new Spotify.Player({
    name: "CalmTunes Player",
    getOAuthToken: cb => cb(token),
    volume: 0.5,
  });

  player.addListener("ready", ({ device_id }) => {
    console.log("✅ Player ready with device", device_id);
    deviceId = device_id;
    updatePlayerStatus("ready");
  });

  player.addListener("authentication_error", ({ message }) => {
    console.error("Auth error:", message);
    updatePlayerStatus("error", "Authentication failed, using preview mode");
  });

  player.addListener("player_state_changed", (state) => {
    if (state) {
      currentTrackUri = state.track_window.current_track.uri;
      isPlaying = !state.paused;
      console.log("🎵 Playback state:", isPlaying ? "Playing" : "Paused", currentTrackUri);
    }
  });

  player.connect();
}

// ✅ NEW: Spotify Web Playback SDK functions
async function playSpotifyTrack(uri) {
  const token = getValidSpotifyToken();
  if (!token || !deviceId) {
    console.warn("⚠️ Spotify device not ready, cannot play full track");
    showTempMessage("Spotify device not ready. Using preview instead.", "warning");
    return false;
  }

  try {
    console.log("🎵 Playing Spotify track:", uri);
    
    const response = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
      method: "PUT",
      body: JSON.stringify({ uris: [uri] }),
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Spotify play failed:", response.status, errorText);
      showTempMessage("Spotify playback failed. Using preview instead.", "error");
      return false;
    }

    showTempMessage("🎵 Playing full track on Spotify!", "success");
    return true;
  } catch (error) {
    console.error("❌ Error playing Spotify track:", error);
    showTempMessage("Error playing track. Using preview instead.", "error");
    return false;
  }
}

function showTempMessage(message, type = "info") {
  const messageDiv = document.getElementById("temp-message");
  if (!messageDiv) return;

  const bgColor = {
    success: "bg-green-100 border-green-500 text-green-700",
    warning: "bg-yellow-100 border-yellow-500 text-yellow-700", 
    error: "bg-red-100 border-red-500 text-red-700",
    info: "bg-blue-100 border-blue-500 text-blue-700"
  }[type] || "bg-gray-100 border-gray-500 text-gray-700";

  messageDiv.className = `fixed top-4 right-4 p-3 border-l-4 rounded shadow-lg z-50 ${bgColor}`;
  messageDiv.textContent = message;
  messageDiv.classList.remove("hidden");

  setTimeout(() => {
    messageDiv.classList.add("hidden");
  }, 3000);
}

// ✅ NEW: Setup preview playback functionality
function setupPreviewPlayback() {
  console.log("🎧 Setting up preview playback...");
  
  // Handle all audio controls in the page
  document.addEventListener('play', (e) => {
    if (e.target.tagName === 'AUDIO') {
      // Stop any other currently playing audio
      if (currentAudio && currentAudio !== e.target) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      }
      currentAudio = e.target;
      console.log("▶️ Playing preview:", e.target.src);
    }
  }, true);

  document.addEventListener('pause', (e) => {
    if (e.target.tagName === 'AUDIO') {
      console.log("⏸️ Paused preview:", e.target.src);
    }
  }, true);

  document.addEventListener('ended', (e) => {
    if (e.target.tagName === 'AUDIO') {
      console.log("⏹️ Preview ended:", e.target.src);
      currentAudio = null;
    }
  }, true);
}

// Modal + song rendering
function setupModalFunctionality() {
  const categoryButtons = document.querySelectorAll(".category-btn");
  const modal = document.getElementById("categoryModal");
  const modalTitle = document.getElementById("modalTitle");
  const modalSongs = document.getElementById("modalSongs");
  const closeModalBtn = document.getElementById("closeModalBtn");
  const closeModalBtn2 = document.getElementById("closeModalBtn2");

  if (!modal) return;

  categoryButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const catId = btn.dataset.categoryId;
      const category = window.CATEGORIES.find(c => c.id === catId);
      const songs = window.ALL_SONGS[catId] || [];

      console.log(`🎵 Opening modal for category: ${catId}`, songs);

      modalTitle.textContent = category?.title || "Songs";
      
      if (songs.length > 0) {
        modalSongs.innerHTML = songs.map((song, i) => createSongElement(song, i).outerHTML).join("");
        
        // ✅ Re-setup preview functionality for new audio elements
        setupAudioControls();
      } else {
        modalSongs.innerHTML = `
          <div class="text-center py-12">
            <i class="fas fa-music text-gray-300 text-4xl mb-4"></i>
            <p class="text-gray-500">No songs available for this category</p>
          </div>
        `;
      }

      modal.classList.remove("hidden");
      modal.classList.add("flex");
    });
  });

  // Close modal handlers
  [closeModalBtn, closeModalBtn2].forEach(btn => {
    btn?.addEventListener("click", () => {
      modal.classList.add("hidden");
      modal.classList.remove("flex");
      
      // ✅ Stop any playing audio when modal closes
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio = null;
      }
    });
  });

  // Close modal when clicking outside
  modal?.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.classList.add("hidden");
      modal.classList.remove("flex");
      
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio = null;
      }
    }
  });
}

// ✅ NEW: Setup audio controls for dynamically added elements
function setupAudioControls() {
  const audioElements = document.querySelectorAll('#modalSongs audio');
  
  audioElements.forEach(audio => {
    // Remove existing event listeners to prevent duplicates
    audio.removeEventListener('play', handleAudioPlay);
    audio.removeEventListener('pause', handleAudioPause);
    audio.removeEventListener('ended', handleAudioEnded);
    audio.removeEventListener('error', handleAudioError);
    
    // Add fresh event listeners
    audio.addEventListener('play', handleAudioPlay);
    audio.addEventListener('pause', handleAudioPause);
    audio.addEventListener('ended', handleAudioEnded);
    audio.addEventListener('error', handleAudioError);
    
    // Set volume to a reasonable level
    audio.volume = 0.7;
  });
}

function handleAudioPlay(e) {
  // Stop any other currently playing audio
  if (currentAudio && currentAudio !== e.target) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
  }
  currentAudio = e.target;
  console.log("▶️ Playing preview:", e.target.src);
}

function handleAudioPause(e) {
  console.log("⏸️ Paused preview:", e.target.src);
}

function handleAudioEnded(e) {
  console.log("⏹️ Preview ended:", e.target.src);
  currentAudio = null;
}

function handleAudioError(e) {
  console.error("❌ Audio error:", e.target.error, e.target.src);
  
  // Show user-friendly error message
  const errorMsg = document.createElement('div');
  errorMsg.className = 'text-red-600 text-sm mt-1';
  errorMsg.textContent = 'Preview not available';
  
  // Insert after the audio element
  e.target.parentNode.insertBefore(errorMsg, e.target.nextSibling);
  e.target.style.display = 'none';
}

function createSongElement(song, index) {
  const div = document.createElement("div");
  div.className = "flex items-center justify-between bg-gray-50 p-4 rounded-lg mb-3 hover:bg-gray-100 transition-colors";

  const hasPreview = song.preview_url && song.preview_url !== null && song.preview_url !== "null";
  const hasSpotifyLink = song.open_url && song.open_url !== "#";
  const hasSpotifyUri = song.spotify_uri && song.spotify_uri !== null;
  const hasSpotifyToken = !!getValidSpotifyToken();

  console.log(`🎵 Song: ${song.title}, Preview: ${hasPreview ? 'Yes' : 'No'}, URI: ${hasSpotifyUri ? 'Yes' : 'No'}, Token: ${hasSpotifyToken ? 'Yes' : 'No'}`);

  // Song Info Section
  const songInfo = `
    <div class="flex items-center flex-1">
      <img src="${song.cover_image || '/images/default-cover.jpg'}" 
           alt="${song.title}" 
           class="w-12 h-12 rounded-lg mr-4 object-cover shadow-sm">
      <div>
        <p class="font-semibold text-gray-800">${song.title}</p>
        <p class="text-sm text-gray-600">${song.artist}</p>
      </div>
    </div>
  `;

  // Controls Section
  let controls = '<div class="flex items-center space-x-3">';

  // ✅ Always show preview if available
  if (hasPreview) {
    controls += `
      <div class="flex flex-col items-center">
        <audio controls preload="metadata" class="w-48 mb-1">
          <source src="${song.preview_url}" type="audio/mpeg">
          Your browser does not support the audio element.
        </audio>
        <span class="text-xs text-gray-500">30s Preview</span>
      </div>
    `;
  } else {
    controls += `
      <div class="w-48 flex items-center justify-center">
        <span class="text-sm text-gray-500 italic">No preview available</span>
      </div>
    `;
  }

  // ✅ Add Spotify playback button if user is logged in and has URI
  if (hasSpotifyToken && hasSpotifyUri && deviceId) {
    controls += `
      <button onclick="playSpotifyTrack('${song.spotify_uri}')" 
              class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm flex items-center shadow-sm">
        <i class="fab fa-spotify mr-2"></i>
        Play Full Track
      </button>
    `;
  } else if (hasSpotifyLink) {
    // Fallback to opening in Spotify app/web
    controls += `
      <a href="${song.open_url}" target="_blank" 
         class="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm flex items-center">
        <i class="fab fa-spotify mr-1"></i>
        Open in Spotify
      </a>
    `;
  }

  controls += '</div>';

  div.innerHTML = songInfo + controls;
  return div;
}

function loadDataFromDivs() {
  try {
    const categoriesDiv = document.getElementById("categories-data");
    window.CATEGORIES = JSON.parse(categoriesDiv?.textContent || "[]");

    const songsDiv = document.getElementById("songs-data");
    window.ALL_SONGS = JSON.parse(songsDiv?.textContent || "{}");
    
    console.log("📊 Loaded data:", {
      categories: window.CATEGORIES.length,
      songs: Object.keys(window.ALL_SONGS).length
    });
  } catch (e) {
    console.error("❌ Error loading data:", e);
    window.CATEGORIES = [];
    window.ALL_SONGS = {};
  }
}