const ytSearch = require('yt-search');
const { Ytdl } = require('@distube/ytdl-core');

const ytdl = new Ytdl();

const ANTI_KARAOKE_REGEX =
  /\b(karaoke|zzang|arcade player|16-bit|8-bit|emulation|originally perf|performed by|tribute to|melody version|instrumental version|ringtone|8d audio|chipmunk|nightcore|1 hour|10 hours|hour loop)\b/i;

function isKaraokeOrBootleg(text) {
  return ANTI_KARAOKE_REGEX.test(text || '');
}

/**
 * Resolves full-length studio audio stream for a given song title and artist.
 * 1. Searches YouTube for `${artist} - ${title} Official Audio`.
 * 2. Filters out shorts, loops, and any karaoke/emulation tracks.
 * 3. Matches duration within closest range of official track duration.
 * 4. Extracts highest bitrate audio format via @distube/ytdl-core.
 */
async function resolveYouTubeAudio(title, artist, targetDuration = 0) {
  if (!title) return null;

  const cleanTitle = String(title)
    .replace(/[\(\[]\s*(?:feat\.?|ft\.?)[^\)\]]*[\)\]]/gi, '')
    .replace(/\b(?:feat\.?|ft\.?)\b.*$/gi, '')
    .replace(/[\(\[]\s*official\s*(?:video|audio|music\s*video)?\s*[\)\]]/gi, '')
    .trim();

  const cleanArtist = String(artist || '')
    .split(/[,&/]/)[0]
    .replace(/\b(?:feat\.?|ft\.?)\b.*$/gi, '')
    .trim();

  const queries = [
    `${cleanArtist} - ${cleanTitle} Official Audio`,
    `${cleanArtist} - ${cleanTitle}`,
    `${artist} - ${title} Official Audio`,
    `${cleanArtist} ${cleanTitle}`,
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

  // Filter candidates: ignore shorts (< 40s), hour-long loops (> 900s), and bootleg/karaoke
  const candidates = videos.filter((v) => {
    if (isKaraokeOrBootleg(`${v.title} ${v.author?.name || ''}`)) return false;
    if (v.seconds < 35 || v.seconds > 900) return false;
    return true;
  });

  if (candidates.length === 0) {
    return null;
  }

  // Score candidates to pick the most accurate studio audio
  let bestCandidate = candidates[0];
  let bestScore = -9999;

  for (const v of candidates) {
    let score = 0;
    const lowerTitle = v.title.toLowerCase();
    const lowerAuthor = (v.author?.name || '').toLowerCase();

    if (lowerTitle.includes('official audio')) score += 50;
    if (lowerAuthor.includes('topic')) score += 40; // Official YouTube Music auto-generated upload
    if (lowerTitle.includes('official video') || lowerTitle.includes('official music video')) score += 30;
    if (lowerAuthor.includes(cleanArtist.toLowerCase())) score += 25;

    if (targetDuration > 0) {
      const diff = Math.abs(v.seconds - targetDuration);
      if (diff <= 5) score += 40;
      else if (diff <= 12) score += 25;
      else if (diff <= 25) score += 10;
      else score -= diff;
    }

    if (score > bestScore) {
      bestScore = score;
      bestCandidate = v;
    }
  }

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
    console.error('[ytResolver] Ytdl audio extraction failed:', err.message);
  }

  return null;
}

module.exports = {
  resolveYouTubeAudio,
  isKaraokeOrBootleg,
  ANTI_KARAOKE_REGEX,
};
