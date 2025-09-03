const fetch = require("node-fetch");
const { getSpotifyToken } = require("../utilities/spotifyAuth");

/**
 * Fetch Spotify tracks (album or playlist)
 */
async function fetchSpotifyTracks(id, type, token) {
  if (!token) {
    console.error("âŒ Missing Spotify token for fetch");
    return [];
  }

  try {
    if (type === "album") {
      const albumRes = await fetch(`https://api.spotify.com/v1/albums/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!albumRes.ok) {
        console.error("âŒ Album fetch failed:", await albumRes.text());
        return [];
      }

      const albumData = await albumRes.json();
      const albumCover = albumData.images?.[0]?.url || "/images/default-cover.jpg";

      return (albumData.tracks.items || []).map(track => ({
        title: track.name || "Unknown Track",
        artist: track.artists?.map(a => a.name).join(", ") || "Unknown Artist",
        preview_url: track.preview_url || null,
        open_url: track.external_urls?.spotify || "#", // ðŸ‘‰ Spotify link
        cover_image: albumCover,
      }));
    }

    // Playlist fetch
    const playlistRes = await fetch(
      `https://api.spotify.com/v1/playlists/${id}/tracks`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!playlistRes.ok) {
      console.error("âŒ Playlist fetch failed:", await playlistRes.text());
      return [];
    }

    const playlistData = await playlistRes.json();

    return (playlistData.items || []).map(item => ({
      title: item.track?.name || "Unknown Track",
      artist: item.track?.artists?.map(a => a.name).join(", ") || "Unknown Artist",
      preview_url: item.track?.preview_url || null,
      open_url: item.track?.external_urls?.spotify || "#", // ðŸ‘‰ Spotify link
      cover_image: item.track?.album?.images?.[0]?.url || "/images/default-cover.jpg",
    }));
  } catch (err) {
    console.error("âŒ Spotify fetch error:", err);
    return [];
  }
}

/**
 * Render Music Page
 */
module.exports.getMusicPage = async (req, res) => {
  try {
    // ðŸ”¹ Get client credentials token
    const clientToken = await getSpotifyToken();

    // ðŸ”¹ Get user's Spotify access token from session (if available)
    const userSpotifyToken = req.session.spotifyAccessToken || null;
    const hasSpotifyToken = !!userSpotifyToken;

    // Categories
    const categories = [
      {
        id: "sleep",
        title: "Sleep Therapy",
        description: "Calming music for better sleep",
        cover_url: "https://images.pexels.com/photos/1021876/pexels-photo-1021876.jpeg",
        type: process.env.DEFAULT_SPOTIFY_ALBUM_TYPE || "album",
        playlistId: process.env.DEFAULT_SPOTIFY_ALBUM_ID,
      },
      {
        id: "anxiety",
        title: "Anxiety Relief",
        description: "Therapeutic sounds for stress relief",
        cover_url: "https://images.pexels.com/photos/1054218/pexels-photo-1054218.jpeg",
        type: "playlist",
        playlistId: process.env.ANXIETY_PLAYLIST_ID,
      },
      {
        id: "focus",
        title: "Focus & Concentration",
        description: "Background music to enhance focus",
        cover_url: "https://images.pexels.com/photos/1181248/pexels-photo-1181248.jpeg",
        type: "local",
      },
    ];

    // Local fallback tracks
    const localSongs = [
      {
        id: "local1",
        title: "Local Calm Track",
        artist: "Unknown Artist1",
        preview_url: "/audio/Fido-Joy-Is-Coming.mp3",
        cover_image: "/images/local-cover.jpg",
        open_url: "#",
      },
      {
        id: "local2",
        title: "Local Focus Track",
        artist: "Unknown Artist2",
        preview_url: "/audio/Omah-Lay-Soso-feat-Ozuna.mp3",
        cover_image: "/images/local-cover.jpg",
        open_url: "#",
      },
    ];

    // Fetch remote + local songs
    const allSongs = {
      sleep: await fetchSpotifyTracks(
        process.env.DEFAULT_SPOTIFY_ALBUM_ID,
        process.env.DEFAULT_SPOTIFY_ALBUM_TYPE || "album",
        clientToken
      ),
      anxiety: await fetchSpotifyTracks(
        process.env.ANXIETY_PLAYLIST_ID,
        "playlist",
        clientToken
      ),
      focus: localSongs,
    };

    // Render page with all required variables
    res.render("pages/music", {
      title: "Music Therapy",
      user: req.session.user || null,
      categories,
      allSongs,
      spotifyEnabled: true, // flag for showing "Open in Spotify" buttons
      // ðŸ”¹ Add the missing variables that the template expects
      spotifyToken: userSpotifyToken, // User's access token for full playback
      hasSpotifyToken: hasSpotifyToken,
      tokenType: hasSpotifyToken ? 'user' : 'client'
    });
  } catch (err) {
    console.error("Error in getMusicPage:", err);
    res.render("pages/music", {
      title: "Music Therapy",
      user: req.session.user || null,
      categories: [],
      allSongs: {},
      spotifyEnabled: false,
      // ðŸ”¹ Add default values for error case
      spotifyToken: null,
      hasSpotifyToken: false,
      tokenType: 'none'
    });
  }
};