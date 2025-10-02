// controllers/socialAuthController.js
const db = require("../config/database");
const fetch = require("node-fetch");


// Google OAuth Configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI =
  process.env.NODE_ENV === "production"
    ? process.env.GOOGLE_REDIRECT_URI_PROD
    : process.env.GOOGLE_REDIRECT_URI_LOCAL ||
      `http://localhost:${process.env.PORT || 8080}/auth/google/callback`;

// Spotify OAuth Configuration (reusing your existing config)
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const SPOTIFY_AUTH_REDIRECT_URI =
  process.env.NODE_ENV === "production"
    ? process.env.SPOTIFY_AUTH_REDIRECT_URI_PROD ||
      process.env.SPOTIFY_REDIRECT_URI_PROD
    : process.env.SPOTIFY_AUTH_REDIRECT_URI_LOCAL ||
      `http://localhost:${process.env.PORT || 8080}/auth/spotify/callback`;

// Google OAuth - Initiate login
exports.googleLogin = (req, res) => {
  if (!GOOGLE_CLIENT_ID) {
    req.flash("error", "Google authentication is not configured");
    return res.redirect("/login");
  }

  const state = Buffer.from(
    JSON.stringify({
      timestamp: Date.now(),
      returnTo: req.query.returnTo || "/dashboard",
    })
  ).toString("base64");

  req.session.oauthState = state;

  const authURL = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authURL.searchParams.set("client_id", GOOGLE_CLIENT_ID);
  authURL.searchParams.set("redirect_uri", GOOGLE_REDIRECT_URI);
  authURL.searchParams.set("response_type", "code");
  authURL.searchParams.set("scope", "openid email profile");
  authURL.searchParams.set("state", state);
  authURL.searchParams.set("access_type", "offline");
  authURL.searchParams.set("prompt", "select_account");

  res.redirect(authURL.toString());
};

// Google OAuth - Handle callback
exports.googleCallback = async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    req.flash("error", `Google authentication failed: ${error}`);
    return res.redirect("/login");
  }

  if (!state || state !== req.session.oauthState) {
    req.flash("error", "Invalid authentication state");
    return res.redirect("/login");
  }

  delete req.session.oauthState;

  if (!code) {
    req.flash("error", "No authorization code received");
    return res.redirect("/login");
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        code: code,
        grant_type: "authorization_code",
        redirect_uri: GOOGLE_REDIRECT_URI,
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error("Failed to exchange code for token");
    }

    const tokenData = await tokenResponse.json();

    // Get user info from Google
    const userResponse = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      }
    );

    if (!userResponse.ok) {
      throw new Error("Failed to fetch user information");
    }

    const googleUser = await userResponse.json();

    // Find or create user in database
    const user = await findOrCreateSocialUser({
      email: googleUser.email,
      name: googleUser.name,
      provider: "google",
      providerId: googleUser.id,
      picture: googleUser.picture,
    });

    // Set up session
    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      profile_image: user.profile_image,
    };

    // Decode return URL from state
    try {
      const stateData = JSON.parse(Buffer.from(state, "base64").toString());
      const returnTo = stateData.returnTo || "/dashboard";

      req.flash("success", "Successfully signed in with Google!");
      res.redirect(getRedirectByRole(user.role, returnTo));
    } catch {
      req.flash("success", "Successfully signed in with Google!");
      res.redirect(getRedirectByRole(user.role));
    }
  } catch (error) {
    console.error("Google OAuth error:", error);
    req.flash("error", "Authentication failed. Please try again.");
    res.redirect("/login");
  }
};

// Spotify OAuth - Initiate login (for auth purposes)
exports.spotifyLogin = (req, res) => {
  if (!SPOTIFY_CLIENT_ID) {
    req.flash("error", "Spotify authentication is not configured");
    return res.redirect("/login");
  }

  const state = Buffer.from(
    JSON.stringify({
      timestamp: Date.now(),
      returnTo: req.query.returnTo || "/dashboard",
      purpose: "auth", // Distinguish from music integration
    })
  ).toString("base64");

  req.session.oauthState = state;

  const authURL = new URL("https://accounts.spotify.com/authorize");
  authURL.searchParams.set("client_id", SPOTIFY_CLIENT_ID);
  authURL.searchParams.set("response_type", "code");
  authURL.searchParams.set("redirect_uri", SPOTIFY_AUTH_REDIRECT_URI);
  authURL.searchParams.set("scope", "user-read-email user-read-private");
  authURL.searchParams.set("state", state);
  authURL.searchParams.set("show_dialog", "true");

  res.redirect(authURL.toString());
};

