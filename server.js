import express from 'express';
import axios from 'axios';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cookieParser(process.env.SESSION_SECRET || 'zoom-confetti-secret'));

// OWASP Security Headers required by Zoom
app.use((req, res, next) => {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'origin-when-cross-origin');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' https://appssdk.zoom.us https://cdn.jsdelivr.net; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "img-src 'self' data:; " +
    "connect-src 'self' https://zoom.us; " +
    "frame-ancestors 'self' https://*.zoom.us https://zoom.us;"
  );
  next();
});

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

/**
 * 1. OAuth Install Route
 * Redirects the user to the Zoom OAuth authorize page.
 */
app.get('/api/zoom/install', (req, res) => {
  const zoomAuthUrl = new URL('https://zoom.us/oauth/authorize');
  zoomAuthUrl.searchParams.append('response_type', 'code');
  zoomAuthUrl.searchParams.append('client_id', process.env.ZM_CLIENT_ID);
  zoomAuthUrl.searchParams.append('redirect_uri', process.env.ZM_REDIRECT_URL);

  res.redirect(zoomAuthUrl.toString());
});

/**
 * 2. OAuth Redirect Callback Route
 * Zoom redirects back here with a code parameter.
 * We exchange this code for an access token.
 */
app.get('/api/zoom/auth', async (req, res) => {
  const code = req.query.code;

  if (!code) {
    return res.status(400).send('Authorization code missing from Zoom redirect');
  }

  try {
    const authHeader = Buffer.from(
      `${process.env.ZM_CLIENT_ID}:${process.env.ZM_CLIENT_SECRET}`
    ).toString('base64');

    const tokenResponse = await axios.post(
      'https://zoom.us/oauth/token',
      null,
      {
        params: {
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: process.env.ZM_REDIRECT_URL,
        },
        headers: {
          Authorization: `Basic ${authHeader}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const { access_token, expires_in } = tokenResponse.data;

    // Store the access token securely in a signed HTTP-only cookie
    res.cookie('zoom_access_token', access_token, {
      httpOnly: true,
      secure: true, // Requires HTTPS (mandatory for Zoom Apps)
      sameSite: 'none', // Needed because Zoom Apps run in iframes
      signed: true,
      maxAge: expires_in * 1000,
    });

    // Redirect user back to the app home page
    res.redirect('/');
  } catch (error) {
    console.error('OAuth token exchange error:', error.response?.data || error.message);
    res.status(500).send('Failed to authenticate with Zoom: ' + (error.response?.data?.reason || error.message));
  }
});

/**
 * 3. App Status Route
 * Checks if the user has an active session cookie.
 */
app.get('/api/zoom/status', (req, res) => {
  const token = req.signedCookies.zoom_access_token;
  res.json({ isAuthenticated: !!token });
});

// Fallback for SPA Routing: Send index.html for any other non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Zoom Confetti App server is running on http://localhost:${PORT}`);
  console.log(`🔗 Make sure ngrok points to port ${PORT} (e.g., "ngrok http ${PORT}")`);
});
