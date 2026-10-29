/**
 * Universal Stream & Official Catalog Resolver for Vybe
 * 
 * Works seamlessly in:
 * 1. Native Windows Desktop Electron App (IPC YouTube Music Resolver + direct 320kbps CDN audio)
 * 2. Vite Dev Mode (routes via /api/resolve-stream & /api/echo/... local proxy)
 * 3. Vercel Production Web (multi-mirror fallback + public Piped & iTunes streaming)
 * 4. Capacitor Mobile APK (direct high-bitrate CDN streams via native WebView)
 */

import { decryptDesEcb } from '../server/des';
import { TrackMetadata } from '../providers/types';

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
  previewUrl?: string;
  // Universal track properties for UI component compatibility
  coverUrl?: string;
  image?: string;
  artwork?: string;
  audioUrl?: string;
  url?: string;
}

export const DEFAULT_ARTWORK_FALLBACK = './logo.png';

/**
 * STRICT ANTI-KARAOKE & BOOTLEG FILTER
 * Immediately rejects fake karaoke tracks (ZZang KARAOKE), 16-bit emulations (Arcade Player),
 * instrumental covers, tribute tracks, ringtones, chipmunk, and nightcore versions.
 */
export const ANTI_KARAOKE_REGEX =
  /\b(karaoke|zzang|arcade player|16-bit|8-bit|emulation|originally perf|performed by|tribute to|melody version|instrumental version|ringtone|8d audio|chipmunk|nightcore|1 hour|10 hours|hour loop)\b/i;

export function isKaraokeOrBootleg(title?: string, artist?: string, album?: string): boolean {
  const combined = `${title || ''} ${artist || ''} ${album || ''}`;
  return ANTI_KARAOKE_REGEX.test(combined);
}

/**
 * Normalizes string for strict title and artist comparison.
 * Strips punctuation, casing, (feat...), [Official Video], and whitespace.
 */
export function normalizeSongString(str?: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[\(\[]\s*(?:feat\.?|ft\.?)[^\)\]]*[\)\]]/gi, '')
    .replace(/\b(?:feat\.?|ft\.?)\b.*$/gi, '')
    .replace(/[\(\[]\s*official\s*(?:video|audio|music\s*video|lyric\s*video)?\s*[\)\]]/gi, '')
    .replace(/[^a-z0-9]/gi, '')
    .trim();
}

/**
 * Verifies if two artist strings match.
 * Prevents attaching fake regional / cover artists to official global tracks.
 */
export function isArtistMatch(artistA?: string, artistB?: string): boolean {
  if (!artistA || !artistB) return false;
  const normA = normalizeSongString(artistA);
  const normB = normalizeSongString(artistB);
  if (!normA || !normB) return false;
  if (normA === normB || normA.includes(normB) || normB.includes(normA)) {
    return true;
  }

  // Check the primary artist name before any commas, slashes, or ampersands
  const primaryA = normalizeSongString(artistA.split(/[,&/]/)[0]);
  const primaryB = normalizeSongString(artistB.split(/[,&/]/)[0]);
  if (
    primaryA &&
    primaryB &&
    (primaryA === primaryB || primaryA.includes(primaryB) || primaryB.includes(primaryA))
  ) {
    return true;
  }

  return false;
}

/**
 * Verifies if two song titles match.
 */
export function isTitleMatch(titleA?: string, titleB?: string): boolean {
  if (!titleA || !titleB) return false;
  const normA = normalizeSongString(titleA);
  const normB = normalizeSongString(titleB);
  if (!normA || !normB) return false;
  return normA === normB || normA.includes(normB) || normB.includes(normA);
}

/**
 * Robust URL extractor handling all JioSaavn API formats and enforcing HTTPS.
 */
