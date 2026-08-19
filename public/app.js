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

// BroadcastChannel for local browser testing
const confettiChannel = new BroadcastChannel('zoom_confetti_channel');

// Helper: Random in range
function randomInRange(min, max) {
  return Math.random() * (max - min) + min;
}

// Helper: Show HTML Notification Banner
function showNotification(message, type = 'info') {
  const banner = document.getElementById('notification-banner');
  if (banner) {
    banner.innerText = message;
    banner.className = `notification-banner ${type}`;
    banner.style.display = 'block';
  }
}

// Helper: Broadcast confetti triggers to other frames/contexts
function broadcastConfetti(style, config = null) {
  // 1. Send via local BroadcastChannel (for Chrome browser sandboxes)
  confettiChannel.postMessage({ type: 'trigger', style, activeTheme, config });

  // 2. Send via Zoom SDK postMessage (for cross-process Zoom Sidebar <-> Camera Overlay)
  if (typeof window !== 'undefined' && window.zoomSdk && window.zoomSdk.postMessage) {
    window.zoomSdk.postMessage({ type: 'trigger', style, activeTheme, config }).catch(err => {
      console.warn('Zoom postMessage failed:', err);
    });
  }
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
  confetti({
    particleCount: 120,
    spread: 80,
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
  const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

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

    const count = 50 * (timeLeft / duration);

    confetti({
      ...defaults,
      particleCount: count,
      origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
      colors: THEME_COLORS[activeTheme]
    });
    confetti({
      ...defaults,
      particleCount: count,
      origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
      colors: THEME_COLORS[activeTheme]
    });
  }, 250);

  if (shouldBroadcast) {
    broadcastConfetti('fireworks');
  }
}

// 3. Side Cannons
function triggerCannons(shouldBroadcast = true) {
  const duration = 2.5 * 1000;
  const end = Date.now() + duration;
  
  playConfettiSound('cannons');
  
  const frame = () => {
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.8 },
      colors: THEME_COLORS[activeTheme],
      zIndex: 9999
    });
    confetti({
      particleCount: 3,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.8 },
      colors: THEME_COLORS[activeTheme],
      zIndex: 9999
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  };
  frame();

  if (shouldBroadcast) {
    broadcastConfetti('cannons');
  }
}

// 4. Confetti Rain
function triggerRain(shouldBroadcast = true) {
  const duration = 4 * 1000;
  const end = Date.now() + duration;
  
  playConfettiSound('rain');
  setTimeout(() => {
    if (Date.now() < end) playConfettiSound('rain');
  }, 1800);

  const frame = () => {
    confetti({
      particleCount: 2,
      spread: 360,
      startVelocity: 5,
      gravity: 0.6,
      origin: { x: Math.random(), y: -0.1 },
      colors: THEME_COLORS[activeTheme],
      zIndex: 9999
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  };
  frame();

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

  confetti({
    particleCount: count,
    spread: spread,
    startVelocity: velocity,
    gravity: gravity,
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
  confetti({
    particleCount: 50,
    spread: 60,
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
  if (typeof window !== 'undefined' && window.zoomSdk) {
    try {
      console.log('Enabling Camera Overlay Mode...');
      await window.zoomSdk.runRenderingContext({ view: 'camera' });
      showNotification('Camera overlay enabled! Now select "General app 979" as your video camera in Zoom.', 'success');
    } catch (e) {
      console.error('Failed to run camera context:', e);
      showNotification('Failed to enable camera: ' + (e.message || String(e)), 'error');
    }
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

setupSlider('slider-particle', 'label-particle', ' items');
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
        capabilities: [
          'getRunningContext',
          'getMeetingContext',
          'getUserContext',
          'shareApp',
          'runRenderingContext',
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
              logDiv.style.color = '#34d399';
              logDiv.style.fontSize = '0.75rem';
              logDiv.style.margin = '4px 0';
              logDiv.innerText = `📹 [Camera] ${event.payload.message}`;
              statusDisplay.appendChild(logDiv);
            } else if (event.payload.type === 'camera-error') {
              console.error('[Camera Process Error]', event.payload.message);
              const logDiv = document.createElement('p');
              logDiv.style.color = '#f87171';
              logDiv.style.fontSize = '0.75rem';
              logDiv.style.margin = '4px 0';
              logDiv.innerText = `🚨 [Camera Error] ${event.payload.message}`;
              statusDisplay.appendChild(logDiv);
            } else if (event.payload.type === 'trigger') {
              handleTriggerMessage(event.payload);
            }
          }
        });
      }

      try {
        const runningContext = await zoomSdk.getRunningContext();
        
        // 📹 CHECK IF APP IS RUNNING AS CAMERA VIDEO OVERLAY
        if (runningContext === 'inCamera') {
          isCameraView = true;
          document.body.classList.add('in-camera');
          
          // Helper to send log back to sidebar panel
          const sendLogToSidebar = (msg, isErr = false) => {
            zoomSdk.postMessage({
              type: isErr ? 'camera-error' : 'camera-log',
              message: msg
            }).catch(() => {});
          };

          sendLogToSidebar('Camera view loaded. Waiting for rendered app opened event...');

          // Wait until rendering engine CEF is ready before drawing
          zoomSdk.onRenderedAppOpened(async () => {
            try {
              sendLogToSidebar('onRenderedAppOpened fired. Querying user context...');
              
              // 1. Get local participant UUID
              const userContext = await zoomSdk.getUserContext();
              const localParticipantId = userContext.participantId;
              
              sendLogToSidebar(`Got userContext. participantId: ${localParticipantId}`);
              
              const { participants } = await zoomSdk.getMeetingParticipants();
              const localParticipant = participants.find(p => p.participantId === localParticipantId);
              const localParticipantUUID = localParticipant ? localParticipant.participantUUID : '';
              
              sendLogToSidebar(`Resolved UUID: ${localParticipantUUID || 'NOT FOUND'}`);
              
              const width = window.innerWidth || 1280;
              const height = window.innerHeight || 720;
              
              // 3. Draw transparent WebView on top at zIndex: 2
              await zoomSdk.drawWebView({
                webviewId: 'camera',
                x: 0,
                y: 0,
                width: width,
                height: height,
                zIndex: 2
              });
              sendLogToSidebar('Successfully called drawWebView');
            } catch (err) {
              sendLogToSidebar(`Error in camera rendering: ${err.message || String(err)}`, true);
            }
          });
          
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
