console.log("🎵 Music.js loaded - Enhanced Version with Preview Fix");

// Check if we're on the music page before initializing
const isOnMusicPage = () => {
  return window.location.pathname.includes('/music') || 
         document.getElementById('categories-data') || 
         document.querySelector('.category-btn');
};

let currentAudio = null; // Track current HTML5 audio element

document.addEventListener("DOMContentLoaded", () => {
  // Only initialize if we're on the music page
  if (!isOnMusicPage()) {
    console.log("ℹ️ Not on music page, skipping music initialization");
    return;
  }
  
  console.log("🎵 On music page - initializing...");
  loadDataFromDivs();
  initializeApp();
});

function initializeApp() {
  console.log("🎵 Initializing music app - Preview + External Spotify Links");

  // Always set up core functionality
  setupModalFunctionality();
  setupPreviewPlayback();
  
  // Check Spotify connection status
  checkSpotifyConnection();
}

async function checkSpotifyConnection() {
  try {
    const response = await fetch('/spotify/check');
    const data = await response.json();
    
    if (data.connected) {
      console.log("✅ Spotify connected via API check");
      window.SPOTIFY_TOKEN = data.token;
      updatePlayerStatus("connected");
      return true;
    } else {
      console.log("ℹ️ No Spotify connection");
      updatePlayerStatus("preview");
      return false;
    }
  } catch (error) {
    console.error("❌ Error checking Spotify connection:", error);
    updatePlayerStatus("preview");
    return false;
  }
}

