# 06. Implementation Roadmap & Verification Framework

## 1. Roadmap Architecture & Phasing Strategy

The VibeForge engineering lifecycle is divided into **four deterministic, sequentially testable phases**. Each phase establishes a stable layer upon which subsequent real-time graphics and multimodal AI features rely. No phase commences until its associated verification checklist has been validated.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│             PHASE 1: CORE DSP & AUDIO PLAYBACK INFRASTRUCTURE               │
│  • Web Audio API Graph (7-Stage Filter Chain, Limiter, FFT Analyser)        │
│  • Reverse Stream Proxy (CORS bypass & 206 Partial Content support)         │
│  • Asymmetric EMA Sub-Bass Energy Extractor                                 │
│  • 5 Factory EQ Presets with smooth parameter ramping                       │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                  PHASE 2: 60FPS KINETIC LYRICS ENGINE                       │
│  • Unified AST Normalizer (LRC, ELRC, faster-whisper JSON schemas)          │
│  • Zero-Reconciliation rAF CSS Variable Injection Engine                    │
│  • Framer Motion Spring Dynamics (Line progression & auto-centering)        │
│  • Progressive Depth-of-Field Blur (d * 3px) & Syllable Gradient Wipes      │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│          PHASE 3: GEMINI + CLIP MULTIMODAL VIDEO DISCOVERY BACKEND          │
│  • Gemini 1.5 Flash Structured Prompting (Visual Queries & Pos/Neg Prompts) │
│  • 2.5-Second Parallel Scraper Pool (Pexels, Pixabay, Reddit, yt-dlp)       │
│  • Hugging Face CLIP Reranker (Keyframe extraction & Cosine Scoring)        │
│  • Supabase & pgvector HNSW Vector Cache Persistence                        │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│             PHASE 4: AUDIO-REACTIVE INTEGRATION & CONCERT POLISH            │
│  • Dual-Video Crossfade Canvas Player (Raised cosine transition curve)      │
│  • Radial Vignette Contrast Scrim (100% white text legibility)              │
│  • Sub-Bass Reactive PlaybackRate Modulation (0.85x - 1.25x)                │
│  • 60fps/120fps Hardware Performance Profiling & Production Deployment      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Phase 1: Core DSP & Audio Player

### 2.1. Deliverables
1. **Audio Context & Graph Builder**:
   * Implement `AudioDspEngine` class managing `MediaElementAudioSourceNode`, `Sub-Bass Shelf (60Hz)`, `Punch Peaking (120Hz)`, 5-band parametric filters, `DynamicsCompressorNode`, and `AnalyserNode (FFT 512)`.
   * Implement smooth audio parameter ramps via `linearRampToValueAtTime()` over $50\text{ms}$ windows to prevent audible pops.
2. **Reverse Stream Proxy Service**:
   * Build Node.js / FastAPI HTTP 206 Partial Content reverse proxy.
   * Strip restrictive origin headers and inject `Access-Control-Allow-Origin: *` to prevent Web Audio API canvas/analyzer tainting.
3. **EMA Sub-Bass Normalizer**:
   * Implement asymmetric attack/decay math ($\alpha_{\text{attack}} = 0.65, \alpha_{\text{decay}} = 0.15$) on FFT bins 0 to 4.
4. **Preset Selector UI**:
   * Interactive UI toggle for Flat, Sub-Bass Rattler, Late Night Lo-Fi, Vocal Clarity, and V-Shape Arena.

### 2.2. Phase 1 Verification Checklist
- [ ] **Graph Stability**: Playing 10 consecutive audio tracks across different bitrates (128kbps MP3 to 320kbps AAC) runs without memory leaks or graph disconnection.
- [ ] **Limiter Efficacy**: Boosting all 7 EQ bands to $+12\text{dB}$ simultaneously triggers the `DynamicsCompressorNode` without digital hard-clipping or DAC distortion.
- [ ] **CORS Verification**: Audio loaded through the reverse proxy streams with HTTP 206 status codes and provides non-zero byte frequency data in `AnalyserNode.getByteFrequencyData()`.
- [ ] **EMA Metric Output**: Sub-bass energy output evaluates strictly between `0.0` and `1.0`, reacting within $<16\text{ms}$ to kick transients and decaying smoothly during pauses.

---

## 3. Phase 2: 60fps Kinetic Lyrics Engine

### 2.1. Deliverables
1. **Lyric Parser & AST Normalizer**:
   * Implement ingestion engine supporting standard `.lrc`, enhanced `.elrc`, and `faster-whisper` word-level JSON.
   * Ingest metadata from the public LRCLIB API (`GET https://lrclib.net/api/get?artist_name=...&track_name=...`).
2. **High-Frequency rAF Render Loop**:
   * Implement $O(\log N)$ binary search to locate active lines and active words per animation frame tick.
   * Direct DOM mutation injecting `--word-progress`, `--bass-energy`, and active line translation offsets.
3. **Motion Physics & Progressive Blur**:
   * Configure Framer Motion spring physics ($k=180, c=24, m=0.9$).
   * Implement distance-based Depth-of-Field blur: $\text{blur}(|i - k| \times 3\text{px})$ and opacity falloff.
4. **Syllable Gradient Wipe CSS**:
   * Render dual-tone text clipping mask with illuminated pure-white sweeps.

### 2.2. Phase 2 Verification Checklist
- [ ] **Zero React Re-renders**: Profiling active playback via React DevTools confirms zero component re-renders while `--word-progress` advances continuously.
- [ ] **Sub-Frame Sync**: Active syllable wipe leads or lags audio vocals by less than $\pm 25\text{ms}$.
- [ ] **Framerate Benchmark**: Google Chrome DevTools Performance monitor confirms sustained $60.0\text{fps}$ (or $120.0\text{fps}$ on high-refresh displays) without layout shifts or dropped frames.
- [ ] **Long Lyric Stess Test**: Loading a 9-minute track with 150+ lines maintains steady $60\text{fps}$ scroll dynamics without DOM accumulation or memory growth.

