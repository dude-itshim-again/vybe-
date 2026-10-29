/**
 * VybeKineticStage.tsx
 * ---------------------------------------------------------------------------
 * Unified Dual-Engine Lyric Stage:
 *   1. Kinetic Conveyor ("ah / Side / bitch / out / of" — de-congested 5-slot
 *      staircase with asymmetric left-half maroon cutout blocks & icons).
 *      One continuous flow: hidden -> next2 -> next -> mid -> past -> past2 -> gone.
 *      There is no separate "lead" state, so words never pile up and colors never flash.
 *   2. Split-Screen Album Cascade ("About You / The 1975" — left album cover +
 *      title/artist metadata, right optical depth-of-field scrolling lyrics)
 *   3. Auto-Alternate Mode — smoothly alternates between both views every 4
 *      lines while keeping the exact same background & album color theme.
 *   4. Self-Healing Lyrics Matcher + Sync Offset (-0.4s / +0.4s) built in.
 *   5. Lumn Neon Snake Edge (always on, z-index 40): a razor-thin neon line that
 *      slithers around the outer screen edge. 60-70% of the perimeter stays pure
 *      black. Single or Dual Twin snakes, optional MacBook notch tracing,
 *      Primary/Secondary album colors, Music Sync / Flow / Static, color override.
 */
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { cleanMetadata, scoreCandidate, LRCLibRecord } from '../../services/lrclibClient';

/* ========================================================================== */
/* Public API                                                                 */
/* ========================================================================== */

export interface LyricWordItem { text: string; startTime: number; endTime: number; }
export interface LyricLineItem { id: string; startTime: number; endTime: number; text: string; words: LyricWordItem[]; }
export interface VybeKineticStageProps {
  lines?: LyricLineItem[];
  currentTime?: number;
  getCurrentTime?: () => number;
  bassEnergy?: number;
  getBassEnergy?: () => number;
  artworkUrl?: string;
  trackTitle?: string;
  trackArtist?: string;
  trackAlbum?: string;
  trackDuration?: number;
  isPlaying?: boolean;
  onTogglePlay?: () => void;
  onClose?: () => void;
  onSeek?: (time: number) => void;
  onVocalAttenuationChange?: (level: number) => void;
}

/* ========================================================================== */
/* Helpers                                                                    */
/* ========================================================================== */

type RGB = [number, number, number];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const clamp01 = (v: number) => clamp(v, 0, 1);

function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHsl([r, g, b]: RGB): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn;
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h /= 6;
  return [h, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 1) + 1) % 1;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const to = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0');
  return '#' + to(s === 0 ? l : f(h + 1 / 3)) + to(s === 0 ? l : f(h)) + to(s === 0 ? l : f(h - 1 / 3));
}

interface Hsv { h: number; s: number; v: number; }

function hsvToHex({ h, s, v }: Hsv): string {
  h = ((h % 1) + 1) % 1;
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const [r, g, b] = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i % 6];
  const to = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
  return '#' + to(r) + to(g) + to(b);
}

function hexToHsv(hex: string): Hsv {
  const [r, g, b] = hexToRgb(hex).map((x) => x / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) {
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  return { h, s: mx ? d / mx : 0, v: mx };
}

const hashStr = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
};

const rnd = (seed: number, k: number) => {
  const x = Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/* ========================================================================== */
/* Palette & Unified Theme                                                    */
/* ========================================================================== */

interface Palette {
  lab: string;    // bright tape block (top)
  lab2: string;   // bright tape block (bottom)
  txt: string;    // finished/past word color ("Side" burnt-orange / crimson)
  past2: string;  // upper faded word color ("ah" deep umber / dark crimson)
  act: string;    // active sung text ("bitch" / "out" / "of" warm peach-salmon)
  blk: string;    // deep maroon/burgundy cutout box behind active/next words
  glow1: string;  // unified ambient background tint 1
  glow2: string;  // unified ambient background tint 2
  tint: string;   // rich accent for inactive cascade lines + seekbar fill
  aura1: string;  // Split Cascade moving aura (deep accent)
  aura2: string;  // Split Cascade moving aura (deeper accent)
}

export const VYBE_PALETTES: Record<string, string> = {
  rust: '#D94E1F',     // Exact "ah / Side / bitch / out / of" screenshot palette
  pink: '#E81E68',     // Reference "Swish / name / tell" hot-pink palette
  warmSand: '#8E7968', // Reference "About You - The 1975" warm sepia/taupe palette
  crimson: '#E52B38',
  violet: '#8B5CF6',
  cobalt: '#2F6BFF',
  emerald: '#16B67A',
};

export function makePalette(baseHex: string): Palette {
  const [h, s0, l0] = rgbToHsl(hexToRgb(baseHex));
  const s = clamp(s0, 0.75, 0.96); // always vibrant, never muddy brown or grey
  const l = clamp(l0, 0.44, 0.56);
  return {
    lab: hslToHex(h, Math.max(s, 0.72), l),
    lab2: hslToHex(h - 0.015, Math.max(s, 0.72), l - 0.08),
    txt: hslToHex(h + 0.025, Math.max(s, 0.78), 0.48),
    past2: hslToHex(h + 0.015, Math.max(s, 0.65), 0.24),
    act: hslToHex(h + 0.02, Math.max(s, 0.78), 0.74),
    blk: hslToHex(h - 0.015, Math.max(s, 0.65), 0.14),
    glow1: hslToHex(h, clamp(s0, 0.25, 0.55), 0.26),
    glow2: hslToHex(h + 0.04, clamp(s0, 0.2, 0.45), 0.14),
    tint: hslToHex(h, Math.max(s, 0.8), 0.62),
    aura1: hslToHex(h, Math.max(s, 0.75), 0.22),
    aura2: hslToHex(h - 0.03, Math.max(s, 0.7), 0.14),
  };
}

const DEFAULT_PALETTE = makePalette(VYBE_PALETTES.rust);

function paletteVars(p: Palette): React.CSSProperties {
  return {
    '--lab': p.lab,
    '--lab2': p.lab2,
    '--txt': p.txt,
    '--past2': p.past2,
    '--act': p.act,
    '--blk': p.blk,
    '--glow1': p.glow1,
    '--glow2': p.glow2,
    '--tint': p.tint,
    '--aura1': p.aura1,
    '--aura2': p.aura2,
  } as React.CSSProperties;
}

function colorFromArtwork(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onerror = () => resolve(null);
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = c.height = 24;
        const x = c.getContext('2d');
        if (!x) return resolve(null);
        x.drawImage(img, 0, 0, 24, 24);
        const d = x.getImageData(0, 0, 24, 24).data;
        let r = 0, g = 0, b = 0, ws = 0;
        for (let i = 0; i < d.length; i += 4) {
          const mx = Math.max(d[i], d[i + 1], d[i + 2]);
          const mn = Math.min(d[i], d[i + 1], d[i + 2]);
          const sat = mx === 0 ? 0 : (mx - mn) / mx;
          const w = (0.08 + sat * sat) * (mx > 35 ? 1 : 0.15);
          r += d[i] * w; g += d[i + 1] * w; b += d[i + 2] * w; ws += w;
        }
        if (ws <= 0) return resolve(null);
        const [h, s, l] = rgbToHsl([r / ws, g / ws, b / ws]);
        resolve(hslToHex(h, clamp(s, 0.75, 0.92), clamp(l, 0.45, 0.56)));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function useArtworkHex(url?: string): string | null {
  const [hex, setHex] = useState<string | null>(null);
  useEffect(() => {
    let dead = false;
    setHex(null);
    if (!url) return;
    colorFromArtwork(url).then((h) => { if (!dead) setHex(h); });
    return () => { dead = true; };
  }, [url]);
  return hex;
}

/* ---------------- Lumn: two dominant vibrant album colors ---------------- */

export interface LumnColors { primary: string; secondary: string; }

/** Analogous partner hue. Never +120/+180 deg (that turns red covers swamp green):
    warm reds/oranges slide toward rose, everything else slides +20 deg. */
function analogousHue(h: number): number {
  const deg = h * 360;
  return deg < 50 || deg > 330 ? h - 12 / 360 : h + 20 / 360;
}

/** Fallback pair when no artwork is available: base color + a rich analogous shade. */
export function deriveLumnColors(baseHex: string): LumnColors {
  const [h, s] = rgbToHsl(hexToRgb(baseHex));
  const sat = clamp(s, 0.75, 0.95);
  return { primary: hslToHex(h, sat, 0.5), secondary: hslToHex(analogousHue(h), 1, 0.62) };
}

/**
 * Buckets saturated pixels into 24 hue bins (weighted by saturation and value),
 * takes the heaviest bin as Primary (60%) and a clearly present bin at least 45 deg
 * away as Secondary (40%). Monochromatic covers get an analogous partner instead.
 * Both colors are forced to saturation >= 75%.
 */
export function extractLumnColors(src: CanvasImageSource): LumnColors | null {
  const N = 48;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const x = c.getContext('2d', { willReadFrequently: true });
  if (!x) return null;
  x.drawImage(src, 0, 0, N, N);
  const d = x.getImageData(0, 0, N, N).data;

  const BINS = 24;
  const w = new Array<number>(BINS).fill(0);
  const hx = new Array<number>(BINS).fill(0);
  const hy = new Array<number>(BINS).fill(0);
  const ss = new Array<number>(BINS).fill(0);

  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 200) continue;
    const mx = Math.max(d[i], d[i + 1], d[i + 2]);
    const mn = Math.min(d[i], d[i + 1], d[i + 2]);
    const v = mx / 255;
    const s = mx ? (mx - mn) / mx : 0;
    if (v < 0.3 || s < 0.4) continue;
    const [h] = rgbToHsl([d[i], d[i + 1], d[i + 2]]);
    const wt = s * s * (0.35 + v);
    const b = Math.min(BINS - 1, Math.floor(h * BINS));
    w[b] += wt;
    hx[b] += Math.cos(h * Math.PI * 2) * wt;
    hy[b] += Math.sin(h * Math.PI * 2) * wt;
    ss[b] += s * wt;
  }

  const at = (a: number[], i: number) => a[(i + BINS) % BINS];
  const score = (i: number) => at(w, i) + 0.6 * (at(w, i - 1) + at(w, i + 1));
  const around = (a: number[], i: number) => at(a, i - 1) + at(a, i) + at(a, i + 1);
  const huePick = (i: number) => {
    const wsum = around(w, i) || 1;
    let h = Math.atan2(around(hy, i), around(hx, i)) / (Math.PI * 2);
    if (h < 0) h += 1;
    return { h, s: around(ss, i) / wsum };
  };

  let p = -1, best = 0;
  for (let i = 0; i < BINS; i++) if (score(i) > best) { best = score(i); p = i; }
  if (p < 0) return null;

  let q = -1, qBest = 0;
  for (let i = 0; i < BINS; i++) {
    const dist = Math.min(Math.abs(i - p), BINS - Math.abs(i - p));
    if (dist >= 3 && score(i) > qBest) { qBest = score(i); q = i; }
  }

  const P = huePick(p);
  const primary = hslToHex(P.h, clamp(P.s, 0.75, 0.95), 0.52);
  let secondary: string;
  if (q >= 0 && qBest >= best * 0.3) {
    const S = huePick(q);
    secondary = hslToHex(S.h, clamp(S.s, 0.75, 0.95), 0.5);
  } else {
    // Monochromatic cover (e.g. crimson + black): rich analogous shade, never a +120/+180 jump
    secondary = hslToHex(analogousHue(P.h), 1, 0.62);
  }
  return { primary, secondary };
}

function lumnColorsFromArtwork(url: string): Promise<LumnColors | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try { resolve(extractLumnColors(img)); } catch { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function useArtworkLumn(url?: string): LumnColors | null {
  const [colors, setColors] = useState<LumnColors | null>(null);
  useEffect(() => {
    let dead = false;
    setColors(null);
    if (!url) return;
    lumnColorsFromArtwork(url).then((c) => { if (!dead) setColors(c); });
    return () => { dead = true; };
  }, [url]);
  return colors;
}

/* ========================================================================== */
/* Built-In Self-Healing Lyrics Fetcher & Sanitizer                           */
/* ========================================================================== */

type LrcSearchCandidate = LRCLibRecord;

export function parseLrcToLines(lrcText: string, fallbackDuration = 180): LyricLineItem[] {
  const rawLines = lrcText.split(/\r?\n/);
  const parsed: Array<{ startTime: number; text: string }> = [];

  for (const raw of rawLines) {
    // High-precision tag regex supporting [mm:ss.xx] and [mm:ss.xxx]
    const tagRegex = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
    const timestamps: number[] = [];
    let match: RegExpExecArray | null;
    let lastIndex = 0;

    while ((match = tagRegex.exec(raw)) !== null) {
      const mins = parseInt(match[1], 10);
      const secs = parseInt(match[2], 10);
      const fracStr = match[3] || '0';
      const frac = parseInt(fracStr, 10) / Math.pow(10, fracStr.length);
      timestamps.push(mins * 60 + secs + frac);
      lastIndex = tagRegex.lastIndex;
    }

    if (timestamps.length === 0) continue;

    // Strip inline karaoke tags cleanly <mm:ss.xx> or <mm:ss.xxx>
    const text = raw
      .slice(lastIndex)
      .replace(/<\d{1,3}:\d{2}(?:[.:]\d{1,3})?>/g, '')
      .trim();

    if (!text) continue;

    for (const t of timestamps) {
      parsed.push({ startTime: t, text });
    }
  }

  parsed.sort((a, b) => a.startTime - b.startTime);

  if (!parsed.length) {
    // Plain lyrics fallback: auto-distribute across song duration
    const plain = rawLines.map((l) => l.replace(/^\[.*\]$/, '').trim()).filter(Boolean).slice(0, 160);
    if (!plain.length) return [];
    const safeDur = Number.isFinite(fallbackDuration) && fallbackDuration > 20 ? fallbackDuration : Math.max(120, plain.length * 3.2);
    const activeSpan = Math.max(30, safeDur - 8);
    const step = activeSpan / plain.length;
    return plain.map((text, idx) => {
      const startTime = 3.0 + idx * step;
      const endTime = startTime + step * 0.95;
      return { id: `p-${idx}`, startTime, endTime, text, words: [] };
    });
  }

  return parsed.slice(0, 250).map((item, idx) => {
    const next = parsed[idx + 1];
    const endTime = next ? Math.max(item.startTime + 0.4, next.startTime - 0.04) : item.startTime + 4.0;
    return {
      id: `lrc-${idx}`,
      startTime: item.startTime,
      endTime,
      text: item.text,
      words: [],
    };
  });
}

async function fetchBestMatchedLyrics(
  title: string,
  artist: string,
  targetDuration?: number,
): Promise<{ lines: LyricLineItem[]; candidates: LrcSearchCandidate[] }> {
  const { cleanTitle, primaryArtist, allArtists } = cleanMetadata(title, artist);
  if (!cleanTitle) return { lines: [], candidates: [] };

  const candidateMap = new Map<number, LrcSearchCandidate>();
  const addCandidates = (records: LrcSearchCandidate[]) => {
    for (const r of records) {
      if (r && typeof r.id === 'number') {
        candidateMap.set(r.id, r);
      }
    }
  };

  const hasSyncedResult = () =>
    Array.from(candidateMap.values()).some((c) => Boolean(c.syncedLyrics && c.syncedLyrics.trim().length > 0));

  // Pass 1: Query track_name & artist_name
  try {
    const res = await fetch(
      `https://lrclib.net/api/search?track_name=${encodeURIComponent(cleanTitle)}&artist_name=${encodeURIComponent(primaryArtist)}`
    );
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) addCandidates(data);
    }
  } catch {}

  // Pass 2: If Pass 1 returns no synced results, query q=cleanTitle primaryArtist
  if (!hasSyncedResult()) {
    try {
      const q2 = `${cleanTitle} ${primaryArtist}`.trim();
      const res = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(q2)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) addCandidates(data);
      }
    } catch {}
  }

  // Pass 3: If still empty, query q=cleanTitle
  if (!hasSyncedResult()) {
    try {
      const res = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(cleanTitle)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) addCandidates(data);
      }
    } catch {}
  }

  const allCandidates = Array.from(candidateMap.values());
  if (!allCandidates.length) return { lines: [], candidates: [] };

  // Score & Rank Every Candidate using scoreCandidate
  const scored = [...allCandidates].sort((a, b) => {
    const scoreA = scoreCandidate(a, cleanTitle, allArtists, targetDuration);
    const scoreB = scoreCandidate(b, cleanTitle, allArtists, targetDuration);
    return scoreB - scoreA;
  });

  const best = scored[0];
  const rawLrc = best?.syncedLyrics || best?.plainLyrics || '';
  const lines = rawLrc ? parseLrcToLines(rawLrc, targetDuration || best?.duration || 180) : [];
  return { lines, candidates: scored.slice(0, 10) };
}


