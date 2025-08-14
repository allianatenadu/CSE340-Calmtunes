// models/songModel.js
const pool = require('../config/database');

exports.upsertSpotifySong = async (song) => {
  const q = `
    INSERT INTO songs (title, artist, album, duration_ms, source, spotify_id, spotify_preview_url, cover_url, genre)
    VALUES ($1,$2,$3,$4,'spotify',$5,$6,$7,$8)
    ON CONFLICT (spotify_id) DO UPDATE
    SET title = EXCLUDED.title,
        artist = EXCLUDED.artist,
        album = EXCLUDED.album,
        duration_ms = EXCLUDED.duration_ms,
        spotify_preview_url = EXCLUDED.spotify_preview_url,
        cover_url = EXCLUDED.cover_url
    RETURNING *;
  `;
  const vals = [
    song.title,
    song.artist,
    song.album,
    song.duration_ms || null,
    song.spotify_id,
    song.preview_url || null,
    song.cover_url || null,
    song.genre || null,
  ];
  const { rows } = await pool.query(q, vals);
  return rows[0];
};

exports.createLocalSong = async ({ title, artist, album, duration_ms, local_file_path, cover_url, genre }) => {
  const q = `
    INSERT INTO songs (title, artist, album, duration_ms, source, local_file_path, cover_url, genre)
    VALUES ($1,$2,$3,$4,'local',$5,$6,$7) RETURNING *;
  `;
  const vals = [title, artist || null, album || null, duration_ms || null, local_file_path, cover_url || null, genre || null];
  const { rows } = await pool.query(q, vals);
  return rows[0];
};

exports.findBySpotifyId = async (spotifyId) => {
  const { rows } = await pool.query(`SELECT * FROM songs WHERE spotify_id = $1`, [spotifyId]);
  return rows[0];
};

exports.findById = async (id) => {
  const { rows } = await pool.query(`SELECT * FROM songs WHERE id = $1`, [id]);
  return rows[0];
};

exports.getAll = async (limit = 50, offset = 0, sortBy = 'created_at_desc') => {
  const order = sortBy === 'title_asc' ? 'title ASC' :
                sortBy === 'title_desc' ? 'title DESC' :
                'created_at DESC';
  const { rows } = await pool.query(`SELECT * FROM songs ORDER BY ${order} LIMIT $1 OFFSET $2`, [limit, offset]);
  return rows;
};

exports.search = async (q, source, genre, sortBy = 'created_at_desc') => {
  const order = sortBy === 'title_asc' ? 'title ASC' :
                sortBy === 'title_desc' ? 'title DESC' :
                'created_at DESC';
  const params = [];
  const where = [];

  if (q) {
    params.push(`%${q}%`);
    where.push(`(title ILIKE $${params.length} OR artist ILIKE $${params.length})`);
  }
  if (source) {
    params.push(source);
    where.push(`source = $${params.length}`);
  }
  if (genre) {
    params.push(genre);
    where.push(`genre = $${params.length}`);
  }

  const sql = `
    SELECT * FROM songs
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY ${order}
    LIMIT 200
  `;
  const { rows } = await pool.query(sql, params);
  return rows;
};

exports.delete = async (id) => {
  const { rowCount } = await pool.query(`DELETE FROM songs WHERE id = $1`, [id]);
  return rowCount > 0;
};

exports.getDistinctGenres = async () => {
  const { rows } = await pool.query(`SELECT DISTINCT genre FROM songs WHERE genre IS NOT NULL ORDER BY genre ASC`);
  return rows.map(r => r.genre);
};

exports.getStats = async () => {
  const totalRes = await pool.query(`SELECT COUNT(*)::int AS total FROM songs`);
  const localRes = await pool.query(`SELECT COUNT(*)::int AS local FROM songs WHERE source='local'`);
  const spotifyRes = await pool.query(`SELECT COUNT(*)::int AS spotify FROM songs WHERE source='spotify'`);
  return { total: totalRes.rows[0].total, local: localRes.rows[0].local, spotify: spotifyRes.rows[0].spotify };
};

exports.getPlaylistSongs = async (playlistId) => {
  const { rows } = await pool.query(`
    SELECT s.*
    FROM playlist_songs ps
    JOIN songs s ON s.id = ps.song_id
    WHERE ps.playlist_id = $1
    ORDER BY COALESCE(ps.position, 999999), s.title ASC
  `, [playlistId]);
  return rows;
};

exports.addToPlaylist = async (playlistId, songId) => {
  await pool.query(`
    INSERT INTO playlist_songs (playlist_id, song_id, position)
    VALUES ($1,$2,
      (SELECT COALESCE(MAX(position),0)+1 FROM playlist_songs WHERE playlist_id = $1))
    ON CONFLICT DO NOTHING
  `, [playlistId, songId]);
};
