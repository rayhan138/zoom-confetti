# 🎉 Zoom Confetti App

A premium, interactive celebration panel designed for teachers, presenters, and meeting hosts. Trigger multiple styles of beautiful confetti animations (Classic, Fireworks, Side Cannons, and overhead Rain) to congratulate your students or team members directly inside the Zoom client!

---

## 🛠️ Prerequisites

1.  **Node.js**: Verify installation using `node -v` (version 18+ recommended).
2.  **Zoom Developer Credentials**: Register a **General App** in the [Zoom App Marketplace](https://marketplace.zoom.us/) and obtain your **Client ID** and **Client Secret**.
3.  **Ngrok**: Zoom Apps must be served over secure HTTPS. Download and configure [ngrok](https://ngrok.com/) to tunnel your local port.

---

## 🚀 Quick Start Guide

### 1. Configure the Environment
Create a `.env` file at the root of the project using the template in `.env.example`:
```env
ZM_CLIENT_ID=your_client_id_here
ZM_CLIENT_SECRET=your_client_secret_here
ZM_REDIRECT_URL=https://your-ngrok-subdomain.ngrok-free.app/api/zoom/auth
SESSION_SECRET=some_random_secret_string
PORT=3000
```

### 2. Start the Secure Tunnel
Zoom requires secure connection frames. Open a terminal and start ngrok on port 3000:
```bash
ngrok http 3000
```
Copy the secure HTTPS URL provided by ngrok (e.g. `https://1234-abcd.ngrok-free.app`). Ensure this URL (with `/api/zoom/auth` appended) matches the `ZM_REDIRECT_URL` in your `.env` file!

### 3. Update Zoom Marketplace Settings
In your Zoom App Marketplace console (where you got your credentials):
1.  Navigate to **Basic Information** / **OAuth Information**.
2.  Set **Home URL** to your ngrok URL: `https://your-ngrok-subdomain.ngrok-free.app`
3.  Set **OAuth Redirect URL** to: `https://your-ngrok-subdomain.ngrok-free.app/api/zoom/auth`
4.  Navigate to **Features** -> **Zoom App** (ensure it's toggled ON).
5.  Set **Home URL** and **Redirect URL** there as well.

### 4. Run the Application
Install dependencies, compile the frontend, and run the Express server:
```bash
# Install dependencies
npm install

# Compile the React frontend
npm run build

# Start the Express server
node server.js
```
The server will boot up on `http://localhost:3000`. You can now open your ngrok URL in a browser to test the client in **Browser Sandbox Mode**, or load it directly in the Zoom Client to run the integrated app!

---

## 🎮 Features

*   **Preset Celebrations**: Quick-trigger buttons for Classic Bursts, Fireworks Shows, Side Cannons, and overhead Confetti Rain.
*   **Custom Designer**: Custom sliders to control particle count, launch speed, spread angle, gravity, and themed color palettes (Rainbow, Sunset, Ocean, Neon, Cyberpunk).
*   **Background Click Burst**: Click anywhere on the empty screen background to fire local, coordinate-based blasts.
*   **Status Panel**: Automatically detects and displays connection state and context details when loaded inside the Zoom client.
