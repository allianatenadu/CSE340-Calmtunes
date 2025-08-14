const express = require('express');
const router = express.Router();
const SpotifyController = require('../controllers/spotifyController');
const UploadController = require('../controllers/uploadController');
const SongModel = require('../models/songModel');

// Import from Spotify
router.post('/import/spotify', SpotifyController.importFromSpotify);

// Search Spotify
router.get('/search/spotify', SpotifyController.searchSpotify);

// Upload MP3 files
router.post('/upload', 
    UploadController.getUploadMiddleware(), 
    UploadController.uploadMP3Files
);

// Fixed: Get all songs with proper filtering
router.get('/songs', async (req, res) => {
    try {
        const { page = 1, limit = 20, search, source, genre, sortBy = 'created_at_desc' } = req.query;
        const offset = (page - 1) * limit;

        let songs;
        if (search && search.trim()) {
            songs = await SongModel.search(search.trim(), source, genre, sortBy);
        } else {
            songs = await SongModel.getAll(parseInt(limit), offset, sortBy);
        }

        // Apply additional filters if no search term
        if (!search && (source || genre)) {
            songs = songs.filter(song => {
                if (source && song.source !== source) return false;
                if (genre && song.genre !== genre) return false;
                return true;
            });
        }

        res.json({
            success: true,
            data: songs,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: songs.length,
                totalPages: Math.ceil(songs.length / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Error fetching songs:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch songs: ' + error.message
        });
    }
});

// Get a single song by ID
router.get('/songs/:id', async (req, res) => {
    try {
        const song = await SongModel.findById(req.params.id);
        
        if (!song) {
            return res.status(404).json({
                success: false,
                message: 'Song not found'
            });
        }

        res.json({
            success: true,
            data: song
        });
    } catch (error) {
        console.error('Error fetching song:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch song: ' + error.message
        });
    }
});

// Get songs in a playlist
router.get('/playlist/:id/songs', async (req, res) => {
    try {
        const songs = await SongModel.getPlaylistSongs(req.params.id);
        res.json({
            success: true,
            data: songs
        });
    } catch (error) {
        console.error('Error fetching playlist songs:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch playlist songs: ' + error.message
        });
    }
});

// Add song to playlist
router.post('/playlist/:playlistId/songs/:songId', async (req, res) => {
    try {
        const { playlistId, songId } = req.params;
        
        // Check if song exists
        const song = await SongModel.findById(songId);
        if (!song) {
            return res.status(404).json({
                success: false,
                message: 'Song not found'
            });
        }

        await SongModel.addToPlaylist(playlistId, songId);
        res.json({
            success: true,
            message: 'Song added to playlist successfully'
        });
    } catch (error) {
        console.error('Error adding song to playlist:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add song to playlist: ' + error.message
        });
    }
});

// Remove song from playlist
router.delete('/playlist/:playlistId/songs/:songId', async (req, res) => {
    try {
        const success = await SongModel.removeFromPlaylist(req.params.playlistId, req.params.songId);
        
        if (!success) {
            return res.status(404).json({
                success: false,
                message: 'Song not found in playlist'
            });
        }

        res.json({
            success: true,
            message: 'Song removed from playlist successfully'
        });
    } catch (error) {
        console.error('Error removing song from playlist:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to remove song from playlist: ' + error.message
        });
    }
});

// Delete a song
router.delete('/songs/:id', async (req, res) => {
    try {
        const song = await SongModel.findById(req.params.id);
        if (!song) {
            return res.status(404).json({
                success: false,
                message: 'Song not found'
            });
        }

        // Delete local file if it exists
        if (song.local_file_path && song.source === 'local') {
            try {
                const fs = require('fs').promises;
                const path = require('path');
                const filePath = path.join(__dirname, '../public', song.local_file_path);
                await fs.unlink(filePath);
                console.log('Deleted local file:', filePath);
            } catch (fileError) {
                console.error('Error deleting file:', fileError);
                // Continue with database deletion even if file deletion fails
            }
        }

        const success = await SongModel.delete(req.params.id);
        if (!success) {
            return res.status(500).json({
                success: false,
                message: 'Failed to delete song from database'
            });
        }

        res.json({
            success: true,
            message: 'Song deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting song:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete song: ' + error.message
        });
    }
});

// Get library statistics
router.get('/stats', async (req, res) => {
    try {
        const stats = await SongModel.getStats();
        const genres = await SongModel.getDistinctGenres();
        
        res.json({
            success: true,
            data: {
                ...stats,
                genres: genres
            }
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch statistics: ' + error.message
        });
    }
});

// Add favorite song endpoint
router.post('/songs/:id/favorite', async (req, res) => {
    try {
        // This would require a favorites table - for now just return success
        res.json({
            success: true,
            data: {
                is_favorite: true // Toggle logic would go here
            }
        });
    } catch (error) {
        console.error('Error toggling favorite:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to toggle favorite: ' + error.message
        });
    }
});

module.exports = router;
