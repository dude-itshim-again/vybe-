/**
 * Echo Streaming Gateway & CORS Audio Proxy Middleware for Vite
 * 
 * Handles:
 * 1. GET /api/echo/search?q=... (320kbps JioSaavn + Fallback search)
 * 2. GET /api/echo/home (Curated Moods, Charts & Trending Sections)
 * 3. GET /api/echo/stream?url=... (CORS-safe 206 Partial Content Audio Stream Proxy)
 */

import type { Plugin, ViteDevServer } from 'vite';
import type { IncomingMessage, ServerResponse } from 'http';
import { Readable } from 'stream';
import { decryptDesEcb } from './des';

export interface EchoTrack {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration?: number;
  artworkUrl?: string;
  streamUrl: string;
  quality: '320kbps' | '256kbps Opus' | '160kbps';
  source: 'saavn' | 'ytmusic' | 'local';
  sourceType: 'stream';
  year?: string;
  genre?: string;
}

export interface HomeSection {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  tracks: EchoTrack[];
}

// In-memory cache for home feed sections (15 minute TTL)
let homeCache: { timestamp: number; sections: HomeSection[] } | null = null;
const CACHE_TTL_MS = 15 * 60 * 1000;

// Vybe Connect in-memory models & state
export interface ConnectDevice {
  deviceId: string;
  deviceName: string;
  deviceType: 'laptop' | 'phone' | 'desktop';
  currentTrack: unknown;
  currentTime: number;
  isPlaying: boolean;
  volume: number;
  queue?: unknown[];
  userId?: string;
  lastSeen: number;
}

export interface ConnectCommand {
  id: string;
  fromDeviceId: string;
  targetDeviceId: string;
  command: 'TRANSFER_PLAYBACK' | 'PLAY' | 'PAUSE' | 'SEEK' | 'NEXT' | 'PREV' | 'SET_VOLUME';
  payload: unknown;
  timestamp: number;
}

const connectDevices = new Map<string, ConnectDevice>();
const pendingCommands = new Map<string, ConnectCommand[]>();

// Live Jam in-memory models & state
export interface JamParticipant {
  id: string;
  name: string;
  avatarColor: string;
  joinedAt: number;
  isHost?: boolean;
}

export interface JamSong {
  track: unknown;
  addedBy: {
    id: string;
    name: string;
    avatarColor: string;
  };
  votes: number;
  addedAt: number;
}

export interface JamRoom {
  roomCode: string;
  hostUser: {
    id: string;
    name: string;
    avatarColor: string;
  };
  participants: JamParticipant[];
  currentTrack: unknown;
  currentTime: number;
  isPlaying: boolean;
  queue: JamSong[];
  updatedAt: number;
}

const jamRooms = new Map<string, JamRoom>();

async function readJsonBody<T>(req: IncomingMessage): Promise<T | null> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 2 * 1024 * 1024) {
        req.destroy();
        resolve(null);
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? (JSON.parse(body) as T) : null);
      } catch {
        resolve(null);
      }
    });
    req.on('error', () => resolve(null));
  });
}

