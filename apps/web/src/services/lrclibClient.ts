import { LyricTrack, parseLrc, interpolateWordsForLine } from './lrcParser';

export interface LRCLibRecord {
  id: number;
  name: string;
  trackName: string;
  artistName: string;
  albumName: string;
  duration: number;
  instrumental: boolean;
  plainLyrics: string | null;
  syncedLyrics: string | null;
}

const LRCLIB_BASE = 'https://lrclib.net/api';
const CACHE_PREFIX = 'vybe_lyrics_cache_v2_';

/**
 * Fast in-memory pre-fetch cache for AutoMix & Queued tracks.
 * Keyed by trackId, title, or normalized artist_title string.
 */
export const preFetchedLyricsMap = new Map<string, LyricTrack>();

export function getCachedLyricTrack(key: string): LyricTrack | undefined {
  if (!key) return undefined;
  return preFetchedLyricsMap.get(key) || preFetchedLyricsMap.get(key.toLowerCase().trim());
}

export function setCachedLyricTrack(key: string, track: LyricTrack): void {
  if (!key || !track) return;
  preFetchedLyricsMap.set(key, track);
  preFetchedLyricsMap.set(key.toLowerCase().trim(), track);
}

export function cleanHtmlEntities(text?: string): string {
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

export interface CleanedMetadata {
  cleanTitle: string;
  primaryArtist: string;
  allArtists: string[];
}

/**
 * 1. BULLETPROOF METADATA SANITIZER
 * Strips bracketed/parenthetical noise, trailing dash suffixes, and extracts primary & all artists.
 */
export function cleanMetadata(title: string, artist?: string): CleanedMetadata {
  let cleanTitle = cleanHtmlEntities(title || '');

  // 1. Strip bracketed/parenthetical noise
  cleanTitle = cleanTitle.replace(
    /[\(\[]\s*(?:official\s*(?:music\s*)?(?:video|audio|lyric\s*video|visualizer)|lyrics?|hd|hq|4k|remastered(?:\s*\d{4})?|from\s*["'].*?["']|feat\.?.*|ft\.?.*|prod\.?.*)\s*[\)\]]/gi,
    ''
  );

  // 2. Strip trailing dash suffixes like - Remastered, - Single Version, - Original Motion Picture Soundtrack
  cleanTitle = cleanTitle.replace(
    /[-–—|]\s*(?:remastered(?:\s*\d{4})?|single\s*version|original\s*motion\s*picture\s*soundtrack|soundtrack|ost|official\s*(?:music\s*)?(?:video|audio|lyric\s*video|visualizer)|audio|video|visualizer|4k|hd|hq)\s*$/gi,
    ''
  );

  // 3. Strip trailing feat. / ft. / prod. outside brackets
  cleanTitle = cleanTitle.replace(/\b(?:feat\.?|ft\.?|prod\.?)\b.*$/gi, '');

  // 4. Collapse extra whitespace and trim
  cleanTitle = cleanTitle.replace(/\s+/g, ' ').replace(/^[\s\-–—/|:]+|[\s\-–—/|:]+$/g, '').trim();

  if (!cleanTitle) {
    cleanTitle = (title || '').trim();
  }

  // 5. Extract Primary & Featured Artists
  const rawArtist = cleanHtmlEntities(artist || '');
  const splitArtists = rawArtist
    .split(/,|&|\bfeat\.?\b|\bft\.?\b|\bx\b|\bwith\b/i)
    .map((a) => a.replace(/^["'\[]+|["'\]]+$/g, '').replace(/\s*-\s*topic$/i, '').trim())
    .filter(Boolean);

  const primaryArtist = splitArtists[0] || (rawArtist.trim() || '');
  const allArtists = splitArtists.length > 0 ? splitArtists : (primaryArtist ? [primaryArtist] : []);

  return {
    cleanTitle,
    primaryArtist,
    allArtists,
  };
}

export function sanitizeSearchTitle(title: string): string {
  return cleanMetadata(title).cleanTitle;
}

export function extractPrimaryArtist(artist: string): string {
  return cleanMetadata('', artist).primaryArtist;
}

/**
 * 2. 4-PASS CANDIDATE SCORING ENGINE
 * Evaluates candidate accuracy against cleanTitle, allArtists, and targetDuration.
 */
export function scoreCandidate(
  item: LRCLibRecord,
  cleanTitle: string,
  allArtists: string[],
  targetDuration?: number
): number {
  if (!item) return -9999;
  let score = 0;

  // Filter out instrumental-only entries unless no lyrics exist
  if (item.instrumental && !item.syncedLyrics && !item.plainLyrics) {
    score -= 200;
  }

  const norm = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  const normTargetTitle = norm(cleanTitle);
  const normCandTitle = norm(item.trackName || item.name || '');

  // Title Similarity (+0 to +40 pts): Exact normalized title match gets +40; startsWith/includes gets +25; mismatch gets -50.
  if (normTargetTitle && normCandTitle) {
    if (normTargetTitle === normCandTitle) {
      score += 40;
    } else if (
      normCandTitle.startsWith(normTargetTitle) ||
      normCandTitle.includes(normTargetTitle) ||
      normTargetTitle.includes(normCandTitle)
    ) {
      score += 25;
    } else {
      score -= 50;
    }
  }

  // Artist Match (+0 to +35 pts): If item.artistName matches primaryArtist (+35), or matches any artist in allArtists (+25), else -30.
  const normCandArtist = norm(item.artistName || '');
  const primaryArtist = allArtists[0] || '';
  const normPrimary = norm(primaryArtist);

  if (
    normPrimary &&
    normCandArtist &&
    (normCandArtist === normPrimary ||
      normCandArtist.includes(normPrimary) ||
      normPrimary.includes(normCandArtist))
  ) {
    score += 35;
  } else {
    const matchesAny = allArtists.some((art) => {
      const nArt = norm(art);
      return nArt && (normCandArtist.includes(nArt) || nArt.includes(normCandArtist));
    });
    if (matchesAny) {
      score += 25;
    } else {
      score -= 30;
    }
  }

  // Synced Lyrics Bonus (+50 pts): Strongly prefer candidates where item.syncedLyrics is non-empty over plain item.plainLyrics.
  if (item.syncedLyrics && item.syncedLyrics.trim().length > 0) {
    score += 50;
  } else if (item.plainLyrics && item.plainLyrics.trim().length > 0) {
    score += 10;
  } else {
    score -= 100;
  }

  // Duration Lock (+40 to -100 pts):
  // If targetDuration > 0 and item.duration > 0:
  //   diff = Math.abs(item.duration - targetDuration)
  //   diff <= 2s -> +40 pts
  //   diff <= 5s -> +25 pts
  //   diff <= 10s -> +5 pts
  //   diff > 12s -> -100 pts (reject wrong radio edit / extended remix).
  if (targetDuration && targetDuration > 0 && item.duration && item.duration > 0) {
    const diff = Math.abs(item.duration - targetDuration);
    if (diff <= 2) {
      score += 40;
    } else if (diff <= 5) {
      score += 25;
    } else if (diff <= 10) {
      score += 5;
    } else if (diff > 12) {
      score -= 100;
    }
  }

  // Penalize remix, slowed, reverb, karaoke unless target title contains those terms
  const rawTitleLower = cleanTitle.toLowerCase();
  const candText = `${item.trackName || item.name || ''} ${item.albumName || ''}`.toLowerCase();
  for (const kw of ['slowed', 'reverb', 'remix', 'karaoke', 'speed up', 'sped up', 'nightcore']) {
    if (candText.includes(kw) && !rawTitleLower.includes(kw)) {
      score -= 35;
    }
  }

  return score;
}

export function rankLyricCandidates(
  candidates: LRCLibRecord[],
  targetDuration?: number,
  trackTitle?: string,
  primaryArtist?: string
): LRCLibRecord[] {
  if (!candidates || candidates.length === 0) return [];
  const meta = cleanMetadata(trackTitle || '', primaryArtist || '');

  return [...candidates].sort((a, b) => {
    const sA = scoreCandidate(a, meta.cleanTitle, meta.allArtists, targetDuration);
    const sB = scoreCandidate(b, meta.cleanTitle, meta.allArtists, targetDuration);
    return sB - sA;
  });
}

function buildCacheKey(artist: string, title: string): string {
  const normArtist = (artist || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
  const normTitle = (title || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
  return `${CACHE_PREFIX}${normArtist}_${normTitle}`;
}

/**
 * Checks localStorage cache for saved lyric record.
 */
export function getCachedLyrics(artist: string, title: string): LRCLibRecord | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const key = buildCacheKey(artist, title);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as LRCLibRecord;
  } catch (e) {
    console.warn('Error reading lyric cache:', e);
    return null;
  }
}

/**
 * Saves lyric record to localStorage cache.
 */
export function setCachedLyrics(artist: string, title: string, record: LRCLibRecord): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const key = buildCacheKey(artist, title);
    localStorage.setItem(key, JSON.stringify(record));
  } catch (e) {
    console.warn('Error saving lyric cache:', e);
  }
}

/**
 * Direct call to LRCLIB /api/search with ZERO custom headers.
 * Never attach custom headers in browser fetches to prevent CORS preflight blocks.
 */
export async function searchLyrics(
  query: string,
  targetDuration?: number,
  trackTitle?: string,
  primaryArtist?: string
): Promise<LRCLibRecord[]> {
  if (!query || query.trim().length === 0) return [];

  const url = `${LRCLIB_BASE}/search?q=${encodeURIComponent(query.trim())}`;
  try {
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`LRCLIB returned status ${res.status}`);
    }

    const data = (await res.json()) as LRCLibRecord[];
    const list = Array.isArray(data) ? data : [];
    if (targetDuration || trackTitle || primaryArtist) {
      return rankLyricCandidates(list, targetDuration, trackTitle, primaryArtist);
    }
    return list;
  } catch (error) {
    console.error('Error querying LRCLIB search:', error);
    return [];
  }
}

/**
 * Secondary Multi-Provider Lyrics Chain
 * Queries secondary exact-match and public endpoints when primary fuzzy search is exhausted.
 * Header-free to prevent CORS preflight blocks.
 */
export async function querySecondaryLyricProviders(
  title: string,
  artist: string,
  duration?: number
): Promise<LRCLibRecord[]> {
  if (!title) return [];

  try {
    const getUrl = `${LRCLIB_BASE}/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(title)}${duration ? `&duration=${Math.round(duration)}` : ''}`;
    const getRes = await fetch(getUrl);
    if (getRes.ok) {
      const data = (await getRes.json()) as LRCLibRecord;
      if (data && (data.syncedLyrics || data.plainLyrics)) {
        return [data];
      }
    }
  } catch (err) {
    console.warn('[SecondaryLyrics] Direct get lookup failed:', err);
  }

  return [];
}

/**
 * Formats seconds into [mm:ss.xx] timestamp string.
 */
function formatLrcTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const mm = mins.toString().padStart(2, '0');
  const ss = secs.toFixed(2).padStart(5, '0');
  return `[${mm}:${ss}]`;
}

/**
 * Guaranteed Plain-Lyrics Synchronization:
 * If the best record from LRCLIB or JioSaavn only has plainLyrics (and syncedLyrics is null),
 * splits plainLyrics by \n, filters out empty lines, and automatically distributes startTime
 * and endTime across duration (starting at 3.0s through duration - 5.0s, roughly 3.2s per line)
 * with synthesized word-level timestamps so kinetic animations ALWAYS render!
 */
export function interpolatePlainLyricsToLrc(
  plainLyrics: string,
  audioDuration = 180,
  title = '',
  artist = ''
): string {
  const safeDuration = Number.isFinite(audioDuration) && audioDuration > 10 ? audioDuration : 180;
  const lines = plainLyrics
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 250);

  if (lines.length === 0) return '';

  const startSec = 3.0;
  const endSec = Math.max(startSec + lines.length * 2.4, safeDuration - 5.0);
  const availableTime = Math.max(lines.length * 1.5, endSec - startSec);
  // Roughly 3.2 seconds per line
  const lineInterval = Math.max(2.0, availableTime / Math.max(1, lines.length));

  const lrcLines: string[] = [
    `[ti:${title || 'Unknown Title'}]`,
    `[ar:${artist || 'Unknown Artist'}]`,
  ];

  for (let i = 0; i < lines.length; i++) {
    const timeSec = startSec + i * lineInterval;
    const ts = formatLrcTimestamp(timeSec);
    lrcLines.push(`${ts} ${lines[i]}`);
  }

  return lrcLines.join('\n');
}

/**
 * Generates an on-beat typographic rhythm pulse for instrumental tracks or while syncing lyrics.
 * Never displays hardcoded fake sentences like "PURE VOLTAGE PULSING".
 * Instead, animates the track's authentic Title & Artist phrases on beat!
 */
export function generateInstrumentalRhythmTrack(
  title: string,
  artist: string,
  duration = 180
): LyricTrack {
  const safeDuration = Number.isFinite(duration) && duration > 10 ? duration : 180;
  const tName = title.trim() || 'Audio Track';
  const aName = artist && artist !== 'Unknown Artist' && artist !== 'Unknown' ? artist.trim() : '';
  const phrases = [
    tName,
    aName ? `by ${aName}` : 'Instrumental Soundstage',
    '♪ Instrumental Beat ♪',
    tName,
    aName ? `${aName} Groove` : 'Pure Audio Vibration',
  ];

  const totalSec = Math.max(12, safeDuration);
  const phraseInterval = 4.2;
  const numPhrases = Math.min(60, Math.max(1, Math.floor(totalSec / phraseInterval)));
  const lines = [];

  for (let i = 0; i < numPhrases; i++) {
    const phraseText = phrases[i % phrases.length];
    const start = i * phraseInterval + 0.6;
    const end = Math.min(totalSec, start + 3.4);
    const lineId = `instr-line-${i}`;
    lines.push({
      id: lineId,
      lineIndex: i,
      text: phraseText,
      startTime: start,
      endTime: end,
      duration: end - start,
      words: interpolateWordsForLine(phraseText, start, end, lineId),
      isInstrumentalBreak: true,
    });
  }

  return {
    trackId: `instrumental-${Date.now()}`,
    title: tName,
    artist: aName,
    duration: totalSec,
    precision: 'word',
    source: 'lrclib_synced',
    lines,
    offsetMs: 0,
  };
}

/**
 * Converts an LRCLibRecord into our unified LyricTrack AST.
 * If syncedLyrics is missing but plainLyrics is present, uses auto-interpolation.
 * If instrumental, generates an authentic on-beat rhythm track from the real song's Title & Artist.
 */
export function convertLRCLibToLyricTrack(
  record: LRCLibRecord,
  audioDuration?: number
): LyricTrack {
  const safeDuration = Number.isFinite(audioDuration) && (audioDuration ?? 0) > 10
    ? (audioDuration as number)
    : (Number.isFinite(record.duration) && record.duration > 10 ? record.duration : 180);

  // Auto Duration-Diff Offset Compensation:
  // If the audio stream (e.g. from YouTube/JioSaavn music video) is slightly longer than
  // official LRCLIB candidate.duration by 1.5s to 12s, apply initial vocal offset so lines align with video intro silence.
  let autoOffsetSec = 0;
  if (
    Number.isFinite(audioDuration) &&
    audioDuration! > 10 &&
    Number.isFinite(record.duration) &&
    record.duration > 10 &&
    audioDuration! > record.duration
  ) {
    const introDiff = audioDuration! - record.duration;
    if (introDiff >= 1.5 && introDiff <= 12) {
      autoOffsetSec = introDiff * 0.5;
    }
  }

  const metadata = {
    trackId: `lrclib-${record.id}`,
    title: record.trackName || record.name,
    artist: record.artistName,
    duration: safeDuration,
    source: 'lrclib_synced' as const,
  };

  let track: LyricTrack;
  if (record.syncedLyrics) {
    track = parseLrc(record.syncedLyrics, metadata);
  } else if (record.plainLyrics) {
    const syntheticLrc = interpolatePlainLyricsToLrc(
      record.plainLyrics,
      safeDuration,
      metadata.title,
      metadata.artist
    );
    track = parseLrc(syntheticLrc, metadata);
  } else {
    track = generateInstrumentalRhythmTrack(
      metadata.title,
      metadata.artist,
      safeDuration
    );
  }

  if (autoOffsetSec > 0 && track.lines && track.lines.length > 0) {
    track.offsetMs = (track.offsetMs || 0) + Math.round(autoOffsetSec * 1000);
    track.lines = track.lines.map((ln) => ({
      ...ln,
      startTime: Math.max(0, ln.startTime + autoOffsetSec),
      endTime: Math.max(0.1, ln.endTime + autoOffsetSec),
      words: ln.words.map((w) => ({
        ...w,
        startTime: Math.max(0, w.startTime + autoOffsetSec),
        endTime: Math.max(0.05, w.endTime + autoOffsetSec),
      })),
    }));
  }

  return track;
}

export interface AutoFetchResult {
  track: LyricTrack;
  record: LRCLibRecord;
  candidates: LRCLibRecord[];
  isFallbackInterpolated: boolean;
  isDemoFallback?: boolean;
}

/**
 * CRITICAL 4-STAGE FUZZY SEARCH WATERFALL
 * Guarantees lyrics load automatically and the stage is NEVER blank.
 * Uses Streamed Catalog Title Sanitizer to strip catalog clutter before querying LRCLIB.
 */
export async function autoFetchLyrics(
  metadata: {
    title: string;
    artist?: string;
    album?: string;
    searchQuery?: string;
    songId?: string;
  },
  audioDuration?: number,
  onStatusChange?: (status: string) => void
): Promise<AutoFetchResult> {
  const { cleanTitle, primaryArtist, allArtists } = cleanMetadata(
    metadata.title,
    metadata.artist
  );
  const rawTitle = metadata.title || '';
  const safeAudioDuration = Number.isFinite(audioDuration) && (audioDuration ?? 0) > 10 ? (audioDuration as number) : 0;

  onStatusChange?.('Extracting track metadata...');

  // 0. Cache Check
  const cached = getCachedLyrics(primaryArtist, cleanTitle) || getCachedLyrics(primaryArtist, rawTitle);
  if (cached && (cached.syncedLyrics || cached.plainLyrics)) {
    onStatusChange?.(`Synced Lyrics Locked (Cached: ${cached.artistName} - ${cached.trackName})`);
    const track = convertLRCLibToLyricTrack(cached, safeAudioDuration);
    setCachedLyricTrack(rawTitle, track);
    setCachedLyricTrack(cleanTitle, track);
    return {
      track,
      record: cached,
      candidates: [cached],
      isFallbackInterpolated: !cached.syncedLyrics && !!cached.plainLyrics,
      isDemoFallback: false,
    };
  }

  const cleanSongId = (metadata.songId || '').replace(/^saavn-/, '');

  const candidateMap = new Map<number, LRCLibRecord>();
  const addCandidates = (records: LRCLibRecord[]) => {
    for (const r of records) {
      if (r && typeof r.id === 'number') {
        candidateMap.set(r.id, r);
      }
    }
  };

  const hasSyncedResult = () =>
    Array.from(candidateMap.values()).some((c) => Boolean(c.syncedLyrics && c.syncedLyrics.trim().length > 0));

  // Pass 0: Exact Direct GET with targetDuration
  if (cleanTitle && primaryArtist) {
    try {
      const getUrl = `${LRCLIB_BASE}/get?track_name=${encodeURIComponent(cleanTitle)}&artist_name=${encodeURIComponent(primaryArtist)}${safeAudioDuration > 0 ? `&duration=${Math.round(safeAudioDuration)}` : ''}`;
      const getRes = await fetch(getUrl);
      if (getRes.ok) {
        const exact = (await getRes.json()) as LRCLibRecord;
        if (exact && (exact.syncedLyrics || exact.plainLyrics)) {
          addCandidates([exact]);
        }
      }
    } catch {}
  }

  // Pass 1: Query by track_name & artist_name
  if (cleanTitle && primaryArtist) {
    onStatusChange?.(`Searching LRCLIB for ${primaryArtist} - ${cleanTitle}...`);
    try {
      const url = `${LRCLIB_BASE}/search?track_name=${encodeURIComponent(cleanTitle)}&artist_name=${encodeURIComponent(primaryArtist)}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = (await res.json()) as LRCLibRecord[];
        if (Array.isArray(data)) addCandidates(data);
      }
    } catch (err) {
      console.warn('LRCLIB Pass 1 failed:', err);
    }
  }

  // Pass 2: If Pass 1 returns no synced results, query q=cleanTitle primaryArtist
  if (!hasSyncedResult() && (cleanTitle || primaryArtist)) {
    const q2 = `${cleanTitle} ${primaryArtist}`.trim();
    onStatusChange?.(`Searching LRCLIB for "${q2}"...`);
    try {
      const url = `${LRCLIB_BASE}/search?q=${encodeURIComponent(q2)}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = (await res.json()) as LRCLibRecord[];
        if (Array.isArray(data)) addCandidates(data);
      }
    } catch (err) {
      console.warn('LRCLIB Pass 2 failed:', err);
    }
  }

  // Pass 3: If still empty, query q=cleanTitle
  if (!hasSyncedResult() && cleanTitle) {
    onStatusChange?.(`Searching title: "${cleanTitle}"...`);
    try {
      const url = `${LRCLIB_BASE}/search?q=${encodeURIComponent(cleanTitle)}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = (await res.json()) as LRCLibRecord[];
        if (Array.isArray(data)) addCandidates(data);
      }
    } catch (err) {
      console.warn('LRCLIB Pass 3 failed:', err);
    }
  }

  // Pass 3.5: Compound title split (if slash in title)
  if (!hasSyncedResult() && cleanTitle.includes('/')) {
    const firstPart = cleanMetadata(cleanTitle.split('/')[0]).cleanTitle;
    if (firstPart) {
      try {
        const res = await fetch(`${LRCLIB_BASE}/search?track_name=${encodeURIComponent(firstPart)}&artist_name=${encodeURIComponent(primaryArtist)}`);
        if (res.ok) {
          const data = (await res.json()) as LRCLibRecord[];
          if (Array.isArray(data)) addCandidates(data);
        }
      } catch {}
    }
  }

  const allCandidates = Array.from(candidateMap.values());

  // Pass 3.5: Direct JioSaavn upstream lyrics fallback if LRCLIB has no results
  if (allCandidates.length === 0 && cleanSongId) {
    try {
      // 1. Direct JioSaavn API
      let saavnLyrics: string | null = null;
      try {
        const jsRes = await fetch(
          `https://www.jiosaavn.com/api.php?__call=lyrics.getLyrics&lyrics_id=${encodeURIComponent(cleanSongId)}&_format=json&ctx=web6dot0`,
          { signal: AbortSignal.timeout(3000) }
        );
        if (jsRes.ok) {
          const jsData = await jsRes.json();
          if (typeof jsData?.lyrics === 'string' && jsData.lyrics.trim().length > 0) {
            saavnLyrics = jsData.lyrics
              .replace(/<br\s*\/?>/gi, '\n')
              .replace(/&quot;/g, '"')
              .replace(/&amp;/g, '&')
              .replace(/&#039;/g, "'");
          }
        }
      } catch {}

      // 2. Fallback to active HTTPS mirror
      if (!saavnLyrics) {
        try {
          const mRes = await fetch(
            `https://jiosaavn-api-taupe.vercel.app/api/songs/${encodeURIComponent(cleanSongId)}/lyrics`,
            { signal: AbortSignal.timeout(3000) }
          );
          if (mRes.ok) {
            const mData = await mRes.json();
            const rawL = mData?.data?.lyrics || mData?.lyrics;
            if (typeof rawL === 'string' && rawL.trim().length > 0) {
              saavnLyrics = rawL
                .replace(/<br\s*\/?>/gi, '\n')
                .replace(/&quot;/g, '"')
                .replace(/&amp;/g, '&')
                .replace(/&#039;/g, "'");
            }
          }
        } catch {}
      }

      if (saavnLyrics) {
        const saavnRecord: LRCLibRecord = {
          id: 88888,
          name: cleanTitle || rawTitle || 'Audio Track',
          trackName: cleanTitle || rawTitle || 'Audio Track',
          artistName: primaryArtist || '',
          albumName: metadata.album || '',
          duration: safeAudioDuration || 180,
          instrumental: false,
          plainLyrics: saavnLyrics,
          syncedLyrics: null,
        };
        const parsed = convertLRCLibToLyricTrack(saavnRecord, safeAudioDuration);
        setCachedLyricTrack(rawTitle, parsed);
        setCachedLyricTrack(cleanTitle, parsed);
        if (primaryArtist && cleanTitle) {
          setCachedLyrics(primaryArtist, cleanTitle, saavnRecord);
        }
        onStatusChange?.(`Plain Lyrics Auto-Timed (${primaryArtist} - ${cleanTitle})`);
        return {
          track: parsed,
          record: saavnRecord,
          candidates: [saavnRecord],
          isFallbackInterpolated: true,
          isDemoFallback: false,
        };
      }
    } catch {}
  }

  // Pass 4: Instrumental Fallback if absolutely no candidates exist
  if (allCandidates.length === 0) {
    onStatusChange?.('No lyrics match • Real Audio');
    const emptyRecord: LRCLibRecord = {
      id: -1,
      name: cleanTitle || rawTitle || 'Audio Track',
      trackName: cleanTitle || rawTitle || 'Audio Track',
      artistName: primaryArtist || '',
      albumName: '',
      duration: safeAudioDuration || 180,
      instrumental: true,
      plainLyrics: null,
      syncedLyrics: null,
    };
    const rhythmTrack = generateInstrumentalRhythmTrack(
      cleanTitle || rawTitle,
      primaryArtist,
      safeAudioDuration || 180
    );
    setCachedLyricTrack(rawTitle, rhythmTrack);
    setCachedLyricTrack(cleanTitle, rhythmTrack);
    return {
      track: rhythmTrack,
      record: emptyRecord,
      candidates: [],
      isFallbackInterpolated: true,
      isDemoFallback: false,
    };
  }

  // Score & Rank Every Candidate using scoreCandidate
  const rankedCandidates = [...allCandidates].sort((a, b) => {
    return (
      scoreCandidate(b, cleanTitle, allArtists, safeAudioDuration) -
      scoreCandidate(a, cleanTitle, allArtists, safeAudioDuration)
    );
  });

  const bestMatch = rankedCandidates[0];
  const isFallback = !bestMatch.syncedLyrics && !!bestMatch.plainLyrics;

  if (primaryArtist && cleanTitle) {
    setCachedLyrics(primaryArtist, cleanTitle, bestMatch);
  }

  const statusLabel = isFallback
    ? `Plain Lyrics Auto-Timed (${bestMatch.artistName} - ${bestMatch.trackName})`
    : `Synced Lyrics Locked (${bestMatch.artistName} - ${bestMatch.trackName})`;
  onStatusChange?.(statusLabel);

  const parsedTrack = convertLRCLibToLyricTrack(bestMatch, safeAudioDuration);
  setCachedLyricTrack(rawTitle, parsedTrack);
  setCachedLyricTrack(cleanTitle, parsedTrack);

  return {
    track: parsedTrack,
    record: bestMatch,
    candidates: rankedCandidates.slice(0, 8),
    isFallbackInterpolated: isFallback,
    isDemoFallback: false,
  };
}