function getValidSpotifyToken() {
  // Retained for potential future API use (e.g., user playlists), but not for playback
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

function updatePlayerStatus(status, message = null) {
  const playerStatus = document.getElementById("player-status");
  if (!playerStatus) return;

  if (status === "connected") {
    playerStatus.innerHTML = `
      <div class="p-4 bg-green-50 border border-green-200 rounded-lg">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-green-800 font-medium flex items-center">
              <i class="fas fa-check-circle mr-2"></i> Spotify Connected
            </p>
            <p class="text-sm text-green-600 mt-1">
              Enjoy previews and open full tracks in Spotify
            </p>
          </div>
          <div class="flex space-x-2">
            <a href="/spotify/logout" class="px-3 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm">
              <i class="fas fa-unlink mr-1"></i> Disconnect
            </a>
          </div>
        </div>
      </div>
    `;
    return;
  }

  if (status === "preview") {
    playerStatus.innerHTML = `
      <div class="p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p class="text-blue-700 font-medium">🎵 Preview + Spotify Integration</p>
        <p class="text-sm text-gray-500">Listen to 30s previews or open full tracks in the Spotify app</p>
        <a href="/spotify/login" class="mt-2 inline-block px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
          🔗 Connect Spotify Account
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

// Simplified playback: Open in Spotify app/web player
function openInSpotify(openUrl) {
  if (!openUrl || openUrl === "#") {
    console.warn("❌ No Spotify URL available");
    showTempMessage("This track is not available on Spotify.", "warning");
    return;
  }

  console.log("🔗 Opening track in Spotify:", openUrl);
  window.open(openUrl, "_blank");
  showTempMessage("🎵 Opening full track in Spotify...", "success");
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

// Setup preview playback functionality
function setupPreviewPlayback() {
  console.log("🎧 Setting up preview playback...");
  
  // Remove any existing listeners to prevent duplicates
  document.removeEventListener('play', handleGlobalAudioPlay, true);
  document.removeEventListener('pause', handleGlobalAudioPause, true);
  document.removeEventListener('ended', handleGlobalAudioEnded, true);
  
  // Add global audio event handlers
  document.addEventListener('play', handleGlobalAudioPlay, true);
  document.addEventListener('pause', handleGlobalAudioPause, true);  
  document.addEventListener('ended', handleGlobalAudioEnded, true);
}

function handleGlobalAudioPlay(e) {
  if (e.target.tagName === 'AUDIO') {
    // Stop any other currently playing audio
    if (currentAudio && currentAudio !== e.target) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    }
    currentAudio = e.target;
    console.log("▶️ Playing preview:", e.target.src);
  }
}

function handleGlobalAudioPause(e) {
  if (e.target.tagName === 'AUDIO') {
    console.log("⏸️ Paused preview:", e.target.src);
  }
}

function handleGlobalAudioEnded(e) {
  if (e.target.tagName === 'AUDIO') {
    console.log("⏹️ Preview ended:", e.target.src);
    currentAudio = null;
  }
}

// Modal + song rendering
function setupModalFunctionality() {
  const categoryButtons = document.querySelectorAll(".category-btn");
  const modal = document.getElementById("categoryModal");
  const modalTitle = document.getElementById("modalTitle");
  const modalSongs = document.getElementById("modalSongs");
  const closeModalBtn = document.getElementById("closeModalBtn");
  const closeModalBtn2 = document.getElementById("closeModalBtn2");

  if (!modal) {
    console.warn("⚠️ Modal element not found - music functionality limited");
    return;
  }

  categoryButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const catId = btn.dataset.categoryId;
      const category = window.CATEGORIES.find(c => c.id === catId);
      const songs = window.ALL_SONGS[catId] || [];

      console.log(`🎵 Opening modal for category: ${catId}`, songs);

      if (modalTitle) modalTitle.textContent = category?.title || "Songs";
      
      if (modalSongs) {
        if (songs.length > 0) {
          modalSongs.innerHTML = songs.map((song, i) => createSongElement(song, i).outerHTML).join("");
          console.log(`🔊 Rendered ${songs.length} songs in modal`);
        } else {
          modalSongs.innerHTML = `
            <div class="text-center py-12">
              <i class="fas fa-music text-gray-300 text-4xl mb-4"></i>
              <p class="text-gray-500">No songs available for this category</p>
              <p class="text-xs text-gray-400 mt-2">Check console for loading errors</p>
            </div>
          `;
        }
      }

      modal.classList.remove("hidden");
      modal.classList.add("flex");
    });
  });

  // Close modal handlers
  [closeModalBtn, closeModalBtn2].forEach(btn => {
    btn?.addEventListener("click", () => {
      closeModal(modal);
    });
  });

  // Close modal when clicking outside
  modal?.addEventListener("click", (e) => {
    if (e.target === modal) {
      closeModal(modal);
    }
  });
}

function closeModal(modal) {
  modal.classList.add("hidden");
  modal.classList.remove("flex");
  
  // Stop any playing audio when modal closes
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
}

function createSongElement(song, index) {
  const div = document.createElement("div");
  div.className = "flex items-center justify-between bg-gray-50 p-4 rounded-lg mb-3 hover:bg-gray-100 transition-colors";

  const hasPreview = song.preview_url && song.preview_url !== null && song.preview_url !== "null";
  const hasSpotifyLink = song.open_url && song.open_url !== "#";
  console.log(`🎵 Song: ${song.title}, Preview: ${hasPreview ? 'Yes' : 'No'}, Link: ${hasSpotifyLink ? 'Yes' : 'No'}`);
 
  // Song Info Section
  const songInfo = `
    <div class="flex items-center flex-1">
      <img src="${song.cover_image || '/images/default-cover.jpg'}"
           alt="${song.title}"
           class="w-12 h-12 rounded-lg mr-4 object-cover shadow-sm"
           onerror="this.src='/images/pngtree-music-notes--musical-design-png-image_6283885.png'">
      <div>
        <p class="font-semibold text-gray-800">${song.title}</p>
        <p class="text-sm text-gray-600">${song.artist}</p>
      </div>
    </div>
  `;
 
  // Controls Section
  let controls = '<div class="flex items-center space-x-3">';
 
  // Always show preview if available
  if (hasPreview) {
    const audioId = `audio-${index}`;
    controls += `
      <div class="flex flex-col items-center">
        <audio id="${audioId}" controls preload="metadata" class="w-48 mb-1">
          <source src="${song.preview_url}" type="audio/mpeg">
          Your browser does not support the audio element.
        </audio>
        <span class="text-xs text-gray-500">30s Preview</span>
      </div>
    `;
  } else {
    controls += `
      <div class="w-48 flex flex-col items-center justify-center">
        <i class="fas fa-info-circle text-gray-400 mb-1 text-lg"></i>
        <span class="text-sm text-gray-500 italic">Preview not available</span>
        <span class="text-xs text-gray-400 mt-1">(Spotify API limitation)</span>
        <span class="text-xs text-green-500 font-medium mt-1">Open for full track</span>
      </div>
    `;
  }
 
  // Always show open in Spotify if link available
  if (hasSpotifyLink) {
    controls += `
      <a href="#" onclick="openInSpotify('${song.open_url}'); return false;"
         class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm flex items-center shadow-sm">
        <i class="fab fa-spotify mr-2"></i>
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
    const songsDiv = document.getElementById("songs-data");
    
    if (!categoriesDiv || !songsDiv) {
      console.warn("⚠️ Data divs not found - using empty data");
      window.CATEGORIES = [];
      window.ALL_SONGS = {};
      return;
    }

    window.CATEGORIES = JSON.parse(categoriesDiv.textContent || "[]");
    window.ALL_SONGS = JSON.parse(songsDiv.textContent || "{}");
    
    console.log("🔊 Loaded data:", {
      categories: window.CATEGORIES.length,
      songs: Object.keys(window.ALL_SONGS).length,
      songCounts: Object.keys(window.ALL_SONGS).map(key => `${key}: ${window.ALL_SONGS[key].length}`).join(', ')
    });
  } catch (e) {
    console.error("❌ Error loading data:", e);
    window.CATEGORIES = [];
    window.ALL_SONGS = {};
  }
}
function setupModalFunctionality() {
  const categoryButtons = document.querySelectorAll(".category-btn");
  const modal = document.getElementById("categoryModal");
  const modalTitle = document.getElementById("modalTitle");
  const modalSongs = document.getElementById("modalSongs");
  const closeModalBtn = document.getElementById("closeModalBtn");
  const closeModalBtn2 = document.getElementById("closeModalBtn2");

  if (!modal) {
    console.warn("Modal element not found - music functionality limited");
    return;
  }

  categoryButtons.forEach((btn) => {
    btn.addEventListener("click", async () => {
      const catId = btn.dataset.categoryId;
      const category = window.CATEGORIES.find(c => c.id === catId);
      const songs = window.ALL_SONGS[catId] || [];

      console.log(`Opening modal for category: ${catId}`, songs);

      // Track the category selection
      await trackCategorySelection(catId);

      if (modalTitle) modalTitle.textContent = category?.title || "Songs";
      
      if (modalSongs) {
        if (songs.length > 0) {
          modalSongs.innerHTML = songs.map((song, i) => createSongElement(song, i).outerHTML).join("");
          console.log(`Rendered ${songs.length} songs in modal`);
        } else {
          modalSongs.innerHTML = `
            <div class="text-center py-12">
              <i class="fas fa-music text-gray-300 text-4xl mb-4"></i>
              <p class="text-gray-500">No songs available for this category</p>
              <p class="text-xs text-gray-400 mt-2">Check console for loading errors</p>
            </div>
          `;
        }
      }

      modal.classList.remove("hidden");
      modal.classList.add("flex");
    });
  });

  // Close modal handlers remain the same...
  [closeModalBtn, closeModalBtn2].forEach(btn => {
    btn?.addEventListener("click", () => {
      closeModal(modal);
    });
  });

  modal?.addEventListener("click", (e) => {
    if (e.target === modal) {
      closeModal(modal);
    }
  });
}
// Enhanced music tracking - Replace the existing functions in your music.js

// Track category usage - call this when user actually engages with music
async function trackCategoryUsage(category, action = 'play') {
    try {
        console.log(`Tracking music category: ${category} (${action})`);
        
        const response = await fetch('/music/track-category', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                category: category,
                action: action 
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            console.log(`Category ${category} tracked successfully. Play count: ${data.playCount}`);
        } else {
            console.warn('Failed to track category:', data.message);
        }
    } catch (error) {
        console.error('Error tracking category:', error);
    }
}

// Enhanced openInSpotify function with tracking
function openInSpotify(openUrl, categoryId) {
  if (!openUrl || openUrl === "#") {
    console.warn("No Spotify URL available");
    showTempMessage("This track is not available on Spotify.", "warning");
    return;
  }

  console.log("Opening track in Spotify:", openUrl, "Category:", categoryId);
  
  // Track the category usage when user opens Spotify
  if (categoryId) {
    trackCategoryUsage(categoryId, 'spotify_open');
  }
  
  window.open(openUrl, "_blank");
  showTempMessage("Opening full track in Spotify...", "success");
}

// Enhanced createSongElement function with proper tracking
function createSongElement(song, index, categoryId) {
  const div = document.createElement("div");
  div.className = "flex items-center justify-between bg-gray-50 p-4 rounded-lg mb-3 hover:bg-gray-100 transition-colors";

  const hasPreview = song.preview_url && song.preview_url !== null && song.preview_url !== "null";
  const hasSpotifyLink = song.open_url && song.open_url !== "#";
  
  // Song Info Section
  const songInfo = `
    <div class="flex items-center flex-1">
      <img src="${song.cover_image || '/images/default-cover.jpg'}"
           alt="${song.title}"
           class="w-12 h-12 rounded-lg mr-4 object-cover shadow-sm"
           onerror="this.src='/images/pngtree-music-notes--musical-design-png-image_6283885.png'">
      <div>
        <p class="font-semibold text-gray-800">${song.title}</p>
        <p class="text-sm text-gray-600">${song.artist}</p>
      </div>
    </div>
  `;
 
  // Controls Section
  let controls = '<div class="flex items-center space-x-3">';
 
  // Preview audio with tracking
  if (hasPreview) {
    const audioId = `audio-${index}`;
    controls += `
      <div class="flex flex-col items-center">
        <audio id="${audioId}" controls preload="metadata" class="w-48 mb-1" 
               onplay="trackCategoryUsage('${categoryId}', 'preview_play')">
          <source src="${song.preview_url}" type="audio/mpeg">
          Your browser does not support the audio element.
        </audio>
        <span class="text-xs text-gray-500">30s Preview</span>
      </div>
    `;
  } else {
    controls += `
      <div class="w-48 flex flex-col items-center justify-center">
        <i class="fas fa-info-circle text-gray-400 mb-1 text-lg"></i>
        <span class="text-sm text-gray-500 italic">Preview not available</span>
        <span class="text-xs text-gray-400 mt-1">(Spotify API limitation)</span>
        <span class="text-xs text-green-500 font-medium mt-1">Open for full track</span>
      </div>
    `;
  }
 
  // Spotify link with tracking
  if (hasSpotifyLink) {
    controls += `
      <a href="#" onclick="openInSpotify('${song.open_url}', '${categoryId}'); return false;"
         class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm flex items-center shadow-sm">
        <i class="fab fa-spotify mr-2"></i>
        Open in Spotify
      </a>
    `;
  }
 
  controls += '</div>';
 
  div.innerHTML = songInfo + controls;
  return div;
}

// Updated modal setup with category tracking
function setupModalFunctionality() {
  const categoryButtons = document.querySelectorAll(".category-btn");
  const modal = document.getElementById("categoryModal");
  const modalTitle = document.getElementById("modalTitle");
  const modalSongs = document.getElementById("modalSongs");
  const closeModalBtn = document.getElementById("closeModalBtn");
  const closeModalBtn2 = document.getElementById("closeModalBtn2");

  if (!modal) {
    console.warn("Modal element not found - music functionality limited");
    return;
  }

  categoryButtons.forEach((btn) => {
    btn.addEventListener("click", async () => {
      const catId = btn.dataset.categoryId;
      const category = window.CATEGORIES.find(c => c.id === catId);
      const songs = window.ALL_SONGS[catId] || [];

      console.log(`Opening modal for category: ${catId}`);

      // Track category browsing (lighter tracking for just viewing)
      await trackCategoryUsage(catId, 'browse');

      if (modalTitle) modalTitle.textContent = category?.title || "Songs";
      
      if (modalSongs) {
        if (songs.length > 0) {
          // Pass categoryId to createSongElement for proper tracking
          modalSongs.innerHTML = songs.map((song, i) => 
            createSongElement(song, i, catId).outerHTML
          ).join("");
          console.log(`Rendered ${songs.length} songs in modal for category: ${catId}`);
        } else {
          modalSongs.innerHTML = `
            <div class="text-center py-12">
              <i class="fas fa-music text-gray-300 text-4xl mb-4"></i>
              <p class="text-gray-500">No songs available for this category</p>
            </div>
          `;
        }
      }

      modal.classList.remove("hidden");
      modal.classList.add("flex");
    });
  });

  // Close modal handlers
  [closeModalBtn, closeModalBtn2].forEach(btn => {
    btn?.addEventListener("click", () => {
      closeModal(modal);
    });
  });

  modal?.addEventListener("click", (e) => {
    if (e.target === modal) {
      closeModal(modal);
    }
  });
}