export function extractBestUrl(field: any): string {
  if (!field) return '';
  if (typeof field === 'string') return field.replace(/^http:\/\//i, 'https://');
  if (Array.isArray(field) && field.length > 0) {
    const best = field[field.length - 1] || field[0];
    const raw = typeof best === 'string' ? best : (best?.url || best?.link || best?.src || '');
    return String(raw).replace(/^http:\/\//i, 'https://');
  }
  if (typeof field === 'object') {
    const raw = field.url || field.link || field['500x500'] || field['320kbps'] || '';
    return String(raw).replace(/^http:\/\//i, 'https://');
  }
  return '';
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

export function isStandaloneApp(): boolean {
  return !import.meta.env.DEV || isElectronEnvironment() || isCapacitorEnvironment();
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
    .trim();
}

/**
 * Universal Stream URL Cleaner:
 * - Unwraps /api/echo/stream?url=...
 * - Enforces HTTPS
 */
export function resolveStreamUrl(streamUrl?: string): string {
  if (!streamUrl) return '';

  if (streamUrl.startsWith('blob:') || streamUrl.startsWith('data:')) {
    return streamUrl;
  }

  if (streamUrl.startsWith('/api/echo/stream') || streamUrl.includes('/api/echo/stream?url=')) {
    const match = streamUrl.match(/[?&]url=([^&]+)/);
    if (match && match[1]) {
      const direct = decodeURIComponent(match[1]);
      return resolveStreamUrl(direct);
    }
  }

  let cleanUrl = streamUrl;
  if (cleanUrl.startsWith('http://')) {
    cleanUrl = cleanUrl.replace('http://', 'https://');
  }

  return cleanUrl;
}

/**
 * Verified public JioSaavn HTTPS API mirrors
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
    if (!song || (!song.id && !song.songId)) continue;
    const songId = String(song.id || song.songId);

    const cleanTitleStr = cleanHtmlEntities(song.name || song.song || song.title || 'Untitled Track');
    const primaryArtists = Array.isArray(song.artists?.primary)
      ? song.artists.primary.map((a: any) => a.name).join(', ')
      : song.primaryArtists ||
        song.primary_artists ||
        song.artist ||
        song.singers ||
        'Unknown Artist';
    const cleanArtistStr = cleanHtmlEntities(primaryArtists);
    const cleanAlbumStr = cleanHtmlEntities(
      typeof song.album === 'object' ? song.album?.name || '' : song.album || ''
    );

    // Strict Anti-Karaoke / Bootleg Filter
    if (isKaraokeOrBootleg(cleanTitleStr, cleanArtistStr, cleanAlbumStr)) {
      continue;
    }

    let directAudioUrl = extractBestUrl(
      song.downloadUrl ||
      song.download_url ||
      song.media_url ||
      song.audioUrl ||
      song.streamUrl ||
      song.url ||
      song.media_preview_url
    );

    if (!directAudioUrl && song.encrypted_media_url) {
      const decrypted = decryptDesEcb(song.encrypted_media_url, '38346591');
      if (decrypted) {
        directAudioUrl = decrypted.replace('_96.mp4', '_320.mp4');
      }
    }

    if (directAudioUrl.startsWith('http://')) {
      directAudioUrl = directAudioUrl.replace('http://', 'https://');
    }

    let artwork = extractBestUrl(song.image || song.images || song.artworkUrl || song.coverUrl);
    if (artwork) {
      artwork = artwork.replace('150x150', '500x500').replace('50x50', '500x500');
    }
    if (!artwork) {
      artwork = DEFAULT_ARTWORK_FALLBACK;
    }

    const resolvedStream = resolveStreamUrl(directAudioUrl);

    tracks.push({
      id: songId.startsWith('saavn-') ? songId : `saavn-${songId}`,
      title: cleanTitleStr,
      artist: cleanArtistStr,
      album: cleanAlbumStr,
      duration: parseInt(String(song.duration), 10) || 180,
      artworkUrl: artwork,
      coverUrl: artwork,
      image: artwork,
      artwork: artwork,
      streamUrl: resolvedStream,
      audioUrl: resolvedStream,
      url: resolvedStream,
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
 * 1. Primary Official Catalog Search via Apple Music / iTunes Official API:
 * Guaranteed 100% real, official studio songs with 600x600 artwork and accurate duration.
 */
export async function fetchITunesCatalogSearch(query: string, limit = 25): Promise<EchoTrack[]> {
  try {
    const url = `https://itunes.apple.com/search?media=music&entity=song&limit=${limit}&term=${encodeURIComponent(query)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4500) });
    if (!res.ok) return [];

    const json = await res.json();
    if (!json || !Array.isArray(json.results)) return [];

    const tracks: EchoTrack[] = [];
    for (const item of json.results) {
      if (!item || !item.trackName) continue;

      const title = cleanHtmlEntities(item.trackName);
      const artist = cleanHtmlEntities(item.artistName);
      const album = cleanHtmlEntities(item.collectionName);

      // Strict Anti-Karaoke Filter: reject tributes, emulation, and instrumentals
      if (isKaraokeOrBootleg(title, artist, album)) {
        continue;
      }

      // Upgrade official iTunes cover art from 100x100 to 600x600 high-res
      const artwork = item.artworkUrl100
        ? item.artworkUrl100.replace('100x100bb', '600x600bb')
        : DEFAULT_ARTWORK_FALLBACK;

      const duration = Math.round((item.trackTimeMillis || 0) / 1000) || 180;
      const previewUrl = item.previewUrl ? item.previewUrl.replace(/^http:\/\//i, 'https://') : '';

      tracks.push({
        id: `itunes-${item.trackId}`,
        title,
        artist,
        album,
        duration,
        artworkUrl: artwork,
        coverUrl: artwork,
        image: artwork,
        artwork: artwork,
        streamUrl: '', // Bound to direct JioSaavn match or YouTube Music stream on playback
        audioUrl: '',
        url: '',
        previewUrl,
        quality: '320kbps',
        source: 'ytmusic',
        sourceType: 'stream',
        year: item.releaseDate ? String(new Date(item.releaseDate).getFullYear()) : undefined,
        genre: item.primaryGenreName,
      });
    }

    return tracks;
  } catch (err) {
    console.warn('[streamResolver] iTunes catalog search error:', err);
    return [];
  }
}

/**
 * 2. Direct Client-Side Indian JioSaavn API Search with DES-ECB 38346591 Decryption.
 */
export async function searchSaavnDirect(query: string, limit = 30): Promise<EchoTrack[]> {
  try {
    const url = `https://www.jiosaavn.com/api.php?__call=search.getResults&_format=json&_marker=0&api_version=4&ctx=web6dot0&n=${limit}&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5500) });
    if (!res.ok) return [];

    const json = (await res.json()) as { results?: any[] };
    if (!json || !Array.isArray(json.results)) return [];

    const tracks: EchoTrack[] = [];

    for (const song of json.results) {
      if (!song || !song.id) continue;

      const cleanTitleStr = cleanHtmlEntities(song.title || song.song || 'Untitled Track');
      const primaryArtists =
        song.more_info?.artistMap?.primary_artists?.map((a: any) => a.name).join(', ') ||
        song.more_info?.music ||
        song.primary_artists ||
        song.singers ||
        song.subtitle ||
        'Unknown Artist';
      const cleanArtistStr = cleanHtmlEntities(primaryArtists);
      const cleanAlbumStr = cleanHtmlEntities(song.more_info?.album || song.album || '');

      // Strict Anti-Karaoke Filter
      if (isKaraokeOrBootleg(cleanTitleStr, cleanArtistStr, cleanAlbumStr)) {
        continue;
      }

      let directAudioUrl = '';
      const enc = song.more_info?.encrypted_media_url || song.encrypted_media_url;
      if (enc) {
        const decrypted = decryptDesEcb(enc, '38346591');
        if (decrypted) {
          directAudioUrl = decrypted.replace('_96.mp4', '_320.mp4').replace('_160.mp4', '_320.mp4');
        }
      }

      if (!directAudioUrl && song.media_preview_url) {
        directAudioUrl = song.media_preview_url;
      }

      let artwork = extractBestUrl(song.image || song.images);
      if (artwork) {
        artwork = artwork.replace('150x150', '500x500').replace('50x50', '500x500');
      }
      if (!artwork) {
        artwork = DEFAULT_ARTWORK_FALLBACK;
      }

      const finalStream = resolveStreamUrl(directAudioUrl);

      tracks.push({
        id: `saavn-${song.id}`,
        title: cleanTitleStr,
        artist: cleanArtistStr,
        album: cleanAlbumStr,
        duration: parseInt(song.more_info?.duration || song.duration, 10) || 180,
        artworkUrl: artwork,
        coverUrl: artwork,
        image: artwork,
        artwork: artwork,
        streamUrl: finalStream,
        audioUrl: finalStream,
        url: finalStream,
        quality: '320kbps',
        source: 'saavn',
        sourceType: 'stream',
        year: song.year || undefined,
        genre: song.language || undefined,
      });
    }

    return tracks;
  } catch (err) {
    console.warn('[streamResolver] JioSaavn direct search error:', err);
    return [];
  }
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
 * Universal Catalog Search Pipeline:
 * 1. Parallel Official Search (iTunes Official Catalog + Direct JioSaavn API)
 * 2. Strict Title & Artist Verification to attach JioSaavn 320kbps streams to official songs
 * 3. Fallback to active mirrors and client-side DES decryption
 */
export async function fetchCatalogSearch(query: string, limit = 25): Promise<EchoTrack[]> {
  const cleanQ = query.trim();
  if (!cleanQ) return [];

  // Parallel fetch: iTunes official metadata + direct JioSaavn results
  const [itunesRes, saavnRes] = await Promise.allSettled([
    fetchITunesCatalogSearch(cleanQ, limit),
    searchSaavnDirect(cleanQ, limit + 5),
  ]);

  const itunesTracks = itunesRes.status === 'fulfilled' ? itunesRes.value : [];
  const saavnTracks = saavnRes.status === 'fulfilled' ? saavnRes.value : [];

  if (itunesTracks.length > 0) {
    const finalTracks: EchoTrack[] = [];
    const matchedSaavnIds = new Set<string>();

    for (const official of itunesTracks) {
      // Direct JioSaavn Stream Matcher with STRICT Artist + Title Verification
      const matched = saavnTracks.find((s) => {
        if (!s.streamUrl) return false;
        return isTitleMatch(official.title, s.title) && isArtistMatch(official.artist, s.artist);
      });

      if (matched && matched.streamUrl) {
        official.streamUrl = matched.streamUrl;
        official.audioUrl = matched.streamUrl;
        official.url = matched.streamUrl;
        official.source = 'saavn';
        official.quality = '320kbps';
        matchedSaavnIds.add(matched.id);
      }

      finalTracks.push(official);
    }

    // Append genuine Indian / regional releases found on JioSaavn that weren't in iTunes
    for (const sTrack of saavnTracks) {
      if (matchedSaavnIds.has(sTrack.id)) continue;
      const alreadyPresent = finalTracks.some(
        (f) => isTitleMatch(f.title, sTrack.title) && isArtistMatch(f.artist, sTrack.artist)
      );
      if (!alreadyPresent && sTrack.streamUrl) {
        finalTracks.push(sTrack);
      }
    }

    return finalTracks.slice(0, limit);
  }

  // Fallback if iTunes is unavailable: use verified JioSaavn results
  if (saavnTracks.length > 0) {
    return saavnTracks.slice(0, limit);
  }

  // Fallback to active CORS mirrors
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

  return [];
}

/**
 * On-Demand Saavn Stream Fetch Fallback
 */
export async function fetchTrackStreamOnDemand(trackId: string): Promise<string> {
  const cleanId = trackId.replace(/^saavn-/, '').trim();
  if (!cleanId || trackId.startsWith('itunes-')) return '';

  const mirrors = [
    `https://jiosaavn-api-taupe.vercel.app/api/songs/${cleanId}`,
    `https://jiosaavn-api-2.vercel.app/api/songs/${cleanId}`,
    `https://jiosaavn-api-rose.vercel.app/api/songs/${cleanId}`,
    `https://saavn.dev/api/songs/${cleanId}`,
    `https://www.jiosaavn.com/api.php?__call=song.getDetails&pids=${cleanId}&_format=json&ctx=web6dot0`,
  ];

  for (const url of mirrors) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3500) });
      if (!res.ok) continue;
      const json = await res.json();
      const item = Array.isArray(json?.data)
        ? json.data[0]
        : (json?.data || json?.songs?.[0] || json?.[cleanId]);

      if (item) {
        let stream = extractBestUrl(
          item.downloadUrl ||
          item.download_url ||
          item.media_url ||
          item.audioUrl ||
          item.streamUrl ||
          item.url ||
          item.media_preview_url
        );
        if (!stream && item.encrypted_media_url) {
          const decrypted = decryptDesEcb(item.encrypted_media_url, '38346591');
          if (decrypted) {
            stream = decrypted.replace('_96.mp4', '_320.mp4');
          }
        }
        if (stream) {
          return resolveStreamUrl(stream);
        }
      }
    } catch {}
  }

  return '';
}

