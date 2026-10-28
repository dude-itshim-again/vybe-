/**
 * Unified Lyric AST & Multi-Mode Parser
 * Conforms to docs/03_KINETIC_LYRICS_SPEC.md.
 * Parses Standard LRC, Enhanced Syllable ELRC, and performs weighted word-level sub-timing interpolation.
 */

export type LyricSyncPrecision = 'line' | 'word' | 'syllable';
export type LyricSourceType = 'lrclib_synced' | 'whisper_worker' | 'embedded_id3' | 'manual_lrc';

export interface SyllableSegment {
  id: string;
  text: string;
  startTime: number; // Seconds (float, millisecond precision)
  endTime: number;   // Seconds (float, millisecond precision)
  duration: number;  // Seconds
}

export interface LyricWord {
  id: string;
  word: string;
  startTime: number;
  endTime: number;
  duration: number;
  syllables?: SyllableSegment[];
}

export interface LyricLine {
  id: string;
  lineIndex: number;
  text: string;
  startTime: number;
  endTime: number;
  duration: number;
  words: LyricWord[];
  isInstrumentalBreak?: boolean;
}

export interface LyricTrack {
  trackId: string;
  title: string;
  artist: string;
  duration: number;
  precision: LyricSyncPrecision;
  source: LyricSourceType;
  lines: LyricLine[];
  offsetMs: number;
}

/**
 * Parses timestamp string "[mm:ss.xx]", "[mm:ss.xxx]", or "[mm:ss:xx]" into seconds (float).
 */
export function parseTimestampToSeconds(ts: string): number {
  const clean = ts.replace(/[\[\]<>]/g, '').trim();
  const parts = clean.split(':');
  if (parts.length < 2) return 0;

  const minutes = parseFloat(parts[0]);
  let seconds = parseFloat(parts[1]);
  if (isNaN(minutes) || isNaN(seconds)) return 0;

  if (parts.length >= 3) {
    const fraction = parseFloat(parts[2]);
    if (!isNaN(fraction)) {
      const divisor = parts[2].length === 3 ? 1000 : 100;
      seconds += fraction / divisor;
    }
  }

  return Math.max(0, minutes * 60 + seconds);
}

/**
 * Enhanced Word Parser: extracts <mm:ss.xx> word-level tags if present.
 * Example: "<00:12.30> Hello <00:12.80> beautiful <00:13.40> world"
 */
