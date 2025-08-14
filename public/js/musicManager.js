// Enhanced musicManager.js with better error handling
class MusicManager {
    constructor() {
        this.currentPlaylist = null;
        this.currentSong = null;
        this.isPlaying = false;
        this.audioPlayer = new Audio();
        this.currentViewMode = 'grid';
        this.isLoading = false;
        this.currentFilters = {
            search: '',
            source: '',
            genre: '',
            sortBy: 'created_at_desc'
        };
        
        this.setupEventListeners();
        this.setupAudioPlayerEvents();
        this.loadInitialData();
    }

    async loadInitialData() {
        try {
            await this.loadLibraryStats();
            await this.refreshSongList();
        } catch (error) {
            console.error('Error loading initial data:', error);
        }
    }

    setupEventListeners() {
        // Spotify import form
        const spotifyForm = document.getElementById('spotifyImportForm');
        if (spotifyForm) {
            spotifyForm.addEventListener('submit', this.handleSpotifyImport.bind(this));
        }

        // MP3 upload form
        const uploadForm = document.getElementById('mp3UploadForm');
        if (uploadForm) {
            uploadForm.addEventListener('submit', this.handleMP3Upload.bind(this));
        }

        // Filter inputs
        this.setupFilterListeners();
        this.setupPlayerControls();
    }