function cleanHtmlEntities(text?: string): string {
  if (!text) return '';
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#034;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#038;/g, '&')
    .replace(/&#38;/g, '&')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&lsquo;|&rsquo;/g, "'")
    .trim();
}

/**
 * Aggressive Title & Artist Sanitizer (Crucial for JioSaavn / YouTube):
 * 1. Decodes all HTML entities.
 * 2. Strips (From "..."), [Official Video], (Audio), - Remastered, feat. ..., ft. ....
 */
function sanitizeTitleForLyrics(title: string): string {
  if (!title) return '';
  let clean = cleanHtmlEntities(title);

  // 1. Remove (From "...") or (From '...') or [From ...] or - From "..."
  clean = clean.replace(/[\(\[]\s*From\s+["'][^"'\]\)]+["']\s*[\)\]]/gi, '');
  clean = clean.replace(/[\(\[]\s*From\s+[^\]\)]+\s*[\)\]]/gi, '');
  clean = clean.replace(/[-–—|]\s*From\s+["'][^"']+["']/gi, '');
  clean = clean.replace(/[-–—|]\s*From\s+[^-\(\[]+/gi, '');

  // 2. Remove [Official Video], (Audio), [Official Audio], (Lyric Video), [Visualizer], etc.
  clean = clean.replace(/[\(\[]\s*(?:official\s*(?:music\s*)?(?:video|audio|lyric\s*video|visualizer)?|lyric\s*video|audio|music\s*video|visualizer|slowed\s*\+\s*reverb|speed\s*up|reverb|remix|4k|hd|hq|video|full\s*video|full\s*song)\s*[\)\]]/gi, '');
  clean = clean.replace(/[-–—|]\s*(?:official\s*(?:music\s*)?(?:video|audio|lyric\s*video|visualizer)|lyric\s*video|official|audio|visualizer|music\s*video|4k|hd|hq)\s*$/gi, '');

  // 3. Remove - Remastered / Remastered 2021 / (Remastered...) / [Remastered]
  clean = clean.replace(/[\(\[]\s*(?:\d{4}\s*)?remaster(?:ed)?(?:\s*\d{4})?\s*[\)\]]/gi, '');
  clean = clean.replace(/[-–—|]\s*(?:\d{4}\s*)?remaster(?:ed)?(?:\s*\d{4})?/gi, '');

  // 4. Remove feat. / ft. in title (parenthesized, bracketed, or inline to end)
  clean = clean.replace(/[\(\[]\s*(?:feat\.?|ft\.?)\b[^\]\)]*[\)\]]/gi, '');
  clean = clean.replace(/\b(?:feat\.?|ft\.?)\s+[^\-\(\[,\/]+/gi, '');
  clean = clean.replace(/\b(?:feat\.?|ft\.?)\b.*$/gi, '');

  // 5. Remove (Original Motion Picture Soundtrack) or (OST)
  clean = clean.replace(/[\(\[]\s*(?:original\s+motion\s+picture\s+soundtrack|soundtrack|ost)\s*[\)\]]/gi, '');

  // 6. Clean extra spaces / trailing punctuation
  clean = clean.replace(/\s+/g, ' ').trim();
  clean = clean.replace(/^[\s\-–—/|]+|[\s\-–—/|]+$/g, '').trim();
  return clean || title;
}

const LABEL_BLACKLIST = new Set([
  't-series',
  'tseries',
  'vevo',
  'zee music company',
  'sony music india',
  'sony music',
  'speed records',
  'yrf',
  'tips official',
  'tips music',
  'aditya music',
  'eros now',
  'saregama',
  't-series regional',
]);

/**
 * Extracts ONLY the first primary artist from compound artist strings before ,, &, or /.
 * e.g., "The Weeknd, Anitta" -> "The Weeknd", "Pritam, Arijit Singh" -> "Pritam"
 */
function extractPrimaryArtist(artist: string): string {
  if (!artist) return '';
  let clean = cleanHtmlEntities(artist);
  // Split on multiple artists: comma, &, /, x, with, feat
  const parts = clean.split(/,|&|\/|\s+x\s+|\s+with\s+|\s+feat\.?\s+|\s+ft\.?\s+/i);
  let first = (parts[0]?.trim() || clean).replace(/^["'\[]+|["'\]]+$/g, '').trim();
  if (LABEL_BLACKLIST.has(first.toLowerCase())) {
    return '';
  }
  return first;
}

interface LyricsResult {
  trackName: string;
  artistName: string;
  duration?: number;
  syncedLyrics: string | null;
  plainLyrics: string | null;
  instrumental?: boolean;
  source: 'lrclib' | 'saavn' | 'fallback';
  id?: number | string;
}

/**
 * 4-Stage Multi-Provider Waterfall:
 * Stage 1: LRCLIB Exact Search (track_name + artist_name)
 * Stage 2: LRCLIB Keyword Search (cleanTitle + primaryArtist)
 * Stage 3: LRCLIB Title-Only Search (if Stage 2 empty or primaryArtist is label)
 * Stage 4: JioSaavn Native Lyrics Fallback (songId or plain lyrics)
 */
async function fetchLyricsMultiSource(
  title: string,
  artist: string,
  duration?: number,
  songId?: string
): Promise<LyricsResult | null> {
  const cleanTitle = sanitizeTitleForLyrics(title);
  const primaryArtist = extractPrimaryArtist(artist);
  const userAgent = 'VybeMusicPlayer/1.0 (https://github.com/vybe-music)';

  // Helper for LRCLIB fetches
  const callLrclib = async (endpoint: string): Promise<any[]> => {
    try {
      const res = await fetch(`https://lrclib.net/api/${endpoint}`, {
        headers: { 'User-Agent': userAgent },
      });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : data ? [data] : [];
    } catch (e) {
      return [];
    }
  };

  const scoreCandidate = (r: any): number => {
    if (!r) return -9999;
    let s = 0;
    if (r.syncedLyrics && r.syncedLyrics.trim().length > 0) {
      s += 1000;
    } else if (r.plainLyrics && r.plainLyrics.trim().length > 0) {
      s += 200;
    }

    if (duration && duration > 10 && r.duration && r.duration > 0) {
      const diff = Math.abs(r.duration - duration);
      if (diff <= 4) {
        s += 700;
        s += Math.max(0, Math.round((4 - diff) * 25));
      } else if (diff <= 8) {
        s += 450 - Math.round((diff - 4) * 25);
      } else if (diff <= 15) {
        s += 200 - Math.round((diff - 8) * 15);
      } else if (diff <= 30) {
        s += 50 - Math.round((diff - 15) * 5);
      } else {
        s -= Math.min(400, Math.round(diff * 5));
      }
    }

    const titleLower = title.toLowerCase();
    const candText = `${r.trackName || r.name || ''} ${r.albumName || ''}`.toLowerCase();
    for (const kw of ['slowed', 'reverb', 'remix', 'karaoke']) {
      if (candText.includes(kw) && !titleLower.includes(kw)) {
        s -= 400;
      }
    }

    if (
      (candText.includes('speed up') || candText.includes('sped up') || candText.includes('8d') || candText.includes('nightcore')) &&
      !titleLower.includes('speed up') && !titleLower.includes('sped up')
    ) {
      s -= 400;
    }

    return s;
  };

  const pickBestLrc = (records: any[]): LyricsResult | null => {
    if (!records || records.length === 0) return null;
    const sorted = [...records].sort((a, b) => scoreCandidate(b) - scoreCandidate(a));
    const best = sorted[0];
    if (!best) return null;

    if (best.syncedLyrics && best.syncedLyrics.trim().length > 0) {
      return {
        trackName: best.trackName || best.name || cleanTitle,
        artistName: best.artistName || primaryArtist,
        duration: best.duration || duration,
        syncedLyrics: best.syncedLyrics,
        plainLyrics: best.plainLyrics,
        instrumental: !!best.instrumental,
        source: 'lrclib',
        id: best.id,
      };
    }
    const withPlain = sorted.find((r) => r && r.plainLyrics && r.plainLyrics.trim().length > 0);
    if (withPlain) {
      return {
        trackName: withPlain.trackName || withPlain.name || cleanTitle,
        artistName: withPlain.artistName || primaryArtist,
        duration: withPlain.duration || duration,
        syncedLyrics: null,
        plainLyrics: withPlain.plainLyrics,
        instrumental: !!withPlain.instrumental,
        source: 'lrclib',
        id: withPlain.id,
      };
    }
    return null;
  };

  // Stage 1: LRCLIB Exact Search
  if (cleanTitle && primaryArtist) {
    const stage1 = await callLrclib(
      `search?track_name=${encodeURIComponent(cleanTitle)}&artist_name=${encodeURIComponent(primaryArtist)}`
    );
    const best1 = pickBestLrc(stage1);
    if (best1) return best1;
  }

  // Stage 2: LRCLIB Keyword Search (Title + Artist)
  if (cleanTitle && primaryArtist) {
    const stage2 = await callLrclib(`search?q=${encodeURIComponent(`${cleanTitle} ${primaryArtist}`)}`);
    const best2 = pickBestLrc(stage2);
    if (best2) return best2;
  }

  // Stage 3: LRCLIB Title-Only Search
  if (cleanTitle) {
    const stage3 = await callLrclib(`search?q=${encodeURIComponent(cleanTitle)}`);
    const best3 = pickBestLrc(stage3);
    if (best3) return best3;
  }

  // Stage 4: JioSaavn Native Lyrics Fallback
  if (songId) {
    try {
      const sDevRes = await fetch(`https://saavn.dev/api/songs/${songId}/lyrics`, {
        headers: { 'User-Agent': userAgent },
      });
      if (sDevRes.ok) {
        const sData = await sDevRes.json();
        const lyrics = sData?.data?.lyrics || sData?.lyrics;
        if (typeof lyrics === 'string' && lyrics.trim().length > 0) {
          return {
            trackName: cleanTitle,
            artistName: primaryArtist,
            duration,
            syncedLyrics: null,
            plainLyrics: cleanHtmlEntities(lyrics),
            source: 'saavn',
            id: songId,
          };
        }
      }
    } catch (_) {}

    try {
      const jsUrl = `https://www.jiosaavn.com/api.php?__call=lyrics.getLyrics&lyrics_id=${songId}&_format=json&ctx=web6dot0`;
      const jsRes = await fetch(jsUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          Referer: 'https://www.jiosaavn.com/',
        },
      });
      if (jsRes.ok) {
        const jsData = await jsRes.json();
        const lyrics = jsData?.lyrics;
        if (typeof lyrics === 'string' && lyrics.trim().length > 0) {
          const formatted = cleanHtmlEntities(lyrics.replace(/<br\s*\/?>/gi, '\n'));
          return {
            trackName: cleanTitle,
            artistName: primaryArtist,
            duration,
            syncedLyrics: null,
            plainLyrics: formatted,
            source: 'saavn',
            id: songId,
          };
        }
      }
    } catch (_) {}
  }

  return null;
}

/**
 * Searches JioSaavn for tracks and decrypts them into direct 320kbps stream URLs.
 */
async function searchSaavn(query: string, limit = 20): Promise<EchoTrack[]> {
  try {
    const url = `https://www.jiosaavn.com/api.php?__call=search.getResults&_format=json&n=${limit}&p=1&_marker=0&ctx=web6dot0&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Referer: 'https://www.jiosaavn.com/',
      },
    });

    if (!res.ok) {
      console.warn(`[EchoGateway] JioSaavn search returned status ${res.status}`);
      return [];
    }

    const json = (await res.json()) as { results?: any[] };
    if (!json || !Array.isArray(json.results)) return [];

    const tracks: EchoTrack[] = [];

    for (const song of json.results) {
      if (!song || !song.id) continue;

      let directAudioUrl = '';
      if (song.encrypted_media_url) {
        const decrypted = decryptDesEcb(song.encrypted_media_url, '38346591');
        if (decrypted) {
          // Upgrade 96kbps to 320kbps MP4
          directAudioUrl = decrypted.replace('_96.mp4', '_320.mp4');
        }
      }

      if (!directAudioUrl && song.media_preview_url) {
        directAudioUrl = song.media_preview_url;
      }

      if (!directAudioUrl) continue;

      const artwork = (song.image || '')
        .replace('150x150', '500x500')
        .replace('50x50', '500x500');

      tracks.push({
        id: `saavn-${song.id}`,
        title: cleanHtmlEntities(song.song || song.title || 'Untitled Track'),
        artist: cleanHtmlEntities(song.primary_artists || song.singers || 'Unknown Artist'),
        album: cleanHtmlEntities(song.album || ''),
        duration: parseInt(song.duration, 10) || 180,
        artworkUrl: artwork,
        streamUrl: directAudioUrl,
        quality: '320kbps',
        source: 'saavn',
        sourceType: 'stream',
        year: song.year || undefined,
        genre: song.language || undefined,
      });
    }

    return tracks;
  } catch (err) {
    console.warn('[EchoGateway] Saavn search failed:', err);
    return [];
  }
}

/**
 * Builds curated Home Feed sections matching Echo-Music's browsing experience.
 */
async function getHomeSections(): Promise<HomeSection[]> {
  const now = Date.now();
  if (homeCache && now - homeCache.timestamp < CACHE_TTL_MS) {
    return homeCache.sections;
  }

  const sectionConfigs = [
    {
      id: 'trending',
      title: 'Trending Now',
      subtitle: 'Global hits & viral audio taking over the charts',
      icon: 'Flame',
      query: 'Trending Hits',
    },
    {
      id: 'top-charts',
      title: 'Top Charts',
      subtitle: 'Top 50 most streamed releases worldwide',
      icon: 'Trophy',
      query: 'Global Top 50',
    },
    {
      id: 'late-night-bass',
      title: 'Late Night Bass',
      subtitle: 'Tuned for our 60Hz Sub-Bass & 120Hz Punch DSP Engine',
      icon: 'Zap',
      query: 'Bass Boosted',
    },
    {
      id: 'phonk-gym',
      title: 'Phonk & Gym',
      subtitle: 'High-octane drift phonk & heavy kick energy',
      icon: 'Activity',
      query: 'Phonk',
    },
    {
      id: 'hiphop-rnb',
      title: 'Hip-Hop & R&B',
      subtitle: 'Crisp 808s, smooth melodies & modern groove',
      icon: 'Headphones',
      query: 'Hip Hop',
    },
    {
      id: 'chill-lofi',
      title: 'Chill & Lo-Fi',
      subtitle: 'Warm analog tape saturation & late-night study vibes',
      icon: 'Coffee',
      query: 'Lofi',
    },
  ];

  const sections: HomeSection[] = [];

  for (const config of sectionConfigs) {
    const tracks = await searchSaavn(config.query, 12);
    sections.push({
      id: config.id,
      title: config.title,
      subtitle: config.subtitle,
      icon: config.icon,
      tracks: tracks.slice(0, 10),
    });
  }

  homeCache = {
    timestamp: now,
    sections,
  };

  return sections;
}

/**
 * Handles CORS Audio Proxy requests with 206 Partial Content Range support.
 */
async function handleAudioStreamProxy(
  req: IncomingMessage,
  res: ServerResponse,
  targetUrl: string
): Promise<void> {
  // CORS Headers allowing browser Web Audio createMediaElementSource
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Accept');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges, Content-Type');
  res.setHeader('Accept-Ranges', 'bytes');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  try {
    const headers: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      Referer: 'https://www.jiosaavn.com/',
      Accept: '*/*',
    };

    if (req.headers['range']) {
      headers['Range'] = req.headers['range'] as string;
    }

    // Try primary URL (e.g. 320kbps)
    let upstreamRes = await fetch(targetUrl, {
      method: req.method === 'HEAD' ? 'HEAD' : 'GET',
      headers,
    });

    // If 320kbps returned 404 or 403, fallback to 160kbps or 96kbps
    if (upstreamRes.status === 404 && targetUrl.includes('_320.mp4')) {
      const fallbackUrl = targetUrl.replace('_320.mp4', '_160.mp4');
      upstreamRes = await fetch(fallbackUrl, {
        method: req.method === 'HEAD' ? 'HEAD' : 'GET',
        headers,
      });
      if (upstreamRes.status === 404) {
        const fallback96 = targetUrl.replace('_320.mp4', '_96.mp4');
        upstreamRes = await fetch(fallback96, {
          method: req.method === 'HEAD' ? 'HEAD' : 'GET',
          headers,
        });
      }
    }

    // Forward upstream response headers
    res.statusCode = upstreamRes.status;

    const contentType = upstreamRes.headers.get('content-type') || 'audio/mp4';
    const contentLength = upstreamRes.headers.get('content-length');
    const contentRange = upstreamRes.headers.get('content-range');

    res.setHeader('Content-Type', contentType);
    if (contentLength) res.setHeader('Content-Length', contentLength);
    if (contentRange) res.setHeader('Content-Range', contentRange);
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');

    if (req.method === 'HEAD' || !upstreamRes.body) {
      res.end();
      return;
    }

    // Pipe audio data to client with backpressure management
    const nodeStream = Readable.fromWeb(upstreamRes.body as any);
    nodeStream.on('error', (err: unknown) => {
      console.warn('[EchoGateway] Proxy stream error:', err);
      if (!res.headersSent) {
        res.statusCode = 502;
        res.end();
      }
    });

    nodeStream.pipe(res);
  } catch (err) {
    console.error('[EchoGateway] Proxy request failed:', err);
    if (!res.headersSent) {
      res.statusCode = 502;
      res.end('Proxy Fetch Error');
    }
  }
}

/**
 * Vite Plugin that registers the Echo Music Gateway middleware on the dev server.
 */
export function echoGatewayPlugin(): Plugin {
  return {
    name: 'vite-plugin-echo-streaming-gateway',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        const httpReq = req as IncomingMessage;
        const urlStr = httpReq.url || '';

        // Only handle /api/echo/... endpoints
        if (!urlStr.startsWith('/api/echo/')) {
          return next();
        }

        try {
          const parsed = new URL(urlStr, 'http://localhost');
          const pathname = parsed.pathname;

          // 1. GET /api/echo/search?q=...
          if (pathname === '/api/echo/search') {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Content-Type', 'application/json');

            const query = parsed.searchParams.get('q') || '';
            if (!query.trim()) {
              res.end(JSON.stringify({ tracks: [] }));
              return;
            }

            const tracks = await searchSaavn(query.trim(), 25);
            res.end(JSON.stringify({ tracks }));
            return;
          }

          // 2. GET /api/echo/home
          if (pathname === '/api/echo/home') {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Content-Type', 'application/json');

            const sections = await getHomeSections();
            res.end(JSON.stringify({ sections }));
            return;
          }

          // 3. GET /api/echo/stream?url=...
          if (pathname === '/api/echo/stream') {
            const targetUrl = parsed.searchParams.get('url');
            if (!targetUrl) {
              res.statusCode = 400;
              res.end('Missing url parameter');
              return;
            }

            await handleAudioStreamProxy(req, res, targetUrl);
            return;
          }

          // 4. GET /api/echo/lyrics?title=...&artist=...&duration=...&songId=...
          if (pathname === '/api/echo/lyrics') {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', '*');
            res.setHeader('Content-Type', 'application/json');

            if (httpReq.method === 'OPTIONS') {
              res.statusCode = 204;
              res.end();
              return;
            }

            const title = parsed.searchParams.get('title') || '';
            const artist = parsed.searchParams.get('artist') || '';
            const duration = parseFloat(parsed.searchParams.get('duration') || '0');
            const songId = parsed.searchParams.get('songId') || '';

            if (!title.trim()) {
              res.statusCode = 400;
              res.end(JSON.stringify({ success: false, error: 'Missing title parameter' }));
              return;
            }

            const result = await fetchLyricsMultiSource(title, artist, duration, songId);
            if (!result) {
              res.end(JSON.stringify({ success: false, error: 'No lyrics found' }));
              return;
            }

            res.end(JSON.stringify({ success: true, ...result }));
            return;
          }

          // -------------------------------------------------------------------
          // 5. VYBE CONNECT: POST /api/echo/connect/heartbeat
          // -------------------------------------------------------------------
          if (pathname === '/api/echo/connect/heartbeat' && httpReq.method === 'POST') {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Content-Type', 'application/json');

            const body = await readJsonBody<Partial<ConnectDevice>>(httpReq);
            if (!body || !body.deviceId) {
              res.statusCode = 400;
              res.end(JSON.stringify({ success: false, error: 'Missing deviceId' }));
              return;
            }

            const device: ConnectDevice = {
              deviceId: body.deviceId,
              deviceName: body.deviceName || 'Vybe Device',
              deviceType: body.deviceType || 'laptop',
              currentTrack: body.currentTrack || null,
              currentTime: typeof body.currentTime === 'number' ? body.currentTime : 0,
              isPlaying: Boolean(body.isPlaying),
              volume: typeof body.volume === 'number' ? body.volume : 0.85,
              queue: Array.isArray(body.queue) ? body.queue : [],
              userId: body.userId,
              lastSeen: Date.now(),
            };

            connectDevices.set(device.deviceId, device);

            // Evict stale devices (> 12s)
            const now = Date.now();
            for (const [id, dev] of connectDevices.entries()) {
              if (now - dev.lastSeen > 12000) {
                connectDevices.delete(id);
                pendingCommands.delete(id);
              }
            }

            res.end(
              JSON.stringify({
                success: true,
                activeDevices: Array.from(connectDevices.values()),
              })
            );
            return;
          }

          // -------------------------------------------------------------------
          // 6. VYBE CONNECT: POST /api/echo/connect/command
          // -------------------------------------------------------------------
          if (pathname === '/api/echo/connect/command' && httpReq.method === 'POST') {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Content-Type', 'application/json');

            const body = await readJsonBody<{
              fromDeviceId: string;
              targetDeviceId: string;
              command: string;
              payload?: unknown;
            }>(httpReq);

            if (!body || !body.targetDeviceId || !body.command) {
              res.statusCode = 400;
              res.end(JSON.stringify({ success: false, error: 'Invalid command payload' }));
              return;
            }

            const cmd: ConnectCommand = {
              id: `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              fromDeviceId: body.fromDeviceId || '',
              targetDeviceId: body.targetDeviceId,
              command: body.command as ConnectCommand['command'],
              payload: body.payload || {},
              timestamp: Date.now(),
            };

            if (!pendingCommands.has(body.targetDeviceId)) {
              pendingCommands.set(body.targetDeviceId, []);
            }
            pendingCommands.get(body.targetDeviceId)!.push(cmd);

            res.end(JSON.stringify({ success: true, commandId: cmd.id }));
            return;
          }

          // -------------------------------------------------------------------
          // 7. VYBE CONNECT: GET /api/echo/connect/state?deviceId=...
          // -------------------------------------------------------------------
          if (pathname === '/api/echo/connect/state') {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Content-Type', 'application/json');

            const deviceId = parsed.searchParams.get('deviceId') || '';
            const cmds = (deviceId && pendingCommands.get(deviceId)) || [];
            if (deviceId) {
              pendingCommands.set(deviceId, []);
            }

            // Clean stale devices
            const now = Date.now();
            for (const [id, dev] of connectDevices.entries()) {
              if (now - dev.lastSeen > 12000) {
                connectDevices.delete(id);
                pendingCommands.delete(id);
              }
            }

            res.end(
              JSON.stringify({
                success: true,
                activeDevices: Array.from(connectDevices.values()),
                pendingCommands: cmds,
              })
            );
            return;
          }

          // -------------------------------------------------------------------
          // 8. LIVE JAM: POST /api/echo/jam/create
          // -------------------------------------------------------------------
          if (pathname === '/api/echo/jam/create' && httpReq.method === 'POST') {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Content-Type', 'application/json');

            const body = await readJsonBody<{
              hostUser: { id: string; name: string; avatarColor: string };
              track?: unknown;
              currentTime?: number;
              isPlaying?: boolean;
              queue?: unknown[];
            }>(httpReq);

            const randomCode = `VYB-${Math.floor(100 + Math.random() * 900)}`;
            const room: JamRoom = {
              roomCode: randomCode,
              hostUser: body?.hostUser || { id: 'host-1', name: 'DJ Host', avatarColor: '#8B5CF6' },
              participants: [
                {
                  id: body?.hostUser?.id || 'host-1',
                  name: body?.hostUser?.name || 'DJ Host',
                  avatarColor: body?.hostUser?.avatarColor || '#8B5CF6',
                  joinedAt: Date.now(),
                  isHost: true,
                },
              ],
              currentTrack: body?.track || null,
              currentTime: body?.currentTime || 0,
              isPlaying: Boolean(body?.isPlaying),
              queue: Array.isArray(body?.queue)
                ? (body.queue as JamSong[])
                : [],
              updatedAt: Date.now(),
            };

            jamRooms.set(randomCode, room);

            res.end(JSON.stringify({ success: true, roomCode: randomCode, room }));
            return;
          }

          // -------------------------------------------------------------------
          // 9. LIVE JAM: POST /api/echo/jam/join
          // -------------------------------------------------------------------
          if (pathname === '/api/echo/jam/join' && httpReq.method === 'POST') {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Content-Type', 'application/json');

            const body = await readJsonBody<{
              roomCode: string;
              user: { id: string; name: string; avatarColor: string };
            }>(httpReq);

            const code = (body?.roomCode || '').toUpperCase().trim();
            const room = jamRooms.get(code);

            if (!room) {
              res.statusCode = 404;
              res.end(JSON.stringify({ success: false, error: 'Room not found. Check your 6-digit code.' }));
              return;
            }

            if (body?.user && !room.participants.some((p) => p.id === body.user.id)) {
              room.participants.push({
                id: body.user.id,
                name: body.user.name,
                avatarColor: body.user.avatarColor || '#3B82F6',
                joinedAt: Date.now(),
                isHost: false,
              });
              room.updatedAt = Date.now();
            }

            res.end(JSON.stringify({ success: true, room }));
            return;
          }

          // -------------------------------------------------------------------
          // 10. LIVE JAM: POST /api/echo/jam/action
          // -------------------------------------------------------------------
          if (pathname === '/api/echo/jam/action' && httpReq.method === 'POST') {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Content-Type', 'application/json');

            const body = await readJsonBody<{
              roomCode: string;
              action: 'ADD_SONG' | 'SYNC_PLAYBACK' | 'VOTE_TRACK' | 'LEAVE';
              payload?: any;
              user?: { id: string; name: string; avatarColor: string };
            }>(httpReq);

            const code = (body?.roomCode || '').toUpperCase().trim();
            const room = jamRooms.get(code);

            if (!room) {
              res.statusCode = 404;
              res.end(JSON.stringify({ success: false, error: 'Room not found.' }));
              return;
            }

            if (body?.action === 'ADD_SONG' && body.payload?.track && body.user) {
              room.queue.push({
                track: body.payload.track,
                addedBy: body.user,
                votes: 1,
                addedAt: Date.now(),
              });
              room.updatedAt = Date.now();
            } else if (body?.action === 'SYNC_PLAYBACK' && body.payload) {
              if (body.payload.currentTrack !== undefined) room.currentTrack = body.payload.currentTrack;
              if (typeof body.payload.currentTime === 'number') room.currentTime = body.payload.currentTime;
              if (typeof body.payload.isPlaying === 'boolean') room.isPlaying = body.payload.isPlaying;
              room.updatedAt = Date.now();
            } else if (body?.action === 'VOTE_TRACK' && body.payload?.trackId) {
              const item = room.queue.find((q) => (q.track as any)?.id === body.payload.trackId);
              if (item) {
                item.votes = (item.votes || 0) + 1;
                room.queue.sort((a, b) => b.votes - a.votes);
                room.updatedAt = Date.now();
              }
            } else if (body?.action === 'LEAVE' && body.user) {
              room.participants = room.participants.filter((p) => p.id !== body.user?.id);
              room.updatedAt = Date.now();
            }

            res.end(JSON.stringify({ success: true, room }));
            return;
          }

          // -------------------------------------------------------------------
          // 11. LIVE JAM: GET /api/echo/jam/state?roomCode=...
          // -------------------------------------------------------------------
          if (pathname === '/api/echo/jam/state') {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Content-Type', 'application/json');

            const code = (parsed.searchParams.get('roomCode') || '').toUpperCase().trim();
            const room = jamRooms.get(code);

            if (!room) {
              res.statusCode = 404;
              res.end(JSON.stringify({ success: false, error: 'Jam session not found.' }));
              return;
            }

            res.end(JSON.stringify({ success: true, room }));
            return;
          }

          next();
        } catch (err) {
          console.error('[EchoGateway] Middleware error:', err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Internal Gateway Error' }));
        }
      });
    },
  };
}
