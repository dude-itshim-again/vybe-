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
    minWidth: 380,
    minHeight: 640,
    backgroundColor: '#050507',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      webSecurity: false, // Disables CORS restrictions so all direct audio streams and APIs load natively
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });

  const ses = mainWindow.webContents.session;

  // 1. Strip or spoof restrictive Origin / Referer headers for upstream audio CDNs & APIs
  ses.webRequest.onBeforeSendHeaders((details, callback) => {
    const requestHeaders = { ...details.requestHeaders };
    const url = details.url || '';
    if (
      url.includes('saavn') ||
      url.includes('saavncdn') ||
      url.includes('jiosaavn') ||
      url.includes('lrclib.net')
    ) {
      delete requestHeaders['Origin'];
      delete requestHeaders['Referer'];
    }
    callback({ requestHeaders });
  });

  // 2. Automatic CORS Unlocker for Web Audio API:
  // Injects permissive CORS headers so JioSaavn CDN (aac.saavncdn.com) streams connect to AudioContext
  ses.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = { ...details.responseHeaders };

    responseHeaders['Access-Control-Allow-Origin'] = ['*'];
    responseHeaders['Access-Control-Allow-Headers'] = ['*'];
    responseHeaders['Access-Control-Allow-Methods'] = ['GET, HEAD, OPTIONS, POST'];
    responseHeaders['Access-Control-Expose-Headers'] = ['Content-Length, Content-Range, Accept-Ranges'];

    callback({ responseHeaders });
  });

  // 3. Load Application:
  // Points to Vite dev server if running, or falls back to production bundle in dist/index.html
  const isDev = process.env.NODE_ENV === 'development' || (!app.isPackaged && process.env.LOAD_DIST !== 'true');
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
