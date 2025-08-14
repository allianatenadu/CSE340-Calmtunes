const SpotifyWebApi = require('spotify-web-api-node');
const pool = require('../config/database'); // Your MySQL connection
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const NodeID3 = require('node-id3');

// Spotify API setup
const spotifyApi = new SpotifyWebApi({
  clientId: process.env.SPOTIFY_CLIENT_ID,
  clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
  redirectUri: process.env.SPOTIFY_REDIRECT_URI
});

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../public/audio');
    fs.ensureDirSync(uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'audio/mpeg' || file.mimetype === 'audio/mp3') {
      cb(null, true);
    } else {
      cb(new Error('Only MP3 files allowed'), false);
    }
  }
});

class MusicController {
  // Get Spotify access token
  static async getSpotifyToken() {
    try {
      const data = await spotifyApi.clientCredentialsGrant();
      spotifyApi.setAccessToken(data.body['access_token']);
      return data.body['access_token'];
    } catch (error) {
      console.error('Error getting Spotify token:', error);
      throw error;
    }
  }

  // Add Spotify album to database (for your sleep playlist)
  static async addSpotifyAlbum(req, res) {
    try {
      await MusicController.getSpotifyToken();
      
      const albumId = '2ohcAAeqSLEC2JrPTxlLFW'; // Your sleep album
      const album = await spotifyApi.getAlbum(albumId);
      
      // Create a sleep playlist
      const [playlistResult] = await pool.execute(
        'INSERT INTO playlists (title, description, cover_url, is_public) VALUES (?, ?, ?, ?)',
        ['Sleep Therapy', 'Calming music for better sleep', album.body.images[0]?.url, true]
      );
      
      const playlistId = playlistResult.insertId;
      
      // Add each track from the album
      for (let i = 0; i < album.body.tracks.items.length; i++) {
        const track = album.body.tracks.items[i];
        
        // Insert song
        const [songResult] = await pool.execute(
          `INSERT INTO songs (title, artist, album, duration_ms, source, spotify_id, 
           spotify_preview_url, cover_url, genre) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            track.name,
            track.artists.map(a => a.name).join(', '),
            album.body.name,
            track.duration_ms,
            'spotify',
            track.id,
            track.preview_url,
            album.body.images[0]?.url,
            'Sleep'
          ]
        );
        
        // Add to playlist
        await pool.execute(
          'INSERT INTO playlist_songs (playlist_id, song_id, position) VALUES (?, ?, ?)',
          [playlistId, songResult.insertId, i + 1]
        );
      }
      
      res.json({ success: true, message: 'Sleep album added successfully!' });
    } catch (error) {
      console.error('Error adding Spotify album:', error);
      res.status(500).json({ error: 'Failed to add album' });
    }
  }

  // Upload local MP3 files
  static uploadLocalMusic = upload.single('audioFile');
  
  static async addLocalMusic(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No audio file uploaded' });
      }

      const filePath = req.file.path;
      const metadata = NodeID3.read(filePath);
      
      const [result] = await pool.execute(
        `INSERT INTO songs (title, artist, album, source, local_file_path, genre) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          metadata.title || req.file.originalname,
          metadata.artist || 'Unknown Artist',
          metadata.album || 'Unknown Album',
          'local',
          `/audio/${req.file.filename}`,
          req.body.genre || 'Therapy'
        ]
      );

      res.json({ 
        success: true, 
        message: 'Local music added successfully!',
        songId: result.insertId 
      });
    } catch (error) {
      console.error('Error adding local music:', error);
      res.status(500).json({ error: 'Failed to add local music' });
    }
  }

  // Get all playlists
  static async getPlaylists(req, res) {
    try {
      const [playlists] = await pool.execute(
        'SELECT * FROM playlists WHERE is_public = TRUE ORDER BY created_at DESC'
      );
      res.json(playlists);
    } catch (error) {
      console.error('Error fetching playlists:', error);
      res.status(500).json({ error: 'Failed to fetch playlists' });
    }
  }

  // Get songs from a specific playlist
  static async getPlaylistSongs(req, res) {
    try {
      const { playlistId } = req.params;
      
      const [songs] = await pool.execute(`
        SELECT s.*, ps.position 
        FROM songs s
        JOIN playlist_songs ps ON s.id = ps.song_id
        WHERE ps.playlist_id = ?
        ORDER BY ps.position
      `, [playlistId]);
      
      res.json(songs);
    } catch (error) {
      console.error('Error fetching playlist songs:', error);
      res.status(500).json({ error: 'Failed to fetch songs' });
    }
  }

  // Render music therapy page
  static async renderMusicPage(req, res) {
    try {
      // Get all public playlists
      const [playlists] = await pool.execute(
        'SELECT * FROM playlists WHERE is_public = TRUE ORDER BY created_at DESC'
      );

      // Get featured songs (mix of spotify and local)
      const [featuredSongs] = await pool.execute(
        'SELECT * FROM songs ORDER BY created_at DESC LIMIT 10'
      );

      res.render('music', { 
        title: 'Music Therapy',
        playlists,
        featuredSongs
      });
    } catch (error) {
      console.error('Error rendering music page:', error);
      res.status(500).render('error', { error: 'Failed to load music page' });
    }
  }
}

module.exports = MusicController;