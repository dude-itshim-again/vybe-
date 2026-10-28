# 03. Kinetic Lyrics Specification

## 1. Unified Lyric AST & Data Model

The VibeForge kinetic typography subsystem normalizes diverse timecode formats—Standard LRC, Enhanced Syllable-Level ELRC, LRCLIB Synced API responses, and OpenAI `faster-whisper` word-level JSON—into an immutable, high-resolution Abstract Syntax Tree (AST).

```
[Raw LRC / ELRC / Whisper JSON]
              │
              ▼
    ┌──────────────────┐
    │  AST Normalizer  │ ──► Monotonic Timestamp Validation & Drift Correction
    └─────────┬────────┘
              │
              ▼
    ┌──────────────────┐
    │    LyricTrack    │ ── Global Track Metadata & Sync Precision Mode
    └─────────┬────────┘
              │ 1:N
              ▼
    ┌──────────────────┐
    │    LyricLine     │ ── Line Boundary [startTime, endTime], Text & Distance Index
    └─────────┬────────┘
              │ 1:N
              ▼
    ┌──────────────────┐
    │    LyricWord     │ ── Word Boundary [startTime, endTime], Syllables & Progress
    └──────────────────┘
```

### 1.1. TypeScript Abstract Syntax Tree (AST) Interfaces

```typescript
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
  words: LyricWord[]; // Populated if precision is 'word' or 'syllable', empty if 'line'
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
  offsetMs: number; // Global calibration offset in milliseconds (-500 to +500)
}
```

### 1.2. Ingestion & Format Parsing Rules

1. **Standard Line LRC (`[mm:ss.xx] Line Text`)**:
   * Timestamps are converted to floating-point seconds: $T = \text{minutes} \times 60 + \text{seconds} + \frac{\text{hundredths}}{100}$.
   * Line `endTime` is inferred from the `startTime` of the subsequent line minus $0.15\text{s}$ pause padding. The final line defaults to $T_{\text{start}} + 4.5\text{s}$ or track end.
   * `words` array is generated synthetically by splitting `text` by whitespace and distributing duration evenly across words with a $0.05\text{s}$ inter-word gap.

2. **Enhanced Syllable ELRC (`[mm:ss.xx] <mm:ss.xx> Word1 <mm:ss.xx> Word2`)**:
   * Direct extraction of per-word start and end boundaries.
   * `precision` flag is promoted to `'word'`.

3. **faster-whisper Output Schema Normalization (`word_timestamps=True`)**:
   ```json
   {
     "start": 14.28,
     "end": 18.90,
     "text": " We found love in a hopeless place",
     "words": [
       { "word": "We", "start": 14.28, "end": 14.52, "probability": 0.98 },
       { "word": "found", "start": 14.56, "end": 14.92, "probability": 0.96 },
       { "word": "love", "start": 14.94, "end": 15.40, "probability": 0.99 },
       { "word": "in", "start": 15.42, "end": 15.60, "probability": 0.97 },
       { "word": "a", "start": 15.62, "end": 15.74, "probability": 0.95 },
       { "word": "hopeless", "start": 15.78, "end": 16.48, "probability": 0.94 },
       { "word": "place", "start": 16.52, "end": 17.10, "probability": 0.98 }
     ]
   }
   ```
   * Punctuation is parsed cleanly; leading whitespaces are trimmed into word delimiters.
   * Overlapping word segments are resolved by clamping $T_{\text{end}}[i] \le T_{\text{start}}[i+1]$.

---

## 2. Motion Graphics Physics & Animation Parameters

Vertical scrolling and line transitions are driven by **Framer Motion spring physics** to emulate physical mass, momentum, and dampening rather than mechanical CSS linear transitions.

### 2.1. Framer Motion Spring Parameters

The active line centering mechanism calculates the physical coordinate offset of the active line relative to the viewport's vertical midpoint ($Y_{\text{center}} = \text{viewportHeight} \times 0.45$).

```typescript
export const LYRIC_SPRING_CONFIG = {
  type: 'spring' as const,
  stiffness: 180,  // Tensile strength: Snappy, responsive vertical leap
  damping: 24,     // Viscous resistance: Eliminates overshoot oscillations
  mass: 0.9,       // Inertia: Feels substantial without feeling sluggish
  restDelta: 0.001,// Sub-pixel termination precision
  restSpeed: 0.001
};
```

### 2.2. Dynamic Line Centering Offset Calculation

Given line DOM elements of variable height $h_i$ (due to multi-line wrapping on mobile screens) and vertical position offsets $y_i$:

$$Y_{\text{target}}[k] = Y_{\text{center}} - \left( y_k + \frac{h_k}{2} \right)$$

Where $k = \text{activeLineIndex}$. The container translates smoothly to $-Y_{\text{target}}[k]$, locking the active line precisely in the focal zone.

---

## 3. Progressive Depth-of-Field (DoF) Optical Blur

To direct the viewer's focus exclusively toward the currently sung phrase, lines fade into progressive background and foreground optical blur as a function of their spatial line distance from the active line index.

### 3.1. Mathematical Distance Metric & Optical Formulations

