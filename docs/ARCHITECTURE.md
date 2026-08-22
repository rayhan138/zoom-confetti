# Architecture

Zoom Confetti is a small Express + static frontend Zoom App. It does not use React, Vite, or a build step.

## Runtime surfaces

### 1. Zoom sidebar controller

The normal app panel runs inside the Zoom client as the host control surface. It shows:

- Zoom connection status
- camera overlay start/stop controls
- mirror preference
- confetti effect buttons
- color and intensity controls

### 2. Zoom Camera Mode renderer

When the host clicks `Enable camera overlay`, the sidebar calls:

```js
zoomSdk.runRenderingContext({ view: 'camera' })
```

Zoom opens a separate camera rendering context. In that context the app:

1. detects `runningContext === 'inCamera'`
2. hides the sidebar UI
3. keeps the document transparent
4. tries to draw the host camera layer with `drawParticipant`
5. draws the app webview with `drawWebView`
6. listens for confetti trigger messages

## Video composition

The intended camera layer order is:

```text
zIndex 1: host camera via drawParticipant
zIndex 2: transparent app webview with confetti canvas
```

This lets the host camera stay visible while confetti renders above it.

## Messaging flow

The sidebar sends confetti events through several paths because Zoom's camera rendering context can behave differently across client versions:

1. `BroadcastChannel` for local/browser testing
2. Zoom SDK `postMessage` for sidebar-to-camera communication
3. server fallback API:
   - `POST /api/confetti/trigger`
   - `GET /api/confetti/latest`

The camera context polls the latest server event as a fallback so effects can still reach the camera canvas.

## Camera controls

The host can:

- enable the camera overlay
- set mirror preference before launch
- turn off the camera overlay with `closeRenderingContext`

If direct closing fails, the sidebar attempts to ask the camera context to stop through Zoom SDK messaging.

## Server responsibilities

`server.js` handles:

- static file serving with no-store cache headers
- Zoom OAuth install and callback routes
- signed cookie storage for the Zoom access token
- camera mirror preference sync
- confetti event fallback sync
- camera density diagnostics

## Important files

```text
server.js
  Express app, OAuth, static hosting, fallback APIs

public/index.html
  DOM structure for the Zoom App panel and camera overlay elements

public/app.js
  Zoom Apps SDK integration, controls, camera mode, confetti effects

public/style.css
  Dark sidebar UI and transparent camera mode styling

public/confetti.js
  Local canvas-confetti library bundle
```

## Known development behavior

- Zoom Camera Mode may briefly blink/flash when the rendering context starts. This is expected during initialization.
- The development tunnel URL changes when the tunnel restarts unless a permanent domain is configured.
- The app should be tested inside the Zoom desktop client. Browser mode only tests the static UI and local confetti.
