/**
 * Native YouTube Music Audio Resolver for Electron and Vite Dev Server
 * 
 * Uses dynamic asynchronous imports (`await import(...)`) to safely load
 * ESM packages (@distube/ytdl-core, yt-search, play-dl) inside Electron's
 * CommonJS main process without ERR_REQUIRE_ESM crashes.
 */

let ytdlInstance = null;
let ytSearchFn = null;
let playDlInstance = null;

async function getYtdl() {
  if (!ytdlInstance) {
    try {
      const mod = await import('@distube/ytdl-core');
      const YtdlClass = mod.Ytdl || mod.default?.Ytdl;
      if (typeof YtdlClass === 'function') {
        ytdlInstance = new YtdlClass();
      } else if (typeof mod.default === 'function') {
        ytdlInstance = new mod.default();
      } else {
        ytdlInstance = mod.default || mod;
      }
    } catch (e) {
      console.error('[ytResolver] Failed to dynamically load @distube/ytdl-core:', e.message);
    }
  }
  return ytdlInstance;
}

async function getYtSearch() {
  if (!ytSearchFn) {
    try {
      const mod = await import('yt-search');
      ytSearchFn = mod.default || mod;
    } catch (e) {
      try {
        ytSearchFn = require('yt-search');
      } catch (err) {
        console.error('[ytResolver] Failed to dynamically load yt-search:', err.message);
      }
    }
  }
  return ytSearchFn;
}

async function getPlayDl() {
  if (!playDlInstance) {
    try {
      const mod = await import('play-dl');
      playDlInstance = mod.default || mod;
    } catch (e) {
      console.warn('[ytResolver] play-dl not available:', e.message);
    }
  }
  return playDlInstance;
}

const ANTI_KARAOKE_REGEX =
  /\b(karaoke|zzang|arcade player|16-bit|8-bit|emulation|originally perf|performed by|tribute to|melody version|instrumental version|ringtone|8d audio|chipmunk|nightcore|1 hour|10 hours|hour loop)\b/i;

function isKaraokeOrBootleg(text) {
  return ANTI_KARAOKE_REGEX.test(text || '');
}

