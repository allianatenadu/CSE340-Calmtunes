const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');

// Configure multer for file uploads
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

// Middleware to check authentication
function requireAuth(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    res.status(401).json({ error: 'Authentication required' });
  }
}

// GET /music/playlists - Get all public playlists
router.get('/playlists', async (req, res) => {
  try {
    const [playlists] = await pool.execute(
      'SELECT * FROM playlists WHERE is_public = 1 ORDER BY created_at DESC'
    );
    res.json(playlists);
  } catch (error) {
    console.error('Error fetching playlists:', error);
    res.status(500).json({ error: 'Failed to fetch playlists' });
  }
});

// GET /music/playlist/:id/songs - Get songs from a specific playlist
router.get('/playlist/:playlistId/songs', async (req, res) => {
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
});

// POST /music/local/upload - Upload local MP3 files
router.post('/local/upload', requireAuth, upload.single('audioFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file uploaded' });
    }

    // Try to extract metadata (basic version without node-id3 for now)
    const title = req.body.title || req.file.originalname.replace('.mp3', '');
    const artist = req.body.artist || 'Unknown Artist';
    const genre = req.body.genre || 'Therapy';

    const [result] = await pool.execute(
      `INSERT INTO songs (title, artist, album, source, local_file_path, genre) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        title,
        artist,
        'Local Upload',
        'local',
        `/audio/${req.file.filename}`,
        genre
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
});

// POST /music/spotify/add-album - Add default Spotify album (placeholder for now)
router.post('/spotify/add-album', requireAuth, async (req, res) => {
  try {
    // For now, create a default playlist with sample data
    // Later you can integrate with Spotify API
    
    const [playlistResult] = await pool.execute(
      'INSERT INTO playlists (title, description, cover_url, is_public) VALUES (?, ?, ?, ?)',
      [
        'Sleep Therapy', 
        'Calming music for better sleep', 
        'https://images.pexels.com/photos/1021876/pexels-photo-1021876.jpeg?auto=compress&cs=tinysrgb&w=400',
        1
      ]
    );
    
    const playlistId = playlistResult.insertId;
    
    // Add some sample songs (you can replace this with actual Spotify integration later)
    const sampleSongs = [
      {
        title: 'Peaceful Dreams',
        artist: 'Sleep Sounds',
        album: 'Night Rest',
        genre: 'Sleep',
        source: 'spotify'
      },
      {
        title: 'Ocean Waves',
        artist: 'Nature Sounds',
        album: 'Calm Waters',
        genre: 'Sleep',
        source: 'spotify'
      },
      {
        title: 'Gentle Rain',
        artist: 'Ambient Collective',
        album: 'Weather Patterns',
        genre: 'Sleep',
        source: 'spotify'
      }
    ];

    for (let i = 0; i < sampleSongs.length; i++) {
      const song = sampleSongs[i];
      
      const [songResult] = await pool.execute(
        `INSERT INTO songs (title, artist, album, source, genre, cover_url) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          song.title,
          song.artist,
          song.album,
          song.source,
          song.genre,
          'https://images.pexels.com/photos/1021876/pexels-photo-1021876.jpeg?auto=compress&cs=tinysrgb&w=400'
        ]
      );
      
      // Add to playlist
      await pool.execute(
        'INSERT INTO playlist_songs (playlist_id, song_id, position) VALUES (?, ?, ?)',
        [playlistId, songResult.insertId, i + 1]
      );
    }
    
    res.json({ success: true, message: 'Default sleep playlist added successfully!' });
  } catch (error) {
    console.error('Error adding default playlist:', error);
    res.status(500).json({ error: 'Failed to add playlist' });
  }
});

// GET /music/songs - Get all songs
router.get('/songs', async (req, res) => {
  try {
    const [songs] = await pool.execute(
      'SELECT * FROM songs ORDER BY created_at DESC'
    );
    res.json(songs);
  } catch (error) {
    console.error('Error fetching songs:', error);
    res.status(500).json({ error: 'Failed to fetch songs' });
  }
});

// POST /music/playlists - Create new playlist
router.post('/playlists', requireAuth, async (req, res) => {
  try {
    const { title, description, is_public = true } = req.body;
    const userId = req.session.user.id;

    const [result] = await pool.execute(
      'INSERT INTO playlists (title, description, is_public, user_id) VALUES (?, ?, ?, ?)',
      [title, description, is_public, userId]
    );

    res.json({ 
      success: true, 
      message: 'Playlist created successfully!',
      playlistId: result.insertId 
    });
  } catch (error) {
    console.error('Error creating playlist:', error);
    res.status(500).json({ error: 'Failed to create playlist' });
  }
});

// POST /music/playlist/:id/add-song - Add song to playlist
router.post('/playlist/:playlistId/add-song', requireAuth, async (req, res) => {
  try {
    const { playlistId } = req.params;
    const { songId } = req.body;

    // Get current max position
    const [positionResult] = await pool.execute(
      'SELECT COALESCE(MAX(position), 0) + 1 as next_position FROM playlist_songs WHERE playlist_id = ?',
      [playlistId]
    );
    
    const nextPosition = positionResult[0].next_position;

    await pool.execute(
      'INSERT INTO playlist_songs (playlist_id, song_id, position) VALUES (?, ?, ?)',
      [playlistId, songId, nextPosition]
    );

    res.json({ success: true, message: 'Song added to playlist!' });
  } catch (error) {
    console.error('Error adding song to playlist:', error);
    res.status(500).json({ error: 'Failed to add song to playlist' });
  }
});

module.exports = router;