function parseEnhancedWords(
  rawText: string,
  _lineStartTime: number,
  lineEndTime: number,
  lineId: string
): LyricWord[] | null {
  const allMatches = Array.from(rawText.matchAll(/<(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?>/g));
  if (allMatches.length === 0) return null;

  const matches = allMatches.map((m) => ({
    index: m.index ?? 0,
    time: parseTimestampToSeconds(m[0]),
    tag: m[0],
  }));

  const words: LyricWord[] = [];
  for (let i = 0; i < matches.length; i++) {
    const cur = matches[i];
    const textStart = cur.index + cur.tag.length;
    const textEnd = i + 1 < matches.length ? matches[i + 1].index : rawText.length;
    const wordText = rawText.slice(textStart, textEnd).trim();

    if (!wordText) continue;

    const startTime = cur.time;
    const nextTime = i + 1 < matches.length ? matches[i + 1].time : lineEndTime;
    const endTime = Math.max(startTime + 0.1, nextTime);

    words.push({
      id: `${lineId}-w${i}`,
      word: wordText,
      startTime,
      endTime,
      duration: Math.max(0.05, endTime - startTime),
    });
  }

  // Cap words per line to 25
  const cappedWords = words.slice(0, 25);
  return cappedWords.length > 0 ? cappedWords : null;
}

/**
 * Natural Word-by-Word Cadence-Weighted Timestamp Synthesizer:
 * Calculates active vocal window: vocalWindow = Math.min(endTime - startTime, Math.max(1.2, words.length * 0.42)) * 0.88
 * Leaves a 12% hold buffer on the final punch word so it stays locked on screen before the next bar.
 * Weights each word proportionally to character length and punctuation: weight = Math.max(2, word.length) + (/[,.!?]$/.test(word) ? 2.5 : 0)
 */
export function interpolateWordsForLine(
  text: string,
  startTime: number,
  endTime: number,
  lineId: string
): LyricWord[] {
  // Clean out any metadata or residual brackets
  const cleanText = text.replace(/<[^>]+>/g, '').trim();
  if (!cleanText) return [];

  // Split into words while preserving punctuation attached to words
  const splitWords = cleanText.split(/\s+/).filter(Boolean);
  if (splitWords.length === 0) return [];
  // Cap words per line to 25
  const rawWords = splitWords.slice(0, 25);

  const durationSpan = Number.isFinite(endTime - startTime) ? endTime - startTime : 2.5;
  const totalLineSpan = Math.max(0.4, durationSpan);
  // Pacing: 85% of actual time until next line, capped at 0.55s per word for long pauses
  const maxSpan = Math.max(1.2, rawWords.length * 0.55);
  const vocalWindow = Math.min(totalLineSpan * 0.85, maxSpan);

  // Weight each word proportionally to syllable count (vowel clusters) + length + punctuation
  const weights = rawWords.map((word, idx) => {
    const vowelClusters = (word.match(/[aeiouy]+/gi) || []).length;
    const syllableScore = Math.max(1, vowelClusters);
    let w = syllableScore * 1.8 + Math.min(word.length, 10) * 0.35 + (/[,.!?]$/.test(word) ? 2.0 : 0);
    if (idx === rawWords.length - 1) w *= 1.4; // 1.4x hold weight on final word
    return w;
  });
  const totalWeight = weights.reduce((sum, w) => sum + w, 0) || 1;

  let currentPointer = startTime;
  const words: LyricWord[] = [];

  for (let i = 0; i < rawWords.length; i++) {
    const word = rawWords[i];
    const isLastWord = i === rawWords.length - 1;
    const wordShare = weights[i] / totalWeight;
    const wordDuration = Math.max(0.08, vocalWindow * wordShare);

    const wStart = currentPointer;
    // Final word extends through the full line endTime (covering the hold buffer so it stays locked on screen)
    const wEnd = isLastWord ? endTime : Math.min(endTime - 0.05, wStart + wordDuration);

    words.push({
      id: `${lineId}-w${i}`,
      word,
      startTime: wStart,
      endTime: wEnd,
      duration: Math.max(0.08, wEnd - wStart),
    });

    currentPointer = wStart + wordDuration;
  }

  return words;
}

interface IntermediateLine {
  startTime: number;
  rawText: string;
}

/**
 * Main parser entry point: transforms raw LRC or ELRC string into a high-res LyricTrack AST.
 */
export function parseLrc(
  rawLrc: string,
  trackMetadata: {
    trackId?: string;
    title?: string;
    artist?: string;
    duration?: number;
    source?: LyricSourceType;
  } = {}
): LyricTrack {
  const lines = rawLrc.split(/\r?\n/);
  const metadataRegex = /^\[(ti|ar|al|au|by|offset|length):([^\]]+)\]/i;

  let title = trackMetadata.title || '';
  let artist = trackMetadata.artist || '';
  let offsetMs = 0;
  let hasEnhancedTags = false;

  const rawEntries: IntermediateLine[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check for ID3/LRC header metadata tags: [ti: Title], [ar: Artist], [offset: 50]
    const metaMatch = trimmed.match(metadataRegex);
    if (metaMatch) {
      const key = metaMatch[1].toLowerCase();
      const val = metaMatch[2].trim();
      if (key === 'ti' && !title) title = val;
      if (key === 'ar' && !artist) artist = val;
      if (key === 'offset') {
        const parsedOffset = parseInt(val, 10);
        if (!isNaN(parsedOffset)) offsetMs = parsedOffset;
      }
      continue;
    }

    // Check for timecodes safely with matchAll (ZERO while loops)
    const matches = Array.from(trimmed.matchAll(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g));
    if (matches.length > 0) {
      const lastMatch = matches[matches.length - 1];
      const lastIndex = (lastMatch.index ?? 0) + lastMatch[0].length;
      const lyricText = trimmed.slice(lastIndex).trim();

      if (/<(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?>/.test(lyricText)) {
        hasEnhancedTags = true;
      }

      // Handle lines with multiple timestamps (e.g. [00:10.00][00:20.00] Chorus)
      for (const m of matches) {
        rawEntries.push({
          startTime: parseTimestampToSeconds(m[0]),
          rawText: lyricText,
        });
      }
    }
  }

  // Sort chronologically
  rawEntries.sort((a, b) => a.startTime - b.startTime);

  // Limit maximum parsed lines to 250 so malformed text never hangs the parser
  const cappedEntries = rawEntries.slice(0, 250);
  const parsedLines: LyricLine[] = [];
  const safeDuration = Number.isFinite(trackMetadata.duration) && (trackMetadata.duration ?? 0) > 10
    ? (trackMetadata.duration as number)
    : 180;

  for (let i = 0; i < cappedEntries.length; i++) {
    const entry = cappedEntries[i];
    const nextEntry = i + 1 < cappedEntries.length ? cappedEntries[i + 1] : null;

    // Determine line endTime:
    // If subsequent line exists, line ends 0.15s before next line starts.
    // If there is an extended break (> 8.0s), line ends 4.5s after start.
    let endTime: number;
    let isInstrumentalBreak = false;

    if (nextEntry) {
      const gap = nextEntry.startTime - entry.startTime;
      if (gap > 8.0) {
        endTime = entry.startTime + 4.5;
        isInstrumentalBreak = true;
      } else {
        endTime = Math.max(entry.startTime + 0.8, nextEntry.startTime - 0.15);
      }
    } else {
      // Last line
      endTime = safeDuration > entry.startTime + 1.0 ? safeDuration : entry.startTime + 4.5;
    }

    const cleanDisplayText = entry.rawText.replace(/<[^>]+>/g, '').trim();
    const lineId = `line-${i}-${Math.round(entry.startTime * 100)}`;

    // Try enhanced word parsing first
    let words = parseEnhancedWords(entry.rawText, entry.startTime, endTime, lineId);

    // If no enhanced inline tags, use weighted word-length sub-timing interpolation
    if (!words) {
      words = interpolateWordsForLine(cleanDisplayText, entry.startTime, endTime, lineId);
    }

    if (words && words.length > 25) {
      words = words.slice(0, 25);
    }

    const offsetSec = offsetMs / 1000;
    const finalStart = Math.max(0, entry.startTime + offsetSec);
    const finalEnd = Math.max(finalStart + 0.1, endTime + offsetSec);

    parsedLines.push({
      id: lineId,
      lineIndex: i,
      text: cleanDisplayText,
      startTime: finalStart,
      endTime: finalEnd,
      duration: Math.max(0.1, finalEnd - finalStart),
      words: words
        ? words.map((w) => ({
            ...w,
            startTime: Math.max(0, w.startTime + offsetSec),
            endTime: Math.max(0.05, w.endTime + offsetSec),
          }))
        : [],
      isInstrumentalBreak,
    });
  }

  return {
    trackId: trackMetadata.trackId || `track-${Date.now()}`,
    title: title || 'Unknown Title',
    artist: artist || 'Unknown Artist',
    duration: safeDuration,
    precision: hasEnhancedTags ? 'word' : 'word', // Both provide word-level timing now
    source: trackMetadata.source || 'lrclib_synced',
    lines: parsedLines.slice(0, 250),
    offsetMs,
  };
}

/**
 * Fallback parser for plain unstructured lyrics (no timecodes).
 * Divides lines evenly across track duration or a 3-minute default.
 */
export function parsePlainLyrics(
  plainText: string,
  metadata: {
    title?: string;
    artist?: string;
    duration?: number;
  } = {}
): LyricTrack {
  const safeDuration = Number.isFinite(metadata.duration) && (metadata.duration ?? 0) > 10
    ? (metadata.duration as number)
    : 180;

  const rawLines = plainText
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean)
    .slice(0, 250);

  const lineDuration = Math.max(2.5, (safeDuration - 4) / Math.max(1, rawLines.length));

  const parsedLines: LyricLine[] = rawLines.map((text, idx) => {
    const startTime = 2.0 + idx * lineDuration;
    const endTime = startTime + lineDuration * 0.85;
    const lineId = `plain-line-${idx}`;

    return {
      id: lineId,
      lineIndex: idx,
      text,
      startTime,
      endTime,
      duration: endTime - startTime,
      words: interpolateWordsForLine(text, startTime, endTime, lineId),
    };
  });

  return {
    trackId: `plain-${Date.now()}`,
    title: metadata.title || 'Unknown Title',
    artist: metadata.artist || 'Unknown Artist',
    duration: safeDuration,
    precision: 'line',
    source: 'manual_lrc',
    lines: parsedLines.slice(0, 250),
    offsetMs: 0,
  };
}
