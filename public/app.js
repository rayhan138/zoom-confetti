// Error loggers for remote debugging
window.addEventListener('error', (e) => {
  const debugDiv = document.createElement('div');
  debugDiv.style.background = 'rgba(255, 0, 0, 0.15)';
  debugDiv.style.border = '1px solid #f87171';
  debugDiv.style.color = '#f87171';
  debugDiv.style.padding = '10px';
  debugDiv.style.margin = '10px 0';
  debugDiv.style.borderRadius = '8px';
  debugDiv.style.fontFamily = 'monospace';
  debugDiv.style.fontSize = '12px';
  debugDiv.innerText = `Error: ${e.message} at ${e.filename || (e.target && e.target.src)}:${e.lineno || ''}`;
  
  const container = document.querySelector('.app-container');
  if (container) container.appendChild(debugDiv);
});

window.addEventListener('unhandledrejection', (e) => {
  const debugDiv = document.createElement('div');
  debugDiv.style.background = 'rgba(255, 0, 0, 0.15)';
  debugDiv.style.border = '1px solid #f87171';
  debugDiv.style.color = '#f87171';
  debugDiv.style.padding = '10px';
  debugDiv.style.margin = '10px 0';
  debugDiv.style.borderRadius = '8px';
  debugDiv.style.fontFamily = 'monospace';
  debugDiv.style.fontSize = '12px';
  debugDiv.innerText = `Promise Rejection: ${e.reason}`;
  
  const container = document.querySelector('.app-container');
  if (container) container.appendChild(debugDiv);
});

// State & Communication Channel
const APP_BUILD = 'human-dark-ui-stop-button-2026-08-22-01';
const CAMERA_DENSITY_BUILD = APP_BUILD;
const MIRROR_STORAGE_KEY = 'zoomConfettiMirrorOverlayCamera';
let activeTheme = 'rainbow';
const THEME_COLORS = {
  rainbow: ['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF', '#4B0082', '#8B00FF'],
  sunset: ['#FF5E62', '#FF9966', '#FFD97D', '#EA2027'],
  ocean: ['#00c6ff', '#0072ff', '#00F2FE', '#0575E6'],
  neon: ['#39FF14', '#00FFFF', '#FF007F', '#FF00FF'],
  cyberpunk: ['#f72585', '#7209b7', '#3f37c9', '#4cc9f0']
};

let isFireworksPlaying = false;
let isCameraView = false;
let cameraModeLaunchInProgress = false;
let cameraModeActive = false;
let cameraModeStopAvailable = false;
let latestRemoteConfettiId = 0;
let remoteConfettiPollTimer = null;
const reportedCameraDensityStyles = new Set();

// BroadcastChannel for local browser testing
const confettiChannel = new BroadcastChannel('zoom_confetti_channel');

// Helper: Random in range
function randomInRange(min, max) {
  return Math.random() * (max - min) + min;
}

// The Zoom Camera Mode renderer is a separate CEF/WebView process from the
// sidebar. Apply its density explicitly here rather than relying on a cached
// auxiliary script being present in that separate process.
function isCameraSurface() {
  return isCameraView
    || document.documentElement.classList.contains('in-camera')
    || document.body.classList.contains('in-camera');
}

function getCameraStyleHint(options = {}) {
  const origin = options.origin || {};
  const originX = Number(origin.x);
  const originY = Number(origin.y);
  const angle = Number(options.angle);
  const spread = Number(options.spread) || 0;
  const startVelocity = Number(options.startVelocity) || 0;
  const particleCount = Number(options.particleCount) || 0;

  if (Number.isFinite(angle) && Number.isFinite(originX) && (originX <= 0.1 || originX >= 0.9)) {
    return 'side-cannons';
  }
  if (Number.isFinite(originY) && originY <= -0.05 && startVelocity <= 12) {
    return 'rain';
  }
  if (spread >= 300) return 'fireworks';
  if (particleCount >= 200) return 'classic-or-custom';
  return 'small-burst';
}

function getCameraDensityMultiplier(styleHint) {
  if (styleHint === 'side-cannons') return 5.8;
  if (styleHint === 'rain') return 6.2;
  if (styleHint === 'fireworks') return 2.7;
  if (styleHint === 'classic-or-custom') return 3.4;
  return 3.2;
}

function reportCameraDensity(details) {
  fetch('/api/camera-density/ping', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      build: CAMERA_DENSITY_BUILD,
      isCameraSurface: true,
      ...details
    }),
    keepalive: true
  }).catch((err) => {
    console.warn('[Zoom Confetti] camera density diagnostic failed:', err);
  });
}

function showCameraDensityBadge(styleHint, multiplier) {
  const badgeText = document.getElementById('camera-badge-text');
  if (!badgeText) return;

  const labels = {
    'side-cannons': '🚀 Side Cannons',
    rain: '🌧️ Confetti Rain',
    fireworks: '🎆 Fireworks',
    'classic-or-custom': '✨ Confetti Burst',
    'small-burst': '✨ Confetti Burst'
  };
  badgeText.textContent = `${labels[styleHint] || '✨ Confetti'} ×${multiplier} camera density`;
}