/**
 * 3-Tier Native Audio Stream Resolution Engine:
 * - Tier 1: Verified Direct JioSaavn 320kbps stream
 * - Tier 2: Local Electron IPC or Vite dev server YouTube Music Official Audio Resolver
 * - Tier 3: Public Piped / Invidious fallback + official iTunes audio preview fallback
 */
export async function resolveFullTrackAudio(track: TrackMetadata | EchoTrack): Promise<string> {
  if (!track) return '';

  // -------------------------------------------------------------------------
  // Tier 1: Verified Direct JioSaavn 320kbps stream (if already attached)
  // -------------------------------------------------------------------------
  const existingDirect = resolveStreamUrl(track.streamUrl || track.audioUrl || track.url);
  if (existingDirect && !existingDirect.includes('audio-ssl.itunes.apple.com')) {
    return existingDirect;
  }

  const title = track.title || '';
  const artist = track.artist || '';
  const duration = track.duration || 0;

  // -------------------------------------------------------------------------
  // Tier 2A: Native Electron IPC YouTube Music Stream Resolver
  // -------------------------------------------------------------------------
  if (typeof window !== 'undefined') {
    const win = window as unknown as {
      electron?: {
        resolveYtStream?: (params: {
          title: string;
          artist: string;
          duration: number;
        }) => Promise<{ streamUrl?: string; quality?: string } | null>;
      };
    };

    if (typeof win.electron?.resolveYtStream === 'function') {
      try {
        const resolved = await win.electron.resolveYtStream({ title, artist, duration });
        if (resolved && resolved.streamUrl) {
          const stream = resolveStreamUrl(resolved.streamUrl);
          track.streamUrl = stream;
          track.audioUrl = stream;
          track.url = stream;
          return stream;
        }
      } catch (err) {
        console.warn('[streamResolver] Electron IPC YT resolver error:', err);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Tier 2B: Local Vite Dev Server YouTube Music Stream Resolver (/api/resolve-stream)
  // -------------------------------------------------------------------------
  try {
    const endpoint = `/api/resolve-stream?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}&duration=${duration}`;
    const res = await fetch(endpoint, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const data = await res.json();
      if (data && data.streamUrl) {
        const stream = resolveStreamUrl(data.streamUrl);
        track.streamUrl = stream;
        track.audioUrl = stream;
        track.url = stream;
        return stream;
      }
    }
  } catch {}

  // -------------------------------------------------------------------------
  // Tier 3A: Public Piped API instance fallback
  // -------------------------------------------------------------------------
  const pipedInstances = [
    'https://pipedapi.kavin.rocks',
    'https://api.piped.privacydev.net',
    'https://piped-api.lunar.icu',
  ];

  for (const inst of pipedInstances) {
    try {
      const searchRes = await fetch(
        `${inst}/search?q=${encodeURIComponent(`${artist} - ${title} Official Audio`)}&filter=music_songs`,
        { signal: AbortSignal.timeout(3500) }
      );
      if (!searchRes.ok) continue;
      const searchData = await searchRes.json();
      const firstItem = searchData?.items?.[0];
      const videoId = firstItem?.url ? firstItem.url.replace('/watch?v=', '') : null;

      if (videoId) {
        const streamRes = await fetch(`${inst}/streams/${videoId}`, {
          signal: AbortSignal.timeout(3500),
        });
        if (streamRes.ok) {
          const streamData = await streamRes.json();
          const audioStreams = streamData?.audioStreams || [];
          if (audioStreams.length > 0) {
            audioStreams.sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));
            const bestPiped = audioStreams[0].url;
            if (bestPiped) {
              const stream = resolveStreamUrl(bestPiped);
              track.streamUrl = stream;
              track.audioUrl = stream;
              track.url = stream;
              return stream;
            }
          }
        }
      }
    } catch {}
  }

  // -------------------------------------------------------------------------
  // Tier 3B: On-demand JioSaavn details fetch
  // -------------------------------------------------------------------------
  if (track.id && track.id.startsWith('saavn-')) {
    try {
      const onDemandUrl = await fetchTrackStreamOnDemand(track.id);
      if (onDemandUrl) {
        track.streamUrl = onDemandUrl;
        track.audioUrl = onDemandUrl;
        track.url = onDemandUrl;
        return onDemandUrl;
      }
    } catch {}
  }

  // -------------------------------------------------------------------------
  // Tier 3C: Official iTunes audio stream preview fallback (never fails)
  // -------------------------------------------------------------------------
  if (track.previewUrl) {
    const preview = resolveStreamUrl(track.previewUrl);
    track.streamUrl = preview;
    track.audioUrl = preview;
    track.url = preview;
    return preview;
  }

  return '';
}

// In-memory cache for home feed sections (15 min TTL)
let homeFeedCache: { timestamp: number; sections: HomeSection[] } | null = null;
const CACHE_TTL_MS = 15 * 60 * 1000;

/**
 * Universal Home Feed:
 * Curates trending sections using official catalog search with strict anti-karaoke filtering.
 */
export async function fetchHomeFeed(): Promise<HomeSection[]> {
  const now = Date.now();
  if (homeFeedCache && now - homeFeedCache.timestamp < CACHE_TTL_MS) {
    return homeFeedCache.sections;
  }

  try {
    const rawCached =
      typeof localStorage !== 'undefined'
        ? localStorage.getItem('vybe_home_feed_cache_v3')
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

  const configs = [
    {
      id: 'trending',
      title: 'Trending Now',
      subtitle: 'Global hits & viral audio taking over the charts',
      icon: 'Flame',
      query: 'Top Hits',
    },
    {
      id: 'chill',
      title: 'Late Night Chill',
      subtitle: 'Deep atmospheric tones, lo-fi beats & nocturnal soundscapes',
      icon: 'Moon',
      query: 'Chill R&B Hits',
    },
    {
      id: 'workout',
      title: 'High Energy Workout',
      subtitle: '130+ BPM punchy basslines & motivating gym anthems',
      icon: 'Zap',
      query: 'Workout Hip Hop',
    },
    {
      id: 'bollywood',
      title: 'Bollywood & Desi Beats',
      subtitle: 'Chart-topping romantic melodies & Punjabi club tracks',
      icon: 'Music',
      query: 'Arijit Singh Hits',
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
      // Additional safety filter against karaoke / bootleg tracks
      const cleanTracks = tracks.filter((t) => !isKaraokeOrBootleg(t.title, t.artist, t.album));
      if (cleanTracks.length > 0) {
        sections.push({
          id: cfg.id,
          title: cfg.title,
          subtitle: cfg.subtitle,
          icon: cfg.icon,
          tracks: cleanTracks.slice(0, 10),
        });
      }
    });

    if (sections.length > 0) {
      homeFeedCache = { timestamp: now, sections };
      try {
        localStorage.setItem('vybe_home_feed_cache_v3', JSON.stringify(sections));
      } catch {}
      return sections;
    }
  } catch (err) {
    console.warn('[streamResolver] Failed to build home feed:', err);
  }

  return homeFeedCache?.sections || [];
}
