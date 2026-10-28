const { app, BrowserWindow, session } = require('electron');
const path = require('path');

// 1. Prevent Background Throttling:
// Ensures 60Hz Sub-Bass DSP, 5-Band EQ, and sample-accurate Dual-Deck AutoMix transitions
// never stutter or freeze when the laptop window is minimized or occluded in the background.
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 380,
    minHeight: 640,
    backgroundColor: '#050507',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false,
      webSecurity: false, // Allows crossOrigin="anonymous" audio to connect to Web Audio AudioContext without tainting
    },
  });

  // 2. Automatic CORS Unlocker for Web Audio API:
  // Intercept all HTTP/HTTPS responses and inject permissive CORS headers so JioSaavn CDN
  // (aac.saavncdn.com) streams connect to AudioContext and DSP chains seamlessly.
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = { ...details.responseHeaders };

    responseHeaders['Access-Control-Allow-Origin'] = ['*'];
    responseHeaders['Access-Control-Allow-Headers'] = ['*'];
    responseHeaders['Access-Control-Allow-Methods'] = ['GET, HEAD, OPTIONS, POST'];
    responseHeaders['Access-Control-Expose-Headers'] = ['Content-Length, Content-Range, Accept-Ranges'];

    callback({ responseHeaders });
  });

  // 3. Load Application:
  // Points to Vite dev server in desktop:dev, or production bundle in packaged desktop app.
  const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

  if (isDev) {
    mainWindow.loadURL(devUrl).catch(() => {
      // If dev server is not ready immediately, fallback to packaged file
      mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