function fireConfetti(options) {
  if (typeof window.confetti !== 'function') {
    console.error('[Zoom Confetti] canvas-confetti is unavailable.');
    return;
  }

  if (!isCameraSurface() || !options || typeof options !== 'object') {
    return window.confetti(options);
  }

  const styleHint = getCameraStyleHint(options);
  const multiplier = getCameraDensityMultiplier(styleHint);
  const baseCount = Number(options.particleCount) || 0;
  const nextOptions = { ...options };

  if (baseCount > 0) {
    nextOptions.particleCount = Math.min(1400, Math.round(baseCount * multiplier));
  }
  if (typeof nextOptions.ticks === 'number') {
    nextOptions.ticks = Math.round(nextOptions.ticks * (multiplier >= 5.8 ? 1.18 : 1.1));
  }
  if (typeof nextOptions.scalar === 'number') {
    nextOptions.scalar = Math.min(1.18, nextOptions.scalar * (multiplier >= 5.8 ? 1.06 : 1.03));
  }

  // Camera Mode has its own CEF reduced-motion environment. The host actively
  // pressed an effect control, so do not let that environment suppress it.
  nextOptions.disableForReducedMotion = false;

  if (!reportedCameraDensityStyles.has(styleHint)) {
    reportedCameraDensityStyles.add(styleHint);
    reportCameraDensity({
      phase: 'camera-confetti',
      styleHint,
      multiplier,
      particleCount: baseCount,
      scaledParticleCount: Number(nextOptions.particleCount) || 0
    });
    showCameraDensityBadge(styleHint, multiplier);
  }

  return window.confetti(nextOptions);
}

window.ZOOM_CONFETTI_CAMERA_DENSITY_BUILD = CAMERA_DENSITY_BUILD;

// Helper: Show HTML Notification Banner
function showNotification(message, type = 'info') {
  const banner = document.getElementById('notification-banner');
  if (banner) {
    banner.innerText = message;
    banner.className = `notification-banner ${type}`;
    banner.style.display = 'block';
  }
}

function readMirrorPreference() {
  try {
    const saved = window.localStorage.getItem(MIRROR_STORAGE_KEY);
    if (saved === 'true') return true;
    if (saved === 'false') return false;
  } catch (err) {
    console.warn('Could not read mirror preference:', err);
  }

  return true;
}

function writeMirrorPreference(mirror) {
  try {
    window.localStorage.setItem(MIRROR_STORAGE_KEY, String(Boolean(mirror)));
  } catch (err) {
    console.warn('Could not save mirror preference:', err);
  }
}

function getCameraSettingsFromUi() {
  const mirrorToggle = document.getElementById('mirror-toggle');
  return {
    mirror: mirrorToggle ? mirrorToggle.checked : readMirrorPreference()
  };
}

async function saveCameraSettings(settings = getCameraSettingsFromUi()) {
  writeMirrorPreference(settings.mirror);

  try {
    await fetch('/api/camera/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
  } catch (err) {
    console.warn('Could not sync camera settings to server:', err);
  }

  if (typeof window !== 'undefined' && window.zoomSdk?.postMessage) {
    window.zoomSdk.postMessage({
      type: 'camera-settings',
      settings
    }).catch(() => {});
  }
}

async function loadCameraSettings() {
  const fallback = { mirror: readMirrorPreference() };

  try {
    const response = await fetch('/api/camera/settings', { cache: 'no-store' });
    if (!response.ok) throw new Error(`camera settings HTTP ${response.status}`);
    const settings = await response.json();
    if (typeof settings.mirror === 'boolean') {
      return { mirror: settings.mirror };
    }
  } catch (err) {
    console.warn('Could not load camera settings from server:', err);
  }

  return fallback;
}

function setCameraControlsState(state, message = '') {
  const cameraButton = document.getElementById('btn-camera-mode');
  const stopButton = document.getElementById('btn-stop-camera');

  cameraModeLaunchInProgress = state === 'starting';
  cameraModeActive = state === 'active';
  cameraModeStopAvailable = state === 'starting' || state === 'active' || state === 'retry';

  if (cameraButton) {
    if (state === 'starting') {
      cameraButton.disabled = true;
      cameraButton.textContent = 'Starting camera overlay...';
    } else if (state === 'active') {
      cameraButton.disabled = true;
      cameraButton.textContent = 'Camera overlay active';
    } else if (state === 'retry') {
      cameraButton.disabled = false;
      cameraButton.textContent = 'Retry camera overlay';
    } else {
      cameraButton.disabled = false;
      cameraButton.textContent = 'Enable camera overlay';
    }
  }

  if (stopButton) {
    stopButton.disabled = !cameraModeStopAvailable;
    stopButton.classList.toggle('is-ready', cameraModeStopAvailable);
    stopButton.setAttribute('aria-disabled', String(!cameraModeStopAvailable));

    if (state === 'starting') {
      stopButton.textContent = 'Cancel overlay';
      stopButton.title = 'Ask Zoom to close the camera overlay while it is starting.';
    } else if (state === 'active' || state === 'retry') {
      stopButton.textContent = 'Turn off overlay';
      stopButton.title = 'Close the confetti camera overlay and return to your normal Zoom camera.';
    } else {
      stopButton.textContent = 'Overlay off';
      stopButton.title = 'The confetti camera overlay is not running.';
    }
  }

  if (message) {
    const type = state === 'active' ? 'success' : state === 'retry' ? 'error' : 'info';
    showNotification(message, type);
  }
}

async function requestCameraOverlayStop({ fromMessage = false } = {}) {
  const sdk = window.zoomSdk;
  let directError = null;

  if (sdk?.closeRenderingContext) {
    try {
      await Promise.race([
        sdk.closeRenderingContext(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Stop overlay timed out')), 7000))
      ]);
      return { stopped: true, method: 'closeRenderingContext' };
    } catch (err) {
      directError = err;
      console.warn('closeRenderingContext failed:', err);
    }
  }

  if (!fromMessage && sdk?.postMessage) {
    try {
      await sdk.postMessage({ type: 'camera-stop', requestedAt: Date.now() });
      return { stopped: false, method: 'postMessage' };
    } catch (err) {
      directError = directError || err;
      console.warn('camera-stop postMessage failed:', err);
    }
  }

  throw directError || new Error('Stop overlay is available only inside the Zoom desktop client.');
}

// Helper: Broadcast confetti triggers to other frames/contexts
function broadcastConfetti(style, config = null) {
  const payload = { type: 'trigger', style, activeTheme, config };

  // 1. Send via local BroadcastChannel (for Chrome browser sandboxes)
  confettiChannel.postMessage(payload);

  // 2. Send via Zoom SDK postMessage (for cross-process Zoom Sidebar <-> Camera Overlay)
  if (typeof window !== 'undefined' && window.zoomSdk && window.zoomSdk.postMessage) {
    window.zoomSdk.postMessage(payload).catch(err => {
      console.warn('Zoom postMessage failed:', err);
    });
  }

  // 3. Same-origin fallback for Zoom camera rendering contexts where postMessage
  // can resolve without reaching the separate camera WebView process.
  fetch('/api/confetti/trigger', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ style, activeTheme, config })
  }).catch(err => {
    console.warn('Confetti trigger fallback failed:', err);
  });
}