    setupFilterListeners() {
        const songSearch = document.getElementById('songSearch');
        const sourceFilter = document.getElementById('sourceFilter');
        const genreFilter = document.getElementById('genreFilter');
        const sortBy = document.getElementById('sortBy');

        if (songSearch) {
            let searchTimeout;
            songSearch.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.currentFilters.search = e.target.value;
                    this.applyFilters();
                }, 500);
            });
        }

        if (sourceFilter) {
            sourceFilter.addEventListener('change', (e) => {
                this.currentFilters.source = e.target.value;
                this.applyFilters();
            });
        }

        if (genreFilter) {
            genreFilter.addEventListener('change', (e) => {
                this.currentFilters.genre = e.target.value;
                this.applyFilters();
            });
        }

        if (sortBy) {
            sortBy.addEventListener('change', (e) => {
                this.currentFilters.sortBy = e.target.value;
                this.applyFilters();
            });
        }
    }

    async applyFilters() {
        await this.searchSongs(
            this.currentFilters.search, 
            this.currentFilters.source, 
            this.currentFilters.genre, 
            this.currentFilters.sortBy
        );
    }

    async handleSpotifyImport(event) {
        event.preventDefault();
        
        const formData = new FormData(event.target);
        const spotifyUrl = formData.get('spotifyUrl');
        const playlistId = formData.get('playlistId');

        if (!spotifyUrl || !spotifyUrl.trim()) {
            this.showToast('Please enter a valid Spotify URL', 'error');
            return;
        }

        // Validate Spotify URL format
        if (!spotifyUrl.includes('spotify.com') && !spotifyUrl.includes('spotify:')) {
            this.showToast('Please enter a valid Spotify URL', 'error');
            return;
        }

        this.showLoading(true, 'Importing from Spotify...');

        try {
            const response = await fetch('/api/music/import/spotify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    spotifyUrl: spotifyUrl.trim(),
                    playlistId: playlistId || null
                })
            });

            const result = await response.json();

            if (result.success) {
                this.showToast(result.message, 'success');
                event.target.reset();
                await this.refreshSongList();
                await this.loadLibraryStats();
            } else {
                this.showToast(result.message, 'error');
            }
        } catch (error) {
            console.error('Import error:', error);
            this.showToast('Failed to import from Spotify. Please check your connection.', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async searchSongs(query = '', source = '', genre = '', sortBy = 'created_at_desc') {
        try {
            const params = new URLSearchParams();
            
            if (query && query.trim()) {
                params.append('search', query.trim());
            }
            if (source) {
                params.append('source', source);
            }
            if (genre) {
                params.append('genre', genre);
            }
            if (sortBy) {
                params.append('sortBy', sortBy);
            }

            const response = await fetch(`/api/music/songs?${params}`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();

            if (result.success) {
                this.renderSongList(result.data);
            } else {
                this.showToast(result.message || 'Search failed', 'error');
                this.renderSongList([]);
            }
        } catch (error) {
            console.error('Search error:', error);
            this.showToast('Search failed. Please try again.', 'error');
            this.renderSongList([]);
        }
    }

    async refreshSongList() {
        await this.searchSongs(
            this.currentFilters.search,
            this.currentFilters.source,
            this.currentFilters.genre,
            this.currentFilters.sortBy
        );
    }

    async loadLibraryStats() {
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

                // Update genre filter options
                this.updateGenreFilter(stats.genres || []);
            }
        } catch (error) {
            console.error('Error loading library stats:', error);
        }
    }

    updateGenreFilter(genres) {
        const genreFilter = document.getElementById('genreFilter');
        if (genreFilter && genres.length > 0) {
            // Clear existing options except "All Genres"
            const allGenresOption = genreFilter.querySelector('option[value=""]');
            genreFilter.innerHTML = '';
            if (allGenresOption) {
                genreFilter.appendChild(allGenresOption);
            }

            // Add genre options
            genres.forEach(genre => {
                const option = document.createElement('option');
                option.value = genre;
                option.textContent = genre;
                genreFilter.appendChild(option);
            });
        }
    }

    renderSongList(songs) {
        const container = document.getElementById('songList');
        if (!container) {
            console.error('Song list container not found');
            return;
        }

        if (songs.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8">
                    <div class="text-gray-400 mb-4">
                        <i class="fas fa-music text-4xl"></i>
                    </div>
                    <p class="text-gray-600">No songs found</p>
                    <p class="text-sm text-gray-500 mt-2">Try adjusting your search filters or import some music</p>
                </div>
            `;
            return;
        }

        const viewMode = this.currentViewMode || 'grid';
        
        if (viewMode === 'list') {
            this.renderSongListView(songs, container);
        } else {
            this.renderSongGridView(songs, container);
        }
    }

    renderSongGridView(songs, container) {
        container.innerHTML = songs.map(song => `
            <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-all duration-200 group">
                <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-4 flex-1">
                        <div class="w-12 h-12 bg-gradient-to-br ${song.source === 'spotify' ? 'from-green-400 to-green-600' : 'from-blue-400 to-blue-600'} rounded-lg flex items-center justify-center relative">
                            <i class="${song.source === 'spotify' ? 'fab fa-spotify text-white' : 'fas fa-music text-white'}"></i>
                            ${this.currentSong && this.currentSong.id === song.id ? 
                                '<div class="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>' : ''
                            }
                        </div>
                        <div class="flex-1 min-w-0">
                            <h4 class="font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                                ${this.escapeHtml(song.title)}
                            </h4>
                            <p class="text-sm text-gray-600 truncate">${this.escapeHtml(song.artist)}</p>
                            ${song.album ? `<p class="text-xs text-gray-500 truncate">${this.escapeHtml(song.album)}</p>` : ''}
                        </div>
                        <div class="text-right">
                            <div class="text-sm text-gray-600">
                                ${song.duration ? this.formatTime(song.duration) : ''}
                            </div>
                            <div class="text-xs text-gray-500 capitalize flex items-center">
                                ${song.source}
                                ${song.explicit ? '<i class="fas fa-exclamation-triangle text-red-500 ml-1" title="Explicit"></i>' : ''}
                            </div>
                        </div>
                    </div>
                    <div class="flex items-center space-x-2 ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button class="text-blue-600 hover:text-blue-800 p-2 rounded-lg hover:bg-blue-50 transition-colors"
                                onclick="musicManager.playSong(${song.id})"
                                title="Play Song">
                            <i class="fas fa-play"></i>
                        </button>
                        <div class="relative">
                            <button class="text-gray-600 hover:text-blue-600 p-2 rounded-lg hover:bg-gray-100 transition-colors"
                                    onclick="toggleSongMenu(${song.id})"
                                    title="More Options">
                                <i class="fas fa-ellipsis-v"></i>
                            </button>
                            ${this.renderSongMenu(song)}
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    renderSongMenu(song) {
        return `
            <div id="songMenu-${song.id}" class="hidden absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                <button class="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm flex items-center"
                        onclick="showAddToPlaylistModal(${song.id}); toggleSongMenu(${song.id});">
                    <i class="fas fa-plus mr-2"></i>Add to Playlist
                </button>
                <button class="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm flex items-center"
                        onclick="navigator.share ? navigator.share({title: '${this.escapeHtml(song.title)}', text: '${this.escapeHtml(song.artist)} - ${this.escapeHtml(song.title)}'}) : console.log('Share not supported'); toggleSongMenu(${song.id});">
                    <i class="fas fa-share mr-2"></i>Share
                </button>
                ${song.source === 'local' ? `
                <hr class="my-1">
                <button class="w-full text-left px-4 py-2 hover:bg-red-50 text-sm text-red-600 flex items-center"
                        onclick="musicManager.deleteSong(${song.id}); toggleSongMenu(${song.id});">
                    <i class="fas fa-trash mr-2"></i>Delete Song
                </button>
                ` : ''}
            </div>
        `;
    }

    escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return '0:00';
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    setupPlayerControls() {
        const playPauseBtn = document.getElementById('playPauseBtn');
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
        const shuffleBtn = document.getElementById('shuffleBtn');
        const repeatBtn = document.getElementById('repeatBtn');
        const muteBtn = document.getElementById('muteBtn');

        if (playPauseBtn) {
            playPauseBtn.addEventListener('click', () => {
                if (this.isPlaying) {
                    this.pauseSong();
                } else if (this.currentSong) {
                    this.resumeSong();
                }
            });
        }

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                if (!prevBtn.disabled) {
                    this.playPrevious();
                }
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                if (!nextBtn.disabled) {
                    this.playNext();
                }
            });
        }

        if (shuffleBtn) {
            shuffleBtn.addEventListener('click', () => {
                this.toggleShuffle();
            });
        }

        if (repeatBtn) {
            repeatBtn.addEventListener('click', () => {
                this.toggleRepeat();
            });
        }

        if (muteBtn) {
            muteBtn.addEventListener('click', () => {
                this.toggleMute();
            });
        }

        // Progress bar click handling
        const progressBar = document.getElementById('progressBar');
        if (progressBar) {
            progressBar.addEventListener('click', (e) => {
                const rect = progressBar.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const percentage = clickX / rect.width;
                
                if (this.audioPlayer.duration) {
                    this.audioPlayer.currentTime = percentage * this.audioPlayer.duration;
                }
            });
        }

        // Volume control
        const volumeBar = document.getElementById('volumeBar');
        if (volumeBar) {
            volumeBar.addEventListener('click', (e) => {
                const rect = volumeBar.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const percentage = Math.max(0, Math.min(1, clickX / rect.width));
                
                this.audioPlayer.volume = percentage;
                this.audioPlayer.muted = false;
                
                const volumeLevel = document.getElementById('volumeLevel');
                const muteBtn = document.getElementById('muteBtn');
                
                if (volumeLevel) {
                    volumeLevel.style.width = `${percentage * 100}%`;
                }
                
                if (muteBtn) {
                    muteBtn.innerHTML = percentage === 0 ? 
                        '<i class="fas fa-volume-mute"></i>' : 
                        '<i class="fas fa-volume-up"></i>';
                }
            });
        }
    }

    setupAudioPlayerEvents() {
        this.audioPlayer.addEventListener('ended', this.playNext.bind(this));
        this.audioPlayer.addEventListener('timeupdate', this.updateProgress.bind(this));
        this.audioPlayer.addEventListener('loadedmetadata', this.updateDuration.bind(this));
        this.audioPlayer.addEventListener('loadstart', this.handleLoadStart.bind(this));
        this.audioPlayer.addEventListener('canplay', this.handleCanPlay.bind(this));
        this.audioPlayer.addEventListener('error', this.handleAudioError.bind(this));
        this.audioPlayer.addEventListener('play', this.handlePlay.bind(this));
        this.audioPlayer.addEventListener('pause', this.handlePause.bind(this));
    }

    handleLoadStart() {
        this.showLoadingSpinner(true);
        this.isLoading = true;
    }

    handleCanPlay() {
        this.showLoadingSpinner(false);
        this.isLoading = false;
    }

    handlePlay() {
        this.isPlaying = true;
        this.updatePlayerUI();
        const indicator = document.getElementById('playingIndicator');
        if (indicator) {
            indicator.classList.remove('hidden');
        }
    }

    handlePause() {
        this.isPlaying = false;
        this.updatePlayerUI();
        const indicator = document.getElementById('playingIndicator');
        if (indicator) {
            indicator.classList.add('hidden');
        }
    }

    handleAudioError(e) {
        console.error('Audio error:', e);
        this.showLoadingSpinner(false);
        this.isLoading = false;
        this.showToast('Failed to load audio', 'error');
    }

    showLoadingSpinner(show) {
        const spinner = document.getElementById('loadingSpinner');
        const playIcon = document.querySelector('#playPauseBtn i');
        
        if (show) {
            if (spinner) spinner.classList.remove('hidden');
            if (playIcon) playIcon.style.opacity = '0';
        } else {
            if (spinner) spinner.classList.add('hidden');
            if (playIcon) playIcon.style.opacity = '1';
        }
    }

    async playSong(songId, playlistId = null) {
        try {
            this.showLoadingSpinner(true);
            
            const response = await fetch(`/api/music/songs/${songId}`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();

            if (result.success) {
                const song = result.data;
                
                // Determine audio source
                let audioSrc;
                if (song.source === 'spotify' && song.spotify_preview_url) {
                    audioSrc = song.spotify_preview_url;
                } else if (song.source === 'local' && song.local_file_path) {
                    audioSrc = song.local_file_path;
                } else {
                    this.showToast('No audio source available for this song', 'error');
                    return;
                }

                // Stop current playback
                this.audioPlayer.pause();
                this.audioPlayer.currentTime = 0;

                // Load and play the song
                this.audioPlayer.src = audioSrc;
                this.currentSong = song;
                this.currentPlaylist = playlistId;

                await this.audioPlayer.play();
                this.updatePlayerUI();

                // Add to recently played
                this.addToRecentlyPlayed(song);

            } else {
                this.showToast(result.message || 'Song not found', 'error');
            }
        } catch (error) {
            console.error('Play error:', error);
            this.showToast('Failed to play song: ' + error.message, 'error');
        } finally {
            this.showLoadingSpinner(false);
        }
    }

    async pauseSong() {
        this.audioPlayer.pause();
        this.updatePlayerUI();
    }

    async resumeSong() {
        try {
            await this.audioPlayer.play();
            this.updatePlayerUI();
        } catch (error) {
            console.error('Resume error:', error);
            this.showToast('Failed to resume playback', 'error');
        }
    }

    updatePlayerUI() {
        const currentSongElement = document.getElementById('currentSong');
        const currentArtistElement = document.getElementById('currentArtist');
        const currentAlbumElement = document.getElementById('currentAlbum');
        const playPauseBtn = document.getElementById('playPauseBtn');
        const playerIcon = document.getElementById('playerIcon');

        if (this.currentSong) {
            if (currentSongElement) currentSongElement.textContent = this.currentSong.title;
            if (currentArtistElement) currentArtistElement.textContent = this.currentSong.artist;
            if (currentAlbumElement) currentAlbumElement.textContent = this.currentSong.album || '';
            
            if (playerIcon) {
                playerIcon.className = this.currentSong.source === 'spotify' ? 
                    'fab fa-spotify text-white' : 'fas fa-music text-white';
            }
        }

        if (playPauseBtn) {
            const icon = playPauseBtn.querySelector('i');
            if (icon && !this.isLoading) {
                icon.className = this.isPlaying ? 'fas fa-pause' : 'fas fa-play';
            }
        }

        // Update previous/next button states
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
        
        if (prevBtn && nextBtn) {
            const hasPlaylist = this.currentPlaylist !== null;
            prevBtn.disabled = !hasPlaylist;
            nextBtn.disabled = !hasPlaylist;
            
            prevBtn.className = hasPlaylist ? 
                'text-gray-600 hover:text-blue-600 transition-colors duration-200' :
                'text-gray-300 cursor-not-allowed';
            nextBtn.className = hasPlaylist ? 
                'text-gray-600 hover:text-blue-600 transition-colors duration-200' :
                'text-gray-300 cursor-not-allowed';
        }
    }

    updateProgress() {
        const progress = document.getElementById('progress');
        const currentTimeElement = document.getElementById('currentTime');
        
        if (progress && this.audioPlayer.duration) {
            const progressPercent = (this.audioPlayer.currentTime / this.audioPlayer.duration) * 100;
            progress.style.width = `${progressPercent}%`;
        }

        if (currentTimeElement) {
            currentTimeElement.textContent = this.formatTime(this.audioPlayer.currentTime);
        }
    }

    updateDuration() {
        const totalTimeElement = document.getElementById('totalTime');
        if (totalTimeElement) {
            totalTimeElement.textContent = this.formatTime(this.audioPlayer.duration);
        }
    }

    addToRecentlyPlayed(song) {
        // Store in session storage for recently played functionality
        try {
            const recentlyPlayed = JSON.parse(sessionStorage.getItem('recentlyPlayed') || '[]');
            
            // Remove if already exists
            const filtered = recentlyPlayed.filter(item => item.id !== song.id);
            
            // Add to beginning
            filtered.unshift({
                id: song.id,
                title: song.title,
                artist: song.artist,
                playedAt: new Date().toISOString()
            });
            
            // Keep only last 50
            const limited = filtered.slice(0, 50);
            
            sessionStorage.setItem('recentlyPlayed', JSON.stringify(limited));
        } catch (error) {
            console.error('Error saving to recently played:', error);
        }
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container') || this.createToastContainer();

        const toast = document.createElement('div');
        toast.className = `
            px-6 py-4 rounded-lg shadow-lg text-white mb-4 transform translate-x-full transition-transform duration-300 max-w-md
            ${type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : type === 'info' ? 'bg-blue-500' : 'bg-gray-500'}
        `;
        
        toast.innerHTML = `
            <div class="flex items-center justify-between">
                <div class="flex items-center">
                    <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'} mr-3"></i>
                    <span>${message}</span>
                </div>
                <button onclick="this.parentElement.parentElement.remove()" class="ml-4 text-white hover:text-gray-200 transition-colors">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        container.appendChild(toast);

        // Animate in
        setTimeout(() => {
            toast.classList.remove('translate-x-full');
        }, 100);

        // Auto remove after 5 seconds
        setTimeout(() => {
            toast.classList.add('translate-x-full');
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    }

    createToastContainer() {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'fixed top-4 right-4 z-50';
            document.body.appendChild(container);
        }
        return container;
    }

    showLoading(show, message = 'Loading...') {
        const overlay = document.getElementById('loadingOverlay') || this.createLoadingOverlay();
        const messageElement = overlay.querySelector('span');
        
        if (messageElement) {
            messageElement.textContent = message;
        }
        
        overlay.style.display = show ? 'flex' : 'none';
    }

    createLoadingOverlay() {
        let overlay = document.getElementById('loadingOverlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'loadingOverlay';
            overlay.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 hidden items-center justify-center';
            overlay.innerHTML = `
                <div class="bg-white rounded-lg p-6 flex items-center">
                    <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-3"></div>
                    <span>Loading...</span>
                </div>
            `;
            document.body.appendChild(overlay);
        }
        return overlay;
    }

    toggleShuffle() {
        const shuffleBtn = document.getElementById('shuffleBtn');
        if (shuffleBtn) {
            shuffleBtn.classList.toggle('text-blue-600');
            shuffleBtn.classList.toggle('text-gray-400');
            
            const isActive = shuffleBtn.classList.contains('text-blue-600');
            this.showToast(isActive ? 'Shuffle enabled' : 'Shuffle disabled', 'info');
        }
    }

    toggleRepeat() {
        const repeatBtn = document.getElementById('repeatBtn');
        if (repeatBtn) {
            repeatBtn.classList.toggle('text-blue-600');
            repeatBtn.classList.toggle('text-gray-400');
            
            const isActive = repeatBtn.classList.contains('text-blue-600');
            this.showToast(isActive ? 'Repeat enabled' : 'Repeat disabled', 'info');
        }
    }

    toggleMute() {
        const muteBtn = document.getElementById('muteBtn');
        const volumeLevel = document.getElementById('volumeLevel');
        
        if (this.audioPlayer.muted) {
            this.audioPlayer.muted = false;
            if (muteBtn) muteBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
            if (volumeLevel) volumeLevel.style.width = '60%';
        } else {
            this.audioPlayer.muted = true;
            if (muteBtn) muteBtn.innerHTML = '<i class="fas fa-volume-mute"></i>';
            if (volumeLevel) volumeLevel.style.width = '0%';
        }
    }

    async playNext() {
        if (!this.currentPlaylist) {
            this.showToast('No playlist active', 'error');
            return;
        }

        try {
            const response = await fetch(`/api/music/playlist/${this.currentPlaylist}/songs`);
            const result = await response.json();

            if (result.success && result.data.length > 0) {
                const songs = result.data;
                const currentIndex = songs.findIndex(song => song.id === this.currentSong?.id);
                
                if (currentIndex !== -1 && currentIndex < songs.length - 1) {
                    const nextSong = songs[currentIndex + 1];
                    await this.playSong(nextSong.id, this.currentPlaylist);
                } else {
                    // Loop back to first song
                    await this.playSong(songs[0].id, this.currentPlaylist);
                }
            }
        } catch (error) {
            console.error('Play next error:', error);
            this.showToast('Failed to play next song', 'error');
        }
    }

    async playPrevious() {
        if (!this.currentPlaylist) {
            this.showToast('No playlist active', 'error');
            return;
        }

        try {
            const response = await fetch(`/api/music/playlist/${this.currentPlaylist}/songs`);
            const result = await response.json();

            if (result.success && result.data.length > 0) {
                const songs = result.data;
                const currentIndex = songs.findIndex(song => song.id === this.currentSong?.id);
                
                if (currentIndex > 0) {
                    const prevSong = songs[currentIndex - 1];
                    await this.playSong(prevSong.id, this.currentPlaylist);
                } else {
                    // Loop to last song
                    const lastSong = songs[songs.length - 1];
                    await this.playSong(lastSong.id, this.currentPlaylist);
                }
            }
        } catch (error) {
            console.error('Play previous error:', error);
            this.showToast('Failed to play previous song', 'error');
        }
    }

    async deleteSong(songId) {
        if (!confirm('Are you sure you want to delete this song? This action cannot be undone.')) {
            return;
        }

        try {
            this.showLoading(true, 'Deleting song...');
            
            const response = await fetch(`/api/music/songs/${songId}`, {
                method: 'DELETE'
            });

            const result = await response.json();

            if (result.success) {
                this.showToast('Song deleted successfully', 'success');
                await this.refreshSongList();
                await this.loadLibraryStats();
                
                // Stop playback if this was the current song
                if (this.currentSong && this.currentSong.id === songId) {
                    this.audioPlayer.pause();
                    this.currentSong = null;
                    this.currentPlaylist = null;
                    this.updatePlayerUI();
                }
            } else {
                this.showToast(result.message || 'Failed to delete song', 'error');
            }
        } catch (error) {
            console.error('Delete song error:', error);
            this.showToast('Failed to delete song', 'error');
        } finally {
            this.showLoading(false);
        }
    }
}

// Global functions for HTML onclick handlers
function setViewMode(mode) {
    if (window.musicManager) {
        window.musicManager.currentViewMode = mode;
        
        const listBtn = document.getElementById('listView');
        const gridBtn = document.getElementById('gridView');
        
        if (mode === 'list') {
            listBtn.classList.add('text-blue-600');
            listBtn.classList.remove('text-gray-500');
            gridBtn.classList.add('text-gray-500');
            gridBtn.classList.remove('text-blue-600');
        } else {
            gridBtn.classList.add('text-blue-600');
            gridBtn.classList.remove('text-gray-500');
            listBtn.classList.add('text-gray-500');
            listBtn.classList.remove('text-blue-600');
        }
        
        window.musicManager.renderSongList(window.musicManager.currentSongs || []);
    }
}

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

function showAddToPlaylistModal(songId) {
    if (window.musicManager) {
        // This would need playlist management functionality
        console.log('Add to playlist modal for song:', songId);
        window.musicManager.showToast('Playlist functionality coming soon!', 'info');
    }
}

// Initialize music manager when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.musicManager = new MusicManager();
});