Let $i$ represent any rendered line index and $k$ represent the current `activeLineIndex`. The discrete line distance $d$ is:

$$d = |i - k|$$

The visual styling parameters are derived as follows:

```
[i = k-2] Blur: 6.0px | Opacity: 0.20 | Scale: 0.90 ── (Distant Background)
[i = k-1] Blur: 3.0px | Opacity: 0.50 | Scale: 0.95 ── (Preceding Line)
[i = k  ] Blur: 0.0px | Opacity: 1.00 | Scale: 1.10* ── ACTIVE FOCAL LINE (Bass Pulsing)
[i = k+1] Blur: 3.0px | Opacity: 0.50 | Scale: 0.95 ── (Upcoming Line)
[i = k+2] Blur: 6.0px | Opacity: 0.20 | Scale: 0.90 ── (Distant Foreground)
```

1. **Gaussian Optical Blur ($\sigma_d$)**:
   $$\text{blur}(d) = d \times 3.0\text{px}$$
   *(Clamped to a maximum blur of $18.0\text{px}$ for $d \ge 6$ to preserve GPU fragment shader bandwidth).*

2. **Perceptual Opacity Falloff ($\alpha_d$)**:
   $$\alpha(d) = \text{clamp}\left(1.0 - (d \times 0.28), \, 0.10, \, 1.0\right)$$

3. **Z-Axis Spatial Scale Falloff ($S_d$)**:
   For inactive lines ($d > 0$):
   $$S(d) = \text{clamp}\left(1.0 - (d \times 0.05), \, 0.80, \, 1.0\right)$$
   For the active line ($d = 0$):
   $$S(0) = 1.08 + (E_{\text{EMA}} \times 0.07)$$
   *(The active line scales dynamically from $1.08\times$ up to $1.15\times$ in direct sync with incoming sub-bass kicks).*

---

## 4. Zero-Reconciliation 60fps CSS Variable Injection Engine

Relying on React's `useState` or context updates for continuous time changes (e.g., advancing syllable progress at $60\text{Hz}$) introduces garbage collection pauses and React fiber scheduler stalls. VibeForge bypasses React's virtual DOM during active playback entirely.

### 4.1. Fast Binary Search Timestamp Locator

During each `requestAnimationFrame` tick, the active line and active word are located via binary search ($O(\log N)$):

```typescript
function findActiveLineIndex(lines: LyricLine[], currentTime: number): number {
  let low = 0;
  let high = lines.length - 1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    const line = lines[mid];

    if (currentTime < line.startTime) {
      high = mid - 1;
    } else if (currentTime > line.endTime) {
      low = mid + 1;
    } else {
      return mid; // Exact match inside [startTime, endTime]
    }
  }
  // Return closest preceding line if during instrumental pause
  return Math.max(0, high);
}
```

### 4.2. Word & Syllable Progress Interpolation

For the active line $k$, the current active word $j$ is queried:

$$\text{progress}_{\text{raw}} = \frac{T_{\text{render}} - T_{\text{start}}[j]}{T_{\text{end}}[j] - T_{\text{start}}[j]}$$

$$\text{progress}_{\text{clamped}} = \text{clamp}(\text{progress}_{\text{raw}}, \, 0.0, \, 1.0)$$

This value is written directly to the active DOM element's style attribute via `element.style.setProperty('--word-progress', ...)`.

### 4.3. Syllable Gradient Wipe Implementation (CSS)

Each word element is rendered with an active CSS background clipping mask. As `--word-progress` advances from `0.0` to `1.0`, an illuminated pure-white fill sweeps smoothly across the word from left to right:

```css
.lyric-word {
  position: relative;
  display: inline-block;
  padding: 0 0.18em;
  font-weight: 800;
  letter-spacing: -0.02em;
  
  /* Fallback color for un-highlighted text */
  color: rgba(255, 255, 255, 0.28);
  
  /* Linear gradient fill wiped via CSS custom property */
  background: linear-gradient(
    90deg,
    #ffffff 0%,
    #ffffff calc(var(--word-progress, 0) * 100%),
    rgba(255, 255, 255, 0.28) calc(var(--word-progress, 0) * 100%),
    rgba(255, 255, 255, 0.28) 100%
  );
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  transition: transform 0.05s ease-out;
}

/* Audio-reactive sub-bass glow bloom on active singing words */
.lyric-word.is-active {
  filter: drop-shadow(
    0 0 calc(var(--bass-energy, 0) * 20px + 4px) 
    rgba(147, 51, 234, calc(var(--bass-energy, 0) * 0.9 + 0.3))
  );
  transform: scale(calc(1.0 + (var(--bass-energy, 0) * 0.06)));
}
```

### 4.4. Audio-Reactive Neon Glow Bloom & Pulse

In addition to text scaling, sub-bass energy ($E_{\text{EMA}}$) is injected into global root variables:
* `--bass-energy`: Bound to background chromatic aberration, active word drop-shadow radius, and ambient edge vignette intensity.
* Under heavy sub-bass hits ($E_{\text{EMA}} > 0.70$), text emits a localized neon bloom (`#a855f7` ultraviolet to `#06b6d4` cyan) that decays organically via the audio DSP engine's asymmetric decay curve.