async function startRemoteConfettiPolling(sendLog = () => {}) {
  if (remoteConfettiPollTimer) return;

  const readLatest = async () => {
    const response = await fetch('/api/confetti/latest', { cache: 'no-store' });
    if (!response.ok) throw new Error(`latest confetti HTTP ${response.status}`);
    return response.json();
  };

  try {
    const latest = await readLatest();
    latestRemoteConfettiId = Number(latest.id) || 0;
    sendLog(`Remote confetti fallback armed at event ${latestRemoteConfettiId}.`);
  } catch (err) {
    sendLog(`Remote confetti fallback could not initialize: ${err.message || String(err)}`, true);
  }

  remoteConfettiPollTimer = setInterval(async () => {
    try {
      const latest = await readLatest();
      const latestId = Number(latest.id) || 0;
      if (!latest.style || latestId <= latestRemoteConfettiId) return;

      latestRemoteConfettiId = latestId;
      handleTriggerMessage({
        type: 'trigger',
        style: latest.style,
        activeTheme: latest.activeTheme,
        config: latest.config
      });
    } catch (err) {
      console.warn('Remote confetti fallback polling failed:', err);
    }
  }, 300);
}

// 🔊 Web Audio API Synthesizer Pop Sounds
function playConfettiSound(style) {
  // Do not play sounds in the transparent camera view itself (only play in controller)
  if (isCameraView) return;

  const isAudioEnabled = document.getElementById('audio-toggle').checked;
  if (!isAudioEnabled) return;

  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  
  const playPop = (pitch, delay, panValue = 0) => {
    setTimeout(() => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(pitch, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(pitch * 1.5, audioCtx.currentTime + 0.12);
      
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
      
      let destination = audioCtx.destination;
      if (audioCtx.createStereoPanner) {
        const panner = audioCtx.createStereoPanner();
        panner.pan.setValueAtTime(panValue, audioCtx.currentTime);
        panner.connect(audioCtx.destination);
        destination = panner;
      }
      
      osc.connect(gain);
      gain.connect(destination);
      
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    }, delay);
  };

  if (style === 'classic') {
    playPop(220, 0);
    playPop(330, 40);
    playPop(440, 80);
  } else if (style === 'fireworks') {
    for (let i = 0; i < 6; i++) {
      playPop(randomInRange(250, 550), i * 160, randomInRange(-0.7, 0.7));
    }
  } else if (style === 'cannons') {
    playPop(180, 0, -0.85);
    playPop(180, 80, 0.85);
    playPop(240, 150, -0.5);
    playPop(240, 230, 0.5);
  } else if (style === 'rain') {
    for (let i = 0; i < 8; i++) {
      playPop(randomInRange(800, 1200), i * 180, randomInRange(-0.85, 0.85));
    }
  } else {
    playPop(260, 0);
  }
}

// --- Confetti Animations & Broadcasting ---

// 1. Classic Center Burst
function triggerClassic(shouldBroadcast = true) {
  fireConfetti({
    particleCount: 240,
    spread: 86,
    startVelocity: 44,
    gravity: 0.88,
    ticks: 190,
    scalar: 0.95,
    disableForReducedMotion: true,
    origin: { y: 0.6 },
    colors: THEME_COLORS[activeTheme],
    zIndex: 9999
  });
  playConfettiSound('classic');

  if (shouldBroadcast) {
    broadcastConfetti('classic');
  }
}

