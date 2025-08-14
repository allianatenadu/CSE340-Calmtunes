// public/js/musicInterface.js - Enhanced Music Interface Functions

// Global variables
let currentViewMode = 'grid';
let selectedSongForPlaylist = null;
let currentFilters = {
    search: '',
    source: '',
    genre: '',
    sortBy: 'created_at_desc'
};

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeMusicInterface();
    loadLibraryStats();
    loadPlaylistSongCounts();
    setupEventListeners();
});

function initializeMusicInterface() {
    // Setup filter event listeners
    const songSearch = document.getElementById('songSearch');
    const sourceFilter = document.getElementById('sourceFilter');
    const genreFilter = document.getElementById('genreFilter');
    const sortBy = document.getElementById('sortBy');

    if (songSearch) {
        let searchTimeout;
        songSearch.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                currentFilters.search = e.target.value;
                applyFilters();
            }, 500);
        });
    }

    if (sourceFilter) {
        sourceFilter.addEventListener('change', (e) => {
            currentFilters.source = e.target.value;
            applyFilters();
        });
    }

    if (genreFilter) {
        genreFilter.addEventListener('change', (e) => {
            currentFilters.genre = e.target.value;
            applyFilters();
        });
    }

    if (sortBy) {
        sortBy.addEventListener('change', (e) => {
            currentFilters.sortBy = e.target.value;
            applyFilters();
        });
    }
}

function setupEventListeners() {
    // Close dropdowns when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('[id^="songMenu-"]') && !e.target.closest('button[onclick^="toggleSongMenu"]')) {
            document.querySelectorAll('[id^="songMenu-"]').forEach(menu => {
                menu.classList.add('hidden');
            });
        }
    });

    // Setup keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        // Only trigger if not in an input field
        if (e.target.tagName.toLowerCase() === 'input') return;

        switch(e.code) {
            case 'Space':
                e.preventDefault();
                togglePlayPause();
                break;
            case 'ArrowLeft':
                if (e.ctrlKey) {
                    e.preventDefault();
                    playPrevious();
                }
                break;
            case 'ArrowRight':
                if (e.ctrlKey) {
                    e.preventDefault();
                    playNext();
                }
                break;
        }
    });
}

// View mode functions
function setViewMode(mode) {
    currentViewMode = mode;
    const listBtn = document.getElementById('listView');
    const gridBtn = document.getElementById('gridView');
    
    if (mode === 'list') {
        listBtn.classList.add('text-primary');
        listBtn.classList.remove('text-gray-500');
        gridBtn.classList.add('text-gray-500');
        gridBtn.classList.remove('text-primary');
    } else {
        gridBtn.classList.add('text-primary');
        gridBtn.classList.remove('text-gray-500');
        listBtn.classList.add('text-gray-500');
        listBtn.classList.remove('text-primary');
    }
    
    // Re-render song list with new view mode
    if (window.musicManager) {
        window.musicManager.refreshSongList();
    }
}

// Filter functions
function applyFilters() {
    if (window.musicManager) {
        window.musicManager.searchSongs(
            currentFilters.search, 
            currentFilters.source, 
            currentFilters.genre, 
            currentFilters.sortBy
        );
    }
}

function clearFilters() {
    document.getElementById('songSearch').value = '';
    document.getElementById('sourceFilter').value = '';
    document.getElementById('genreFilter').value = '';
    document.getElementById('sortBy').value = 'created_at_desc';
    
    currentFilters = {
        search: '',
        source: '',
        genre: '',
        sortBy: 'created_at_desc'
    };
    
    applyFilters();
}

// Playlist functions
async function playPlaylist(playlistId) {
    if (!window.musicManager) {
        console.error('Music manager not initialized');
        return;
    }

    try {
        showLoadingState('Loading playlist...');
        
        const response = await fetch(`/api/music/playlist/${playlistId}/songs`);
        const result = await response.json();
        
        if (result.success && result.data.length > 0) {
            // Play first song in playlist
            await window.musicManager.playSong(result.data[0].id, playlistId);
            
            // Update UI
            updateCurrentPlaylistUI(playlistId);
            window.musicManager.showToast(`Playing playlist`, 'success');
        } else {
            window.musicManager.showToast('Playlist is empty', 'error');
        }
    } catch (error) {
        console.error('Play playlist error:', error);
        window.musicManager.showToast('Failed to play playlist', 'error');
    } finally {
        hideLoadingState();
    }
}