// Spotify OAuth - Handle callback (for auth purposes)
exports.spotifyCallback = async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    req.flash("error", `Spotify authentication failed: ${error}`);
    return res.redirect("/login");
  }

  if (!state || state !== req.session.oauthState) {
    req.flash("error", "Invalid authentication state");
    return res.redirect("/login");
  }

  delete req.session.oauthState;

  if (!code) {
    req.flash("error", "No authorization code received");
    return res.redirect("/login");
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch(
      "https://accounts.spotify.com/api/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization:
            "Basic " +
            Buffer.from(
              SPOTIFY_CLIENT_ID + ":" + SPOTIFY_CLIENT_SECRET
            ).toString("base64"),
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: code,
          redirect_uri: SPOTIFY_AUTH_REDIRECT_URI,
        }),
      }
    );

    if (!tokenResponse.ok) {
      throw new Error("Failed to exchange code for token");
    }

    const tokenData = await tokenResponse.json();

    // Get user info from Spotify
    const userResponse = await fetch("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userResponse.ok) {
      throw new Error("Failed to fetch user information");
    }

    const spotifyUser = await userResponse.json();

    // Find or create user in database
    const user = await findOrCreateSocialUser({
      email: spotifyUser.email,
      name: spotifyUser.display_name || spotifyUser.id,
      provider: "spotify",
      providerId: spotifyUser.id,
      picture: spotifyUser.images?.[0]?.url,
    });

    // Set up session
    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      profile_image: user.profile_image,
    };

    // Also store Spotify tokens for music integration if auth purpose
    try {
      const stateData = JSON.parse(Buffer.from(state, "base64").toString());
      if (stateData.purpose === "auth") {
        req.session.spotifyAccessToken = tokenData.access_token;
        req.session.spotifyRefreshToken = tokenData.refresh_token;
        req.session.spotifyTokenExpiry =
          Date.now() + tokenData.expires_in * 1000;
        console.log("🎵 Spotify tokens stored from social auth");
      }
    } catch (e) {
      console.log("No auth purpose in state, skipping music token storage");
    }

    // Decode return URL from state
    try {
      const stateData = JSON.parse(Buffer.from(state, "base64").toString());
      const returnTo = stateData.returnTo || "/dashboard";

      req.flash("success", "Successfully signed in with Spotify!");
      res.redirect(getRedirectByRole(user.role, returnTo));
    } catch {
      req.flash("success", "Successfully signed in with Spotify!");
      res.redirect(getRedirectByRole(user.role));
    }
  } catch (error) {
    console.error("Spotify OAuth error:", error);
    req.flash("error", "Authentication failed. Please try again.");
    res.redirect("/login");
  }
};

// Helper function to find or create social user
async function findOrCreateSocialUser({
  email,
  name,
  provider,
  providerId,
  picture,
}) {
  try {
    // Check if user exists with this email
    let existingUser = await db.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);

    if (existingUser.rows.length > 0) {
      const user = existingUser.rows[0];

      // Update profile image if provided and user doesn't have one
      if (picture && !user.profile_image) {
        await db.query(
          "UPDATE users SET profile_image = $1, updated_at = NOW() WHERE id = $2",
          [picture, user.id]
        );
        user.profile_image = picture;
      }

      return user;
    }

    // Create new user
    const query = `
      INSERT INTO users (name, email, role, profile_image, created_at, updated_at)
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      RETURNING *
    `;

    const result = await db.query(query, [
      name || "User",
      email,
      "patient", // Default role for social login
      picture || null,
    ]);

    return result.rows[0];
  } catch (error) {
    console.error("Error finding/creating social user:", error);
    throw error;
  }
}

// Helper function to get redirect URL based on role
function getRedirectByRole(role, defaultPath = null) {
  if (defaultPath && defaultPath !== "/dashboard") {
    return defaultPath;
  }

  switch (role) {
    case "admin":
      return "/admin";
    case "therapist":
      return "/therapist";
    case "patient":
    default:
      return "/dashboard";
  }
}
