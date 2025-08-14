const pool = require('../config/database');

class SongModel {
    static async create(songData) {
        // Fixed PostgreSQL query with proper RETURNING clause
        const query = `
            INSERT INTO songs (
                title, artist, album, duration, spotify_id, spotify_preview_url,
                local_file_path, file_size, genre, release_date, popularity,
                explicit, source, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP)
            RETURNING id
        `;
        
        const values = [
            songData.title,
            songData.artist,
            songData.album || null,
            songData.duration || null,
            songData.spotify_id || null,
            songData.spotify_preview_url || null,
            songData.local_file_path || null,
            songData.file_size || null,
            songData.genre || null,
            songData.release_date || null,
            songData.popularity || 0,
            songData.explicit || false,
            songData.source
        ];

        try {
            const result = await pool.query(query, values);
            return result.rows[0].id;
        } catch (error) {
            if (error.code === '23505') { // PostgreSQL unique violation
                throw new Error('Song already exists');
            }
            console.error('Database error in SongModel.create:', error);
            throw error;
        }
    }

    static async search(searchTerm, source = null, genre = null, sortBy = 'created_at_desc') {
        let query = `
            SELECT * FROM songs 
            WHERE (title ILIKE $1 OR artist ILIKE $2 OR album ILIKE $3)
        `;
        let params = [`%${searchTerm}%`, `%${searchTerm}%`, `%${searchTerm}%`];

        if (source) {
            query += ` AND source = $${params.length + 1}`;
            params.push(source);
        }

        if (genre) {
            query += ` AND genre = $${params.length + 1}`;
            params.push(genre);
        }

        // Add proper sorting
        switch (sortBy) {
            case 'title_asc':
                query += ' ORDER BY title ASC';
                break;
            case 'title_desc':
                query += ' ORDER BY title DESC';
                break;
            case 'artist_asc':
                query += ' ORDER BY artist ASC';
                break;
            case 'artist_desc':
                query += ' ORDER BY artist DESC';
                break;
            case 'popularity_desc':
                query += ' ORDER BY popularity DESC, title ASC';
                break;
            default:
                query += ' ORDER BY created_at DESC';
        }

        const result = await pool.query(query, params);
        return result.rows;
    }

    // Fixed other methods with proper PostgreSQL syntax
    static async findById(id) {
        const query = 'SELECT * FROM songs WHERE id = $1';
        const result = await pool.query(query, [id]);
        return result.rows[0] || null;
    }

    static async findBySpotifyId(spotifyId) {
        const query = 'SELECT * FROM songs WHERE spotify_id = $1';
        const result = await pool.query(query, [spotifyId]);
        return result.rows[0] || null;
    }

    static async getAll(limit = 50, offset = 0, sortBy = 'created_at_desc') {
        let query = 'SELECT * FROM songs ';
        
        switch (sortBy) {
            case 'title_asc':
                query += 'ORDER BY title ASC ';
                break;
            case 'title_desc':
                query += 'ORDER BY title DESC ';
                break;
            case 'artist_asc':
                query += 'ORDER BY artist ASC ';
                break;
            case 'artist_desc':
                query += 'ORDER BY artist DESC ';
                break;
            case 'popularity_desc':
                query += 'ORDER BY popularity DESC, title ASC ';
                break;
            default:
                query += 'ORDER BY created_at DESC ';
        }
        
        query += 'LIMIT $1 OFFSET $2';
        
        const result = await pool.query(query, [limit, offset]);
        return result.rows;
    }

    static async addToPlaylist(playlistId, songId, position = null) {
        if (!position) {
            const posResult = await pool.query(
                'SELECT COALESCE(MAX(position), 0) as max_pos FROM playlist_songs WHERE playlist_id = $1',
                [playlistId]
            );
            position = (posResult.rows[0].max_pos || 0) + 1;
        }

        const query = `
            INSERT INTO playlist_songs (playlist_id, song_id, position, added_at)
            VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
            ON CONFLICT (playlist_id, song_id) 
            DO UPDATE SET position = EXCLUDED.position, added_at = CURRENT_TIMESTAMP
        `;
        
        await pool.query(query, [playlistId, songId, position]);
        return true;
    }

    static async getPlaylistSongs(playlistId) {
        const query = `
            SELECT s.*, ps.position, ps.added_at
            FROM songs s
            JOIN playlist_songs ps ON s.id = ps.song_id
            WHERE ps.playlist_id = $1
            ORDER BY ps.position ASC
        `;
        
        const result = await pool.query(query, [playlistId]);
        return result.rows;
    }

    static async removeFromPlaylist(playlistId, songId) {
        const query = 'DELETE FROM playlist_songs WHERE playlist_id = $1 AND song_id = $2';
        const result = await pool.query(query, [playlistId, songId]);
        return result.rowCount > 0;
    }

    static async delete(id) {
        const query = 'DELETE FROM songs WHERE id = $1';
        const result = await pool.query(query, [id]);
        return result.rowCount > 0;
    }

    static async getDistinctGenres() {
        const query = 'SELECT DISTINCT genre FROM songs WHERE genre IS NOT NULL ORDER BY genre ASC';
        const result = await pool.query(query);
        return result.rows.map(row => row.genre);
    }

    static async getStats() {
        const query = `
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN source = 'local' THEN 1 ELSE 0 END) as local_count,
                SUM(CASE WHEN source = 'spotify' THEN 1 ELSE 0 END) as spotify_count
            FROM songs
        `;
        const result = await pool.query(query);
        return result.rows[0];
    }
}

module.exports = SongModel;