function updateCurrentPlaylistUI(playlistId) {
    const playlistElement = document.querySelector(`[data-playlist-id="${playlistId}"]`);
    const currentPlaylistName = document.getElementById('currentPlaylistName');
    
    if (playlistElement && currentPlaylistName) {
        const titleElement = playlistElement.querySelector('h3');
        if (titleElement) {
            currentPlaylistName.textContent = titleElement.textContent;
        }
    }
    
    // Update playlist button state
    const playlistBtn = document.getElementById('playlistBtn');
    if (playlistBtn) {
        playlistBtn.classList.remove('text-gray-600');
        playlistBtn.classList.add('text-primary');
    }
}

function viewPlaylistDetails(playlistId) {
    window.location.href = `/playlists/${playlistId}`;
}

function editPlaylist(playlistId) {
    window.location.href = `/admin/playlists/${playlistId}/edit`;
}

async function toggleFavorite(playlistId) {
    try {
        const response = await fetch(`/api/playlists/${playlistId}/favorite`, {
            method: 'POST'
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Update UI
            const heartIcon = document.querySelector(`[data-playlist-id="${playlistId}"] .fa-heart`);
            if (heartIcon) {
                if (result.data.is_favorite) {
                    heartIcon.classList.remove('far');
                    heartIcon.classList.add('fas', 'text-red-500');
                } else {
                    heartIcon.classList.remove('fas', 'text-red-500');
                    heartIcon.classList.add('far');
                }
            }
            
            window.musicManager.showToast(
                result.data.is_favorite ? 'Added to favorites' : 'Removed from favorites', 
                'success'
            );
        }
    } catch (error) {
        console.error('Toggle favorite error:', error);
        window.musicManager.showToast('Failed to update favorite', 'error');
    }
}

// Song modal functions
function showAddToPlaylistModal(songId) {
    selectedSongForPlaylist = songId;
    const modal = document.getElementById('addToPlaylistModal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        loadPlaylistsForModal();
    }
}

function closeAddToPlaylistModal() {
    const modal = document.getElementById('addToPlaylistModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
    selectedSongForPlaylist = null;
}

async function loadPlaylistsForModal() {
    try {
        const response = await fetch('/api/playlists');
        const result = await response.json();
        
        const container = document.getElementById('playlistSelection');
        if (container && result.success) {
            container.innerHTML = result.data.map(playlist => `
                <label class="flex items-center p-3 hover:bg-gray-50 rounded-lg cursor-pointer">
                    <input type="radio" name="playlistSelect" value="${playlist.id}" class="mr-3">
                    <div>
                        <div class="font-medium">${playlist.title}</div>
                        <div class="text-sm text-gray-500">${playlist.song_count || 0} songs</div>
                    </div>
                </label>
            `).join('');
        }
    } catch (error) {
        console.error('Load playlists error:', error);
        window.musicManager.showToast('Failed to load playlists', 'error');
    }
}

async function confirmAddToPlaylist() {
    const selectedPlaylist = document.querySelector('input[name="playlistSelect"]:checked');
    
    if (!selectedPlaylist || !selectedSongForPlaylist) {
        window.musicManager.showToast('Please select a playlist', 'error');
        return;
    }
    
    if (window.musicManager) {
        await window.musicManager.addSongToPlaylist(selectedSongForPlaylist, selectedPlaylist.value);
    }
    
    closeAddToPlaylistModal();
}

// Player control functions
function togglePlayPause() {
    if (window.musicManager) {
        if (window.musicManager.isPlaying) {
            window.musicManager.pauseSong();
        } else if (window.musicManager.currentSong) {
            window.musicManager.resumeSong();
        }
    }
}

function playNext() {
    if (window.musicManager) {
        window.musicManager.playNext();
    }
}

function playPrevious() {
    if (window.musicManager) {
        window.musicManager.playPrevious();
    }
}

function toggleShuffle() {
    // Implement shuffle functionality
    const shuffleBtn = document.getElementById('shuffleBtn');
    if (shuffleBtn) {
        shuffleBtn.classList.toggle('text-primary');
        shuffleBtn.classList.toggle('text-gray-400');
    }
}

function toggleRepeat() {
    // Implement repeat functionality
    const repeatBtn = document.getElementById('repeatBtn');
    if (repeatBtn) {
        repeatBtn.classList.toggle('text-primary');
        repeatBtn.classList.toggle('text-gray-400');
    }
}

function toggleMute() {
    if (window.musicManager && window.musicManager.audioPlayer) {
        const muteBtn = document.getElementById('muteBtn');
        const volumeLevel = document.getElementById('volumeLevel');
        
        if (window.musicManager.audioPlayer.muted) {
            window.musicManager.audioPlayer.muted = false;
            muteBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
            volumeLevel.style.width = '60%';
        } else {
            window.musicManager.audioPlayer.muted = true;
            muteBtn.innerHTML = '<i class="fas fa-volume-mute"></i>';
            volumeLevel.style.width = '0%';
        }
    }
}

// Stats and data loading functions
async function loadLibraryStats() {
    try {
        const response = await fetch('/api/music/stats');
        const result = await response.json();
        
        if (result.success) {
            const stats = result.data;
            
            const totalSongs = document.getElementById('totalSongs');
            const localSongs = document.getElementById('localSongs');
            const spotifySongs = document.getElementById('spotifySongs');
            
            if (totalSongs) totalSongs.textContent = stats.total || 0;
            if (localSongs) localSongs.textContent = stats.local_count || 0;
            if (spotifySongs) spotifySongs.textContent = stats.spotify_count || 0;
        }
    } catch (error) {
        console.error('Error loading library stats:', error);
    }
}

async function loadPlaylistSongCounts() {
    const playlistElements = document.querySelectorAll('[data-playlist-id]');
    
    for (const element of playlistElements) {
        const playlistId = element.dataset.playlistId;
        try {
            const response = await fetch(`/api/music/playlist/${playlistId}/songs`);
            const result = await response.json();
            
            const countElement = document.getElementById(`playlistSongCount-${playlistId}`);
            if (countElement && result.success) {
                countElement.textContent = result.data.length;
            }
        } catch (error) {
            console.error(`Error loading song count for playlist ${playlistId}:`, error);
        }
    }
}

// Utility functions
function showLoadingState(message = 'Loading...') {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        const messageElement = overlay.querySelector('span');
        if (messageElement) {
            messageElement.textContent = message;
        }
        overlay.style.display = 'flex';
    }
}

function hideLoadingState() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

function formatDuration(seconds) {
    if (!seconds) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Search and external functions
function previewSpotifyTrack(previewUrl) {
    if (window.musicManager) {
        // Stop current playback
        window.musicManager.audioPlayer.pause();
        
        // Play preview
        const previewAudio = new Audio(previewUrl);
        previewAudio.volume = 0.5;
        previewAudio.play();
        
        // Stop preview after 30 seconds
        setTimeout(() => {
            previewAudio.pause();
        }, 30000);
        
        window.musicManager.showToast('Playing 30-second preview', 'info');
    }
}

async function importSingleSpotifyTrack(spotifyId) {
    try {
        showLoadingState('Importing track...');
        
        const response = await fetch('/api/music/import/spotify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                spotifyUrl: `https://open.spotify.com/track/${spotifyId}`
            })
        });

        const result = await response.json();

        if (result.success) {
            window.musicManager.showToast('Track imported successfully', 'success');
            window.musicManager.refreshSongList();
        } else {
            window.musicManager.showToast(result.message, 'error');
        }
    } catch (error) {
        console.error('Import error:', error);
        window.musicManager.showToast('Failed to import track', 'error');
    } finally {
        hideLoadingState();
    }
}

