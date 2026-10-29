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
    title: 'Vybe — Kinetic Music & DSP Studio',
    icon: path.join(__dirname, '../public/logo.png'),
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#07080C',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      webSecurity: false, // Completely disables CORS for music APIs & audio streams
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });

  // 1. Strip restrictive Origin / Referer headers and inject clean browser User-Agent
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    const headers = { ...details.requestHeaders };
    delete headers['Origin'];
    delete headers['Referer'];
    headers['User-Agent'] =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
    callback({ requestHeaders: headers });
  });

  // 2. Automatic CORS Unlocker: Injects permissive CORS headers for all media & CDN streams
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = { ...details.responseHeaders };
    responseHeaders['Access-Control-Allow-Origin'] = ['*'];
    responseHeaders['Access-Control-Allow-Methods'] = ['GET, POST, OPTIONS, HEAD'];
    responseHeaders['Access-Control-Allow-Headers'] = ['*'];
    callback({ responseHeaders });
  });

  // 3. Smart Dev vs. Production Loader:
  // If process.env.VITE_DEV_SERVER_URL is set (or --dev flag is passed), load the live Vite dev server URL.
  // Otherwise, load path.join(__dirname, '../dist/index.html').
  const isDev = Boolean(
    process.env.VITE_DEV_SERVER_URL ||
      process.argv.includes('--dev') ||
      process.argv.includes('-d')
  );
  const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';

  if (isDev) {
    mainWindow.loadURL(devUrl).catch(() => {
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