// 2. Fireworks Show
function triggerFireworks(shouldBroadcast = true) {
  if (isFireworksPlaying) return;
  isFireworksPlaying = true;

  const duration = 5 * 1000;
  const animationEnd = Date.now() + duration;
  const defaults = {
    startVelocity: 32,
    spread: 360,
    ticks: 105,
    scalar: 0.9,
    disableForReducedMotion: true,
    zIndex: 9999
  };

  playConfettiSound('fireworks');
  setTimeout(() => {
    if (Date.now() < animationEnd) playConfettiSound('fireworks');
  }, 1500);

  const interval = setInterval(() => {
    const timeLeft = animationEnd - Date.now();

    if (timeLeft <= 0) {
      isFireworksPlaying = false;
      return clearInterval(interval);
    }

    const count = Math.max(26, Math.floor(96 * (timeLeft / duration)));

    fireConfetti({
      ...defaults,
      particleCount: count,
      origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
      colors: THEME_COLORS[activeTheme]
    });
    fireConfetti({
      ...defaults,
      particleCount: count,
      origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
      colors: THEME_COLORS[activeTheme]
    });
  }, 260);

  if (shouldBroadcast) {
    broadcastConfetti('fireworks');
  }
}

// 3. Side Cannons
function triggerCannons(shouldBroadcast = true) {
  const duration = 3.2 * 1000;
  const end = Date.now() + duration;
  
  playConfettiSound('cannons');
  
  const interval = setInterval(() => {
    fireConfetti({
      particleCount: 10,
      angle: 58,
      spread: 72,
      startVelocity: 54,
      gravity: 0.82,
      ticks: 210,
      scalar: 0.9,
      disableForReducedMotion: true,
      origin: { x: 0, y: randomInRange(0.58, 0.86) },
      colors: THEME_COLORS[activeTheme],
      zIndex: 9999
    });
    fireConfetti({
      particleCount: 10,
      angle: 122,
      spread: 72,
      startVelocity: 54,
      gravity: 0.82,
      ticks: 210,
      scalar: 0.9,
      disableForReducedMotion: true,
      origin: { x: 1, y: randomInRange(0.58, 0.86) },
      colors: THEME_COLORS[activeTheme],
      zIndex: 9999
    });
    fireConfetti({
      particleCount: 4,
      angle: 75,
      spread: 95,
      startVelocity: 42,
      gravity: 0.76,
      ticks: 220,
      scalar: 0.84,
      disableForReducedMotion: true,
      origin: { x: 0.08, y: randomInRange(0.42, 0.78) },
      colors: THEME_COLORS[activeTheme],
      zIndex: 9999
    });
    fireConfetti({
      particleCount: 4,
      angle: 105,
      spread: 95,
      startVelocity: 42,
      gravity: 0.76,
      ticks: 220,
      scalar: 0.84,
      disableForReducedMotion: true,
      origin: { x: 0.92, y: randomInRange(0.42, 0.78) },
      colors: THEME_COLORS[activeTheme],
      zIndex: 9999
    });

    if (Date.now() >= end) {
      clearInterval(interval);
    }
  }, 55);

  if (shouldBroadcast) {
    broadcastConfetti('cannons');
  }
}

// 4. Confetti Rain
function triggerRain(shouldBroadcast = true) {
  const duration = 5.5 * 1000;
  const end = Date.now() + duration;
  
  playConfettiSound('rain');
  setTimeout(() => {
    if (Date.now() < end) playConfettiSound('rain');
  }, 1800);

  const interval = setInterval(() => {
    fireConfetti({
      particleCount: 5,
      spread: 115,
      startVelocity: 9,
      gravity: 0.7,
      ticks: 260,
      scalar: 0.86,
      disableForReducedMotion: true,
      origin: { x: Math.random(), y: -0.1 },
      colors: THEME_COLORS[activeTheme],
      zIndex: 9999
    });
    fireConfetti({
      particleCount: 3,
      spread: 55,
      startVelocity: 7,
      gravity: 0.64,
      ticks: 240,
      scalar: 0.78,
      disableForReducedMotion: true,
      origin: { x: randomInRange(0.08, 0.92), y: -0.08 },
      colors: THEME_COLORS[activeTheme],
      zIndex: 9999
    });

    if (Date.now() >= end) {
      clearInterval(interval);
    }
  }, 60);

  if (shouldBroadcast) {
    broadcastConfetti('rain');
  }
}

// 5. Custom Confetti Burst
function triggerCustom(shouldBroadcast = true, config = null) {
  let count, spread, velocity, gravity;
  
  if (config) {
    count = config.count;
    spread = config.spread;
    velocity = config.velocity;
    gravity = config.gravity;
  } else {
    count = parseInt(document.getElementById('slider-particle').value);
    spread = parseInt(document.getElementById('slider-spread').value);
    velocity = parseInt(document.getElementById('slider-velocity').value);
    gravity = parseFloat(document.getElementById('slider-gravity').value);
  }

  fireConfetti({
    particleCount: count,
    spread: spread,
    startVelocity: velocity,
    gravity: gravity,
    ticks: 190,
    scalar: 0.95,
    disableForReducedMotion: true,
    colors: THEME_COLORS[activeTheme],
    origin: { y: 0.6 },
    zIndex: 9999
  });
  
  playConfettiSound('custom');

  if (shouldBroadcast) {
    broadcastConfetti('custom', { count, spread, velocity, gravity });
  }
}

