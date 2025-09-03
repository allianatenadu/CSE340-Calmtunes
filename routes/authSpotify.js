const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const fetch = require("node-fetch");

// Spotify OAuth configuration
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

// 🔹 Fixed: Use environment-specific redirect URI
const REDIRECT_URI = process.env.NODE_ENV === 'production' 
  ? process.env.SPOTIFY_REDIRECT_URI_PROD 
  : process.env.SPOTIFY_REDIRECT_URI_LOCAL;

// Fallback to local if not set
const FINAL_REDIRECT_URI = REDIRECT_URI || "http://localhost:3001/spotify/callback";

// Required scopes for Web Playback SDK
const SCOPES = [
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
  "streaming",
  "user-read-email",
  "user-read-private"
].join(" ");

/**
 * Initiate Spotify OAuth login
 */
router.get("/login", (req, res) => {
  if (!SPOTIFY_CLIENT_ID) {
    return res.status(500).json({ error: "Spotify Client ID not configured" });
  }

  // Generate state for security
  const state = crypto.randomBytes(16).toString("hex");
  req.session.spotifyState = state;

  const authURL = new URL("https://accounts.spotify.com/authorize");
  authURL.searchParams.set("client_id", SPOTIFY_CLIENT_ID);
  authURL.searchParams.set("response_type", "code");
  authURL.searchParams.set("redirect_uri", FINAL_REDIRECT_URI);
  authURL.searchParams.set("scope", SCOPES);
  authURL.searchParams.set("state", state);
  authURL.searchParams.set("show_dialog", "true"); // Force re-auth dialog

  console.log("🔗 Redirecting to Spotify auth:", authURL.toString());
  console.log("🔑 Using redirect URI:", FINAL_REDIRECT_URI);
  res.redirect(authURL.toString());
});

/**
 * Handle Spotify OAuth callback
 */
router.get("/callback", async (req, res) => {
  const { code, state, error } = req.query;

  // Check for OAuth errors
  if (error) {
    console.error("❌ Spotify OAuth error:", error);
    req.flash("error", `Spotify authentication failed: ${error}`);
    return res.redirect("/music");
  }

  // Verify state to prevent CSRF attacks
  if (!state || state !== req.session.spotifyState) {
    console.error("❌ Invalid state parameter");
    req.flash("error", "Invalid authentication state");
    return res.redirect("/music");
  }

  // Clear the state from session
  delete req.session.spotifyState;

  if (!code) {
    console.error("❌ No authorization code received");
    req.flash("error", "No authorization code received");
    return res.redirect("/music");
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: "Basic " + Buffer.from(SPOTIFY_CLIENT_ID + ":" + SPOTIFY_CLIENT_SECRET).toString("base64"),
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: code,
        redirect_uri: FINAL_REDIRECT_URI, // 🔹 Use the same URI as in login
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error("❌ Token exchange failed:", errorData);
      req.flash("error", "Failed to exchange authorization code");
      return res.redirect("/music");
    }

    const tokenData = await tokenResponse.json();
    
    // Store tokens in session
    req.session.spotifyAccessToken = tokenData.access_token;
    req.session.spotifyRefreshToken = tokenData.refresh_token;
    req.session.spotifyTokenExpiry = Date.now() + (tokenData.expires_in * 1000);

    console.log("✅ Spotify tokens stored in session");
    console.log("🕐 Token expires in:", tokenData.expires_in, "seconds");

    req.flash("success", "Successfully connected to Spotify!");
    res.redirect("/music");

  } catch (error) {
    console.error("❌ Error during token exchange:", error);
    req.flash("error", "Authentication failed. Please try again.");
    res.redirect("/music");
  }
});

/**
 * Refresh Spotify access token
 */
router.get("/refresh", async (req, res) => {
  const refreshToken = req.session.spotifyRefreshToken;

  if (!refreshToken) {
    req.flash("error", "No refresh token available. Please log in again.");
    return res.redirect("/spotify/login");
  }

  try {
    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: "Basic " + Buffer.from(SPOTIFY_CLIENT_ID + ":" + SPOTIFY_CLIENT_SECRET).toString("base64"),
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      console.error("❌ Token refresh failed:", response.status);
      req.flash("error", "Failed to refresh token. Please log in again.");
      return res.redirect("/spotify/login");
    }

    const tokenData = await response.json();
    
    // Update session with new token
    req.session.spotifyAccessToken = tokenData.access_token;
    req.session.spotifyTokenExpiry = Date.now() + (tokenData.expires_in * 1000);
    
    // Update refresh token if provided
    if (tokenData.refresh_token) {
      req.session.spotifyRefreshToken = tokenData.refresh_token;
    }

    console.log("✅ Spotify token refreshed");
    req.flash("success", "Spotify connection refreshed!");
    res.redirect("/music");

  } catch (error) {
    console.error("❌ Error refreshing token:", error);
    req.flash("error", "Failed to refresh connection. Please log in again.");
    res.redirect("/spotify/login");
  }
});

/**
 * Logout/disconnect from Spotify
 */
router.get("/logout", (req, res) => {
  // Clear Spotify tokens from session
  delete req.session.spotifyAccessToken;
  delete req.session.spotifyRefreshToken;
  delete req.session.spotifyTokenExpiry;
  delete req.session.spotifyState;

  console.log("🔓 Spotify tokens cleared from session");
  req.flash("success", "Disconnected from Spotify");
  res.redirect("/music");
});

/**
 * Check if Spotify token is valid and not expired
 */
function isTokenValid(req) {
  const token = req.session.spotifyAccessToken;
  const expiry = req.session.spotifyTokenExpiry;
  
  if (!token) return false;
  if (!expiry) return true; // Assume valid if no expiry set
  
  return Date.now() < expiry;
}

/**
 * Middleware to check and refresh token if needed
 */
router.use("/check", async (req, res, next) => {
  if (!req.session.spotifyAccessToken) {
    return res.json({ connected: false, reason: "No token" });
  }

  if (!isTokenValid(req)) {
    console.log("🔄 Token expired, attempting refresh...");
    try {
      // Attempt to refresh token
      const refreshToken = req.session.spotifyRefreshToken;
      if (!refreshToken) {
        return res.json({ connected: false, reason: "Token expired, no refresh token" });
      }

      // Refresh logic here (similar to /refresh route)
      const response = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: "Basic " + Buffer.from(SPOTIFY_CLIENT_ID + ":" + SPOTIFY_CLIENT_SECRET).toString("base64"),
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
        }),
      });

      if (response.ok) {
        const tokenData = await response.json();
        req.session.spotifyAccessToken = tokenData.access_token;
        req.session.spotifyTokenExpiry = Date.now() + (tokenData.expires_in * 1000);
        console.log("✅ Token refreshed successfully");
      } else {
        return res.json({ connected: false, reason: "Token refresh failed" });
      }
    } catch (error) {
      console.error("❌ Token refresh error:", error);
      return res.json({ connected: false, reason: "Token refresh error" });
    }
  }

  res.json({ 
    connected: true, 
    token: req.session.spotifyAccessToken,
    expiresAt: req.session.spotifyTokenExpiry 
  });
});

module.exports = router;