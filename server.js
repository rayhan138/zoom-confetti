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
const SESSION_SECRET = process.env.SESSION_SECRET || 'zoom-confetti-dev-only-secret';
const REQUIRED_ZOOM_ENV = ['ZM_CLIENT_ID', 'ZM_CLIENT_SECRET', 'ZM_REDIRECT_URL'];

if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET is required when NODE_ENV=production');
}

let latestConfettiEventId = Date.now();
let latestConfettiEvent = {
  id: latestConfettiEventId,
  style: null,
  activeTheme: null,
  config: null,
  createdAt: null,
};
let cameraOverlaySettings = {
  version: 0,
  mirror: true,
  updatedAt: null,
};
let latestCameraDensityPing = {
  id: 0,
  build: null,
  phase: null,
  isCameraSurface: null,
  styleHint: null,
  multiplier: null,
  particleCount: null,
  scaledParticleCount: null,
  createdAt: null,
  userAgent: null,
};

app.disable('x-powered-by');
app.use(express.json());
app.use(cookieParser(SESSION_SECRET));

function getMissingZoomEnv() {
  return REQUIRED_ZOOM_ENV.filter((key) => !process.env[key]);
}

function sendMissingZoomEnv(res, missing) {
  return res.status(500).json({
    error: 'Zoom OAuth is not configured',
    missing,
    hint: 'Copy .env.example to .env and set the Zoom Marketplace credentials and redirect URL.',
  });
}

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

// Serve static files from public directory. During Zoom App development the
// desktop client can cache app assets aggressively, so keep them fresh.
app.use(express.static(path.join(__dirname, 'public'), {
  etag: false,
  lastModified: false,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-store');
  },
}));

app.get('/healthz', (req, res) => {
  res.json({
    ok: true,
    service: 'zoom-confetti',
    zoomOAuthConfigured: getMissingZoomEnv().length === 0,
  });
});

/**
 * 1. OAuth Install Route
 * Redirects the user to the Zoom OAuth authorize page.
 */
app.get('/api/zoom/install', (req, res) => {
  const missing = getMissingZoomEnv();
  if (missing.length > 0) {
    return sendMissingZoomEnv(res, missing);
  }

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
  const missing = getMissingZoomEnv();
  if (missing.length > 0) {
    return sendMissingZoomEnv(res, missing);
  }

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

app.post('/api/confetti/trigger', (req, res) => {
  const allowedStyles = new Set(['classic', 'fireworks', 'cannons', 'rain', 'custom', 'coordinate']);
  const { style, activeTheme, config } = req.body || {};

  if (!allowedStyles.has(style)) {
    return res.status(400).json({ error: 'Unknown confetti style' });
  }

  latestConfettiEvent = {
    id: ++latestConfettiEventId,
    style,
    activeTheme: typeof activeTheme === 'string' ? activeTheme : 'rainbow',
    config: config && typeof config === 'object' ? config : null,
    createdAt: new Date().toISOString(),
  };

  res.json({ ok: true, event: latestConfettiEvent });
});

app.get('/api/confetti/latest', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json(latestConfettiEvent);
});

app.get('/api/camera/settings', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json(cameraOverlaySettings);
});

app.post('/api/camera/settings', (req, res) => {
  const { mirror } = req.body || {};

  if (typeof mirror !== 'boolean') {
    return res.status(400).json({ error: 'mirror must be a boolean' });
  }

  cameraOverlaySettings = {
    version: cameraOverlaySettings.version + 1,
    mirror,
    updatedAt: new Date().toISOString(),
  };

  res.json({ ok: true, settings: cameraOverlaySettings });
});

app.post('/api/camera-density/ping', (req, res) => {
  const {
    build,
    phase,
    isCameraSurface,
    styleHint,
    multiplier,
    particleCount,
    scaledParticleCount,
  } = req.body || {};

  latestCameraDensityPing = {
    id: latestCameraDensityPing.id + 1,
    build: typeof build === 'string' ? build.slice(0, 80) : null,
    phase: typeof phase === 'string' ? phase.slice(0, 80) : null,
    isCameraSurface: typeof isCameraSurface === 'boolean' ? isCameraSurface : null,
    styleHint: typeof styleHint === 'string' ? styleHint.slice(0, 80) : null,
    multiplier: Number.isFinite(Number(multiplier)) ? Number(multiplier) : null,
    particleCount: Number.isFinite(Number(particleCount)) ? Number(particleCount) : null,
    scaledParticleCount: Number.isFinite(Number(scaledParticleCount)) ? Number(scaledParticleCount) : null,
    createdAt: new Date().toISOString(),
    userAgent: req.get('user-agent') || null,
  };

  res.json({ ok: true, ping: latestCameraDensityPing });
});

app.get('/api/camera-density/latest', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json(latestCameraDensityPing);
});

// Fallback for SPA Routing: Send index.html for any other non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Zoom Confetti App server is running on http://localhost:${PORT}`);
  console.log(`🔗 Make sure ngrok points to port ${PORT} (e.g., "ngrok http ${PORT}")`);
});
