const fetch = require("node-fetch");
const { getSpotifyToken } = require("../utilities/spotifyAuth");
const db = require("../config/database");


async function searchSpotifyPlaylists(query, token, market = "US") {
  if (!token) return null;

  try {
    const res = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=playlist&limit=1&market=${market}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!res.ok) {
      console.error(`❌ Search failed (${res.status}):`, await res.text());
      return null;
    }

    const data = await res.json();
    const playlist = data.playlists?.items[0];
    if (playlist) {
      console.log(`✅ Found playlist for "${query}": ${playlist.name} (${playlist.id})`);
      return {
        id: playlist.id,
        title: playlist.name,
        description: playlist.description || "Motivational music playlist",
        cover_url: playlist.images?.[0]?.url || "/images/pngtree-music-notes--musical-design-png-image_6283885.png",
      };
    }
    return null;
  } catch (err) {
    console.error("❌ Search error:", err.message);
    return null;
  }
}

/**
 * Fetch Spotify tracks (album or playlist)
 */
async function fetchSpotifyTracks(id, type, token) {
  if (!token) {
    console.error("❌ Missing Spotify token for fetch");
    return [];
  }

  try {
    console.log(`🔍 Fetching ${type} ${id} with client token`);

    let res;
    if (type === "album") {
      res = await fetch(`https://api.spotify.com/v1/albums/${id}?market=US`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } else {
      res = await fetch(
        `https://api.spotify.com/v1/playlists/${id}/tracks?limit=50&market=US`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
    }

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`❌ ${type} fetch failed (${res.status}):`, errorText);
      return [];
    }

    const data = await res.json();
    console.log(`✅ Fetched ${type} data for ${id}:`, {
      totalTracks: type === "album" ? data.tracks?.items?.length || 0 : data.items?.length || 0
    });

    let tracks;
    if (type === "album") {
      const albumCover =
        data.images?.[0]?.url ||
        "/images/pngtree-music-notes--musical-design-png-image_6283885.png";
      tracks = (data.tracks?.items || []).map((track) => ({
        title: track.name || "Unknown Track",
        artist:
          track.artists?.map((a) => a.name).join(", ") || "Unknown Artist",
        preview_url: track.preview_url || null,
        open_url: track.external_urls?.spotify || "#",
        spotify_uri: track.id ? `spotify:track:${track.id}` : null,
        cover_image: albumCover,
      }));
    } else {
      tracks = (data.items || [])
        .map((item) => {
          const track = item.track;
          if (!track) return null;
          return {
            title: track.name || "Unknown Track",
            artist:
              track.artists?.map((a) => a.name).join(", ") || "Unknown Artist",
            preview_url: track.preview_url || null,
            open_url: track.external_urls?.spotify || "#",
            spotify_uri: track.id ? `spotify:track:${track.id}` : null,
            cover_image:
              track.album?.images?.[0]?.url ||
              "/images/pngtree-music-notes--musical-design-png-image_6283885.png",
          };
        })
        .filter(Boolean);
    }

    console.log(`📊 Processed ${tracks.length} tracks from ${type} ${id}`);
    return tracks;
  } catch (err) {
    console.error("❌ Spotify fetch error:", err.message);
    return [];
  }
}
// Enhanced trackMusicCategory function - Replace the existing one in musicController.js

exports.trackMusicCategory = async (req, res) => {
    try {
        const userId = req.session?.user?.id;
        const { category, action = 'play' } = req.body;
        
        if (!userId) {
            return res.status(401).json({ success: false, message: "User not authenticated" });
        }
        
        if (!category) {
            return res.status(400).json({ success: false, message: "Category is required" });
        }
        
        console.log(`Tracking music category: ${category} (${action}) for user: ${userId}`);
        
        // Check if record exists
        const existingQuery = `
            SELECT id, play_count FROM music_preferences 
            WHERE user_id = $1 AND category = $2
        `;
        const existingResult = await db.query(existingQuery, [userId, category]);
        
        let query, values;
        
        // Different increment amounts based on action type
        let incrementAmount = 1;
        switch(action) {
            case 'spotify_open':
                incrementAmount = 3; // Higher weight for actually opening Spotify
                break;
            case 'preview_play':
                incrementAmount = 2; // Medium weight for playing previews
                break;
            case 'browse':
                incrementAmount = 1; // Light weight for just browsing
                break;
            default:
                incrementAmount = 1;
        }
        
        if (existingResult.rows.length > 0) {
            // Update existing record
            query = `
                UPDATE music_preferences 
                SET play_count = play_count + $3, 
                    last_played = CURRENT_TIMESTAMP, 
                    updated_at = CURRENT_TIMESTAMP
                WHERE user_id = $1 AND category = $2
                RETURNING play_count
            `;
            values = [userId, category, incrementAmount];
        } else {
            // Create new record
            query = `
                INSERT INTO music_preferences (user_id, category, play_count, last_played)
                VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
                RETURNING play_count
            `;
            values = [userId, category, incrementAmount];
        }
        
        const result = await db.query(query, values);
        const playCount = result.rows[0]?.play_count || incrementAmount;
        
        console.log(`Category ${category} tracked: ${action} (+${incrementAmount}) = ${playCount} total`);
        
        res.json({ 
            success: true, 
            message: `Category tracked successfully (${action})`,
            playCount: playCount,
            action: action
        });
        
    } catch (error) {
        console.error("Error tracking music category:", error);
        res.status(500).json({ 
            success: false, 
            error: "Failed to track music category" 
        });
    }
};
/**
 * Render Music Page
 */