// 6. Fullscreen coordinates trigger
function triggerAtCoordinate(x, y, shouldBroadcast = true) {
  fireConfetti({
    particleCount: 130,
    spread: 70,
    startVelocity: 40,
    gravity: 0.85,
    ticks: 170,
    scalar: 0.9,
    disableForReducedMotion: true,
    origin: { x: x, y: y },
    colors: THEME_COLORS[activeTheme],
    zIndex: 9999
  });
  playConfettiSound('custom');

  if (shouldBroadcast) {
    broadcastConfetti('coordinate', { x, y });
  }
}

// --- Handler: Processes Trigger Payload (Shared by both listeners) ---
function handleTriggerMessage(data) {
  const { style, activeTheme: msgTheme, config } = data;
  
  // Show in-camera celebration banner if present
  const banner = document.getElementById('camera-celebration-banner');
  const bannerText = document.getElementById('camera-banner-text');
  if (banner && bannerText) {
    if (style === 'classic') bannerText.innerText = '🎉 Congratulations!';
    else if (style === 'fireworks') bannerText.innerText = '🎆 Amazing Work!';
    else if (style === 'cannons') bannerText.innerText = '🚀 Super Star!';
    else if (style === 'rain') bannerText.innerText = '🌧️ Celebration Time!';
    else bannerText.innerText = '✨ Great Job!';
    
    banner.classList.add('active');
    setTimeout(() => {
      banner.classList.remove('active');
    }, 4500);
  }

  // Sync theme temporarily
  const oldTheme = activeTheme;
  if (msgTheme) activeTheme = msgTheme;
  
  if (style === 'classic') {
    triggerClassic(false);
  } else if (style === 'fireworks') {
    triggerFireworks(false);
  } else if (style === 'cannons') {
    triggerCannons(false);
  } else if (style === 'rain') {
    triggerRain(false);
  } else if (style === 'custom') {
    triggerCustom(false, config);
  } else if (style === 'coordinate') {
    triggerAtCoordinate(config.x, config.y, false);
  }
  
  activeTheme = oldTheme;
}

// --- Listen on BroadcastChannel (for Chrome browser sandbox tab syncing) ---
confettiChannel.onmessage = (e) => {
  if (e.data && e.data.type === 'trigger') {
    handleTriggerMessage(e.data);
  }
};

// --- Bind HTML Event Listeners ---

document.getElementById('btn-classic').addEventListener('click', () => triggerClassic());
document.getElementById('btn-fireworks').addEventListener('click', () => triggerFireworks());
document.getElementById('btn-cannons').addEventListener('click', () => triggerCannons());
document.getElementById('btn-rain').addEventListener('click', () => triggerRain());
document.getElementById('btn-custom').addEventListener('click', () => triggerCustom());

const mirrorToggle = document.getElementById('mirror-toggle');
if (mirrorToggle) {
  mirrorToggle.checked = readMirrorPreference();
  mirrorToggle.addEventListener('change', () => {
    saveCameraSettings({ mirror: mirrorToggle.checked });
    showNotification(
      cameraModeActive
        ? 'Mirror preference saved. Stop and re-enable overlay to redraw the camera layer.'
        : 'Mirror preference saved for the next camera overlay launch.',
      'info'
    );
  });
}

document.getElementById('btn-stop-camera').addEventListener('click', async () => {
  if (typeof window === 'undefined' || !window.zoomSdk) {
    showNotification('Stop overlay is available only inside the Zoom desktop client.', 'error');
    return;
  }

  if (!cameraModeStopAvailable) {
    showNotification('Camera overlay is already off.', 'info');
    return;
  }

  const stopButton = document.getElementById('btn-stop-camera');
  const fallbackState = cameraModeActive ? 'active' : 'retry';

  try {
    if (stopButton) {
      stopButton.disabled = true;
      stopButton.textContent = 'Turning off...';
    }
    showNotification('Stopping camera overlay…', 'info');
    const result = await requestCameraOverlayStop();
    setCameraControlsState(
      'idle',
      result.stopped
        ? 'Camera overlay stopped. Your normal Zoom camera is back.'
        : 'Stop request sent to the camera overlay. If the badge remains, refresh the app once.'
    );
  } catch (e) {
    console.error('Failed to stop camera overlay:', e);
    setCameraControlsState(fallbackState);
    showNotification('Could not stop overlay from the app. Close the app panel if Zoom keeps it active: ' + (e.message || String(e)), 'error');
  }
});

// Background click overlay
document.getElementById('click-overlay').addEventListener('click', (e) => {
  if (e.target.id === 'click-overlay' || e.target.className === 'app-container') {
    const x = e.clientX / window.innerWidth;
    const y = e.clientY / window.innerHeight;
    triggerAtCoordinate(x, y);
  }
});

// Share App Screen click handler
document.getElementById('btn-share').addEventListener('click', async () => {
  if (typeof window !== 'undefined' && window.zoomSdk) {
    try {
      console.log('Initiating App Screen Share...');
      await window.zoomSdk.shareApp();
    } catch (e) {
      console.error('Failed to share app:', e);
      showNotification('Failed to start sharing: ' + (e.message || String(e)), 'error');
    }
  }
});