---

## 4. Phase 3: Gemini + CLIP Video Discovery Backend

### 2.1. Deliverables
1. **Gemini 1.5 Flash Vibe Director**:
   * Implement Google GenAI SDK integration with enforced JSON Schema outputs.
   * Validate prompt synthesis generating 3 distinct search queries, aesthetic positive prompt, and negative prompt.
2. **Parallel Scraper Engine**:
   * Fan-out scrapers concurrently across Pexels Video API, Pixabay API, Reddit JSON, and `yt-dlp`.
   * Enforce a hard timeout budget of $2.5\text{s}$ per scraper using `Promise.allSettled()` or Python `asyncio.wait_for`.
3. **Multimodal CLIP Reranking Worker**:
   * Deploy `Xenova/clip-vit-base-patch32` inference pipeline.
   * Extract 3 temporal keyframes ($15\%, 50\%, 85\%$) from candidate streams.
   * Compute scores via $S = w_1 \cdot \text{Cos}(\mathbf{v}, \mathbf{t}_{\text{pos}}) - w_2 \cdot \text{Cos}(\mathbf{v}, \mathbf{t}_{\text{neg}}) - P_{\text{lum}} - P_{\text{text}}$.
4. **Supabase & pgvector Persistence**:
   * Execute migration scripts creating `tracks`, `lyrics`, `vibe_profiles`, and `visual_loops`.
   * Implement HNSW cosine similarity search to retrieve and cache visual loops across identical or similar vibes.

### 2.2. Phase 3 Verification Checklist
- [ ] **SLA Compliance**: Complete backend discovery round (from track ingestion through CLIP reranking) completes in $< 3.5\text{s}$ total elapsed time.
- [ ] **Schema Conformance**: Gemini structured outputs validate $100\%$ against the JSON schema without parsing errors across 25 diverse test tracks (metal, ambient, rap, jazz).
- [ ] **Negative Prompt Filtering**: Videos with prominent white backgrounds, burned-in subtitles, or talking heads receive scores $< 0.35$ and are eliminated from the top 5 selection.
- [ ] **pgvector HNSW Performance**: Vector query execution against a database of 10,000 cached loop embeddings returns nearest neighbors in $< 15\text{ms}$.

---

## 5. Phase 4: Audio-Reactive Integration & Polish

### 2.1. Deliverables
1. **Dual-Video Crossfade Player**:
   * Implement dual `<video>` slot swapping (`Slot A` / `Slot B`) with raised cosine crossfade transitions.
   * Preload incoming loop at $T_{\text{remaining}} \le 4.0\text{s}$.
2. **Radial Contrast Scrim & Readability Matrix**:
   * Layer multi-stop radial gradient and linear scrim over background video elements.
   * Guarantee WCAG AAA contrast ratio ($> 7:1$) for pure-white lyrics over light or dark video content.
3. **Audio-Reactive Modulation**:
   * Modulate video `playbackRate` ($0.85\times - 1.25\times$) based on $E_{\text{EMA}}$.
   * Inject neon glow bloom and particle bursts on heavy bass drops ($E_{\text{EMA}} > 0.70$).
4. **End-to-End Responsive Shell**:
   * Responsive layout for Desktop, Tablet, and Mobile viewport sizes.
   * Fullscreen concert mode with keyboard shortcuts (Space to toggle play, M to mute, F for fullscreen, 1-5 for EQ presets).

### 2.2. Phase 4 Verification Checklist
- [ ] **Seamless Crossfading**: Crossfade between two disparate 1080p video streams executes with zero frame stutter, buffering pause, or black flashes.
- [ ] **Lyric Contrast Readability**: Contrast testing across 100 randomly sampled high-luminance video frames verifies $100\%$ legibility of lyric text.
- [ ] **PlaybackRate Smoothness**: Modulation of video playback speed during bass transients occurs smoothly without audible audio artifacts or video decoding crashes.
- [ ] **Production Lighthouse Score**: Visualizer page achieves $> 95$ Performance score in Google Lighthouse audit with all DSP and video elements active.

---

## 6. End-to-End Automated Test Commands

Execute the following test suites during each respective phase:

```bash
# ==============================================================================
# PHASE 1: AUDIO DSP & STREAM PROXY
# ==============================================================================
# Run Unit & Frequency Bin Math Tests
npm run test:dsp

# Run Stream Proxy Range Request & CORS Integration Tests
npm run test:proxy

# ==============================================================================
# PHASE 2: KINETIC LYRICS & ANIMATION PHYSICS
# ==============================================================================
# Test Lyric AST Parsing & Monotonic Normalization
npm run test:lyrics:parser

# Run 60fps rAF Loop Benchmarks (Headless Playwright Profiler)
npm run test:e2e:fps-benchmark

# ==============================================================================
# PHASE 3: MULTIMODAL AI & RERANKER
# ==============================================================================
# Test Gemini 1.5 Flash JSON Output Schema Validation
npm run test:ai:gemini-schema

# Test Parallel Scraper SLA (< 2.5s) & Fallbacks
npm run test:scrapers:sla

# Test CLIP Cosine Scoring & Watermark Penalties
npm run test:ai:clip-reranker

# ==============================================================================
# PHASE 4: FULL SYSTEM INTEGRATION
# ==============================================================================
# End-to-End Cypress / Playwright Smoke Test Suite
npm run test:e2e:concert-experience
```
