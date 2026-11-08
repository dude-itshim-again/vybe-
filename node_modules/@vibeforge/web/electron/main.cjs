const { app, BrowserWindow, session, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');

let ytResolverMod = null;
async function getYtResolver() {
  if (!ytResolverMod) {
    try {
      ytResolverMod = require('./ytResolver.cjs');
    } catch {
      ytResolverMod = await import('./ytResolver.cjs');
    }
  }
  return ytResolverMod;
}

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
      preload: path.join(__dirname, 'preload.cjs'),
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
  // 4. Native YouTube Music Full-Audio Stream Resolver (Tier 2)
  ipcMain.handle('resolve-yt-stream', async (_, args) => {
    try {
      const { title, artist, duration } = args || {};
      const mod = await getYtResolver();
      const fn = mod?.resolveYouTubeAudio || mod?.default?.resolveYouTubeAudio;
      if (typeof fn === 'function') {
        return await fn(title, artist, Number(duration) || 0);
      }
      return null;
    } catch (err) {
      console.error('[main.cjs] resolve-yt-stream error:', err);
      return null;
    }
  });

  // 5. YouTube Music Search Multi-Source Fallback (Tier 3)
  ipcMain.handle('search-yt', async (_, args) => {
    try {
      const { query, limit } = args || {};
      const mod = await getYtResolver();
      const fn = mod?.searchYouTubeVideos || mod?.default?.searchYouTubeVideos;
      if (typeof fn === 'function') {
        return await fn(query, Number(limit) || 10);
      }
      return [];
    } catch (err) {
      console.error('[main.cjs] search-yt error:', err);
      return [];
    }
  });

  // 6. Permanent Native Disk Storage for vybe-user-data.json
  const userDataPath = app.getPath('userData');
  const userStorageFile = path.join(userDataPath, 'vybe-user-data.json');

  ipcMain.handle('storage:load', async () => {
    try {
      if (fs.existsSync(userStorageFile)) {
        const raw = await fs.promises.readFile(userStorageFile, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.warn('[main.cjs] storage:load error:', err.message);
    }
    return null;
  });

  ipcMain.handle('storage:save', async (_, data) => {
    try {
      await fs.promises.mkdir(userDataPath, { recursive: true });
      await fs.promises.writeFile(userStorageFile, JSON.stringify(data, null, 2), 'utf-8');
      return { success: true };
    } catch (err) {
      console.error('[main.cjs] storage:save error:', err.message);
      return { success: false, error: err.message };
    }
  });

  // 7. Native Track Downloader to Real "Music/Vybe Downloads" folder
  const downloadsDir = path.join(app.getPath('music'), 'Vybe Downloads');
  try {
    if (!fs.existsSync(downloadsDir)) {
      fs.mkdirSync(downloadsDir, { recursive: true });
    }
  } catch (err) {
    console.warn('[main.cjs] Could not create downloads directory:', err.message);
  }

  ipcMain.handle('get-downloads-folder', () => {
    return downloadsDir;
  });

  ipcMain.handle('open-downloads-folder', async () => {
    try {
      await fs.promises.mkdir(downloadsDir, { recursive: true });
      await shell.openPath(downloadsDir);
      return { success: true };
    } catch (err) {
      console.error('[main.cjs] open-downloads-folder error:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('show-item-in-folder', async (_, filePath) => {
    try {
      if (filePath) {
        shell.showItemInFolder(filePath);
        return { success: true };
      }
      return { success: false, error: 'No filePath provided' };
    } catch (err) {
      console.error('[main.cjs] show-item-in-folder error:', err.message);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('download-track', async (_, track) => {
    try {
      if (!track || !track.title) {
        throw new Error('Invalid track metadata for download');
      }

      await fs.promises.mkdir(downloadsDir, { recursive: true });

      // Resolve stream URL if not already present
      let streamUrl = track.streamUrl || track.audioUrl || track.url;
      if (!streamUrl) {
        const mod = await getYtResolver();
        const fn = mod?.resolveYouTubeAudio || mod?.default?.resolveYouTubeAudio;
        if (typeof fn === 'function') {
          const resolved = await fn(track.title, track.artist, Number(track.duration) || 0);
          if (resolved?.streamUrl) {
            streamUrl = resolved.streamUrl;
          }
        }
      }

      if (!streamUrl) {
        throw new Error('Could not resolve audio stream URL for download');
      }

      // Format safe filename
      const safeArtist = String(track.artist || 'Unknown Artist')
        .replace(/[\/\\?%*:|"<>]/g, '_')
        .trim();
      const safeTitle = String(track.title)
        .replace(/[\/\\?%*:|"<>]/g, '_')
        .trim();

      const ext = streamUrl.includes('.mp3') ? 'mp3' : 'm4a';
      const fileName = `${safeArtist} - ${safeTitle}.${ext}`;
      const filePath = path.join(downloadsDir, fileName);

      // Download binary stream
      const res = await fetch(streamUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        },
      });

      if (!res.ok) {
        throw new Error(`Failed to download stream: HTTP ${res.status}`);
      }

      const buffer = Buffer.from(await res.arrayBuffer());
      await fs.promises.writeFile(filePath, buffer);

      return {
        success: true,
        localFilePath: filePath,
        fileName,
        sizeBytes: buffer.length,
      };
    } catch (err) {
      console.error('[main.cjs] download-track error:', err.message);
      return { success: false, error: err.message };
    }
  });

  // -------------------------------------------------------------------------
  // Electron Auto-Updater IPC & Lifecycle Hooks
  // -------------------------------------------------------------------------
  ipcMain.handle('updater:check', async () => {
    const autoUpdater = getAutoUpdater();
    if (!autoUpdater) return { status: 'unavailable' };
    try {
      const res = await autoUpdater.checkForUpdates();
      return { status: 'checking', updateInfo: res?.updateInfo };
    } catch (err) {
      return { status: 'error', error: err.message };
    }
  });

  ipcMain.handle('updater:restart-and-install', () => {
    const autoUpdater = getAutoUpdater();
    if (autoUpdater) {
      autoUpdater.quitAndInstall(false, true);
    }
  });

  createWindow();
  setupAutoUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      setupAutoUpdater();
    }
  });
});

let autoUpdaterInstance = null;
function getAutoUpdater() {
  if (!autoUpdaterInstance) {
    try {
      const updaterMod = require('electron-updater');
      autoUpdaterInstance = updaterMod.autoUpdater || updaterMod.default?.autoUpdater || updaterMod;
    } catch (e) {
      console.warn('[main.cjs] Failed to require electron-updater:', e.message);
    }
  }
  return autoUpdaterInstance;
}

function setupAutoUpdater() {
  const autoUpdater = getAutoUpdater();
  if (!autoUpdater) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    console.log('[AutoUpdater] Checking for updates...');
    mainWindow?.webContents?.send('updater:status', { status: 'checking' });
  });

  autoUpdater.on('update-available', (info) => {
    console.log('[AutoUpdater] Update available:', info?.version);
    mainWindow?.webContents?.send('updater:status', {
      status: 'available',
      version: info?.version,
      releaseNotes: info?.releaseNotes,
    });
  });

  autoUpdater.on('update-not-available', (info) => {
    console.log('[AutoUpdater] App is up to date:', info?.version);
    mainWindow?.webContents?.send('updater:status', {
      status: 'not-available',
      version: info?.version,
    });
  });

  autoUpdater.on('error', (err) => {
    console.warn('[AutoUpdater] Error in auto-updater:', err?.message || err);
    mainWindow?.webContents?.send('updater:status', {
      status: 'error',
      error: err?.message || String(err),
    });
  });

  autoUpdater.on('download-progress', (progressObj) => {
    mainWindow?.webContents?.send('updater:status', {
      status: 'downloading',
      percent: Math.round(progressObj?.percent || 0),
      bytesPerSecond: progressObj?.bytesPerSecond,
      transferred: progressObj?.transferred,
      total: progressObj?.total,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[AutoUpdater] Update downloaded; ready to install:', info?.version);
    mainWindow?.webContents?.send('updater:status', {
      status: 'ready',
      version: info?.version,
    });
  });

  // Check for updates on launch and every 30 minutes in packaged builds
  if (app.isPackaged) {
    setTimeout(() => {
      autoUpdater.checkForUpdatesAndNotify().catch((err) => {
        console.warn('[AutoUpdater] Initial checkForUpdates error:', err.message);
      });
    }, 4000);

    setInterval(() => {
      autoUpdater.checkForUpdatesAndNotify().catch((err) => {
        console.warn('[AutoUpdater] Periodic checkForUpdates error:', err.message);
      });
    }, 30 * 60 * 1000);
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
