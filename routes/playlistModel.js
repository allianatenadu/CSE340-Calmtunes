// models/playlistModel.js

const db = require('../config/database');

class PlaylistModel {
    static async create(playlistData) {
        const query = `
            INSERT INTO playlists (title, description, image, category_id, created_by, is_public)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        
        const values = [
            playlistData.title,
            playlistData.description || null,
            playlistData.image || null,
            playlistData.category_id || null,
            playlistData.created_by,
            playlistData.is_public !== false // Default to true
        ];

        try {
            const [result] = await db.execute(query, values);
            return result.insertId;
        } catch (error) {
            throw error;
        }
    }

    static async findById(id) {
        const query = 'SELECT * FROM playlists WHERE id = ?';
        const [rows] = await db.execute(query, [id]);
        return rows[0] || null;
    }

    static async getAll(limit = 50, offset = 0) {
        const query = `
            SELECT p.*, 
                   COUNT(ps.song_id) as song_count,
                   u.username as creator_name
            FROM playlists p
            LEFT JOIN playlist_songs ps ON p.id = ps.playlist_id
            LEFT JOIN users u ON p.created_by = u.id
            WHERE p.is_public = true
            GROUP BY p.id
            ORDER BY p.created_at DESC
            LIMIT ? OFFSET ?
        `;
        const [rows] = await db.execute(query, [limit, offset]);
        return rows;
    }

    static async getByUserId(userId, limit = 50, offset = 0) {
        const query = `
            SELECT p.*, COUNT(ps.song_id) as song_count
            FROM playlists p
            LEFT JOIN playlist_songs ps ON p.id = ps.playlist_id
            WHERE p.created_by = ?
            GROUP BY p.id
            ORDER BY p.created_at DESC
            LIMIT ? OFFSET ?
        `;
        const [rows] = await db.execute(query, [userId, limit, offset]);
        return rows;
    }

    static async getFeatured() {
        // Get the most recent public playlist as featured
        const query = `
            SELECT p.*, COUNT(ps.song_id) as song_count
            FROM playlists p
            LEFT JOIN playlist_songs ps ON p.id = ps.playlist_id
            WHERE p.is_public = true
            GROUP BY p.id
            HAVING song_count > 0
            ORDER BY p.created_at DESC
            LIMIT 1
        `;
        const [rows] = await db.execute(query);
        return rows[0] || null;
    }

    static async update(id, playlistData) {
        const query = `
            UPDATE playlists 
            SET title = ?, description = ?, image = ?, category_id = ?, is_public = ?
            WHERE id = ?
        `;
        
        const values = [
            playlistData.title,
            playlistData.description || null,
            playlistData.image || null,
            playlistData.category_id || null,
            playlistData.is_public !== false,
            id
        ];

        const [result] = await db.execute(query, values);
        return result.affectedRows > 0;
    }

    static async delete(id) {
        const query = 'DELETE FROM playlists WHERE id = ?';
        const [result] = await db.execute(query, [id]);
        return result.affectedRows > 0;
    }

    static async search(searchTerm) {
        const query = `
            SELECT p.*, COUNT(ps.song_id) as song_count
            FROM playlists p
            LEFT JOIN playlist_songs ps ON p.id = ps.playlist_id
            WHERE p.is_public = true AND (p.title LIKE ? OR p.description LIKE ?)
            GROUP BY p.id
            ORDER BY p.title ASC
        `;
        const [rows] = await db.execute(query, [`%${searchTerm}%`, `%${searchTerm}%`]);
        return rows;
    }
}

module.exports = PlaylistModel;