// Enable Camera Overlay click handler
document.getElementById('btn-camera-mode').addEventListener('click', async () => {
  if (typeof window === 'undefined' || !window.zoomSdk) {
    showNotification('Camera Mode is available only inside the Zoom desktop client.', 'error');
    return;
  }

  if (cameraModeLaunchInProgress) {
    showNotification('Camera Mode is already starting. Please wait before trying again.', 'info');
    return;
  }

  const cameraButton = document.getElementById('btn-camera-mode');
  await saveCameraSettings(getCameraSettingsFromUi());
  setCameraControlsState('starting', 'Starting camera overlay…');

  try {
    console.log('Enabling Camera Overlay Mode...');
    let timedOut = false;
    const timeoutPromise = new Promise((resolve) => {
      setTimeout(() => {
        timedOut = true;
        resolve('timeout');
      }, 9000);
    });

    const launchPromise = window.zoomSdk.runRenderingContext({ view: 'camera' });
    await Promise.race([launchPromise, timeoutPromise]);

    if (timedOut) {
      setCameraControlsState('retry', 'Camera request was sent, but Zoom has not returned completion yet. If the video tile has the badge, you can use the confetti controls.');
      launchPromise
        .then(() => {
          setCameraControlsState('active', 'Camera overlay is active. Confetti controls are ready.');
        })
        .catch((e) => {
          setCameraControlsState('retry');
          showNotification('Camera Mode background start failed: ' + (e.message || String(e)), 'error');
        });
      return;
    }

    setCameraControlsState('active', 'Camera overlay is active. Use the confetti controls below.');
  } catch (e) {
    console.error('Failed to run camera context:', e);
    setCameraControlsState('retry');
    showNotification('Failed to enable camera: ' + (e.message || String(e)), 'error');
  }
});

// Theme Selectors
document.querySelectorAll('.theme-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
    
    const targetBtn = e.target.closest('.theme-btn');
    targetBtn.classList.add('active');
    activeTheme = targetBtn.dataset.theme;
  });
});

// Slider Value Text Sync
const setupSlider = (sliderId, labelId, suffix) => {
  const slider = document.getElementById(sliderId);
  const label = document.getElementById(labelId);
  
  if (slider && label) {
    slider.addEventListener('input', () => {
      label.innerText = `${slider.value}${suffix}`;
    });
  }
};

setupSlider('slider-particle', 'label-particle', ' pieces');
setupSlider('slider-spread', 'label-spread', '° width');
setupSlider('slider-velocity', 'label-velocity', ' speed');
setupSlider('slider-gravity', 'label-gravity', ' g');

// --- Zoom Apps SDK Initialization ---

