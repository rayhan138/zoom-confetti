# Development

## Prerequisites

- Node.js 18 or newer
- Zoom desktop client
- Zoom Marketplace developer account
- HTTPS tunnel tool such as Cloudflare Tunnel or ngrok

## Install

```bash
npm install
```

## Environment

Create `.env` from `.env.example`.

Required for OAuth testing:

```env
ZM_CLIENT_ID=...
ZM_CLIENT_SECRET=...
ZM_REDIRECT_URL=https://your-public-domain.example/api/zoom/auth
SESSION_SECRET=...
PORT=3000
```

The app can still open in browser sandbox mode without OAuth credentials, but Zoom install/auth routes need the values above.

## Run locally

```bash
npm run dev
```

Open:

```text
http://127.0.0.1:3000
```

## Run a tunnel

Cloudflare Tunnel:

```bash
cloudflared tunnel --url http://127.0.0.1:3000
```

ngrok:

```bash
ngrok http 3000
```

Update `.env` and Zoom Marketplace with the new public URL.

## Check syntax

```bash
npm run check
```

This checks:

- `server.js`
- `public/app.js`

## Manual Zoom test

1. Start the local server.
2. Start the HTTPS tunnel.
3. Update Zoom Marketplace development URLs.
4. Open the app through Local Test in Zoom.
5. Start a meeting.
6. Open the Zoom App panel.
7. Click `Enable camera overlay`.
8. Wait for the brief camera blink/flash.
9. Trigger `Nice work`, `Side pop`, `Rain`, and `Firework`.
10. Click `Turn off overlay` and confirm the normal camera view returns.

## Troubleshooting

### App opens in browser mode

This is normal outside Zoom. Real Zoom SDK behavior only works inside the Zoom desktop client.

### Old UI keeps showing

Zoom can cache app assets during development. Restart the Zoom app, close/reopen the Zoom App panel, or change the script cache-busting query in `public/index.html`.

### Confetti appears in the sidebar but not the camera

Check:

- the camera overlay badge
- whether `drawWebView` succeeded
- whether the app is running in `inCamera`
- `/api/camera-density/latest` for the last camera density ping

### Camera appears mirrored incorrectly

Change the `Mirror camera` toggle before starting the overlay, then stop and re-enable the overlay.
