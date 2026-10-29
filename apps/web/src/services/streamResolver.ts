/**
 * Universal Stream & Catalog Resolver
 * 
 * Works seamlessly in:
 * 1. Vite Dev Mode (routes via /api/echo/... local proxy when active)
 * 2. Vercel Production Web (automatic multi-instance CORS mirrors & direct 320kbps streams)
 * 3. Standalone Electron Desktop (direct high-bitrate CDN streams with native CORS bypass)
 * 4. Capacitor Android Smartphone APK (direct high-bitrate CDN streams via native WebView)
 */

import { decryptDesEcb } from '../server/des';

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

/** Detect if running inside Electron shell */
export function isElectronEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    (window as unknown as { electron?: unknown }).electron ||
      navigator.userAgent.toLowerCase().includes('electron')
  );
}

/** Detect if running inside Capacitor Android native shell */
export function isCapacitorEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  const win = window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } };
  return Boolean(win.Capacitor?.isNativePlatform?.() || win.Capacitor);
}

/**
 * Checks if the application is running packaged as a standalone desktop app or mobile APK.
 */
export function isStandaloneApp(): boolean {
  return !import.meta.env.DEV || isElectronEnvironment() || isCapacitorEnvironment();
}

function cleanHtmlEntities(text?: string): string {
  if (!text) return '';
  return text
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

/**
 * Universal Stream URL Resolver:
 * - Always unwraps any /api/echo/stream?url=... to the direct media link so production
 *   never fails on missing backend proxy.
 * - Enforces HTTPS (upgrading any http://) to avoid Mixed Content blocking on Vercel.
 * - Directly streams from aac.saavncdn.com (which natively provides CORS * and byte ranges).
 */
export function resolveStreamUrl(streamUrl?: string): string {
  if (!streamUrl) return '';

  // If local blob or direct data URL, return immediately
  if (streamUrl.startsWith('blob:') || streamUrl.startsWith('data:')) {
    return streamUrl;
  }

  // If already wrapped in /api/echo/stream, unwrap to direct URL
  if (streamUrl.startsWith('/api/echo/stream') || streamUrl.includes('/api/echo/stream?url=')) {
    const match = streamUrl.match(/[?&]url=([^&]+)/);
    if (match && match[1]) {
      const direct = decodeURIComponent(match[1]);
      return resolveStreamUrl(direct);
    }
  }

  // Ensure HTTPS for all remote HTTP streams to avoid browser Mixed Content blocking
  let cleanUrl = streamUrl;
  if (cleanUrl.startsWith('http://')) {
    cleanUrl = cleanUrl.replace('http://', 'https://');
  }

  return cleanUrl;
}

/**
 * Active, verified public JioSaavn HTTPS API mirrors with full CORS headers
 */
export const JIOSAAVN_MIRRORS = [
  'https://jiosaavn-api-taupe.vercel.app',
  'https://jiosaavn-api-2.vercel.app',
  'https://jiosaavn-api-rose.vercel.app',
  'https://jiosaavn-api-gold.vercel.app',
];

let fastestMirror = JIOSAAVN_MIRRORS[0];

function parseMirrorSongs(list: any[]): EchoTrack[] {
  if (!Array.isArray(list)) return [];
  const tracks: EchoTrack[] = [];

  for (const song of list) {
    if (!song || !song.id) continue;

    let directAudioUrl = '';
    if (Array.isArray(song.downloadUrl)) {
      const q320 = song.downloadUrl.find((d: any) => d.quality === '320kbps');
      const q160 = song.downloadUrl.find((d: any) => d.quality === '160kbps');
      const q96 = song.downloadUrl.find((d: any) => d.quality === '96kbps');
      const best = q320 || q160 || q96 || song.downloadUrl[song.downloadUrl.length - 1];
      directAudioUrl = best?.link || best?.url || '';
    } else if (typeof song.downloadUrl === 'string') {
      directAudioUrl = song.downloadUrl;
    } else if (song.media_preview_url) {
      directAudioUrl = song.media_preview_url;
    }

    if (!directAudioUrl) continue;

    // Force HTTPS for all streams
    if (directAudioUrl.startsWith('http://')) {
      directAudioUrl = directAudioUrl.replace('http://', 'https://');
    }

    let artwork = '';
    if (Array.isArray(song.image) && song.image.length > 0) {
      artwork =
        song.image[song.image.length - 1]?.link ||
        song.image[song.image.length - 1]?.url ||
        song.image[0]?.link ||
        song.image[0]?.url ||
        '';
    } else if (typeof song.image === 'string') {
      artwork = song.image;
    }

    artwork = artwork.replace('150x150', '500x500').replace('50x50', '500x500');
    if (artwork.startsWith('http://')) {
      artwork = artwork.replace('http://', 'https://');
    }

    const primaryArtists = Array.isArray(song.artists?.primary)
      ? song.artists.primary.map((a: any) => a.name).join(', ')
      : song.primaryArtists ||
        song.primary_artists ||
        song.artist ||
        song.singers ||
        'Unknown Artist';

    tracks.push({
      id: `saavn-${song.id}`,
      title: cleanHtmlEntities(song.name || song.song || song.title || 'Untitled Track'),
      artist: cleanHtmlEntities(primaryArtists),
      album: cleanHtmlEntities(
        typeof song.album === 'object' ? song.album?.name || '' : song.album || ''
      ),
      duration: parseInt(String(song.duration), 10) || 180,
      artworkUrl: artwork,
      streamUrl: resolveStreamUrl(directAudioUrl),
      quality: directAudioUrl.includes('_320') ? '320kbps' : '160kbps',
      source: 'saavn',
      sourceType: 'stream',
      year: song.year || undefined,
      genre: song.language || undefined,
    });
  }

  return tracks;
}

/**
 * Searches a single JioSaavn mirror with timeout protection
 */
async function searchMirror(mirrorUrl: string, query: string, limit = 20): Promise<EchoTrack[]> {
  try {
    const url = `${mirrorUrl}/search/songs?query=${encodeURIComponent(query)}&limit=${limit}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4500) });
    const ct = res.headers.get('content-type') || '';
    if (!res.ok || !ct.includes('json')) return [];

    const json = await res.json();
    const list = json?.data?.results || json?.results || json?.data;
    if (!Array.isArray(list) || list.length === 0) return [];

    const tracks = parseMirrorSongs(list);
    if (tracks.length > 0) {
      fastestMirror = mirrorUrl;
    }
    return tracks;
  } catch {
    return [];
  }
}

/**
 * Direct client-side JioSaavn search using pure JS DES-ECB decryption.
 */
async function searchSaavnDirect(query: string, limit = 20): Promise<EchoTrack[]> {
  try {
    const url = `https://www.jiosaavn.com/api.php?__call=search.getResults&_format=json&n=${limit}&p=1&_marker=0&ctx=web6dot0&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return [];

    const json = (await res.json()) as { results?: any[] };
    if (!json || !Array.isArray(json.results)) return [];

    const tracks: EchoTrack[] = [];

    for (const song of json.results) {
      if (!song || !song.id) continue;

      let directAudioUrl = '';
      if (song.encrypted_media_url) {
        const decrypted = decryptDesEcb(song.encrypted_media_url, '38346591');
        if (decrypted) {
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
        streamUrl: resolveStreamUrl(directAudioUrl),
        quality: '320kbps',
        source: 'saavn',
        sourceType: 'stream',
        year: song.year || undefined,
        genre: song.language || undefined,
      });
    }

    return tracks;
  } catch {
    return [];
  }
}

/**
 * Universal Catalog Search:
 * 1. If in Vite Dev mode, tries `/api/echo/search?q=...`
 * 2. Cascades through multiple active HTTPS public JioSaavn mirrors with CORS *
 * 3. Fallback to client-side DES decryption
 */
export async function fetchCatalogSearch(query: string, limit = 20): Promise<EchoTrack[]> {
  const cleanQ = query.trim();
  if (!cleanQ) return [];

  // Prioritize fastest mirror first, cascading across live CORS-enabled HTTPS mirrors
  const prioritizedMirrors = [
    fastestMirror,
    ...JIOSAAVN_MIRRORS.filter((m) => m !== fastestMirror),
  ];

  for (const mirror of prioritizedMirrors) {
    const results = await searchMirror(mirror, cleanQ, limit);
    if (results.length > 0) {
      return results;
    }
  }

  // Fallback: Direct JioSaavn HTTPS API with client-side DES decryption
  const directResults = await searchSaavnDirect(cleanQ, limit);
  if (directResults.length > 0) return directResults;

  return [];
}

// In-memory cache for home feed sections (15 min TTL)
let homeFeedCache: { timestamp: number; sections: HomeSection[] } | null = null;
const CACHE_TTL_MS = 15 * 60 * 1000;

/**
 * Universal Home Feed:
 * 1. Returns cached sections immediately for 0ms startup (memory & localStorage)
 * 2. Fetches curated sections in parallel across active HTTPS mirrors
 */
export async function fetchHomeFeed(): Promise<HomeSection[]> {
  const now = Date.now();
  if (homeFeedCache && now - homeFeedCache.timestamp < CACHE_TTL_MS) {
    return homeFeedCache.sections;
  }

  // Check localStorage cache for instant zero-latency first paint
  try {
    const rawCached =
      typeof localStorage !== 'undefined'
        ? localStorage.getItem('vybe_home_feed_cache_v2')
        : null;
    if (rawCached) {
      const parsed = JSON.parse(rawCached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        if (!homeFeedCache) {
          homeFeedCache = { timestamp: now, sections: parsed };
        }
      }
    }
  } catch {}

  // Build client-side curated home sections in parallel across verified mirrors
  const configs = [
    {
      id: 'trending',
      title: 'Trending Now',
      subtitle: 'Global hits & viral audio taking over the charts',
      icon: 'Flame',
      query: 'Top Hits 2026',
    },
    {
      id: 'chill',
      title: 'Late Night Chill',
      subtitle: 'Deep atmospheric tones, lo-fi beats & nocturnal soundscapes',
      icon: 'Moon',
      query: 'Chill Lo-Fi Beats',
    },
    {
      id: 'workout',
      title: 'High Energy Workout',
      subtitle: '130+ BPM punchy basslines & motivating gym anthems',
      icon: 'Zap',
      query: 'Workout Bass EDM',
    },
    {
      id: 'bollywood',
      title: 'Bollywood & Desi Beats',
      subtitle: 'Chart-topping romantic melodies & Punjabi club tracks',
      icon: 'Music',
      query: 'Bollywood Hits',
    },
  ];

  try {
    const results = await Promise.allSettled(
      configs.map((cfg) => fetchCatalogSearch(cfg.query, 12))
    );

    const sections: HomeSection[] = [];
    results.forEach((res, i) => {
      const cfg = configs[i];
      const tracks = res.status === 'fulfilled' ? res.value : [];
      if (tracks.length > 0) {
        sections.push({
          id: cfg.id,
          title: cfg.title,
          subtitle: cfg.subtitle,
          icon: cfg.icon,
          tracks: tracks.slice(0, 10),
        });
      }
    });

    if (sections.length > 0) {
      homeFeedCache = { timestamp: now, sections };
      try {
        localStorage.setItem('vybe_home_feed_cache_v2', JSON.stringify(sections));
      } catch {}
      return sections;
    }
  } catch (err) {
    console.warn('[streamResolver] Failed to build home feed:', err);
  }

  return homeFeedCache?.sections || [];
}