function normalizeString(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractPrimaryArtist(artist) {
  if (!artist) return '';
  const first = String(artist).split(/[,&/-]|\bfeat\.?\b|\bft\.?\b/i)[0];
  return normalizeString(first);
}

/**
 * Resolves full-length studio audio stream for a given song title and artist.
 * 1. Searches YouTube with exact query `${artist} - ${title} Official Audio`.
 * 2. Filters the top 8 candidates: strictly requires primary artist and song title.
 * 3. Rejects karaoke, covers, instrumentals, reactions, 8d, tutorials, concert recordings.
 * 4. Picks candidate with duration closest to targetDuration (within ±15 seconds).
 * 5. Extracts highest bitrate audio format via @distube/ytdl-core or play-dl.
 */
async function resolveYouTubeAudio(title, artist, targetDuration = 0) {
  if (!title) return null;

  const ytSearch = await getYtSearch();
  if (!ytSearch) {
    console.error('[ytResolver] yt-search is not available');
    return null;
  }

  const cleanTitle = String(title)
    .replace(/[\(\[]\s*(?:feat\.?|ft\.?)[^\)\]]*[\)\]]/gi, '')
    .replace(/\b(?:feat\.?|ft\.?)\b.*$/gi, '')
    .replace(/[\(\[]\s*official\s*(?:video|audio|music\s*video)?\s*[\)\]]/gi, '')
    .trim();

  const cleanArtist = String(artist || '')
    .split(/[,&/]/)[0]
    .replace(/\b(?:feat\.?|ft\.?)\b.*$/gi, '')
    .trim();

  const primaryArtist = extractPrimaryArtist(artist);
  const normalizedTitle = normalizeString(cleanTitle || title);

  const isCoverRequested = /\bcover\b/i.test(title);
  const isKaraokeRequested = /\bkaraoke\b/i.test(title);
  const isInstrumentalRequested = /\binstrumental\b/i.test(title);
  const isLiveRequested = /\blive\b/i.test(title);

  // Exact search query as specified: "${track.artist} - ${track.title} Official Audio"
  const queries = [
    `${artist} - ${title} Official Audio`,
    `${cleanArtist} - ${cleanTitle} Official Audio`,
    `${cleanArtist} - ${cleanTitle}`,
    `${artist} - ${title}`,
  ];

  let videos = [];
  for (const q of queries) {
    try {
      const res = await ytSearch(q);
      if (res && Array.isArray(res.videos) && res.videos.length > 0) {
        videos = res.videos;
        break;
      }
    } catch (e) {
      console.warn('[ytResolver] Search attempt failed:', q, e.message);
    }
  }

  if (videos.length === 0) {
    return null;
  }

  // Inspect the top 8 search results
  const top8 = videos.slice(0, 8);

  // Filter candidates strictly
  const strictCandidates = top8.filter((v) => {
    const combined = `${v.title} ${v.author?.name || ''}`.toLowerCase();

    // Rejection filter
    if (!isCoverRequested && /\b(cover|acoustic cover|dance cover|remake|parody)\b/i.test(combined)) return false;
    if (!isKaraokeRequested && /\b(karaoke|zzang|arcade player|16-bit|8-bit)\b/i.test(combined)) return false;
    if (!isInstrumentalRequested && /\b(instrumental|backing track)\b/i.test(combined)) return false;
    if (!isLiveRequested && /\b(live at|live concert|concert|reaction|8d|tutorial|10 hours|hour loop)\b/i.test(combined)) return false;

    // Filter out shorts (< 35s) and hour-long loops (> 900s)
    if (v.seconds < 35 || v.seconds > 900) return false;

    const normVideoTitle = normalizeString(v.title);
    const normChannel = normalizeString(v.author?.name || '');

    // Strict Requirement:
    // 1. Channel or video title contains primary artist
    const hasArtist = normVideoTitle.includes(primaryArtist) || normChannel.includes(primaryArtist);
    // 2. Video title contains song title
    const hasTitle = normVideoTitle.includes(normalizedTitle) || normalizedTitle.includes(normVideoTitle);

    if (!hasArtist || !hasTitle) return false;

    return true;
  });

  const candidates = strictCandidates.length > 0 ? strictCandidates : top8.filter((v) => {
    const normVideoTitle = normalizeString(v.title);
    const normChannel = normalizeString(v.author?.name || '');
    return (normVideoTitle.includes(primaryArtist) || normChannel.includes(primaryArtist)) &&
           normVideoTitle.includes(normalizedTitle) &&
           v.seconds >= 35 && v.seconds <= 900;
  });

  if (candidates.length === 0) {
    return null;
  }

  // Score candidates to pick the most accurate studio audio within ±15 seconds
  let bestCandidate = candidates[0];
  let bestScore = -9999;

  for (const v of candidates) {
    let score = 0;
    const lowerTitle = v.title.toLowerCase();
    const lowerAuthor = (v.author?.name || '').toLowerCase();

    if (lowerTitle.includes('official audio')) score += 60;
    if (lowerAuthor.includes('topic')) score += 50; // Official YouTube Music auto-generated upload
    if (lowerTitle.includes('official video') || lowerTitle.includes('official music video')) score += 30;
    if (lowerAuthor.includes(cleanArtist.toLowerCase())) score += 30;

    if (targetDuration > 0) {
      const diff = Math.abs(v.seconds - targetDuration);
      if (diff <= 5) score += 60;
      else if (diff <= 12) score += 40;
      else if (diff <= 15) score += 25;
      else score -= diff * 2;
    }

    if (score > bestScore) {
      bestScore = score;
      bestCandidate = v;
    }
  }

  // 1. Try extracting with @distube/ytdl-core
  const ytdl = await getYtdl();
  if (ytdl && typeof ytdl.getInfo === 'function') {
    try {
      const info = await ytdl.getInfo(bestCandidate.url);
      const audioFormats = info.formats.filter(
        (f) => f.hasAudio && (!f.hasVideo || f.mimeType?.startsWith('audio/'))
      );
      audioFormats.sort((a, b) => (b.audioBitrate || b.bitrate || 0) - (a.audioBitrate || a.bitrate || 0));
      const chosen = audioFormats.find((f) => f.url);

      if (chosen) {
        return {
          streamUrl: chosen.url,
          videoId: bestCandidate.videoId,
          title: bestCandidate.title,
          artist: bestCandidate.author?.name || cleanArtist,
          duration: bestCandidate.seconds,
          bitrate: chosen.audioBitrate || 160,
          quality: chosen.audioBitrate ? `${chosen.audioBitrate}kbps` : '256kbps Opus',
        };
      }
    } catch (err) {
      console.warn('[ytResolver] Ytdl audio extraction failed, attempting play-dl fallback:', err.message);
    }
  }

  // 2. Fallback to play-dl if available
  const play = await getPlayDl();
  if (play && typeof play.video_basic_info === 'function' && typeof play.stream_from_info === 'function') {
    try {
      const info = await play.video_basic_info(bestCandidate.videoId);
      const stream = await play.stream_from_info(info);
      if (stream && stream.url) {
        return {
          streamUrl: stream.url,
          videoId: bestCandidate.videoId,
          title: bestCandidate.title,
          artist: bestCandidate.author?.name || cleanArtist,
          duration: bestCandidate.seconds,
          bitrate: 160,
          quality: '160kbps',
        };
      }
    } catch (playErr) {
      console.warn('[ytResolver] play-dl extraction failed:', playErr.message);
    }
  }

  return null;
}

/**
 * Searches YouTube for tracks (remixes, anime OST, unreleased tracks, niche music).
 * Respects anti-karaoke filtering unless user explicitly searched for "karaoke".
 */
async function searchYouTubeVideos(query, limit = 10) {
  if (!query || typeof query !== 'string') return [];
  const cleanQ = query.trim();
  if (!cleanQ) return [];

  const ytSearch = await getYtSearch();
  if (!ytSearch) {
    console.error('[ytResolver] yt-search is not available for search');
    return [];
  }

  try {
    const res = await ytSearch(cleanQ);
    if (!res || !Array.isArray(res.videos)) return [];

    const isKaraokeSearch = /\bkaraoke\b/i.test(cleanQ);

    const filtered = res.videos.filter((v) => {
      if (!isKaraokeSearch && isKaraokeOrBootleg(`${v.title} ${v.author?.name || ''}`)) {
        return false;
      }
      if (v.seconds < 30 || v.seconds > 1800) return false;
      return true;
    });

    return filtered.slice(0, limit).map((v) => ({
      id: `yt-${v.videoId}`,
      title: v.title,
      artist: v.author?.name || 'YouTube',
      album: 'YouTube Music',
      duration: v.seconds,
      artworkUrl: v.thumbnail || v.image,
      streamUrl: '',
      quality: '256kbps Opus',
      source: 'ytmusic',
      sourceType: 'stream',
      searchQuery: `${v.author?.name || ''} ${v.title}`.trim(),
    }));
  } catch (err) {
    console.warn('[ytResolver] searchYouTubeVideos error:', err.message);
    return [];
  }
}

module.exports = {
  resolveYouTubeAudio,
  searchYouTubeVideos,
  isKaraokeOrBootleg,
  ANTI_KARAOKE_REGEX,
};