// Menu functions
function toggleSongMenu(songId) {
    const menu = document.getElementById(`songMenu-${songId}`);
    if (menu) {
        menu.classList.toggle('hidden');
    }
    
    // Close other menus
    document.querySelectorAll('[id^="songMenu-"]').forEach(otherMenu => {
        if (otherMenu.id !== `songMenu-${songId}`) {
            otherMenu.classList.add('hidden');
        }
    });
}

// Make functions available globally
window.musicInterface = {
    setViewMode,
    applyFilters,
    clearFilters,
    playPlaylist,
    viewPlaylistDetails,
    editPlaylist,
    toggleFavorite,
    showAddToPlaylistModal,
    closeAddToPlaylistModal,
    confirmAddToPlaylist,
    togglePlayPause,
    playNext,
    playPrevious,
    toggleShuffle,
    toggleRepeat,
    toggleMute,
    previewSpotifyTrack,
    importSingleSpotifyTrack,
    toggleSongMenu,
    formatDuration
};

// Make individual functions available globally for onclick handlers
window.setViewMode = setViewMode;
window.applyFilters = applyFilters;
window.clearFilters = clearFilters;
window.playPlaylist = playPlaylist;
window.viewPlaylistDetails = viewPlaylistDetails;
window.editPlaylist = editPlaylist;
window.toggleFavorite = toggleFavorite;
window.showAddToPlaylistModal = showAddToPlaylistModal;
window.closeAddToPlaylistModal = closeAddToPlaylistModal;
window.confirmAddToPlaylist = confirmAddToPlaylist;
window.togglePlayPause = togglePlayPause;
window.playNext = playNext;
window.playPrevious = playPrevious;
window.toggleShuffle = toggleShuffle;
window.toggleRepeat = toggleRepeat;
window.toggleMute = toggleMute;
window.previewSpotifyTrack = previewSpotifyTrack;
window.importSingleSpotifyTrack = importSingleSpotifyTrack;
window.toggleSongMenu = toggleSongMenu;