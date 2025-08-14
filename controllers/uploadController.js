// controllers/uploadController.js

const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const NodeID3 = require('node-id3'); // npm install node-id3
const SongModel = require('../models/songModel');

// Multer configuration for MP3 uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '../public/uploads/songs');
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'audio/mpeg' || file.mimetype === 'audio/mp3') {
        cb(null, true);
    } else {
        cb(new Error('Only MP3 files are allowed'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit
    }
});

class UploadController {
    static getUploadMiddleware() {
        return upload.array('mp3Files', 10); // Allow up to 10 files
    }

    static async uploadMP3Files(req, res) {
        try {
            if (!req.files || req.files.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'No MP3 files uploaded'
                });
            }

            const uploadedSongs = [];
            const failedUploads = [];

            for (const file of req.files) {
                try {
                    // Extract metadata using NodeID3
                    const tags = NodeID3.read(file.path);
                    
                    const songData = {
                        title: tags.title || path.basename(file.originalname, path.extname(file.originalname)),
                        artist: tags.artist || 'Unknown Artist',
                        album: tags.album || 'Unknown Album',
                        genre: tags.genre || null,
                        duration: null, // You might want to use a library like ffprobe to get duration
                        local_file_path: `/uploads/songs/${file.filename}`,
                        file_size: file.size,
                        source: 'local'
                    };

                    const songId = await SongModel.create(songData);
                    
                    uploadedSongs.push({
                        id: songId,
                        title: songData.title,
                        artist: songData.artist,
                        filename: file.filename
                    });

                    // Add to playlist if specified
                    if (req.body.playlistId) {
                        await SongModel.addToPlaylist(req.body.playlistId, songId);
                    }

                } catch (error) {
                    console.error(`Error processing ${file.originalname}:`, error.message);
                    
                    // Delete the file if database insertion failed
                    try {
                        await fs.unlink(file.path);
                    } catch (unlinkError) {
                        console.error('Error deleting failed upload:', unlinkError.message);
                    }

                    failedUploads.push({
                        filename: file.originalname,
                        reason: error.message
                    });
                }
            }

            res.json({
                success: true,
                message: `Upload completed. ${uploadedSongs.length} files uploaded, ${failedUploads.length} failed.`,
                data: {
                    uploaded: uploadedSongs,
                    failed: failedUploads
                }
            });

        } catch (error) {
            console.error('Upload error:', error.message);
            res.status(500).json({
                success: false,
                message: 'Upload failed: ' + error.message
            });
        }
    }
}

module.exports = UploadController;
