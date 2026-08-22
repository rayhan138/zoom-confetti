# Zoom Confetti

A lightweight Zoom App that lets teachers, tutors, and meeting hosts trigger confetti inside a live Zoom meeting. The app has two surfaces:

- a sidebar control panel for the host
- a Zoom Camera Mode overlay so the celebration appears on the host video

The project is intentionally simple: Express serves a static frontend from `public/`, and the frontend uses the Zoom Apps SDK directly.

## Current status

This is a working development build. It is ready for developer review and local Zoom App testing, but it is not yet production-hosted or marketplace-submitted.

## Features

- Host control panel with preset effects: Nice work, Side pop, Rain, Firework, and Custom
- Zoom Camera Mode support using `runRenderingContext({ view: 'camera' })`
- Camera overlay drawing with `drawParticipant` and `drawWebView`
- Mirror camera preference for matching the Zoom preview
- Turn off overlay button for closing the camera rendering context
- Higher density confetti inside the camera canvas
- Fallback event polling between the sidebar and camera rendering context

## Tech stack

- Node.js 18+
- Express
- Zoom Apps SDK
- `canvas-confetti` served locally from `public/confetti.js`

## Project structure

```text
.
├── public/
│   ├── app.js          # Zoom Apps SDK integration and confetti controls
│   ├── confetti.js     # Local canvas-confetti library bundle
│   ├── index.html      # App shell
│   └── style.css       # Sidebar and camera overlay styles
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DEVELOPMENT.md
│   ├── RELEASE_CHECKLIST.md
│   └── ZOOM_MARKETPLACE_SETUP.md
├── server.js           # Express server, OAuth callback, and local sync APIs
├── .env.example        # Safe environment template
└── package.json
```

## Local setup

Install dependencies:

```bash
npm install
```

Create a local `.env` file:

```bash
cp .env.example .env
```

Fill in:

```env
ZM_CLIENT_ID=your_zoom_client_id_here
ZM_CLIENT_SECRET=your_zoom_client_secret_here
ZM_REDIRECT_URL=https://your-public-domain.example/api/zoom/auth
SESSION_SECRET=replace_with_a_long_random_secret
PORT=3000
```

Start the app:

```bash
npm run dev
```

The local server runs at:

```text
http://127.0.0.1:3000
```

## HTTPS tunnel for Zoom local testing

Zoom Apps must be served over HTTPS. Use one of these:

```bash
cloudflared tunnel --url http://127.0.0.1:3000
```

or:

```bash
ngrok http 3000
```

Use the generated HTTPS domain in Zoom Marketplace.

## Zoom Marketplace development URLs

If your public tunnel is:

```text
https://example.trycloudflare.com
```

then configure:

```text
Home URL:
https://example.trycloudflare.com

OAuth Redirect URL:
https://example.trycloudflare.com/api/zoom/auth

OAuth Allow List:
https://example.trycloudflare.com

Domain Allow List:
example.trycloudflare.com
appssdk.zoom.us
```

See [docs/ZOOM_MARKETPLACE_SETUP.md](docs/ZOOM_MARKETPLACE_SETUP.md) for the full checklist.

## Verify before sharing

Run:

```bash
npm run check
```

Make sure these files are never committed:

- `.env`
- tunnel logs
- local screenshots or recordings
- `tools/cloudflared.exe`

## Notes for reviewers

The most important logic lives in `public/app.js`:

- Zoom SDK configuration
- camera rendering context startup/shutdown
- `drawParticipant` / `drawWebView`
- sidebar-to-camera confetti messaging
- camera-density scaling

Start with [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) if you want to understand the flow before reading the code.