async function initializeZoomApp() {
  const statusDisplay = document.getElementById('status-display');
  const indicator = document.getElementById('status-indicator');

  if (typeof window !== 'undefined' && window.zoomSdk) {
    try {
      console.log('Zoom Apps SDK detected, configuring...');
      const configResponse = await zoomSdk.config({
        version: '0.16',
        capabilities: [
          'getRunningContext',
          'getMeetingContext',
          'getUserContext',
          'shareApp',
          'runRenderingContext',
          'closeRenderingContext',
          'drawWebView',
          'onRenderedAppOpened',
          'postMessage',
          'onMessage',
          'drawParticipant',
          'getMeetingParticipants'
        ]
      });

      console.log('Zoom SDK Configuration complete:', configResponse);
      indicator.className = 'status-indicator connected';

      // Register the Zoom SDK cross-process message listener
      if (zoomSdk.addEventListener) {
        zoomSdk.addEventListener('onMessage', (event) => {
          console.log('Zoom SDK message received:', event.payload);
          if (event.payload) {
            // Check for debug logs from the camera process
            if (event.payload.type === 'camera-log') {
              console.log('[Camera Process]', event.payload.message);
              const logDiv = document.createElement('p');
              logDiv.className = 'camera-log-line';
              logDiv.style.color = '#34d399';
              logDiv.style.fontSize = '0.75rem';
              logDiv.style.margin = '4px 0';
              logDiv.innerText = `[Camera] ${event.payload.message}`;
              statusDisplay.appendChild(logDiv);
              if (/drawParticipant succeeded|drawWebView succeeded|webcam layer OK/i.test(event.payload.message)) {
                setCameraControlsState('active', 'Camera overlay is active. Confetti controls are ready.');
              }
            } else if (event.payload.type === 'camera-error') {
              console.error('[Camera Process Error]', event.payload.message);
              const logDiv = document.createElement('p');
              logDiv.className = 'camera-log-line camera-log-line-error';
              logDiv.style.color = '#f87171';
              logDiv.style.fontSize = '0.75rem';
              logDiv.style.margin = '4px 0';
              logDiv.innerText = `[Camera error] ${event.payload.message}`;
              statusDisplay.appendChild(logDiv);
            } else if (event.payload.type === 'camera-stop') {
              requestCameraOverlayStop({ fromMessage: true })
                .then(() => {
                  console.log('[Camera Process] camera-stop handled');
                })
                .catch((err) => {
                  console.error('[Camera Process] camera-stop failed:', err);
                });
            } else if (event.payload.type === 'trigger') {
              handleTriggerMessage(event.payload);
            }
          }
        });
      }

      try {
        const runningContextResponse = await zoomSdk.getRunningContext();
        // The current Zoom Apps SDK returns { context: 'inCamera' }, rather
        // than the context string directly. Keep the string fallback for
        // compatibility with older clients.
        const runningContext = typeof runningContextResponse === 'string'
          ? runningContextResponse
          : runningContextResponse?.context || configResponse.runningContext;
        
        // 📹 CHECK IF APP IS RUNNING AS CAMERA VIDEO OVERLAY
        if (runningContext === 'inCamera') {
          isCameraView = true;
          document.documentElement.classList.add('in-camera');
          document.body.classList.add('in-camera');
          reportCameraDensity({
            phase: 'camera-context-ready',
            styleHint: 'waiting-for-effect',
            multiplier: null,
            particleCount: null,
            scaledParticleCount: null
          });

          const setCameraBadgeText = (message) => {
            const badgeText = document.getElementById('camera-badge-text');
            if (badgeText) badgeText.textContent = message;
          };

          const extractParticipantUUID = (value) => {
            if (!value || typeof value !== 'object') return null;

            const uuidKeys = [
              'participantUUID',
              'participantUuid',
              'participant_uuid',
              'userParticipantUUID',
              'userParticipantUuid'
            ];

            for (const key of uuidKeys) {
              const candidate = value[key];
              if (typeof candidate === 'string' && candidate.trim()) {
                return candidate;
              }
            }

            return null;
          };

          const normalizeParticipantList = (response) => {
            if (Array.isArray(response)) return response;
            if (!response || typeof response !== 'object') return [];

            for (const key of ['participants', 'meetingParticipants', 'users', 'result', 'data']) {
              const candidate = response[key];
              if (Array.isArray(candidate)) return candidate;
            }

            return [];
          };

          const findCurrentParticipant = (participants, userContext) => {
            const userIds = new Set([
              userContext?.userId,
              userContext?.userID,
              userContext?.uid,
              userContext?.id
            ].filter(Boolean).map((value) => String(value)));

            const userNames = new Set([
              userContext?.displayName,
              userContext?.screenName,
              userContext?.userName,
              userContext?.name
            ].filter(Boolean).map((value) => String(value).toLowerCase()));

            return participants.find((participant) => {
              const participantId = participant?.userId || participant?.userID || participant?.uid || participant?.id;
              const participantName = participant?.displayName || participant?.screenName || participant?.userName || participant?.name;

              return participant?.isSelf
                || participant?.isMe
                || participant?.isCurrentUser
                || (participantId && userIds.has(String(participantId)))
                || (participantName && userNames.has(String(participantName).toLowerCase()));
            }) || participants.find((participant) => {
              return participant?.bVideoOn === true
                || participant?.videoOn === true
                || participant?.isVideoOn === true
                || participant?.video === true;
            }) || participants[0] || null;
          };
          
          // Helper to send log back to sidebar panel
          const sendLogToSidebar = (msg, isErr = false) => {
            zoomSdk.postMessage({
              type: isErr ? 'camera-error' : 'camera-log',
              message: msg
            }).catch(() => {});
          };

          sendLogToSidebar('Camera context loaded. Preparing drawWebView...');
          const cameraSettings = await loadCameraSettings();
          sendLogToSidebar(`Camera mirror mode is ${cameraSettings.mirror ? 'on' : 'off'}.`);
          setCameraBadgeText(cameraSettings.mirror ? 'Loading mirrored webcam...' : 'Loading webcam...');
          startRemoteConfettiPolling(sendLogToSidebar);

          const renderTarget = configResponse.media?.renderTarget;
          const width = Math.floor(renderTarget?.width || window.innerWidth || 1280);
          const height = Math.floor(renderTarget?.height || window.innerHeight || 720);
          let participantUUID = null;
          let userContext = null;

          // Camera Mode renders into a separate off-screen app instance. Draw the
          // current user's real video first, then place the transparent confetti
          // WebView above it. Without this lower layer the virtual camera can be
          // blank even when drawWebView itself succeeds.
          try {
            userContext = await zoomSdk.getUserContext();
            participantUUID = extractParticipantUUID(userContext);
            if (participantUUID) {
              sendLogToSidebar('Camera user context loaded. Preparing video layer.');
            } else {
              sendLogToSidebar('Camera user context did not include a participant UUID. Trying meeting participants fallback...');
            }
          } catch (err) {
            sendLogToSidebar(`Could not load the camera user context: ${err.message || String(err)}. Trying meeting participants fallback...`, true);
          }

          if (!participantUUID && typeof zoomSdk.getMeetingParticipants === 'function') {
            try {
              const participantsResponse = await zoomSdk.getMeetingParticipants();
              const participants = normalizeParticipantList(participantsResponse);
              const currentParticipant = findCurrentParticipant(participants, userContext);
              participantUUID = extractParticipantUUID(currentParticipant);

              if (participantUUID) {
                sendLogToSidebar(`Camera participant fallback found a UUID from ${participants.length} participant(s).`);
              } else {
                sendLogToSidebar(`Meeting participants fallback returned ${participants.length} participant(s), but no participant UUID was available.`, true);
              }
            } catch (err) {
              sendLogToSidebar(`Meeting participants fallback failed: ${err.message || String(err)}`, true);
            }
          }

          if (participantUUID) {
            setCameraBadgeText(cameraSettings.mirror ? 'Mirrored webcam ready' : 'Webcam ready');
          } else {
            setCameraBadgeText('Webcam layer unavailable');
          }

          let cameraWebViewDrawn = false;
          let drawWebViewPromise = null;

          const performDraw = async (source) => {
            if (cameraWebViewDrawn) return;
            if (drawWebViewPromise) return drawWebViewPromise;

            drawWebViewPromise = (async () => {
              try {
                if (participantUUID) {
                  try {
                    await zoomSdk.drawParticipant({
                      participantUUID,
                      x: 0,
                      y: 0,
                      width,
                      height,
                      zIndex: 1,
                      cameraModeMirroring: cameraSettings.mirror
                    });
                    sendLogToSidebar(`drawParticipant succeeded (${width}x${height}).`);
                    setCameraBadgeText(cameraSettings.mirror ? 'Confetti ready - mirrored webcam' : 'Confetti ready - webcam');
                  } catch (err) {
                    // Still attempt the WebView so the diagnostic panel can tell us
                    // whether the failure is specific to the participant layer.
                    sendLogToSidebar(`drawParticipant failed: ${err.message || String(err)}`, true);
                    setCameraBadgeText('Confetti active - webcam failed');
                  }
                } else {
                  setCameraBadgeText('Confetti active - missing webcam');
                }

                await zoomSdk.drawWebView({
                  webviewId: 'camera',
                  x: 0,
                  y: 0,
                  width,
                  height,
                  zIndex: 2
                });
                cameraWebViewDrawn = true;
                sendLogToSidebar(`drawWebView succeeded via ${source} (${width}x${height}).`);
              } catch (err) {
                sendLogToSidebar(`drawWebView failed via ${source}: ${err.message || String(err)}`, true);
              } finally {
                drawWebViewPromise = null;
              }
            })();

            return drawWebViewPromise;
          };

          // Proper event listener subscription
          if (zoomSdk.addEventListener) {
            zoomSdk.addEventListener('onRenderedAppOpened', async () => {
              sendLogToSidebar('onRenderedAppOpened event received!');
              await performDraw('onRenderedAppOpened');
            });
          }

          // A fallback covers an event that fired before this listener was registered.
          // It is deliberately delayed so CEF has time to finish initializing.
          setTimeout(() => {
            performDraw('delayed fallback');
          }, 2000);
          
          return; // Skip normal UI status cards render since they are hidden
        }

        // --- Normal In-Meeting Sidebar Controller Context ---
        let meetingId = 'N/A';
        let role = 'N/A';

        if (runningContext === 'inMeeting') {
          try {
            const meetingContext = await zoomSdk.getMeetingContext();
            meetingId = meetingContext.meetingUUID || meetingContext.meetingID || 'Active Meeting';
            role = meetingContext.role || 'Participant';
          } catch (me) {
            console.warn('Could not query meeting context:', me);
          }
          
          // Show overlay and share buttons in meeting sidebar
          const shareBtn = document.getElementById('btn-share');
          if (shareBtn) shareBtn.style.display = 'block';

          const cameraBtn = document.getElementById('btn-camera-mode');
          if (cameraBtn) cameraBtn.style.display = 'block';
        }

        statusDisplay.innerHTML = `
          <p class="status-tag success">CONNECTED TO ZOOM CLIENT</p>
          <div class="context-grid">
            <div class="context-item">
              <span class="label">Running In</span>
              <span class="value highlight">${runningContext}</span>
            </div>
            <div class="context-item">
              <span class="label">Meeting ID</span>
              <span class="value">${meetingId}</span>
            </div>
            <div class="context-item">
              <span class="label">Your Role</span>
              <span class="value">${role}</span>
            </div>
            <div class="context-item">
              <span class="label">Client Theme</span>
              <span class="value">${configResponse.theme || 'Dark'}</span>
            </div>
            <div class="context-item">
              <span class="label">Build</span>
              <span class="value">${APP_BUILD}</span>
            </div>
          </div>
        `;
      } catch (ce) {
        console.warn('Failed to retrieve full running context:', ce);
        statusDisplay.innerHTML = `
          <p class="status-tag success">CONNECTED TO ZOOM CLIENT</p>
          <p class="sandbox-info">Logged in to client frame. Full meeting attributes unavailable.</p>
        `;
      }
    } catch (err) {
      console.error('Zoom SDK config failed:', err);
      indicator.className = 'status-indicator browser';
      statusDisplay.innerHTML = `
        <p class="status-tag warning">BROWSER MODE (SANDBOX)</p>
        <p class="sandbox-info">Failed to configure Zoom frame. Running in local browser simulator.</p>
        <p class="error-log">Debug details: ${err.message || String(err)}</p>
      `;
    }
  } else {
    console.log('Zoom SDK not detected, falling back to Browser Mode.');
    indicator.className = 'status-indicator browser';
    statusDisplay.innerHTML = `
      <p class="status-tag warning">BROWSER MODE (SANDBOX)</p>
      <p class="sandbox-info">
        The application is running outside the Zoom client. Confetti effects and UI features will work in this browser simulator, but real meeting features require running this inside Zoom.
      </p>
    `;
  }
}

// Run config on startup
initializeZoomApp();
