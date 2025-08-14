const spotifyService = require('../services/spotifyService');
const SongModel = require('../models/songModel');

class SpotifyController {
    static async importFromSpotify(req, res) {
        try {
            const { spotifyUrl, playlistId } = req.body;

            if (!spotifyUrl) {
                return res.status(400).json({
                    success: false,
                    message: 'Spotify URL is required'
                });
            }

            let tracks = [];
            
            if (spotifyUrl.includes('/album/')) {
                const albumData = await spotifyService.getAlbumTracks(spotifyUrl);
                tracks = albumData.tracks;
            } else if (spotifyUrl.includes('/track/')) {
                const trackData = await spotifyService.getTrackDetails(spotifyUrl);
                tracks = [trackData];
            } else if (spotifyUrl.includes('/playlist/')) {
                return res.status(400).json({
                    success: false,
                    message: 'Playlist import not implemented yet'
                });
            } else {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid Spotify URL format'
                });
            }

            const importedSongs = [];
            const skippedSongs = [];

            for (const track of tracks) {
                try {
                    // Check if song already exists
                    const existingSong = await SongModel.findBySpotifyId(track.spotify_id);
                    
                    let songId;
                    if (existingSong) {
                        songId = existingSong.id;
                        skippedSongs.push({
                            title: track.title,
                            artist: track.artist,
                            reason: 'Already exists'
                        });
                    } else {
                        songId = await SongModel.create(track);
                        importedSongs.push({
                            id: songId,
                            title: track.title,
                            artist: track.artist
                        });
                    }

                    // Add to playlist if specified
                    if (playlistId && songId) {
                        await SongModel.addToPlaylist(playlistId, songId);
                    }

                } catch (error) {
                    console.error(`Error importing track ${track.title}:`, error);
                    skippedSongs.push({
                        title: track.title,
                        artist: track.artist,
                        reason: error.message
                    });
                }
            }

            res.json({
                success: true,
                message: `Import completed. ${importedSongs.length} songs imported, ${skippedSongs.length} skipped.`,
                data: {
                    imported: importedSongs,
                    skipped: skippedSongs
                }
            });

        } catch (error) {
            console.error('Spotify import error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to import from Spotify: ' + error.message
            });
        }
    }

    static async searchSpotify(req, res) {
        try {
            const { q, limit = 20 } = req.query;
            
            if (!q || !q.trim()) {
                return res.status(400).json({
                    success: false,
                    message: 'Search query is required'
                });
            }

            const tracks = await spotifyService.searchTracks(q.trim(), parseInt(limit));
            
            res.json({
                success: true,
                data: tracks
            });

        } catch (error) {
            console.error('Spotify search error:', error);
            res.status(500).json({
                success: false,
                message: 'Search failed: ' + error.message
            });
        }
    }
}

module.exports = SpotifyController;