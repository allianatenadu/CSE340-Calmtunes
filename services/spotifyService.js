// services/spotifyService.js

const axios = require('axios');
const qs = require('querystring');

class SpotifyService {
    constructor() {
        this.clientId = process.env.SPOTIFY_CLIENT_ID;
        this.clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
        this.accessToken = null;
        this.tokenExpiry = null;
    }

    async getAccessToken() {
        if (this.accessToken && this.tokenExpiry > Date.now()) {
            return this.accessToken;
        }

        try {
            const response = await axios.post('https://accounts.spotify.com/api/token', 
                qs.stringify({
                    grant_type: 'client_credentials'
                }), 
                {
                    headers: {
                        'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                }
            );

            this.accessToken = response.data.access_token;
            this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);
            
            return this.accessToken;
        } catch (error) {
            console.error('Error getting Spotify access token:', error.response?.data || error.message);
            throw new Error('Failed to authenticate with Spotify');
        }
    }

    async makeSpotifyRequest(endpoint) {
        const token = await this.getAccessToken();
        
        try {
            const response = await axios.get(`https://api.spotify.com/v1${endpoint}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            return response.data;
        } catch (error) {
            console.error('Spotify API request failed:', error.response?.data || error.message);
            throw error;
        }
    }

    extractSpotifyId(url) {
        // Extract ID from various Spotify URL formats
        const patterns = [
            /spotify:album:([a-zA-Z0-9]+)/,
            /open\.spotify\.com\/album\/([a-zA-Z0-9]+)/,
            /spotify:track:([a-zA-Z0-9]+)/,
            /open\.spotify\.com\/track\/([a-zA-Z0-9]+)/,
            /spotify:playlist:([a-zA-Z0-9]+)/,
            /open\.spotify\.com\/playlist\/([a-zA-Z0-9]+)/
        ];

        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) return match[1];
        }
        
        throw new Error('Invalid Spotify URL format');
    }

    async getAlbumTracks(albumUrl) {
        try {
            const albumId = this.extractSpotifyId(albumUrl);
            const albumData = await this.makeSpotifyRequest(`/albums/${albumId}`);
            
            const tracks = albumData.tracks.items.map(track => ({
                spotify_id: track.id,
                title: track.name,
                artist: track.artists.map(artist => artist.name).join(', '),
                album: albumData.name,
                duration: Math.floor(track.duration_ms / 1000),
                track_number: track.track_number,
                explicit: track.explicit,
                spotify_preview_url: track.preview_url,
                popularity: track.popularity || 0,
                release_date: albumData.release_date,
                genre: albumData.genres?.[0] || null,
                source: 'spotify'
            }));

            return {
                album: {
                    name: albumData.name,
                    artist: albumData.artists.map(artist => artist.name).join(', '),
                    image: albumData.images?.[0]?.url || null,
                    release_date: albumData.release_date,
                    total_tracks: albumData.total_tracks
                },
                tracks
            };
        } catch (error) {
            console.error('Error fetching album tracks:', error.message);
            throw error;
        }
    }

    async searchTracks(query, limit = 20) {
        try {
            const encodedQuery = encodeURIComponent(query);
            const data = await this.makeSpotifyRequest(`/search?q=${encodedQuery}&type=track&limit=${limit}`);
            
            return data.tracks.items.map(track => ({
                spotify_id: track.id,
                title: track.name,
                artist: track.artists.map(artist => artist.name).join(', '),
                album: track.album.name,
                duration: Math.floor(track.duration_ms / 1000),
                explicit: track.explicit,
                spotify_preview_url: track.preview_url,
                popularity: track.popularity,
                release_date: track.album.release_date,
                image: track.album.images?.[0]?.url || null,
                source: 'spotify'
            }));
        } catch (error) {
            console.error('Error searching tracks:', error.message);
            throw error;
        }
    }
}

module.exports = new SpotifyService();