/* ========================================================================== */
/* Word icons: flat SVG glyphs and emoji                                      */
/* ========================================================================== */

export type GlyphId =
  | 'heart' | 'person' | 'bubble' | 'signature' | 'shirt' | 'ball' | 'eye' | 'ear' | 'crown' | 'star'
  | 'flame' | 'bolt' | 'diamond' | 'moon' | 'sun' | 'mic' | 'note' | 'phone' | 'clock' | 'drop'
  | 'lock' | 'smile' | 'arrow';

const GLYPH_WORDS: Record<GlyphId, string> = {
  heart: 'heart hearts love loved loving lover need needs feel feeling feelings soul kiss kisses baby care crush darling',
  person: 'you your yours girl boy man woman people everybody everyone friend friends someone nobody stranger',
  bubble: 'tell told talk talking say said saying speak call calling words word message chat text texting',
  signature: 'name names sign signed signature autograph write wrote',
  shirt: 'shirt shirts tee wear wearing dress clothes jersey hoodie jacket',
  ball: 'ball ballin balling basketball hoop hoops game court',
  eye: 'see seen saw look looking watch watching eyes eye blind stare vision view sight',
  ear: 'hear heard hearing listen listening sound sounds noise loud quiet silence whisper ear ears voice',
  crown: 'king queen crown legend legends god royal throne boss champion',
  star: 'starboy star stars shine shining sparkle superstar famous',
  flame: 'pain mood hurt burn burning fire flame hot heat lit desire',
  bolt: 'p1 car cars drive driving fast speed race ride rush power lightning electric',
  diamond: 'money cash rich diamond diamonds gold ice jewels chain paid bag shoes',
  moon: 'night midnight moon dream dreams sleep tonight',
  sun: 'sun sunshine morning summer day daylight',
  mic: 'sing singing song songs rap mic',
  note: 'music beat beats dance dancing play rhythm melody radio tune bass',
  phone: 'phone dm',
  clock: 'time clock late wait forever hours',
  drop: 'cry crying tears rain water ocean sea',
  lock: 'lock locked key secret hide',
  smile: 'smile happy laugh fun joy',
  arrow: 'go going away up rise fly leave',
};

const EMOJI_WORDS: Record<string, string> = {
  swish: '\u{1F446}', point: '\u{1F446}', pointing: '\u{1F446}', up: '\u{1F446}',
  wave: '\u{1F44B}', hello: '\u{1F44B}', hi: '\u{1F44B}',
  party: '\u{1F389}', rocket: '\u{1F680}', ghost: '\u{1F47B}', skull: '\u{1F480}',
  cap: '\u{1F9E2}', pizza: '\u{1F355}', taxi: '\u{1F695}', plane: '✈️', ring: '\u{1F48D}',
};

const GLYPH_LOOKUP: Map<string, GlyphId> = (() => {
  const m = new Map<string, GlyphId>();
  (Object.keys(GLYPH_WORDS) as GlyphId[]).forEach((id) => {
    GLYPH_WORDS[id].split(' ').forEach((w) => { if (!m.has(w)) m.set(w, id); });
  });
  return m;
})();