module.exports.getMusicPage = async (req, res) => {
  try {
    // 🔑 Get client credentials token
    const clientToken = await getSpotifyToken();

    // 🔑 Get user's Spotify access token from session (if available)
    const userSpotifyToken = req.session.spotifyAccessToken || null;
    const hasSpotifyToken = !!userSpotifyToken;

    // Enhanced categories with therapeutic focus and working playlist IDs
    const categories = [
      {
        id: "sleep",
        title: "Sleep Therapy",
        description: "Calming music for better sleep",
        cover_url:
          "https://images.pexels.com/photos/1021876/pexels-photo-1021876.jpeg",
        type: "album",
        playlistId: "2ohcAAeqSLEC2JrPTxlLFW", // User-provided album
      },
      {
        id: "anxiety",
        title: "Anxiety Relief",
        description: "Science-backed music to reduce anxiety and stress",
        cover_url:
          "https://images.pexels.com/photos/1054218/pexels-photo-1054218.jpeg",
        type: "playlist",
        playlistId: "2zYv04WPTCV10YzDwk2Yxb", // Science-Approved Anti-Anxiety Playlist
      },
      {
        id: "anxiety2",
        title: "Stress & Anxiety Free",
        description: "Comprehensive anxiety relief with calming tracks",
        cover_url:
          "https://images.pexels.com/photos/3771110/pexels-photo-3771110.jpeg",
        type: "playlist",
        playlistId: "2pCgNhBE3BPVihwWH1KaVs", // Calming Music Academy playlist
      },
      {
        id: "focus",
        title: "Deep Focus",
        description: "Enhanced concentration for work and study",
        cover_url:
          "https://images.pexels.com/photos/1181248/pexels-photo-1181248.jpeg",
        type: "playlist",
        playlistId: "37i9dQZF1DWZeKCadgRdKQ", // Official Spotify Deep Focus playlist
      },
      {
        id: "relax",
        title: "Relaxation Therapy",
        description: "Your working relaxation playlist for deep calm",
        cover_url:
          "https://images.pexels.com/photos/1054218/pexels-photo-1054218.jpeg",
        type: "playlist",
        playlistId: "2tgEwMM4QzQTQskDM0R9Tv", // User-verified working playlist
      },
      {
        id: "motivation",
        title: "Focus & Work Music",
        description: "Instrumental and ambient tracks to boost productivity",
        cover_url:
          "https://images.pexels.com/photos/371589/pexels-photo-371589.jpeg",
        type: "album",
        playlistId: "3zy4nItVptDsckhEjXsvFI", // Cosmic Clarity: Work Music album
      },
      {
        id: "ambient",
        title: "Ambient Stress Relief",
        description: "Ambient soundscapes for deep relaxation",
        cover_url:
          "https://images.pexels.com/photos/2088203/pexels-photo-2088203.jpeg",
        type: "playlist",
        playlistId: "7dRMmZ7ZMBIBuT2M8DtFA2", // Relaxing Ambient Music for Anxiety and Stress Relief 2024
      },
    ];

    // Enhanced fallback local songs with more therapeutic variety
    const localSongs = [
      {
        id: "local1",
        title: "Calm Meditation",
        artist: "Therapeutic Sounds",
        preview_url: "/audio/Fido-Joy-Is-Coming.mp3",
        cover_image:
          "/images/pngtree-music-notes--musical-design-png-image_6283885.png",
        open_url: "#",
        spotify_uri: null,
      },
      {
        id: "local2",
        title: "Focus Flow",
        artist: "Concentration Music",
        preview_url: "/audio/Omah-Lay-Soso-feat-Ozuna.mp3",
        cover_image:
          "/images/pngtree-music-notes--musical-design-png-image_6283885.png",
        open_url: "#",
        spotify_uri: null,
      },
    ];

    // Fetch remote songs dynamically with enhanced error handling
    const allSongs = {};
    const fetchPromises = categories.map(async (cat) => {
      console.log(`🔍 Fetching ${cat.type} ${cat.id}: ${cat.playlistId}`);
      
      // Add error handling and validation
      if (!clientToken) {
        console.warn(`⚠️ No client token available for ${cat.id}`);
        allSongs[cat.id] = localSongs;
        return;
      }

      try {
        const fetchedTracks = await fetchSpotifyTracks(
          cat.playlistId,
          cat.type,
          clientToken
        );
        
        allSongs[cat.id] = fetchedTracks;
        console.log(`📊 Successfully fetched ${fetchedTracks.length} tracks for ${cat.id}`);
        
        // Fallback to local if empty or error
        if (fetchedTracks.length === 0) {
          console.log(`⚠️ No tracks found for ${cat.id}, using local fallback`);
          allSongs[cat.id] = localSongs;
        }
      } catch (error) {
        console.error(`❌ Error fetching ${cat.id}:`, error.message);
        allSongs[cat.id] = localSongs;
      }
    });

    // Wait for all fetch operations to complete
    await Promise.all(fetchPromises);

    console.log('📊 Final song counts:', Object.keys(allSongs).map(key => 
      `${key}: ${allSongs[key].length} tracks`
    ).join(', '));

    // Render page with all required variables
    res.render("pages/music", {
      title: "Music Therapy",
      user: req.session.user || null,
      categories,
      allSongs,
      spotifyEnabled: true, // flag for showing "Open in Spotify" buttons
      spotifyToken: userSpotifyToken, // User's access token for full playback
      hasSpotifyToken: hasSpotifyToken,
      tokenType: hasSpotifyToken ? "user" : "client",
    });
  } catch (err) {
    console.error("Error in getMusicPage:", err);
    res.render("pages/music", {
      title: "Music Therapy",
      user: req.session.user || null,
      categories: [],
      allSongs: {},
      spotifyEnabled: false,
      spotifyToken: null,
      hasSpotifyToken: false,
      tokenType: "none",
    });
  }
};