const normKey = (word: string) => word.toLowerCase().replace(/[‘’]/g, "'").replace(/[^a-z0-9']/g, '');

export function getSemanticGlyph(word: string): GlyphId | null {
  return GLYPH_LOOKUP.get(normKey(word)) ?? null;
}

interface WordIcon { kind: 'svg'; id: GlyphId; left: boolean; }
interface WordEmoji { kind: 'emoji'; ch: string; left: boolean; }

function iconFor(word: string): WordIcon | WordEmoji | null {
  const k = normKey(word);
  const e = EMOJI_WORDS[k];
  if (e) return { kind: 'emoji', ch: e, left: true };
  const id = GLYPH_LOOKUP.get(k);
  if (id) return { kind: 'svg', id, left: id === 'shirt' };
  return null;
}

const SUN_RAYS = Array.from({ length: 8 }, (_, k) => (
  <rect key={k} x="46" y="3" width="8" height="19" rx="4" transform={`rotate(${k * 45} 50 50)`} />
));

const GLYPH_ART: Record<GlyphId, React.ReactNode> = {
  heart: <path d="M50 88C21 68 6 50 6 31 6 17 17 7 31 7c8 0 15 4 19 11 4-7 11-11 19-11 14 0 25 10 25 24 0 19-15 37-44 57Z" />,
  person: (
    <g>
      <circle cx="50" cy="28" r="19" />
      <path d="M12 92c0-22 16-36 38-36s38 14 38 36Z" />
    </g>
  ),
  bubble: <path d="M18 10h64a14 14 0 0 1 14 14v38a14 14 0 0 1-14 14H46L22 94V76h-4A14 14 0 0 1 4 62V24A14 14 0 0 1 18 10Z" />,
  signature: (
    <g fill="none" stroke="currentColor" strokeWidth="7.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 48 22 66M22 48 6 66" />
      <path d="M36 22c14-4 22 2 18 22-3 18-10 30-20 30-7 0-10-6-6-13 6-10 24-12 34-4 4 3 4 16 10 16 5 0 10-14 15-14 4 0 5 14 12 14 5 0 9-6 12-11" />
      <path d="M20 88h76" strokeWidth="6.5" />
    </g>
  ),
  shirt: <path d="M33 8c2 8 8 13 17 13S65 16 67 8l29 14-11 25-12-5v50H27V42l-12 5L4 22Z" />,
  ball: (
    <g>
      <circle cx="50" cy="50" r="46" />
      <path d="M4 50h92M50 4v92M16 17c22 19 22 47 0 66M84 17c-22 19-22 47 0 66" fill="none" stroke="#000" strokeWidth="5" />
    </g>
  ),
  eye: (
    <path d="M2 50C15 24 32 12 50 12s35 12 48 38c-13 26-30 38-48 38S15 76 2 50Zm27 0a21 21 0 1 0 42 0 21 21 0 1 0-42 0Zm11 0a10 10 0 1 0 20 0 10 10 0 1 0-20 0Z" />
  ),
  ear: (
    <path d="M49 4C27 4 13 19 13 40c0 12 4 18 9 25 4 6 6 10 6 15 0 10 8 17 19 17 12 0 19-8 19-18 0-6-4-9-4-13 0-5 8-9 14-17 5-6 8-13 8-20C84 16 70 4 49 4Z M69.7 34.8A21 21 0 0 0 30.3 49.2L39.7 45.8A11 11 0 0 1 60.3 38.2Z M44 62a6 6 0 1 0 12 0a6 6 0 1 0-12 0Z" />
  ),
  crown: (
    <g>
      <path d="M12 74 4 32l26 20 20-34 20 34 26-20-8 42Z" />
      <path d="M12 80h76v12H12Z" />
      <circle cx="4" cy="27" r="6" />
      <circle cx="50" cy="11" r="7" />
      <circle cx="96" cy="27" r="6" />
    </g>
  ),
  star: <path d="M44 2C48 30 62 44 90 48 62 52 48 66 44 94 40 66 26 52-2 48 26 44 40 30 44 2Z M82 58c1 8 5 12 14 14-9 2-13 6-14 14-1-8-5-12-14-14 9-2 13-6 14-14Z" />,
  flame: <path d="M54 3C57 22 74 33 80 52c4 14-1 28-12 36-5 4-11 6-18 6-14 0-30-10-30-30 0-12 7-20 13-27 1 8 5 12 9 13-4-19 0-36 12-47Z M50 88c-9 0-15-6-15-15 0-9 7-14 11-23 2 6 6 10 9 13 4 4 6 7 6 11 0 8-4 14-11 14Z" />,
  bolt: <path d="M60 2 14 56h28L32 98 86 40H56Z" />,
  diamond: <path d="M30 10h40l24 24H6Z M6 41h26l16 49Z M38 41h24L50 88Z M68 41h26L52 90Z" />,
  moon: <path d="M62 4A46 46 0 1 0 96 66 38 38 0 0 1 62 4Z" />,
  sun: (
    <g>
      <circle cx="50" cy="50" r="19" />
      {SUN_RAYS}
    </g>
  ),
  mic: <path d="M50 4a16 16 0 0 1 16 16v28a16 16 0 0 1-32 0V20A16 16 0 0 1 50 4Z M18 44h8v4c0 13 10 24 24 24s24-11 24-24v-4h8v4c0 16-11 29-28 31v9h14v7H32v-7h14v-9C29 77 18 64 18 48Z" />,
  note: (
    <g>
      <ellipse cx="28" cy="78" rx="18" ry="12" transform="rotate(-20 28 78)" />
      <ellipse cx="72" cy="66" rx="18" ry="12" transform="rotate(-20 72 66)" />
      <rect x="40" y="20" width="8" height="58" />
      <rect x="84" y="8" width="8" height="58" />
      <path d="M40 18 92 6v18L40 36Z" />
    </g>
  ),
  phone: <path d="M28 4h44a9 9 0 0 1 9 9v74a9 9 0 0 1-9 9H28a9 9 0 0 1-9-9V13a9 9 0 0 1 9-9Z M29 16h42v62H29Z M45.5 87a4.5 4.5 0 1 0 9 0a4.5 4.5 0 1 0-9 0Z" />,
  clock: <path d="M3 50a47 47 0 1 0 94 0a47 47 0 1 0-94 0Z M13 50a37 37 0 1 1 74 0a37 37 0 1 1-74 0Z M46 24h8v22h18v8H46Z" />,
  drop: <path d="M50 3S16 40 16 62c0 19 15 33 34 33s34-14 34-33C84 40 50 3 50 3Z" />,
  lock: <path d="M22 44h56a6 6 0 0 1 6 6v40a6 6 0 0 1-6 6H22a6 6 0 0 1-6-6V50a6 6 0 0 1 6-6Z M29 44V32a21 21 0 0 1 42 0v12h-9V32a12 12 0 0 0-24 0v12Z M50 58a7 7 0 0 1 3.5 13V80h-7v-9A7 7 0 0 1 50 58Z" />,
  smile: <path d="M3 50a47 47 0 1 0 94 0a47 47 0 1 0-94 0Z M33 32a6 9 0 1 0 12 0a6 9 0 1 0-12 0Z M55 32a6 9 0 1 0 12 0a6 9 0 1 0-12 0Z M24 56c4 15 14 24 26 24s22-9 26-24c-8 5-17 7-26 7s-18-2-26-7Z" />,
  arrow: <path d="M32 12h56v56H76V33L21 88l-9-9 55-55H32Z" />,
};

export function GlyphArt({ id }: { id: GlyphId }) {
  return (
    <svg viewBox="0 0 100 100" fill="currentColor" fillRule="evenodd" aria-hidden="true" focusable="false">
      {GLYPH_ART[id]}
    </svg>
  );
}

/* ========================================================================== */
/* Lyrics to a flat, timed word list + enriched lines                         */
/* ========================================================================== */

interface TimedWord {
  text: string;
  start: number;
  end: number;
  lineIdx: number;
  lineStart: boolean;
  lineEnd: boolean;
  /** True when the vocal pauses after this word long enough for the whole stack to clear. */
  retire: boolean;
  icon: WordIcon | WordEmoji | null;
}

const cleanDisplay = (s: string) =>
  s.replace(/[‘’]/g, "'").replace(/^[^\p{L}\p{N}']+|[,.!?;:]+$/gu, '');

const LINE_LOOKAHEAD = 0.15;

/* Conveyor timing (seconds) */
const MID_HOLD = 0.95;          // a finished word keeps the center this long before the stack may retire
const NEXT_LINE_PREVIEW = 1.0;  // a phrase-opening word is shown in `next` this long before it is sung
const NEXT2_SPAN = 1.9;         // `next2` only appears when that word is sung within this window
const PAST2_LIFE = 1.15;        // `past2` stays readable this long after its word ended

function wordsOfLine(line: LyricLineItem): Array<{ text: string; start: number; end: number }> {
  const lineStart = Number(line.startTime) || 0;
  const lineEnd = Math.max(lineStart + 0.4, Number(line.endTime) || lineStart + 3.0);

  const out: Array<{ text: string; start: number; end: number }> = [];
  if (line.words && line.words.length) {
    for (const w of line.words) {
      const text = cleanDisplay(w.text ?? '');
      const start = Number(w.startTime);
      if (!text || !isFinite(start)) continue;
      let end = Number(w.endTime);
      if (!isFinite(end) || end <= start) end = start + 0.28;
      // Clamp strictly within parent line boundaries
      const clampedStart = clamp(start, lineStart, Math.max(lineStart, lineEnd - 0.05));
      const clampedEnd = clamp(end, clampedStart + 0.05, lineEnd);
      out.push({ text, start: clampedStart, end: clampedEnd });
    }
    out.sort((a, b) => a.start - b.start);
    if (out.length) return out;
  }
  const toks = (line.text ?? '').split(/\s+/).map(cleanDisplay).filter(Boolean).slice(0, 24);
  if (!toks.length) return [];
  // Strict interpolation within [line.startTime, Math.min(line.endTime, line.startTime + Math.max(1.2, words.length * 0.48))]
  const maxSpan = Math.min(lineEnd, lineStart + Math.max(1.2, toks.length * 0.48));
  const totalWindow = Math.max(0.6, maxSpan - lineStart);
  const step = totalWindow / Math.max(1, toks.length);
  return toks.map((text, i) => {
    const start = lineStart + i * step;
    const end = Math.min(lineEnd, start + step);
    return { text, start, end };
  });
}

function buildWordsAndLines(lines: LyricLineItem[]): { words: TimedWord[]; richLines: LyricLineItem[] } {
  const out: TimedWord[] = [];
  const richLines: LyricLineItem[] = [];
  const sorted = [...lines].sort((a, b) => (a.startTime || 0) - (b.startTime || 0)).slice(0, 250);

  sorted.forEach((line, lineIdx) => {
    const ws = wordsOfLine(line);
    if (!ws.length) return;
    richLines.push({
      ...line,
      startTime: ws[0].start,
      endTime: ws[ws.length - 1].end,
      words: ws.map((w) => ({ text: w.text, startTime: w.start, endTime: w.end })),
    });
    const rIdx = richLines.length - 1;
    ws.forEach((w, i) => {
      const prevEnd = out.length ? out[out.length - 1].end : -Infinity;
      const start = Math.max(w.start, out.length ? out[out.length - 1].start : -Infinity);
      out.push({
        text: w.text,
        start,
        end: w.end,
        lineIdx: rIdx,
        lineStart: i === 0 || start - prevEnd > 0.85,
        lineEnd: i === ws.length - 1,
        retire: false,
        icon: iconFor(w.text),
      });
    });
  });

  // A word "retires" the stack when the next word is still more than NEXT_LINE_PREVIEW away
  // at the moment its MID_HOLD runs out. Decided once per word, so a retired phrase keeps its
  // exit offsets for good and can never be pulled back onto the conveyor.
  for (let j = 0; j < out.length; j++) {
    const nxt = out[j + 1];
    out[j].retire = !nxt || nxt.start - (out[j].end + MID_HOLD) > NEXT_LINE_PREVIEW;
  }

  return { words: out, richLines };
}

function findIdx(ws: TimedWord[], t: number): number {
  let lo = 0, hi = ws.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (ws[mid].start <= t) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return ans;
}

function findActiveLineIdx(lines: LyricLineItem[], t: number): number {
  if (!lines.length) return -1;
  // Strictly compare line.startTime <= t && t < line.endTime
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startTime <= t && t < lines[i].endTime) return i;
  }
  if (t < lines[0].startTime) return 0;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (t >= lines[i].startTime) return i;
  }
  return lines.length - 1;
}

/* ---- Continuous conveyor state ----
   Every word travels the same road: hidden -> next2 -> next -> mid -> past -> past2 -> gone.
   There is no "lead" mode that hides upcoming words and wipes the stack. When the vocal pauses
   long enough, the stack retires by fanning out over three DISTINCT exit offsets (gone1/2/3). */
type Phase = 'wait' | 'sung' | 'done';
interface Snap {
  a: number;        // last word that has started (-1 before the first word)
  ph: Phase;        // state of word `a`
  lineIdx: number;  // active lyric line (drives the Split Cascade)
  parked: boolean;  // word `a` itself has retired (long pause ahead)
  nx1: boolean;     // word a+1 is on screen in `next`
  nx2: boolean;     // word a+2 is on screen in `next2`
  p2: boolean;      // word a-2 is still readable in `past2`
}

function stateAt(ws: TimedWord[], lines: LyricLineItem[], t: number): Snap {
  const lineIdx = findActiveLineIdx(lines, t);
  if (!ws.length) return { a: -1, ph: 'wait', lineIdx, parked: false, nx1: false, nx2: false, p2: false };
  const c = findIdx(ws, t);
  const w1 = ws[c + 1];
  const w2 = ws[c + 2];
  const ph: Phase = c < 0 ? 'wait' : t >= ws[c].end ? 'done' : 'sung';
  const parked = c >= 0 && ws[c].retire && t >= ws[c].end + MID_HOLD;
  // Words inside a phrase are always visible underneath the active word. Only a word that opens a
  // new phrase waits until it is NEXT_LINE_PREVIEW away.
  const nx1 = !!w1 && (!w1.lineStart || w1.start - t <= NEXT_LINE_PREVIEW);
  const nx2 = nx1 && !!w2 && !w2.lineStart && w2.start - t <= NEXT2_SPAN;
  const p2 = c >= 2 && t - ws[c - 2].end < PAST2_LIFE;
  return { a: c, ph, lineIdx, parked, nx1, nx2, p2 };
}

type Slot = 'hidden' | 'next2' | 'next' | 'mid' | 'past' | 'past2' | 'gone1' | 'gone2' | 'gone3';
const GONE_BY_DEPTH: Slot[] = ['gone1', 'gone2', 'gone3'];

function slotOf(ws: TimedWord[], snap: Snap, i: number): Slot {
  const rel = i - snap.a;
  if (rel > 0) {
    if (rel === 1) return snap.nx1 ? 'next' : 'hidden';
    if (rel === 2) return snap.nx1 && snap.nx2 ? 'next2' : 'hidden';
    return 'hidden';
  }
  // Retired phrase: its last word sits in gone1, the one before it in gone2, the rest in gone3.
  // The offsets are fixed per word, so nothing collapses onto the same coordinate and nothing
  // moves again once the next phrase starts.
  const last = snap.parked ? snap.a : snap.a - 1;
  for (let k = i; k <= last; k++) {
    if (ws[k].retire) return GONE_BY_DEPTH[Math.min(3, k - i + 1) - 1];
  }
  if (rel === 0) return 'mid';
  if (rel === -1) return 'past';
  if (rel === -2) return snap.p2 ? 'past2' : 'gone3';
  return 'gone3';
}

/* ========================================================================== */
/* Demo tracks (including "ah / Side / bitch / out / of" & "About You 1975")  */
/* ========================================================================== */

interface DemoTrack {
  id: string;
  label: string;
  title: string;
  artist: string;
  album: string;
  accent: string;
  bpm: number;
  duration: number;
  lines: LyricLineItem[];
  art?: string;          // demo artwork (data URI)
  lumn?: LumnColors;     // pinned Lumn colors, as if extracted from `art`
}

/* Original placeholder artwork for the Earrings demo preset (coral wallpaper,
   emerald window, gold rings). It is not the real cover. */
const EARRINGS_ART =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#EE6A63"/><stop offset="1" stop-color="#D93A33"/></linearGradient>
<pattern id="fl" width="80" height="80" patternUnits="userSpaceOnUse">
<g fill="#F9A9A4"><circle cx="20" cy="20" r="8"/><circle cx="20" cy="7" r="6"/><circle cx="20" cy="33" r="6"/><circle cx="7" cy="20" r="6"/><circle cx="33" cy="20" r="6"/></g>
<circle cx="20" cy="20" r="4.5" fill="#F6C453"/>
<g fill="#F9A9A4" transform="translate(40 40)"><circle cx="20" cy="20" r="8"/><circle cx="20" cy="7" r="6"/><circle cx="20" cy="33" r="6"/><circle cx="7" cy="20" r="6"/><circle cx="33" cy="20" r="6"/></g>
<circle cx="60" cy="60" r="4.5" fill="#F6C453"/>
</pattern>
</defs>
<rect width="400" height="400" fill="url(#bg)"/>
<rect width="400" height="400" fill="url(#fl)" opacity=".5"/>
<rect x="232" y="44" width="124" height="176" rx="10" fill="#1FB863"/>
<rect x="244" y="56" width="100" height="152" rx="6" fill="#4BD58A"/>
<rect x="291" y="56" width="6" height="152" fill="#1FB863"/>
<rect x="0" y="334" width="400" height="66" fill="#28C76F"/>
<circle cx="118" cy="252" r="62" fill="none" stroke="#F6C453" stroke-width="10"/>
<circle cx="232" cy="296" r="38" fill="none" stroke="#F6C453" stroke-width="8"/>
</svg>`,
  );

const EARRINGS_DEMO_LINES: LyricLineItem[] = [
  { id: 'e0', startTime: 0.3, endTime: 2.6, text: 'gold swinging by your ear', words: [] },
  { id: 'e1', startTime: 3.0, endTime: 5.4, text: 'kitchen light on your face', words: [] },
  { id: 'e2', startTime: 5.8, endTime: 8.2, text: 'I can hear you laughing', words: [] },
  { id: 'e3', startTime: 8.6, endTime: 11.0, text: 'heart keeps time with the beat', words: [] },
  { id: 'e4', startTime: 11.4, endTime: 13.8, text: 'stay a little longer tonight', words: [] },
];

const STARBOY_SIDE_LINES: LyricLineItem[] = [
  {
    id: 's0',
    startTime: 0.2,
    endTime: 2.1,
    text: 'ah Side bitch out of your league too ah',
    words: [
      { text: 'ah', startTime: 0.2, endTime: 0.52 },
      { text: 'Side', startTime: 0.55, endTime: 0.92 },
      { text: 'bitch', startTime: 0.95, endTime: 1.42 },
      { text: 'out', startTime: 1.45, endTime: 1.72 },
      { text: 'of', startTime: 1.75, endTime: 2.02 },
      { text: 'your', startTime: 2.05, endTime: 2.32 },
      { text: 'league', startTime: 2.35, endTime: 2.75 },
    ],
  },
  {
    id: 's1',
    startTime: 3.0,
    endTime: 5.2,
    text: 'There was something about you that now I cant remember',
    words: [
      { text: 'There', startTime: 3.0, endTime: 3.25 },
      { text: 'was', startTime: 3.28, endTime: 3.52 },
      { text: 'something', startTime: 3.55, endTime: 3.92 },
      { text: 'about', startTime: 3.95, endTime: 4.25 },
      { text: 'you', startTime: 4.28, endTime: 4.55 },
      { text: 'that', startTime: 4.58, endTime: 4.82 },
      { text: 'now', startTime: 4.85, endTime: 5.15 },
    ],
  },
  {
    id: 's2',
    startTime: 5.4,
    endTime: 7.4,
    text: "It's the same damn thing that made my heart surrender",
    words: [
      { text: "It's", startTime: 5.4, endTime: 5.65 },
      { text: 'the', startTime: 5.68, endTime: 5.9 },
      { text: 'same', startTime: 5.92, endTime: 6.22 },
      { text: 'damn', startTime: 6.25, endTime: 6.55 },
      { text: 'thing', startTime: 6.58, endTime: 6.88 },
      { text: 'heart', startTime: 6.9, endTime: 7.22 },
      { text: 'surrender', startTime: 7.25, endTime: 7.65 },
    ],
  },
  {
    id: 's3',
    startTime: 7.9,
    endTime: 9.6,
    text: 'need my name Swish',
    words: [
      { text: 'need', startTime: 7.9, endTime: 8.25 },
      { text: 'my', startTime: 8.28, endTime: 8.65 },
      { text: 'name', startTime: 8.68, endTime: 9.1 },
      { text: 'Swish', startTime: 9.15, endTime: 9.65 },
    ],
  },
];

const DEMO_TRACKS: DemoTrack[] = [
  {
    id: 'combined',
    label: 'Starboy + About You (Auto-Alternate)',
    title: 'About You / Starboy',
    artist: 'The 1975 — Being Funny In A Foreign Language',
    album: 'Being Funny In A Foreign Language',
    accent: VYBE_PALETTES.rust,
    bpm: 96,
    duration: 10.2,
    lines: STARBOY_SIDE_LINES,
    lumn: { primary: '#E5192E', secondary: '#FF4D6D' }, // Electric Crimson + Warm Rose (analogous)
  },
  {
    id: 'earrings',
    label: 'Earrings — Malcolm Todd',
    title: 'Earrings',
    artist: 'Malcolm Todd',
    album: 'Earrings',
    accent: '#E03C31',
    bpm: 104,
    duration: 14.4,
    lines: EARRINGS_DEMO_LINES,
    art: EARRINGS_ART,
    lumn: { primary: '#E03C31', secondary: '#28C76F' }, // Coral 60% / Emerald 40%
  },
];

/** Demo mode opens on the Earrings preset so the 2-color Lumn sync is visible immediately. */
const DEFAULT_DEMO_IDX = Math.max(0, DEMO_TRACKS.findIndex((t) => t.id === 'earrings'));

const fmtTime = (s: number) => {
  const t = Math.max(0, Math.floor(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

function demoBass(t: number, bpm: number) {
  const beat = (t * bpm) / 60;
  const f = beat - Math.floor(beat);
  const off = beat * 2 - Math.floor(beat * 2);
  return clamp01(Math.exp(-f * 5.5) * 0.85 + Math.exp(-off * 9) * 0.18);
}

/* ========================================================================== */
/* Text measuring                                                             */
/* ========================================================================== */

const FONT = `"Inter Tight", "Helvetica Neue", Helvetica, Arial, system-ui, sans-serif`;
let measureCtx: CanvasRenderingContext2D | null = null;

function textEm(text: string): number {
  if (!measureCtx && typeof document !== 'undefined') measureCtx = document.createElement('canvas').getContext('2d');
  if (!measureCtx) return text.length * 0.62;
  measureCtx.font = `800 100px ${FONT}`;
  return measureCtx.measureText(text).width / 100 - 0.035 * text.length;
}

/* ========================================================================== */
/* Lumn Neon Snake: gradient + perimeter masks + notch                        */
/* ========================================================================== */

const SNAKE_BASE_SPEED = 55;     // deg/s: constant slither
const SNAKE_BASS_SPEED = 180;    // extra deg/s on a full bass hit
const SNAKE_STATIC_ANGLE = 100;  // Static mode parks the snake across the top-right

const f2 = (n: number) => String(Math.round(n * 100) / 100);

function rgbaOf(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

/** Mixes a color toward white: the hot, white-tinted neon core of the snake head. */
function whiten(hex: string, k: number): string {
  const [r, g, b] = hexToRgb(hex);
  const m = (x: number) => Math.round(x + (255 - x) * k);
  return `rgb(${m(r)},${m(g)},${m(b)})`;
}

/**
 * conic-gradient around the screen center (the element is rotated by --snake-angle, which is the same
 * as `from var(--snake-angle)` but stays on the compositor).
 *
 * Single snake, 360deg sweep (0deg-225deg stays fully transparent, so ~65% of the edge is pure black):
 *   0 -> 225   transparent
 *   225 -> 265 fade-in tail      Secondary 0% -> 60%
 *   265 -> 330 neon body         Secondary -> Primary, 100%
 *   330 -> 355 hot head          Primary + white-tinted core
 *   355 -> 360 front taper       back to transparent
 * Twin snakes: the same shape on a repeating 180deg period, 108deg of every 180deg is black (60%).
 */
function snakeGradient(primary: string, secondary: string, twin: boolean): string {
  const s0 = rgbaOf(secondary, 0);
  const s60 = rgbaOf(secondary, 0.6);
  const s100 = rgbaOf(secondary, 1);
  const p100 = rgbaOf(primary, 1);
  const p0 = rgbaOf(primary, 0);
  const hot = whiten(primary, 0.58);
  const stops: Array<[string, number]> = twin
    ? [[s0, 0], [s0, 108], [s60, 132], [s100, 142], [p100, 164], [hot, 171], [p100, 176], [p0, 180]]
    : [[s0, 0], [s0, 225], [s60, 265], [s100, 285], [p100, 330], [hot, 345], [p100, 355], [p0, 360]];
  const list = stops.map(([c, d]) => `${c} ${d}deg`).join(',');
  return `${twin ? 'repeating-conic-gradient' : 'conic-gradient'}(from 0deg at 50% 50%,${list})`;
}

interface NotchBox { x0: number; x1: number; nh: number; r: number; f: number; }

/** A MacBook-style notch: flared top corners (radius f), rounded bottom corners (radius r). */
function notchBox(w: number, h: number): NotchBox {
  const nw = Math.min(clamp(w * 0.13, 120, 232), w * 0.5);
  const nh = clamp(h * 0.036, 22, 38);
  return { x0: (w - nw) / 2, x1: (w + nw) / 2, nh, r: Math.min(10, nh * 0.34), f: Math.min(7, nh * 0.22) };
}

/** The hidden notch silhouette (what the snake must never enter). */
function notchShape(nb: NotchBox): string {
  const { x0, x1, nh, r, f } = nb;
  return `M${f2(x0 - f)} 0A${f2(f)} ${f2(f)} 0 0 1 ${f2(x0)} ${f2(f)}V${f2(nh - r)}A${f2(r)} ${f2(r)} 0 0 0 ${f2(x0 + r)} ${f2(nh)}H${f2(x1 - r)}A${f2(r)} ${f2(r)} 0 0 0 ${f2(x1)} ${f2(nh - r)}V${f2(f)}A${f2(f)} ${f2(f)} 0 0 1 ${f2(x1 + f)} 0Z`;
}

/** The screen outline with rounded corners, dipping around the notch when there is one. */
function perimeterPath(w: number, h: number, nb: NotchBox | null): string {
  const rc = Math.min(clamp(Math.min(w, h) * 0.018, 8, 18), w / 2, h / 2);
  let top = '';
  if (nb) {
    const { x0, x1, nh, r, f } = nb;
    top =
      `H${f2(x0 - f)}A${f2(f)} ${f2(f)} 0 0 1 ${f2(x0)} ${f2(f)}` +
      `V${f2(nh - r)}A${f2(r)} ${f2(r)} 0 0 0 ${f2(x0 + r)} ${f2(nh)}` +
      `H${f2(x1 - r)}A${f2(r)} ${f2(r)} 0 0 0 ${f2(x1)} ${f2(nh - r)}` +
      `V${f2(f)}A${f2(f)} ${f2(f)} 0 0 1 ${f2(x1 + f)} 0`;
  }
  return (
    `M${f2(rc)} 0${top}H${f2(w - rc)}A${f2(rc)} ${f2(rc)} 0 0 1 ${f2(w)} ${f2(rc)}` +
    `V${f2(h - rc)}A${f2(rc)} ${f2(rc)} 0 0 1 ${f2(w - rc)} ${f2(h)}` +
    `H${f2(rc)}A${f2(rc)} ${f2(rc)} 0 0 1 0 ${f2(h - rc)}` +
    `V${f2(rc)}A${f2(rc)} ${f2(rc)} 0 0 1 ${f2(rc)} 0Z`
  );
}

const svgUri = (svg: string) => `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;

/**
 * Two alpha masks that confine the snake to the outermost screen pixels:
 *   core: a stroke centered on the screen edge, 2x thickness, so exactly `t` px stays on screen
 *   glow: the same stroke, blurred, reaching about `g` px inward and fading to nothing
 * Everything else (the other ~98% of the display) is fully masked out and stays pure #000.
 * With a notch the outline dips around it and the notch interior is cut out of both masks.
 */
function buildSnakeMasks(w: number, h: number, t: number, g: number, nb: NotchBox | null) {
  const d = perimeterPath(w, h, nb);
  const open = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`;
  const cut = nb
    ? `<mask id="c" maskUnits="userSpaceOnUse" x="0" y="0" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="#fff"/><path d="${notchShape(nb)}" fill="#000"/></mask>`
    : '';
  const wrap = (inner: string) => (nb ? `<g mask="url(#c)">${inner}</g>` : inner);
  const pad = 80;
  const blur =
    `<filter id="b" filterUnits="userSpaceOnUse" x="${-pad}" y="${-pad}" width="${w + pad * 2}" height="${h + pad * 2}">` +
    `<feGaussianBlur stdDeviation="${f2(g * 0.26)}"/>` +
    `<feComponentTransfer><feFuncA type="linear" slope="1.5"/></feComponentTransfer></filter>`;

  const core =
    open +
    (cut ? `<defs>${cut}</defs>` : '') +
    wrap(`<path d="${d}" fill="none" stroke="#000" stroke-width="${f2(t * 2)}" stroke-linejoin="round"/>`) +
    '</svg>';
  const glow =
    open +
    `<defs>${cut}${blur}</defs>` +
    wrap(`<path d="${d}" fill="none" stroke="#000" stroke-width="${f2(g * 0.55)}" stroke-linejoin="round" filter="url(#b)"/>`) +
    '</svg>';
  return { core: svgUri(core), glow: svgUri(glow) };
}

/* ========================================================================== */
/* Styles                                                                     */
/* ========================================================================== */

const LUMN_CHEVRONS = `url("data:image/svg+xml;utf8,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='8' height='12' viewBox='0 0 8 12'><path d='M1 4.6 4 1.6l3 3M1 7.4l3 3 3-3' fill='none' stroke='white' stroke-width='1.3' stroke-linecap='round' stroke-linejoin='round'/></svg>",
)}")`;

const CSS = `
.vks-stage{position:fixed;inset:0;z-index:50;background:#000000;overflow:hidden;color:#fff;
  font-family:${FONT};-webkit-font-smoothing:antialiased;user-select:none;-webkit-user-select:none;isolation:isolate}
/* Idle (no pointer movement for 2s): cursor and every bar disappear, only lyrics + Lumn remain */
.vks-stage[data-ui="0"],.vks-stage[data-ui="0"] *{cursor:none!important}

.vks-spotify-canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:0}

/* Optional ambient tint (BG: Album Glow). Default is pure #000000. */
.vks-backdrop{position:absolute;inset:0;pointer-events:none;z-index:0;opacity:0;transition:opacity 500ms ease;
  background:
    radial-gradient(circle at 24% 48%, var(--glow1) 0%, transparent 62%),
    radial-gradient(circle at 78% 52%, var(--glow2) 0%, transparent 68%),
    linear-gradient(135deg, rgba(255,255,255,.03) 0%, rgba(0,0,0,.92) 100%)}
.vks-stage[data-bg="album"] .vks-backdrop{opacity:1}
.vks-stage[data-bg="black"] .vks-backdrop,.vks-stage[data-bg="black"] .vks-spotify-canvas{display:none!important}

/* View crossfade: the outgoing view fades out first, the incoming one fades in after it (never both at once) */
.vks-layer{position:absolute;inset:0;transition:opacity 300ms ease,transform 420ms cubic-bezier(.16,1,.3,1)}
.vks-layer[data-active="0"]{opacity:0;pointer-events:none;transform:scale(.97)}
.vks-layer[data-active="1"]{opacity:1;pointer-events:auto;transform:scale(1);transition-delay:300ms,300ms}

.vks-words{position:absolute;inset:0;pointer-events:none;
  transform:scale(calc(1 + var(--vks-bass,0) * .014));transform-origin:50% 50%;will-change:transform}

/* ---- 1. KINETIC CONVEYOR: hidden > next2 > next > mid > past > past2 > gone1/2/3 ----
   Nodes stay mounted and only move with translate3d + scale + opacity. There is no "lead" state:
   every word walks the same road, and an exiting stack fans out over three distinct offsets. */
.vks-w{position:absolute;left:50%;top:50%;font-size:var(--fs);line-height:.94;font-weight:800;letter-spacing:-.04em;white-space:nowrap;
  transform-origin:50% 50%;backface-visibility:hidden;will-change:transform,opacity;
  transition:transform 300ms cubic-bezier(.16,1,.3,1),opacity 220ms ease}
.vks-w[data-slot="hidden"]{opacity:0;pointer-events:none;
  transform:translate3d(calc(-50% + var(--jx2)),calc(-50% + var(--F) * 1.75),0) rotate(var(--rot)) scale(.26) skewX(0deg)}
.vks-w[data-slot="next2"]{opacity:.95;z-index:3;
  transform:translate3d(calc(-50% + var(--jx3)),calc(-50% + var(--F) * 1.32),0) rotate(0deg) scale(.35) skewX(0deg)}
.vks-w[data-slot="next"]{opacity:1;z-index:4;
  transform:translate3d(calc(-50% + var(--jx2)),calc(-50% + var(--F) * .84),0) rotate(0deg) scale(.46) skewX(0deg)}
.vks-w[data-slot="mid"]{opacity:1;z-index:5;
  transform:translate3d(calc(-50% + var(--jx)),-50%,0) rotate(0deg) scale(1) skewX(0deg)}
.vks-w[data-slot="past"]{opacity:1;z-index:4;
  transform:translate3d(calc(-50% + var(--jx3)),calc(-50% + var(--F) * -.82),0) rotate(0deg) scale(.54) skewX(var(--skew-past,-11deg))}
.vks-w[data-slot="past2"]{opacity:.88;z-index:2;
  transform:translate3d(calc(-50% + var(--jx2)),calc(-50% + var(--F) * -1.34),0) rotate(0deg) scale(.44) skewX(0deg)}
/* Exit offsets: each depth of a retiring stack has its own coordinate (1.02F / 1.5F / 1.95F above center) */
.vks-w[data-slot="gone1"]{opacity:0;pointer-events:none;z-index:1;
  transform:translate3d(calc(-50% + var(--jx3)),calc(-50% + var(--F) * -1.02),0) rotate(0deg) scale(.5) skewX(-8deg)}
.vks-w[data-slot="gone2"]{opacity:0;pointer-events:none;z-index:1;
  transform:translate3d(calc(-50% + var(--jx3)),calc(-50% + var(--F) * -1.5),0) rotate(0deg) scale(.42) skewX(-8deg)}
.vks-w[data-slot="gone3"]{opacity:0;pointer-events:none;z-index:0;
  transform:translate3d(calc(-50% + var(--jx3)),calc(-50% + var(--F) * -1.95),0) rotate(0deg) scale(.34) skewX(-8deg)}

/* Cutout box: one node per word. Its color is fixed by the tape type and never swaps, only the opacity
   follows the slot, so next -> mid is a pure move with no color or box flash. */
.vks-bg{position:absolute;left:-.09em;right:-.09em;top:-.05em;bottom:-.06em;z-index:0;opacity:0;clip-path:var(--cp);transition:opacity 180ms ease}
.vks-w[data-tape="pink"] .vks-bg{background:linear-gradient(100deg,var(--lab),var(--lab2))}
.vks-w[data-tape="maroon"] .vks-bg{background:var(--blk)}
.vks-w[data-tape="pink"][data-slot="next2"] .vks-bg,
.vks-w[data-tape="pink"][data-slot="next"] .vks-bg,
.vks-w[data-tape="pink"][data-slot="mid"] .vks-bg{opacity:1}
.vks-w[data-tape="maroon"][data-slot="next2"] .vks-bg,
.vks-w[data-tape="maroon"][data-slot="next"] .vks-bg,
.vks-w[data-tape="maroon"][data-slot="mid"] .vks-bg{opacity:.94}

/* Text: accent (pink) words keep white-on-bright through next2 / next / mid and only change color
   when they step up into past. Plain words stay peach-on-maroon until past. */
.vks-tx{position:relative;z-index:1;display:block;padding-bottom:.03em;color:var(--act);transition:color 220ms ease}
.vks-w[data-tape="pink"][data-slot="next2"] .vks-tx,
.vks-w[data-tape="pink"][data-slot="next"] .vks-tx,
.vks-w[data-tape="pink"][data-slot="mid"] .vks-tx{color:#fff}
.vks-w[data-slot="past"] .vks-tx{color:var(--txt)}
.vks-w[data-slot="past2"] .vks-tx,
.vks-w[data-slot^="gone"] .vks-tx{color:var(--past2)}

.vks-ic{position:absolute;top:50%;left:100%;width:.6em;height:.6em;margin:-.3em 0 0 .24em;color:var(--lab);z-index:1;transition:opacity 200ms ease}
.vks-ic.sig{width:.92em;height:.68em;margin:-.32em 0 0 .22em}
.vks-ic.l{left:auto;right:100%;margin:-.3em .24em 0 0}
.vks-ic svg{display:block;width:100%;height:100%}
.vks-ic.emo{width:auto;height:auto;font-size:.6em;line-height:1;margin-top:-.31em;font-family:"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif;font-weight:400;letter-spacing:0}
.vks-w[data-slot="past"] .vks-ic{opacity:.92}
.vks-w[data-slot="past2"] .vks-ic{opacity:.4}

/* ---- 2. SPLIT-SCREEN ALBUM CASCADE ---- */
.vks-aura{position:absolute;inset:0;overflow:hidden;pointer-events:none}
.vks-aura i{position:absolute;display:block;width:95vmax;height:95vmax;border-radius:50%;will-change:transform}
.vks-aura i:nth-child(1){left:-30vmax;top:-30vmax;background:radial-gradient(circle closest-side,var(--aura1),transparent);
  animation:vks-drift1 28s ease-in-out infinite alternate}
.vks-aura i:nth-child(2){right:-40vmax;bottom:-45vmax;background:radial-gradient(circle closest-side,var(--aura2),transparent);
  animation:vks-drift2 36s ease-in-out infinite alternate}
@keyframes vks-drift1{to{transform:translate3d(38vmax,22vmax,0) scale(1.18)}}
@keyframes vks-drift2{to{transform:translate3d(-34vmax,-26vmax,0) scale(1.25)}}
@media (prefers-reduced-motion:reduce){.vks-aura i{animation:none}}

.vks-split{position:absolute;inset:0;display:grid;grid-template-columns:minmax(240px,38%) 1fr;align-items:center;
  gap:clamp(28px,6vw,88px);max-width:1320px;margin:0 auto;padding:72px clamp(24px,6vw,84px) 96px}
.vks-art-col{display:flex;flex-direction:column;align-items:flex-start;justify-content:center;max-width:400px;width:100%;justify-self:center}
.vks-art-box{width:100%;aspect-ratio:1/1;border-radius:16px;overflow:hidden;background:rgba(255,255,255,.06);
  box-shadow:0 28px 68px rgba(0,0,0,.65),0 0 0 1px rgba(255,255,255,.1);
  transform:scale(calc(1 + var(--vks-bass,0) * .018));will-change:transform}
.vks-art-box img{width:100%;height:100%;object-fit:cover;display:block}
.vks-art-fallback{width:100%;height:100%;display:grid;place-items:center;
  background:linear-gradient(135deg,var(--blk),#121216);color:var(--act);font-size:48px;font-weight:800}
.vks-art-meta{margin-top:16px;text-align:left;width:100%}
.vks-art-title{font-size:clamp(17px,1.6vw,22px);font-weight:800;color:#fff;letter-spacing:-.01em;line-height:1.3;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.vks-art-sub{font-size:clamp(13px,1.1vw,15px);font-weight:500;color:rgba(255,255,255,.62);margin-top:3px;line-height:1.35;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

.vks-cascade-col{position:relative;height:min(74vh,640px);overflow:hidden;
  mask-image:linear-gradient(to bottom,transparent 0%,black 14%,black 84%,transparent 100%);
  -webkit-mask-image:linear-gradient(to bottom,transparent 0%,black 14%,black 84%,transparent 100%)}
.vks-cascade-track{position:absolute;left:0;right:0;top:0;will-change:transform;transition:transform 560ms cubic-bezier(.16,1,.3,1)}
.vks-cline{margin:0 0 clamp(16px,2.4vh,28px);text-align:left;font-size:clamp(22px,2.75vw,40px);font-weight:800;line-height:1.22;letter-spacing:-.025em;
  cursor:pointer;transform-origin:0 50%;max-width:24ch;color:var(--tint);
  opacity:var(--o,0);filter:blur(var(--b,0px));transform:scale(var(--s,.95));
  transition:opacity 480ms ease,filter 480ms ease,transform 480ms cubic-bezier(.16,1,.3,1),color 300ms ease}
.vks-cline[data-far="1"]{pointer-events:none}
.vks-cline[data-cur="1"]{color:#fff;text-shadow:0 0 28px rgba(255,255,255,.3)}
.vks-cline:hover{opacity:.9!important;filter:blur(0)!important}
.vks-cword{display:inline-block;margin-right:.26em;transition:opacity 180ms ease}
.vks-cline[data-cur="1"] .vks-cword{opacity:.55}
.vks-cline[data-cur="1"] .vks-cword[data-sung="1"]{opacity:1}

@media (max-width:768px){
  .vks-split{grid-template-columns:1fr;grid-template-rows:auto 1fr;gap:20px;padding:64px 24px 120px}
  .vks-art-col{flex-direction:row;align-items:center;gap:14px;max-width:100%}
  .vks-art-box{width:64px;height:64px;border-radius:10px;flex-shrink:0}
  .vks-art-meta{margin-top:0}
  .vks-cascade-col{height:100%}
}

/* ---- Top bar + bottom timeline (both fade with the mouse-wake state) ---- */
.vks-top,.vks-chrome{position:absolute;left:0;right:0;z-index:20;display:flex;pointer-events:none;opacity:0;transition:opacity .32s ease;
  padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
.vks-top{top:0;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;padding-top:calc(14px + env(safe-area-inset-top,0px))}
/* Notch Compatibility: the bar sits below the notch silhouette */
.vks-stage[data-notch="1"] .vks-top{padding-top:calc(14px + env(safe-area-inset-top,0px) + var(--notch-h,0px))}
.vks-chrome{bottom:0;justify-content:center;padding-bottom:calc(14px + env(safe-area-inset-bottom,0px))}
.vks-stage[data-ui="1"] .vks-top,.vks-stage[data-ui="1"] .vks-chrome,.vks-top:focus-within,.vks-chrome:focus-within{opacity:1}
.vks-stage[data-ui="0"] .vks-top :is(button,input,select,label,div),.vks-stage[data-ui="0"] .vks-chrome :is(button,input,select,label,div){pointer-events:none!important}
.vks-grp{display:flex;align-items:center;flex-wrap:wrap;gap:8px}
.vks-bar{pointer-events:auto;display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:8px;max-width:100%;
  padding:6px 10px;border-radius:999px;background:rgba(18,18,22,.78);box-shadow:0 0 0 1px rgba(255,255,255,.12);
  -webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px);font-size:12px;color:rgba(255,255,255,.78)}
.vks-seg{pointer-events:auto;display:flex;align-items:center;gap:2px;padding:3px;border-radius:999px;background:rgba(18,18,22,.78);box-shadow:0 0 0 1px rgba(255,255,255,.12)}
.vks-segbtn{appearance:none;border:0;background:transparent;color:rgba(255,255,255,.68);font:inherit;font-size:11.5px;font-weight:700;padding:5px 11px;border-radius:999px;cursor:pointer;white-space:nowrap}
.vks-segbtn.on{background:var(--lab);color:#fff}
.vks-segval{padding:4px 6px;font-size:11px;color:rgba(255,255,255,.7);font-variant-numeric:tabular-nums}
.vks-btn{pointer-events:auto;appearance:none;border:0;width:32px;height:32px;border-radius:50%;display:grid;place-items:center;cursor:pointer;background:rgba(255,255,255,.1);color:#fff;flex-shrink:0}
.vks-btn svg{width:14px;height:14px;fill:currentColor}
.vks-btn:hover,.vks-mini:hover{background:rgba(255,255,255,.2)}
.vks-mini{pointer-events:auto;appearance:none;border:0;background:rgba(255,255,255,.08);color:#fff;font:inherit;font-size:11px;font-weight:700;padding:5px 9px;border-radius:999px;cursor:pointer}
.vks-swatches{pointer-events:auto;display:flex;align-items:center;gap:6px;padding:5px 9px;border-radius:999px;background:rgba(18,18,22,.78);box-shadow:0 0 0 1px rgba(255,255,255,.12)}
.vks-dot{appearance:none;border:0;width:13px;height:13px;border-radius:50%;cursor:pointer;padding:0;transition:transform 150ms ease}
.vks-dot.on{transform:scale(1.25);box-shadow:0 0 0 2px #fff}
.vks-range{width:min(240px,42vw);accent-color:var(--lab);min-width:90px}

.vks-timeline{pointer-events:auto;display:flex;align-items:center;gap:12px;box-sizing:border-box;width:min(980px,100%);
  padding:8px 12px 8px 8px;border-radius:20px;background:rgba(18,18,22,.8);box-shadow:0 0 0 1px rgba(255,255,255,.12);
  -webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px);font-size:12px;color:rgba(255,255,255,.78)}
.vks-tl-meta{display:flex;align-items:center;gap:10px;min-width:0;width:clamp(120px,20vw,220px);flex-shrink:0}
.vks-thumb{width:40px;height:40px;border-radius:8px;overflow:hidden;flex-shrink:0;background:rgba(255,255,255,.08);display:grid;place-items:center;font-weight:800;color:var(--act)}
.vks-thumb img{width:100%;height:100%;object-fit:cover;display:block}
.vks-tl-text{min-width:0}
.vks-tl-title{font-size:13px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.vks-tl-artist{font-size:11px;color:rgba(255,255,255,.6);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.vks-time{font-variant-numeric:tabular-nums;white-space:nowrap;min-width:78px;text-align:center}
.vks-seek{-webkit-appearance:none;appearance:none;flex:1;min-width:100px;height:20px;margin:0;background:transparent;cursor:pointer;--pct:0%}
.vks-seek::-webkit-slider-runnable-track{height:4px;border-radius:2px;background:linear-gradient(90deg,var(--tint) var(--pct),rgba(255,255,255,.18) var(--pct))}
.vks-seek::-webkit-slider-thumb{-webkit-appearance:none;width:12px;height:12px;margin-top:-4px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.5)}
.vks-seek::-moz-range-track{height:4px;border-radius:2px;background:rgba(255,255,255,.18)}
.vks-seek::-moz-range-progress{height:4px;border-radius:2px;background:var(--tint)}
.vks-seek::-moz-range-thumb{width:12px;height:12px;border:0;border-radius:50%;background:#fff}
.vks-seek:focus-visible{outline:2px solid var(--tint);outline-offset:2px}
@media (max-width:760px){
  .vks-timeline{flex-wrap:wrap;justify-content:center}
  .vks-tl-meta{width:100%}
  .vks-seek{order:5;flex-basis:100%}
}

.vks-picker{position:absolute;top:calc(56px + var(--notch-h,0px));right:16px;z-index:30;pointer-events:auto;width:min(360px,92vw);max-height:320px;overflow-y:auto;
  padding:10px;border-radius:16px;background:rgba(14,14,18,.96);box-shadow:0 18px 48px rgba(0,0,0,.8),0 0 0 1px rgba(255,255,255,.14);
  -webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px)}
.vks-pick-row{display:flex;justify-content:space-between;align-items:center;gap:8px;width:100%;text-align:left;appearance:none;border:0;
  background:transparent;color:#fff;padding:8px 10px;border-radius:10px;cursor:pointer;font:inherit;font-size:12px}
.vks-pick-row:hover{background:rgba(255,255,255,.1)}

/* ---- 3. LUMN NEON SNAKE (always on, z-index 40, outermost screen pixels only) ----
   A conic-gradient snake rotates under two static SVG perimeter masks:
     core = razor-thin crisp line, glow = tight inward bloom. The other ~98% of the display stays #000.
   Only the rotation of the gradient square and one opacity change per frame (compositor-only). */
.vks-lumn{position:absolute;inset:0;z-index:40;pointer-events:none;
  --snake-angle:0deg;--snake-breathe:.9;--snake-diag:2200px;--snake-bg:none}
.vks-snake-glow,.vks-snake-core{position:absolute;inset:0;overflow:hidden;pointer-events:none;
  -webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-size:100% 100%;mask-size:100% 100%}
.vks-snake-spin{position:absolute;left:50%;top:50%;width:var(--snake-diag);height:var(--snake-diag);
  transform:translate(-50%,-50%) rotate(var(--snake-angle));will-change:transform;background:var(--snake-bg)}
.vks-snake-core{filter:saturate(1.2) brightness(1.15)}
.vks-snake-glow{opacity:calc(var(--snake-breathe) * .85);mix-blend-mode:screen}
.vks-notch{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;fill:#000}

/* ---- Lumn dock + Settings button ---- */
.vks-dock{pointer-events:auto;display:flex;align-items:center;gap:6px;padding:5px;border-radius:999px;background:rgba(18,18,22,.78);
  box-shadow:0 0 0 1px rgba(255,255,255,.12);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px)}
.vks-lumnbtn{pointer-events:auto;appearance:none;border:0;display:inline-flex;align-items:center;gap:7px;font:inherit;font-size:12px;font-weight:700;
  color:#fff;background:rgba(255,255,255,.08);padding:6px 13px;border-radius:999px;cursor:pointer;white-space:nowrap;transition:background 160ms ease}
.vks-lumnbtn:hover,.vks-lumnbtn[aria-expanded="true"]{background:rgba(255,255,255,.2)}
.vks-lumnbtn svg{width:14px;height:14px;flex-shrink:0}

/* ---- Lumn Settings popover (macOS frosted glass) ---- */
.vks-lumn-pop{position:absolute;top:calc(56px + var(--notch-h,0px));right:16px;z-index:60;pointer-events:auto;width:280px;box-sizing:border-box;max-height:calc(100% - 72px - var(--notch-h,0px));overflow-y:auto;
  padding:12px 16px 16px;border-radius:16px;color:rgba(255,255,255,.9);color-scheme:dark;
  font:13px/1.3 -apple-system,BlinkMacSystemFont,"SF Pro Text","Inter Tight",system-ui,sans-serif;-webkit-font-smoothing:antialiased;
  background:rgba(22,22,26,.88);-webkit-backdrop-filter:blur(24px) saturate(1.5);backdrop-filter:blur(24px) saturate(1.5);
  box-shadow:0 0 0 .5px rgba(255,255,255,.18),0 24px 60px rgba(0,0,0,.72);animation:lp-in 200ms cubic-bezier(.16,1,.3,1) both}
@keyframes lp-in{from{opacity:0;transform:translateY(-6px) scale(.98)}}
.lp-row{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:32px}
.lp-field{display:flex;flex-direction:column;gap:3px;margin-top:8px}
.lp-field label,.lp-row label{font-size:13px;color:rgba(255,255,255,.88)}
.lp-field label{font-size:12px;font-weight:500;color:rgba(255,255,255,.78)}
.lp-select{appearance:none;-webkit-appearance:none;border:0;height:24px;padding:0 24px 0 10px;border-radius:6px;font:inherit;color:#fff;cursor:pointer;
  background:rgba(255,255,255,.1) ${LUMN_CHEVRONS} no-repeat right 7px center}
.lp-select:hover{background-color:rgba(255,255,255,.16)}
.lp-select option{background:#1c1c20;color:#fff}
.lp-choices{display:flex;flex-direction:column;gap:4px;margin-top:2px}
.lp-choice{appearance:none;-webkit-appearance:none;border:0;text-align:left;padding:6px 10px;border-radius:6px;font:inherit;font-size:12px;line-height:1.25;
  color:rgba(255,255,255,.88);background:rgba(255,255,255,.08);cursor:pointer;transition:background 160ms ease}
.lp-choice:hover{background:rgba(255,255,255,.15)}
.lp-choice[aria-checked="true"]{background:#0A84FF;color:#fff}
.lp-choice:focus-visible{outline:2px solid #0A84FF;outline-offset:2px}
.lp-slider{-webkit-appearance:none;appearance:none;width:100%;height:20px;margin:0;background:transparent;cursor:pointer;--pct:50%}
.lp-slider::-webkit-slider-runnable-track{height:3px;border-radius:2px;background:linear-gradient(90deg,#0A84FF var(--pct),rgba(255,255,255,.14) var(--pct))}
.lp-slider::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;margin-top:-6.5px;border-radius:50%;background:#e6e6ec;
  box-shadow:0 1px 3px rgba(0,0,0,.55),0 0 0 .5px rgba(0,0,0,.25)}
.lp-slider::-moz-range-track{height:3px;border-radius:2px;background:rgba(255,255,255,.14)}
.lp-slider::-moz-range-progress{height:3px;border-radius:2px;background:#0A84FF}
.lp-slider::-moz-range-thumb{width:16px;height:16px;border:0;border-radius:50%;background:#e6e6ec;box-shadow:0 1px 3px rgba(0,0,0,.55)}
.lp-slider:disabled{cursor:default;opacity:.5}
.lp-slider:focus-visible,.lp-select:focus-visible,.lp-switch:focus-visible,.lp-wheel:focus-visible{outline:2px solid #0A84FF;outline-offset:2px}
.lp-switch{position:relative;flex-shrink:0;width:38px;height:22px;padding:0;border:0;border-radius:11px;background:rgba(120,120,128,.36);cursor:pointer;transition:background 220ms ease}
.lp-switch::after{content:'';position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.4);
  transition:transform 240ms cubic-bezier(.3,1.4,.5,1)}
.lp-switch[aria-checked="true"]{background:#0A84FF}
.lp-switch[aria-checked="true"]::after{transform:translateX(16px)}
.lp-colors{display:grid;grid-template-rows:0fr;opacity:0;filter:saturate(.3);
  transition:grid-template-rows 380ms cubic-bezier(.16,1,.3,1),opacity 300ms ease,filter 300ms ease}
.lp-colors[data-open="1"]{grid-template-rows:1fr;opacity:1;filter:none}
.lp-colors>div{min-height:0;overflow:hidden;padding:0 2px}
.lp-wheels{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:12px 0 2px}
.lp-wheelcol{display:flex;flex-direction:column;align-items:center;gap:9px;transition:opacity 300ms ease,filter 300ms ease}
.lp-wheelcol[data-dim="1"]{opacity:.35;filter:saturate(.3)}
.lp-wlabel{font-size:11px;font-weight:600;color:rgba(255,255,255,.9);white-space:pre}
.lp-wlabel span{font-weight:500;color:rgba(255,255,255,.55)}
.lp-wheel{position:relative;width:96px;height:96px;border-radius:50%;touch-action:none;cursor:crosshair;
  background:radial-gradient(circle closest-side,#fff,rgba(255,255,255,0)),conic-gradient(from 0deg,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00);
  box-shadow:0 0 0 1px rgba(255,255,255,.1)}
.lp-wheel::after{content:'';position:absolute;inset:0;border-radius:50%;background:#000;opacity:var(--lp-dark,0);pointer-events:none}
.lp-wheel[aria-disabled="true"]{pointer-events:none}
.lp-knob{position:absolute;z-index:1;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;border:2px solid #fff;background:var(--knob,#fff);
  box-shadow:0 0 0 .5px rgba(0,0,0,.55),0 1px 3px rgba(0,0,0,.55);pointer-events:none}
.lp-bright{display:flex;align-items:center;gap:6px;width:100%;color:rgba(255,255,255,.55)}
.lp-bright svg{width:11px;height:11px;flex-shrink:0;fill:currentColor}
.lp-sep{margin-top:6px;padding-top:8px;border-top:1px solid rgba(255,255,255,.08)}
.lp-colorrow{display:flex;align-items:center;gap:8px}
.lp-link{appearance:none;border:0;background:transparent;color:#0A84FF;font:inherit;font-size:12px;cursor:pointer;padding:0}
.lp-swatch{appearance:none;-webkit-appearance:none;width:24px;height:24px;padding:0;border:0;border-radius:50%;background:none;cursor:pointer}
.lp-swatch::-webkit-color-swatch-wrapper{padding:0}
.lp-swatch::-webkit-color-swatch{border:2px solid rgba(255,255,255,.75);border-radius:50%}
.lp-swatch::-moz-color-swatch{border:2px solid rgba(255,255,255,.75);border-radius:50%}
`;

/* ========================================================================== */
/* Component                                                                  */
/* ========================================================================== */

const EMPTY_LINES: LyricLineItem[] = [];
const WINDOW_BEHIND = 3;
const WINDOW_AHEAD = 3;

type DisplayMode = 'auto' | 'kinetic' | 'cascade';
type BgMode = 'album' | 'black';

interface View extends Snap { epoch: number; }

const ICON_PLAY = (<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5v11l9-5.5Z" /></svg>);
const ICON_PAUSE = (<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 2.5h3v11h-3ZM9.5 2.5h3v11h-3Z" /></svg>);
const ICON_CLOSE = (<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.2 1.8 8 6.6l4.8-4.8 1.4 1.4L9.4 8l4.8 4.8-1.4 1.4L8 9.4l-4.8 4.8-1.4-1.4L6.6 8 1.8 3.2Z" /></svg>);

const ICON_LUMN = (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <rect x="1.6" y="2.6" width="12.8" height="10.8" rx="3" fill="none" stroke="currentColor" strokeWidth="1.3" />
    <path d="M3.6 5.4v5.2M12.4 5.4v5.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);
const ICON_SUN_SM = (<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="2.6" /></svg>);
const ICON_SUN_LG = (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <circle cx="8" cy="8" r="3" />
    {Array.from({ length: 8 }, (_, k) => (
      <rect key={k} x="7.3" y="0.6" width="1.4" height="2.6" rx=".7" transform={`rotate(${k * 45} 8 8)`} />
    ))}
  </svg>
);

/* ========================================================================== */
/* Lumn settings model                                                        */
/* ========================================================================== */

type LumnGradient = '1' | '2';
type LumnAnim = 'sync' | 'flow' | 'static';
type SnakeMode = 'single' | 'twin';

const SNAKE_OPTIONS: ReadonlyArray<readonly [SnakeMode, string]> = [
  ['single', 'Single Snake (65% Black)'],
  ['twin', 'Dual Twin Snakes (Opposite Corners, 60% Black)'],
];

interface LumnSettings {
  gradient: LumnGradient;
  anim: LumnAnim;
  snake: SnakeMode;    // one snake, or two on opposite sides
  notch: boolean;      // trace a MacBook notch at top-center
  thickness: number;   // px, 1.5..8 (crisp neon line)
  glow: number;        // px, 6..36 (tight inward bloom)
  override: boolean;   // manual colors instead of album colors
  edited: boolean;     // user touched the wheels (otherwise they seed from the album)
  primary: Hsv;
  secondary: Hsv;
  textHex: string | null; // custom lyrics text color (null = follow the album)
}

const LUMN_DEFAULTS: LumnSettings = {
  gradient: '2',
  anim: 'sync',
  snake: 'single',
  notch: false,
  thickness: 3,
  glow: 18,
  override: false,
  edited: false,
  primary: hexToHsv('#E03C31'),
  secondary: hexToHsv('#28C76F'),
  textHex: null,
};

const LUMN_KEY = 'vybe.lumn.v2';
const MIN_BRIGHT = 0.08;

function loadLumn(): LumnSettings {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(LUMN_KEY);
    if (!raw) return LUMN_DEFAULTS;
    const o = JSON.parse(raw) as Partial<LumnSettings>;
    const num = (v: unknown, lo: number, hi: number, d: number) =>
      typeof v === 'number' && isFinite(v) ? clamp(v, lo, hi) : d;
    const hsv = (v: unknown, d: Hsv): Hsv => {
      const x = v as Partial<Hsv> | null;
      return x && typeof x === 'object'
        ? { h: num(x.h, 0, 1, d.h), s: num(x.s, 0, 1, d.s), v: num(x.v, MIN_BRIGHT, 1, d.v) }
        : d;
    };
    return {
      gradient: o.gradient === '1' ? '1' : '2',
      anim: o.anim === 'flow' || o.anim === 'static' ? o.anim : 'sync',
      snake: o.snake === 'twin' ? 'twin' : 'single',
      notch: o.notch === true,
      thickness: num(o.thickness, 1.5, 8, LUMN_DEFAULTS.thickness),
      glow: num(o.glow, 6, 36, LUMN_DEFAULTS.glow),
      override: o.override === true,
      edited: o.edited === true,
      primary: hsv(o.primary, LUMN_DEFAULTS.primary),
      secondary: hsv(o.secondary, LUMN_DEFAULTS.secondary),
      textHex: typeof o.textHex === 'string' && /^#[0-9a-f]{6}$/i.test(o.textHex) ? o.textHex : null,
    };
  } catch {
    return LUMN_DEFAULTS;
  }
}

/** macOS-style slider; `--pct` paints the blue fill. */
function LumnSlider({ id, min, max, step, value, onChange, disabled, label }: {
  id?: string; min: number; max: number; step: number; value: number;
  onChange: (v: number) => void; disabled?: boolean; label?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <input
      id={id}
      className="lp-slider"
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      aria-label={label}
      title={String(value)}
      style={{ '--pct': `${pct.toFixed(1)}%` } as React.CSSProperties}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  );
}

/** HSV color wheel (hue = angle, saturation = radius) with a brightness slider underneath. */
function LumnWheel({ label, pct, hsv, disabled, dim, onChange }: {
  label: string; pct: string; hsv: Hsv; disabled: boolean; dim: boolean; onChange: (c: Hsv) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const R = 48;
  const pick = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    let h = Math.atan2(dx, -dy) / (Math.PI * 2);
    if (h < 0) h += 1;
    onChange({ ...hsv, h, s: clamp(Math.hypot(dx, dy) / (r.width / 2), 0, 1) });
  };
  const onKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const k = e.key;
    if (k === 'ArrowLeft') onChange({ ...hsv, h: (hsv.h + 0.99) % 1 });
    else if (k === 'ArrowRight') onChange({ ...hsv, h: (hsv.h + 0.01) % 1 });
    else if (k === 'ArrowUp') onChange({ ...hsv, s: clamp(hsv.s + 0.04, 0, 1) });
    else if (k === 'ArrowDown') onChange({ ...hsv, s: clamp(hsv.s - 0.04, 0, 1) });
    else return;
    e.preventDefault();
  };
  const ang = hsv.h * Math.PI * 2;
  const kx = R + Math.sin(ang) * hsv.s * R;
  const ky = R - Math.cos(ang) * hsv.s * R;
  return (
    <div className="lp-wheelcol" data-dim={dim ? '1' : '0'}>
      <div className="lp-wlabel">{label}  <span>{pct}</span></div>
      <div
        ref={ref}
        className="lp-wheel"
        role="application"
        aria-label={`${label} color wheel`}
        aria-disabled={disabled}
        tabIndex={disabled ? -1 : 0}
        style={{ '--lp-dark': (1 - hsv.v).toFixed(3) } as React.CSSProperties}
        onPointerDown={(e) => { if (disabled) return; e.currentTarget.setPointerCapture(e.pointerId); pick(e); }}
        onPointerMove={(e) => { if (!disabled && (e.buttons & 1)) pick(e); }}
        onKeyDown={disabled ? undefined : onKey}
      >
        <span className="lp-knob" style={{ left: kx, top: ky, '--knob': hsvToHex(hsv) } as React.CSSProperties} />
      </div>
      <div className="lp-bright">
        {ICON_SUN_SM}
        <LumnSlider
          min={MIN_BRIGHT}
          max={1}
          step={0.01}
          value={hsv.v}
          disabled={disabled}
          label={`${label} brightness`}
          onChange={(v) => onChange({ ...hsv, v })}
        />
        {ICON_SUN_LG}
      </div>
    </div>
  );
}

interface WordStyle { fs: number; jx: number; jx2: number; jx3: number; rot: number; cp: string; }


/* ---- Stable identity helpers: a parent re-creating `lines` every render must not reset anything ---- */
function linesSignature(ls: LyricLineItem[]): string {
  const n = ls.length;
  if (!n) return '0';
  const a = ls[0], z = ls[n - 1], m = ls[n >> 1];
  return `${n}|${a.startTime}|${a.text}|${m.text}|${z.startTime}|${z.text}`;
}

function useStableLines(ls: LyricLineItem[]): LyricLineItem[] {
  const ref = useRef<{ sig: string; ls: LyricLineItem[] }>({ sig: linesSignature(ls), ls });
  const sig = linesSignature(ls);
  if (ref.current.sig !== sig) ref.current = { sig, ls };
  return ref.current.ls;
}

/** The stylesheet lives in <head> exactly once; it is never part of the React tree. */
function ensureStyles() {
  if (typeof document === 'undefined') return;
  let el = document.getElementById('vks-style') as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.id = 'vks-style';
    document.head.appendChild(el);
  }
  if (el.textContent !== CSS) el.textContent = CSS;
}

export function VybeKineticStage(props: VybeKineticStageProps) {
  const {
    lines,
    getCurrentTime,
    artworkUrl,
    trackTitle,
    trackArtist,
    trackAlbum,
    trackDuration,
    isPlaying,
    onTogglePlay,
    onClose,
    onVocalAttenuationChange,
  } = props;

  const external = lines !== undefined || !!getCurrentTime;

  useLayoutEffect(() => { ensureStyles(); }, []);

  /* ---------------- view mode, theme & sync state ---------------- */
  const [displayMode, setDisplayMode] = useState<DisplayMode>('auto');
  const [bgMode, setBgMode] = useState<BgMode>('album');
  const [syncOffset, setSyncOffset] = useState<number>(0); // seconds
  const [customHex, setCustomHex] = useState<string | null>(null);

  /* ---------------- Lumn neon snake (always on) ---------------- */
  const [lumn, setLumn] = useState<LumnSettings>(loadLumn);
  const [lumnOpen, setLumnOpen] = useState(false);
  const lumnRef = useRef<HTMLDivElement | null>(null);
  const lumnPopRef = useRef<HTMLDivElement | null>(null);
  const lumnOpenRef = useRef(false);
  lumnOpenRef.current = lumnOpen;
  const lumnAnimRef = useRef<LumnAnim>(lumn.anim);
  lumnAnimRef.current = lumn.anim;
  const patchLumn = useCallback((p: Partial<LumnSettings>) => setLumn((s) => ({ ...s, ...p })), []);
  useEffect(() => {
    try { localStorage.setItem(LUMN_KEY, JSON.stringify(lumn)); } catch { /* storage unavailable */ }
  }, [lumn]);

  /* ---------------- self-healing lyrics state ---------------- */
  const [rescuedLines, setRescuedLines] = useState<LyricLineItem[] | null>(null);
  const [candidates, setCandidates] = useState<LrcSearchCandidate[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);

  /* ---------------- demo state ---------------- */
  const [trackIdx, setTrackIdx] = useState(DEFAULT_DEMO_IDX);
  const [playing, setPlaying] = useState(true);
  const demo = useRef({ t: 0, playing: true, track: DEFAULT_DEMO_IDX });
  const demoTrack = DEMO_TRACKS[trackIdx];

  const propLines = useStableLines(lines ?? EMPTY_LINES);

  // Reset rescued lyrics & offset only when the song (or its lyrics) really changes
  useEffect(() => {
    setRescuedLines(null);
    setSyncOffset(0);
    setCandidates([]);
    setShowPicker(false);
    if (!external || !trackTitle) return;
    if (propLines.length <= 1) {
      let cancelled = false;
      setSearching(true);
      fetchBestMatchedLyrics(trackTitle, trackArtist || '', trackDuration).then((res) => {
        if (cancelled) return;
        setSearching(false);
        if (res.lines.length) setRescuedLines(res.lines);
        if (res.candidates.length) setCandidates(res.candidates);
      });
      return () => { cancelled = true; };
    }
  }, [external, trackTitle, trackArtist, trackDuration, propLines]);

  const activeLines = useMemo(() => {
    if (!external) return demoTrack.lines;
    if (rescuedLines && rescuedLines.length) return rescuedLines;
    return propLines;
  }, [external, demoTrack.lines, rescuedLines, propLines]);

  // Auto-Reverify Duration Once Audio Metadata Loads
  const roundedTrackDuration = Math.round(trackDuration || 0);
  const lastReverifiedDurationRef = useRef<number>(0);

  useEffect(() => {
    if (!external || !trackTitle || roundedTrackDuration <= 0) return;
    if (lastReverifiedDurationRef.current === roundedTrackDuration) return;

    const currentLrcDur = activeLines.length > 0 ? activeLines[activeLines.length - 1].endTime : 0;
    if (currentLrcDur > 0 && Math.abs(currentLrcDur - roundedTrackDuration) > 6) {
      lastReverifiedDurationRef.current = roundedTrackDuration;
      let cancelled = false;
      setSearching(true);
      fetchBestMatchedLyrics(trackTitle, trackArtist || '', roundedTrackDuration).then((res) => {
        if (cancelled) return;
        setSearching(false);
        if (res.lines.length) setRescuedLines(res.lines);
        if (res.candidates.length) setCandidates(res.candidates);
      });
      return () => { cancelled = true; };
    }
  }, [external, trackTitle, trackArtist, roundedTrackDuration, activeLines]);

  const runManualSearch = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(q.trim())}`);
      if (res.ok) {
        const data: LrcSearchCandidate[] = await res.json();
        setCandidates(data.slice(0, 10));
      }
    } catch {
      // ignore network error
    } finally {
      setSearching(false);
    }
  }, []);

  const { words, richLines } = useMemo(() => buildWordsAndLines(activeLines), [activeLines]);

  /* ---------------- colors: album palette + Lumn pair (60% / 40%) ---------------- */
  const artHex = useArtworkHex(external ? artworkUrl : undefined);
  const lumnArt = useArtworkLumn(external ? artworkUrl : undefined);
  const shownArt = external ? artworkUrl : demoTrack.art;

  const autoLumn = useMemo<LumnColors>(() => {
    if (!external) return demoTrack.lumn ?? deriveLumnColors(demoTrack.accent);
    return lumnArt ?? deriveLumnColors(artHex ?? VYBE_PALETTES.rust);
  }, [external, demoTrack, lumnArt, artHex]);

  const palette = useMemo<Palette>(() => {
    let base: string;
    if (customHex) base = customHex;
    else if (!external) base = demoTrack.accent;
    else base = lumnArt?.primary ?? artHex ?? VYBE_PALETTES.rust;
    const p = makePalette(base);
    if (lumn.textHex) {
      const [h, s] = rgbToHsl(hexToRgb(lumn.textHex));
      const sat = clamp(s, 0.6, 1);
      return { ...p, act: lumn.textHex, tint: lumn.textHex, txt: hslToHex(h, sat, 0.5), past2: hslToHex(h, sat, 0.26) };
    }
    return p;
  }, [customHex, external, demoTrack, lumnArt, artHex, lumn.textHex]);

  const lumnPrimary = lumn.override ? hsvToHex(lumn.primary) : autoLumn.primary;
  const lumnSecondary =
    lumn.gradient === '1' ? lumnPrimary : lumn.override ? hsvToHex(lumn.secondary) : autoLumn.secondary;

  const toggleOverride = useCallback(() => {
    setLumn((s) => {
      const next = !s.override;
      if (next && !s.edited) {
        return { ...s, override: true, primary: hexToHsv(autoLumn.primary), secondary: hexToHsv(autoLumn.secondary) };
      }
      return { ...s, override: next };
    });
  }, [autoLumn]);

  /* ---------------- refs + view state ---------------- */
  const stageRef = useRef<HTMLDivElement | null>(null);
  const wordsElRef = useRef<HTMLDivElement | null>(null);
  const artBoxRef = useRef<HTMLDivElement | null>(null);
  const scrubRef = useRef<HTMLInputElement | null>(null);
  const timeRef = useRef<HTMLSpanElement | null>(null);
  const colRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const spotifyCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const scrubbingRef = useRef(false);

  const duration = external
    ? trackDuration && trackDuration > 0
      ? trackDuration
      : richLines.length ? richLines[richLines.length - 1].endTime + 3 : 0
    : demoTrack.duration;

  const propsRef = useRef({ ...props, external, syncOffset });
  propsRef.current = { ...props, external, syncOffset };
  const durRef = useRef(duration);
  durRef.current = duration;
  const wordsRef = useRef<TimedWord[]>(words);
  const linesRef = useRef<LyricLineItem[]>(richLines);
  const epochRef = useRef(0);
  const lastKeyRef = useRef('');
  const curIdxRef = useRef(-1);
  const lastTRef = useRef(0);

  const [view, setView] = useState<View | null>(null);
  const [size, setSize] = useState({
    w: typeof window === 'undefined' ? 1280 : window.innerWidth,
    h: typeof window === 'undefined' ? 720 : window.innerHeight,
  });
  const [fontTick, setFontTick] = useState(0);
  const [vocal, setVocal] = useState(0);

  // New lyrics (a different song): remount the word nodes on the next frame.
  useEffect(() => {
    wordsRef.current = words;
    linesRef.current = richLines;
    epochRef.current += 1;
    lastKeyRef.current = '';
  }, [words, richLines]);

  useEffect(() => {
    if (!document.getElementById('vks-fonts')) {
      const l = document.createElement('link');
      l.id = 'vks-fonts';
      l.rel = 'stylesheet';
      l.href = 'https://fonts.googleapis.com/css2?family=Inter+Tight:ital,wght@0,500;0,700;0,800;1,800&display=swap';
      document.head.appendChild(l);
    }
    const f = document.fonts;
    if (!f) return;
    const bump = () => setFontTick((n) => n + 1);
    f.load('800 100px "Inter Tight"').then(bump).catch(() => undefined);
    f.ready.then(bump).catch(() => undefined);
    f.addEventListener?.('loadingdone', bump);
    return () => f.removeEventListener?.('loadingdone', bump);
  }, []);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const read = () => {
      const r = el.getBoundingClientRect();
      setSize((s) => {
        const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
        return s.w === w && s.h === h ? s : { w, h };
      });
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* ---------------- mouse-wake HUD: zero React re-renders ---------------- */
  // `data-ui` is written straight to the DOM node from a ref timer. It is never React state.
  const uiTimer = useRef<number | undefined>(undefined);
  const holdUiRef = useRef(false);
  holdUiRef.current = lumnOpen || showPicker;

  const wake = useCallback(() => {
    const st = stageRef.current;
    if (!st) return;
    if (st.dataset.ui !== '1') st.dataset.ui = '1';
    window.clearTimeout(uiTimer.current);
    const arm = () => {
      uiTimer.current = window.setTimeout(() => {
        if (holdUiRef.current || scrubbingRef.current) arm();
        else if (stageRef.current) stageRef.current.dataset.ui = '0';
      }, 2000);
    };
    arm();
  }, []);

  useEffect(() => {
    wake();
    return () => window.clearTimeout(uiTimer.current);
  }, [wake]);

  /* ---------------- transport ---------------- */
  // `time` is lyric time (includes the sync offset); `seekRaw` takes the real playback time.
  const seekRaw = useCallback((time: number) => {
    const p = propsRef.current;
    const t = Math.max(0, time);
    if (p.external) p.onSeek?.(t);
    else demo.current.t = clamp(t, 0, DEMO_TRACKS[demo.current.track].duration);
  }, []);

  const seekTo = useCallback((time: number) => seekRaw(time - propsRef.current.syncOffset), [seekRaw]);

  const stepWord = useCallback((dir: -1 | 1) => {
    const ws = wordsRef.current;
    if (!ws.length) return;
    const idx = curIdxRef.current;
    let target: number;
    if (dir < 0) {
      target = idx >= 0 && lastTRef.current - ws[idx].start > 0.7 ? ws[idx].start : ws[Math.max(0, idx - 1)].start;
    } else {
      target = ws[Math.min(ws.length - 1, idx + 1)].start;
    }
    seekTo(target + 0.001);
  }, [seekTo]);

  const togglePlay = useCallback(() => {
    if (propsRef.current.external) {
      propsRef.current.onTogglePlay?.();
      return;
    }
    demo.current.playing = !demo.current.playing;
    setPlaying(demo.current.playing);
  }, []);

  const selectDemoTrack = useCallback((i: number) => {
    demo.current.track = i;
    demo.current.t = 0;
    setTrackIdx(i);
  }, []);

  const playingNow = external ? isPlaying ?? true : playing;

  // Close the Lumn popover when pressing outside of it
  useEffect(() => {
    if (!lumnOpen) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      if (lumnPopRef.current?.contains(t) || t.closest('[data-lumn-btn]')) return;
      setLumnOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, [lumnOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
      if (e.key === 'Escape') {
        if (lumnOpenRef.current) { setLumnOpen(false); return; }
        propsRef.current.onClose?.();
        return;
      }
      if (typing) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); stepWord(-1); wake(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); stepWord(1); wake(); }
      else if (e.key === ' ' && el?.tagName !== 'BUTTON') { e.preventDefault(); togglePlay(); wake(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stepWord, togglePlay, wake]);

  /* ---------------- the frame loop (no React state except the word snapshot) ---------------- */
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    let raf = 0;
    let last = performance.now();
    let bass = 0;
    let snakeAngle = 0; // Lumn neon snake angle (deg)
    let lastTime = '';
    let lastDur = -1;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      const p = propsRef.current;
      const d = demo.current;

      let rawT = 0;
      let target = 0;
      if (p.external) {
        rawT = p.getCurrentTime ? p.getCurrentTime() : p.currentTime ?? 0;
        target = p.getBassEnergy ? p.getBassEnergy() : p.bassEnergy ?? 0;
      } else {
        const tr = DEMO_TRACKS[d.track];
        if (d.playing && !scrubbingRef.current) {
          d.t += dt;
          if (d.t >= tr.duration) d.t = 0;
        }
        rawT = d.t;
        target = d.playing ? demoBass(rawT, tr.bpm) : 0;
      }
      if (!isFinite(rawT)) rawT = 0;
      const visualLead = 0.08;
      const t = Math.max(0, rawT + p.syncOffset + visualLead);
      lastTRef.current = t;
      target = clamp01(isFinite(target) ? target : 0);
      bass += (target - bass) * (target > bass ? 0.5 : 0.12);
      const bassStr = bass.toFixed(3);
      // Only the two elements that use the bass variable receive it (no subtree-wide style recalc)
      wordsElRef.current?.style.setProperty('--vks-bass', bassStr);
      artBoxRef.current?.style.setProperty('--vks-bass', bassStr);

      // Spotify-Style 60fps moving album gradient background (filter-free, zero flicker)
      const cvs = spotifyCanvasRef.current;
      if (cvs) {
        const ctx = cvs.getContext('2d');
        if (ctx) {
          if (cvs.width !== size.w || cvs.height !== size.h) {
            cvs.width = size.w;
            cvs.height = size.h;
          }
          const w = size.w;
          const h = size.h;
          const sec = now / 1000;
          ctx.fillStyle = '#06070a';
          ctx.fillRect(0, 0, w, h);

          const pulse = 1 + bass * 0.45;
          const col1 = lumnPrimary || '#2563EB';
          const col2 = lumnSecondary || '#E86538';
          const colDeep = '#18122B';

          // Moving Orb 1 (Primary)
          const x1 = w * (0.35 + Math.sin(sec * 0.35) * 0.22);
          const y1 = h * (0.38 + Math.cos(sec * 0.3) * 0.2);
          const r1 = Math.max(w, h) * 0.58 * pulse;
          const g1 = ctx.createRadialGradient(x1, y1, 0, x1, y1, r1);
          g1.addColorStop(0, rgbaOf(col1, 0.44));
          g1.addColorStop(0.65, rgbaOf(col1, 0.08));
          g1.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g1;
          ctx.fillRect(0, 0, w, h);

          // Moving Orb 2 (Secondary)
          const x2 = w * (0.68 + Math.cos(sec * 0.32) * 0.2);
          const y2 = h * (0.6 + Math.sin(sec * 0.38) * 0.22);
          const r2 = Math.max(w, h) * 0.62 * pulse;
          const g2 = ctx.createRadialGradient(x2, y2, 0, x2, y2, r2);
          g2.addColorStop(0, rgbaOf(col2, 0.4));
          g2.addColorStop(0.6, rgbaOf(col2, 0.07));
          g2.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g2;
          ctx.fillRect(0, 0, w, h);

          // Moving Orb 3 (Deep base)
          const x3 = w * (0.28 + Math.sin(sec * 0.25 + 1.2) * 0.18);
          const y3 = h * (0.75 + Math.cos(sec * 0.28 + 1.0) * 0.18);
          const r3 = Math.max(w, h) * 0.52 * pulse;
          const g3 = ctx.createRadialGradient(x3, y3, 0, x3, y3, r3);
          g3.addColorStop(0, rgbaOf(colDeep, 0.35));
          g3.addColorStop(0.7, 'rgba(0,0,0,0)');
          ctx.fillStyle = g3;
          ctx.fillRect(0, 0, w, h);
        }
      }

      // Lumn neon snake: Music Sync slithers at 55 deg/s and surges with the bass, Flow keeps the
      // constant 55 deg/s, Static eases to a parked pose. Every frame only a rotation and an opacity change.
      const lumnEl = lumnRef.current;
      if (lumnEl) {
        const mode = lumnAnimRef.current;
        const sec = now / 1000;
        let breathe: number;
        if (mode === 'sync') {
          snakeAngle += dt * (SNAKE_BASE_SPEED + bass * SNAKE_BASS_SPEED);
          breathe = 0.6 + bass * 0.4;
        } else if (mode === 'flow') {
          snakeAngle += dt * SNAKE_BASE_SPEED;
          breathe = 0.88 + Math.sin(sec * 1.3) * 0.06;
        } else {
          const delta = ((SNAKE_STATIC_ANGLE - snakeAngle + 540) % 360) - 180;
          snakeAngle += delta * Math.min(1, dt * 3);
          breathe = 0.9;
        }
        snakeAngle = ((snakeAngle % 360) + 360) % 360;
        lumnEl.style.setProperty('--snake-angle', `${snakeAngle.toFixed(2)}deg`);
        lumnEl.style.setProperty('--snake-breathe', clamp01(breathe).toFixed(3));
      }

      // Bottom timeline (real songs and demo): seek value, fill and "0:24 / 3:50"
      const dur = durRef.current;
      const sc = scrubRef.current;
      if (sc) {
        if (!scrubbingRef.current) sc.value = String(rawT);
        const shown = scrubbingRef.current ? Number(sc.value) : rawT;
        sc.style.setProperty('--pct', `${dur > 0 ? clamp01(shown / dur) * 100 : 0}%`);
      }
      const label = `${fmtTime(rawT)} / ${fmtTime(dur)}`;
      if (timeRef.current && (label !== lastTime || dur !== lastDur)) {
        timeRef.current.textContent = label;
        lastTime = label;
        lastDur = dur;
      }

      const ws = wordsRef.current;
      const ls = linesRef.current;
      const snap = stateAt(ws, ls, t);
      curIdxRef.current = findIdx(ws, t);
      // Everything that can change a word's slot is part of the key, so the view re-renders exactly then.
      const key =
        `${snap.a}|${snap.ph}|${snap.lineIdx}|` +
        `${snap.parked ? 1 : 0}${snap.nx1 ? 1 : 0}${snap.nx2 ? 1 : 0}${snap.p2 ? 1 : 0}`;
      if (key !== lastKeyRef.current) {
        lastKeyRef.current = key;
        setView({ ...snap, epoch: epochRef.current });
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  /* ---------------- per-word layout ---------------- */
  const F = clamp(Math.min(size.h * 0.27, size.w * 0.19), 52, 235);

  const styles = useMemo<WordStyle[]>(() => {
    return words.map((wd, i) => {
      const seed = hashStr(wd.text) + i * 7;
      const em = textEm(wd.text);
      const iconEm = wd.icon ? (wd.icon.kind === 'svg' && wd.icon.id === 'signature' ? 1.15 : 0.92) : 0;
      const fit = Math.min(1, (size.w * 0.84) / ((em + iconEm) * F));
      const fs = F * fit;
      const room = Math.max(0, (size.w * 0.92 - (em + iconEm) * fs) / 2);
      const range = Math.min(size.w * 0.032, room * 0.38);
      const jx = (rnd(seed, 1) - 0.5) * 2 * range;
      const jx2 = jx * 0.35;
      const jx3 = jx * 0.45 + (rnd(seed, 2) - 0.5) * size.w * 0.012;
      const rot = (rnd(seed, 3) - 0.5) * 2.2;
      const pt = (k: number, m: number) => (rnd(seed, k) * m).toFixed(1);
      const cp = `polygon(${pt(4, 3)}% ${pt(5, 5)}%, ${(100 - rnd(seed, 6) * 3).toFixed(1)}% ${pt(7, 4)}%, ${(100 - rnd(seed, 8) * 3).toFixed(1)}% ${(100 - rnd(seed, 9) * 4).toFixed(1)}%, ${pt(10, 3)}% ${(100 - rnd(seed, 11) * 5).toFixed(1)}%)`;
      return { fs, jx, jx2, jx3, rot, cp };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [words, size, F, fontTick]);

  const vars = useMemo(() => paletteVars(palette), [palette]);
  const title = external ? trackTitle || 'Unknown Track' : demoTrack.title;
  const artist = external ? trackArtist || '' : demoTrack.artist;
  const album = external ? trackAlbum || '' : demoTrack.album;
  const subtitle = [artist, album && album !== title ? album : ''].filter(Boolean).join(' — ');

  /* ---------------- Lumn neon snake: gradient, masks, notch ---------------- */
  const notch = useMemo(() => (lumn.notch ? notchBox(size.w, size.h) : null), [lumn.notch, size.w, size.h]);

  const snakeBg = useMemo(
    () => snakeGradient(lumnPrimary, lumnSecondary, lumn.snake === 'twin'),
    [lumnPrimary, lumnSecondary, lumn.snake],
  );

  const snakeMasks = useMemo(() => {
    const m = buildSnakeMasks(size.w, size.h, lumn.thickness, lumn.glow, notch);
    return {
      core: { WebkitMaskImage: m.core, maskImage: m.core } as React.CSSProperties,
      glow: { WebkitMaskImage: m.glow, maskImage: m.glow } as React.CSSProperties,
    };
  }, [size.w, size.h, lumn.thickness, lumn.glow, notch]);

  const lumnStyle = useMemo(
    () =>
      ({
        '--snake-bg': snakeBg,
        '--snake-diag': `${Math.ceil(Math.hypot(size.w, size.h))}px`,
      }) as React.CSSProperties,
    [snakeBg, size.w, size.h],
  );

  /* ---------------- which view is showing ---------------- */
  const activeLineIdx = view?.lineIdx ?? 0;
  const showCascade = useMemo(() => {
    if (displayMode === 'cascade') return true;
    if (displayMode === 'kinetic') return false;
    // Auto-Alternate: swap views every 4 lyric lines
    return Math.floor(Math.max(0, activeLineIdx) / 4) % 2 === 1;
  }, [displayMode, activeLineIdx]);

  /* ---------------- 1. Kinetic conveyor items ---------------- */
  const kineticItems: React.ReactNode[] = [];
  if (view && words.length && view.epoch === epochRef.current) {
    const lo = Math.max(0, view.a - WINDOW_BEHIND);
    const hi = Math.min(words.length - 1, view.a + WINDOW_AHEAD);
    for (let i = lo; i <= hi; i++) {
      const wd = words[i];
      const st = styles[i];
      if (!st) continue;
      const slot = slotOf(words, view, i);
      const ph: Phase = i === view.a ? view.ph : i < view.a ? 'done' : 'wait';
      const ic = wd.icon;
      const tapeMode = wd.icon ? 'pink' : 'maroon';
      const skewPast = wd.icon && wd.icon.kind === 'svg' && wd.icon.id !== 'heart' ? '0deg' : '-11deg';

      kineticItems.push(
        <div
          key={`${view.epoch}-${i}`}
          className="vks-w"
          data-i={i}
          data-slot={slot}
          data-ph={ph}
          data-tape={tapeMode}
          style={{
            '--fs': `${st.fs.toFixed(1)}px`,
            '--jx': `${st.jx.toFixed(1)}px`,
            '--jx2': `${st.jx2.toFixed(1)}px`,
            '--jx3': `${st.jx3.toFixed(1)}px`,
            '--rot': `${st.rot.toFixed(2)}deg`,
            '--cp': st.cp,
            '--skew-past': skewPast,
          } as React.CSSProperties}
        >
          <span className="vks-bg" aria-hidden="true" />
          <span className="vks-tx">{wd.text}</span>
          {ic && ic.kind === 'svg' && (
            <span
              className={'vks-ic' + (ic.left ? ' l' : '') + (ic.id === 'signature' ? ' sig' : '')}
              aria-hidden="true"
            >
              <GlyphArt id={ic.id} />
            </span>
          )}
          {ic && ic.kind === 'emoji' && (
            <span className={'vks-ic emo' + (ic.left ? ' l' : '')} aria-hidden="true">{ic.ch}</span>
          )}
        </div>,
      );
    }
  }

  /* ---------------- 2. Split cascade: every line stays mounted, the track just scrolls ---------------- */
  const cascadeLines = useMemo(() => {
    return richLines.map((ln, idx) => {
      const dist = idx - activeLineIdx;
      const abs = Math.abs(dist);
      const near = abs <= 4;
      const isCur = dist === 0;
      const o = !near ? 0 : isCur ? 1 : dist < 0 ? (abs === 1 ? 0.34 : abs === 2 ? 0.2 : 0.1) : clamp(0.62 - (abs - 1) * 0.14, 0.14, 0.62);
      const b = !near || isCur ? 0 : clamp(abs * 0.9, 0.6, 3.6);
      return (
        <div
          key={ln.id || idx}
          className="vks-cline"
          data-cur={isCur ? '1' : '0'}
          data-far={near ? '0' : '1'}
          onClick={() => seekTo(ln.startTime + 0.01)}
          style={{ '--o': o, '--b': `${b.toFixed(1)}px`, '--s': isCur ? 1 : 0.95 } as React.CSSProperties}
        >
          {near && ln.words.length
            ? ln.words.map((w, wi) => (
                <span key={wi} className="vks-cword" data-sung={isCur && lastTRef.current >= w.startTime ? '1' : '0'}>
                  {w.text}
                </span>
              ))
            : ln.text}
        </div>
      );
    });
  }, [richLines, activeLineIdx, seekTo, view]);

  // Scroll the track so the active line sits at ~42% of the column (CSS transition does the glide)
  useLayoutEffect(() => {
    const col = colRef.current;
    const track = trackRef.current;
    if (!col || !track) return;
    const el = track.children[activeLineIdx] as HTMLElement | undefined;
    if (!el) return;
    const y = col.clientHeight * 0.42 - (el.offsetTop + el.offsetHeight / 2);
    track.style.transform = `translate3d(0,${y.toFixed(1)}px,0)`;
  }, [activeLineIdx, richLines, size, fontTick, showCascade]);

  const onLumnBtn = () => { setLumnOpen((o) => !o); setShowPicker(false); };

  return (
    <div
      ref={stageRef}
      className="vks-stage bg-[#000000]"
      style={{
        ...vars,
        backgroundColor: '#000000',
        '--F': `${F.toFixed(1)}px`,
        '--notch-h': `${notch ? Math.ceil(notch.nh) : 0}px`,
      } as React.CSSProperties}
      data-ui="1"
      data-bg={bgMode}
      data-notch={notch ? '1' : '0'}
      onPointerMove={wake}
      onPointerDown={wake}
      role="region"
      aria-label="Lyrics stage"
    >
      {/* When bgMode === 'album' (Default): Full-screen atmospheric album cover over #000000 */}
      {bgMode === 'album' && (
        <>
          {shownArt ? (
            <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
              {/* Layer 1: Full-bleed atmospheric album cover */}
              <img
                src={shownArt}
                alt=""
                className="absolute inset-0 w-full h-full object-cover scale-105 blur-md opacity-65 transition-all duration-700 pointer-events-none select-none"
              />
              {/* Layer 2: Pure black radial vignette & readability overlay */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/45 to-black/80 pointer-events-none" />
            </div>
          ) : (
            <canvas ref={spotifyCanvasRef} className="vks-spotify-canvas" aria-hidden="true" />
          )}
        </>
      )}

      {/* Sleek Loading State when syncing lyrics for real track */}
      {external && activeLines.length === 0 && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 pointer-events-none select-none">
          <div className="relative w-12 h-12 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border-2 border-[#E86538]/20 border-t-[#E86538] animate-spin" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#E86538] animate-ping" />
          </div>
          <div className="text-lg font-bold text-white tracking-wide font-sans animate-pulse">
            Syncing lyrics for {title}...
          </div>
          <div className="text-xs text-white/40 font-mono">
            High-precision LRCLIB stream matching
          </div>
        </div>
      )}

      {/* VIEW A: Kinetic Word Conveyor */}
      <div className="vks-layer" data-active={showCascade ? '0' : '1'}>
        <div ref={wordsElRef} className="vks-words" aria-live="off">{kineticItems}</div>
      </div>

      {/* VIEW B: Split-Screen Album Cascade over a slow moving aura */}
      <div className="vks-layer" data-active={showCascade ? '1' : '0'}>
        {bgMode === 'album' && (
          <div className="vks-aura" aria-hidden="true"><i /><i /></div>
        )}
        <div className="vks-split">
          <div className="vks-art-col">
            <div ref={artBoxRef} className="vks-art-box">
              {shownArt ? (
                <img src={shownArt} alt={title} />
              ) : (
                <div className="vks-art-fallback">{title.slice(0, 1).toUpperCase()}</div>
              )}
            </div>
            <div className="vks-art-meta">
              <div className="vks-art-title">{title}</div>
              <div className="vks-art-sub">{subtitle}</div>
            </div>
          </div>

          <div ref={colRef} className="vks-cascade-col">
            <div ref={trackRef} className="vks-cascade-track">
              {cascadeLines.length ? (
                cascadeLines
              ) : (
                <div className="vks-cline" style={{ '--o': 0.7, '--s': 1 } as React.CSSProperties}>
                  {searching ? 'Matching synced lyrics…' : title}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Lumn neon snake: always on, outermost screen pixels only, the interior stays pure #000 */}
      <div ref={lumnRef} className="vks-lumn" aria-hidden="true" style={lumnStyle}>
        {notch && (
          <svg className="vks-notch" viewBox={`0 0 ${size.w} ${size.h}`} preserveAspectRatio="none">
            <path d={notchShape(notch)} />
          </svg>
        )}
        <div className="vks-snake-glow" style={snakeMasks.glow}><div className="vks-snake-spin" /></div>
        <div className="vks-snake-core" style={snakeMasks.core}><div className="vks-snake-spin" /></div>
      </div>

      {/* Top bar: view modes, background, demo presets, lyric matcher, palette, Lumn, close */}
      <div className="vks-top">
        <div className="vks-grp">
          <div className="vks-seg" role="group" aria-label="Lyric view mode">
            {([
              ['auto', '⚡ Auto-Alternate'],
              ['kinetic', 'Kinetic Word'],
              ['cascade', 'Split Cascade'],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={'vks-segbtn' + (displayMode === id ? ' on' : '')}
                onClick={() => setDisplayMode(id)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="vks-seg" role="group" aria-label="Lyrics background mode">
            <button
              type="button"
              className={'vks-segbtn' + (bgMode === 'album' ? ' on' : '')}
              onClick={() => setBgMode('album')}
            >
              🖼 Album Cover
            </button>
            <button
              type="button"
              className={'vks-segbtn' + (bgMode === 'black' ? ' on' : '')}
              onClick={() => setBgMode('black')}
            >
              ⚫ Pure Black
            </button>
          </div>


        </div>

        <div className="vks-grp">
          <button
            type="button"
            className="vks-mini"
            onClick={() => {
              const nextOpen = !showPicker;
              setShowPicker(nextOpen);
              if (nextOpen) setLumnOpen(false);
              if (nextOpen && !candidates.length && trackTitle) {
                const q = `${trackTitle} ${trackArtist || ''}`.trim();
                setSearchQuery(q);
                runManualSearch(q);
              }
            }}
          >
            {searching ? 'Matching…' : '🔍 Match Lyrics'}
          </button>

          <button
            type="button"
            className="vks-lumnbtn"
            data-lumn-btn
            aria-haspopup="dialog"
            aria-expanded={lumnOpen}
            onClick={onLumnBtn}
          >
            {ICON_LUMN}
            <span>Lumn Settings</span>
          </button>

          <div className="vks-swatches" role="group" aria-label="Color palette">
            {Object.entries(VYBE_PALETTES).map(([name, hex]) => (
              <button
                key={name}
                type="button"
                className={'vks-dot' + (customHex === hex ? ' on' : '')}
                style={{ background: hex }}
                title={`Palette: ${name}`}
                onClick={() => setCustomHex(customHex === hex ? null : hex)}
              />
            ))}
          </div>

          {external && onVocalAttenuationChange && (
            <label className="vks-bar" htmlFor="vks-vocal" style={{ padding: '4px 10px' }}>
              <span>vocal cut</span>
              <input
                id="vks-vocal"
                className="vks-range"
                style={{ width: 90, minWidth: 70 }}
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={vocal}
                onChange={(e) => { const v = Number(e.target.value); setVocal(v); onVocalAttenuationChange(v); }}
              />
            </label>
          )}

          {onClose && (
            <button type="button" className="vks-btn" aria-label="Close lyrics" onClick={onClose}>{ICON_CLOSE}</button>
          )}
        </div>
      </div>

      {/* Lyrics re-match popover */}
      {showPicker && (
        <div className="vks-picker">
          <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
            <input
              type="text"
              value={searchQuery}
              placeholder="Search song & artist…"
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') runManualSearch(searchQuery); }}
              style={{
                flex: 1,
                background: 'rgba(255,255,255,.08)',
                border: '1px solid rgba(255,255,255,.15)',
                borderRadius: 8,
                padding: '6px 10px',
                color: '#fff',
                fontSize: 12,
              }}
            />
            <button type="button" className="vks-mini" onClick={() => runManualSearch(searchQuery)}>
              Search
            </button>
          </div>
          {candidates.map((c) => (
            <button
              key={c.id}
              type="button"
              className="vks-pick-row"
              onClick={() => {
                const raw = c.syncedLyrics || c.plainLyrics || '';
                if (raw) {
                  setRescuedLines(parseLrcToLines(raw, trackDuration || c.duration || 180));
                  setSyncOffset(0);
                  setShowPicker(false);
                }
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <strong>{c.trackName}</strong> · {c.artistName}
              </span>
              <span style={{ opacity: 0.6, flexShrink: 0 }}>
                {c.syncedLyrics ? '⚡ Synced' : 'Plain'} {c.duration ? `(${fmtTime(c.duration)})` : ''}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Lumn Settings popover (frosted macOS glass, top-right) */}
      {lumnOpen && (
        <div ref={lumnPopRef} className="vks-lumn-pop" role="dialog" aria-label="Lumn Settings">
          <div className="lp-row">
            <label htmlFor="lp-gradient">Gradient</label>
            <select
              id="lp-gradient"
              className="lp-select"
              value={lumn.gradient}
              onChange={(e) => patchLumn({ gradient: e.target.value === '1' ? '1' : '2' })}
            >
              <option value="1">1 Color</option>
              <option value="2">2 Colors</option>
            </select>
          </div>

          <div className="lp-row">
            <label htmlFor="lp-anim">Animation</label>
            <select
              id="lp-anim"
              className="lp-select"
              value={lumn.anim}
              onChange={(e) => patchLumn({ anim: e.target.value as LumnAnim })}
            >
              <option value="sync">Music Sync</option>
              <option value="flow">Flow</option>
              <option value="static">Static</option>
            </select>
          </div>

          <div className="lp-field">
            <label id="lp-snake-label">Snake</label>
            <div className="lp-choices" role="radiogroup" aria-labelledby="lp-snake-label">
              {SNAKE_OPTIONS.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={lumn.snake === id}
                  className="lp-choice"
                  onClick={() => patchLumn({ snake: id })}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="lp-row" style={{ marginTop: 6 }}>
            <label id="lp-notch-label">Notch Compatibility</label>
            <button
              type="button"
              className="lp-switch"
              role="switch"
              aria-checked={lumn.notch}
              aria-labelledby="lp-notch-label"
              onClick={() => patchLumn({ notch: !lumn.notch })}
            />
          </div>

          <div className="lp-field">
            <label htmlFor="lp-thickness">Thickness</label>
            <LumnSlider id="lp-thickness" min={1.5} max={8} step={0.5} value={lumn.thickness} onChange={(v) => patchLumn({ thickness: v })} />
          </div>

          <div className="lp-field">
            <label htmlFor="lp-glow">Glow</label>
            <LumnSlider id="lp-glow" min={6} max={36} step={1} value={lumn.glow} onChange={(v) => patchLumn({ glow: v })} />
          </div>

          <div className="lp-row" style={{ marginTop: 6 }}>
            <label id="lp-override-label">Override album color</label>
            <button
              type="button"
              className="lp-switch"
              role="switch"
              aria-checked={lumn.override}
              aria-labelledby="lp-override-label"
              onClick={toggleOverride}
            />
          </div>

          <div className="lp-colors" data-open={lumn.override ? '1' : '0'} aria-hidden={!lumn.override}>
            <div>
              <div className="lp-wheels">
                <LumnWheel
                  label="Primary"
                  pct="60%"
                  hsv={lumn.primary}
                  disabled={!lumn.override}
                  dim={!lumn.override}
                  onChange={(c) => patchLumn({ primary: c, edited: true })}
                />
                <LumnWheel
                  label="Secondary"
                  pct="40%"
                  hsv={lumn.secondary}
                  disabled={!lumn.override || lumn.gradient === '1'}
                  dim={!lumn.override || lumn.gradient === '1'}
                  onChange={(c) => patchLumn({ secondary: c, edited: true })}
                />
              </div>
            </div>
          </div>

          <div className="lp-row lp-sep">
            <label htmlFor="lp-text">Lyrics text color</label>
            <span className="lp-colorrow">
              {lumn.textHex && (
                <button type="button" className="lp-link" onClick={() => patchLumn({ textHex: null })}>Auto</button>
              )}
              <input
                id="lp-text"
                className="lp-swatch"
                type="color"
                value={lumn.textHex ?? hslToHex(rgbToHsl(hexToRgb(palette.tint))[0], 0.8, 0.62)}
                onChange={(e) => patchLumn({ textHex: e.target.value })}
              />
            </span>
          </div>
        </div>
      )}

      {/* Bottom playback timeline: real songs and demo */}
      <div className="vks-chrome">
        <div className="vks-timeline" role="group" aria-label="Playback">
          <div className="vks-tl-meta">
            <div className="vks-thumb">
              {shownArt ? <img src={shownArt} alt="" /> : <span>{title.slice(0, 1).toUpperCase()}</span>}
            </div>
            <div className="vks-tl-text">
              <div className="vks-tl-title">{title}</div>
              <div className="vks-tl-artist">{artist}</div>
            </div>
          </div>

          <button type="button" className="vks-btn" aria-label={playingNow ? 'Pause' : 'Play'} onClick={() => { togglePlay(); wake(); }}>
            {playingNow ? ICON_PAUSE : ICON_PLAY}
          </button>

          <input
            id="vks-scrub"
            ref={scrubRef}
            className="vks-seek"
            type="range"
            min={0}
            max={duration > 0 ? duration : 1}
            step={0.01}
            defaultValue={0}
            aria-label="Seek"
            onPointerDown={() => { scrubbingRef.current = true; }}
            onPointerUp={() => { scrubbingRef.current = false; }}
            onBlur={() => { scrubbingRef.current = false; }}
            onChange={(e) => seekRaw(Number(e.target.value))}
          />
          <span ref={timeRef} className="vks-time" />

          <button
            type="button"
            className="vks-lumnbtn"
            data-lumn-btn
            aria-haspopup="dialog"
            aria-expanded={lumnOpen}
            onClick={onLumnBtn}
          >
            {ICON_LUMN}
            <span>Lumn Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default VybeKineticStage;