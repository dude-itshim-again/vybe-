# Vybe ⚡
### Autonomous Audio-Reactive Visualizer & Kinetic Typography Engine

```
╦  ╦┬ ┬┌┐ ┌─┐
╚╗╔╝└┬┘├┴┐├┤ 
 ╚╝  ┴ └─┘└─┘
60FPS DSP EQUALIZER • KINETIC LYRICS • AI VIDEO DISCOVERY
```

[![Architecture Specs](https://img.shields.io/badge/Specs-Production--Grade-blueviolet.svg)](./docs/01_SYSTEM_ARCHITECTURE.md)
[![Web Audio DSP](https://img.shields.io/badge/Web_Audio_API-7--Band_EQ-emerald.svg)](./docs/02_AUDIO_DSP_ENGINE.md)
[![Motion Graphics](https://img.shields.io/badge/Framer_Motion-60fps_Kinetic-cyan.svg)](./docs/03_KINETIC_LYRICS_SPEC.md)
[![Multimodal AI](https://img.shields.io/badge/Gemini_1.5_Flash-CLIP_Reranker-amber.svg)](./docs/04_AI_VIDEO_DISCOVERY.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-gray.svg)](#)

---

## 1. Executive Summary & Core Value Proposition

**Vybe** is an enterprise-grade, browser-based audio-visual performance platform that transforms any musical input into a cinematic, 60fps synchronized concert visualizer. Traditional visualizers rely on static loops, generic spectrum bars, or pre-rendered MP4 lyric videos. Vybe replaces static media with a real-time, triple-engine pipeline:

1. **Native Client-Side Web Audio DSP**: Low-latency 7-band parametric and shelf equalizer with a brickwall anti-clip limiter and Exponential Moving Average (EMA) sub-bass energy extraction.
2. **Kinetic Typography Engine**: 60fps frame-synced lyrics with syllabic gradient wipes, progressive Depth-of-Field (DoF) optical blur, and spring-physics line transitions executed completely outside React's reconciliation cycle via CSS Custom Properties.
3. **Autonomous "Whole-Internet" Multimodal Video Discovery**: Google Gemini 1.5 Flash vibe direction, multi-threaded parallel scrapers (Pexels, Pixabay, Reddit JSON, yt-dlp direct streams), and a Hugging Face CLIP visual reranker that filters out watermarks, low-contrast frames, and talking heads while matching aesthetic prompts to song semantics.

The result is a completely autonomous, zero-latency visual experience tailored to the sonic characteristics, lyrical themes, and emotional cadence of any track in real time.

---

## 2. High-Level Feature Matrix

| Subsystem | Architectural Role | Key Specifications |
| :--- | :--- | :--- |
| **Real-Time DSP Equalizer** | Native Web Audio API Audio Processing Graph | • Sub-Bass LowShelf (60Hz)<br>• Punch Peaking (120Hz)<br>• 5-Band Parametric (125Hz, 500Hz, 1.5kHz, 4kHz, 10kHz)<br>• DynamicsCompressorNode Anti-Clip Limiter<br>• FFT 512 AnalyserNode with 256 bins<br>• Asymmetric EMA smoothing ($\alpha_{attack}=0.6, \alpha_{decay}=0.15$) |
| **Kinetic Typography** | Spring-Physics Motion Graphics & Syllabic Wipes | • Sub-millisecond LRC / ELRC / Whisper AST<br>• Framer Motion spring physics ($k=180, c=24, m=1.0$)<br>• Distance-based progressive DoF blur ($d \times 3\text{px}$)<br>• Zero-reconciliation CSS injection (`--word-progress`, `--bass-energy`)<br>• Sub-bass reactive text scaling & glow bloom |
| **Multimodal Video Engine** | Autonomous Ingestion, Vibe Analysis & Reranking | • Gemini 1.5 Flash structured vibe extraction (JSON Schema)<br>• 2.5s parallel scraper fan-out (Pexels, Reddit, yt-dlp streams)<br>• Xenova CLIP (`clip-vit-base-patch32`) dual-prompt scoring<br>• Negative prompt penalty (watermarks, text, talking heads)<br>• Supabase (PostgreSQL) + pgvector 512-dim cosine caching |
| **Dual-Video Crossfader** | Smooth Cinematic Background Playback | • Active/Buffering dual HTML5 `<video>` pipeline<br>• 2.0s cosine crossfade transition curve<br>• Radial vignette + linear scrim contrast mask ($100\%$ white lyric legibility)<br>• Audio-reactive `playbackRate` modulation ($0.85\times - 1.25\times$) |

---

## 3. Architecture & Documentation Suite

Every module in VibeForge is strictly specified across our dedicated architectural documentation suite. Refer to the table below for deep implementation blueprints:

```text
docs/
├── 01_SYSTEM_ARCHITECTURE.md   # Complete system topology, render loops, CORS, state sync
├── 02_AUDIO_DSP_ENGINE.md       # Web Audio API graph, filter math, EMA formulas, 5 presets
├── 03_KINETIC_LYRICS_SPEC.md    # LRCLIB/Whisper AST, spring physics, DoF blur, CSS rAF engine
├── 04_AI_VIDEO_DISCOVERY.md     # Gemini 1.5 Flash prompt, scrapers, CLIP scoring, crossfader
├── 05_API_AND_DATA_SCHEMAS.md   # REST/WebSocket endpoints, TypeScript types, Supabase DDL
└── 06_IMPLEMENTATION_ROADMAP.md # 4-phase sequential execution plan & test checklists
```

* **[01_SYSTEM_ARCHITECTURE.md](./docs/01_SYSTEM_ARCHITECTURE.md)**: System topology, client-side 60fps render loop, backend microservice architecture, HTML5 `<audio>` vs `AudioContext` clock sync, and CORS stream proxying.
* **[02_AUDIO_DSP_ENGINE.md](./docs/02_AUDIO_DSP_ENGINE.md)**: Web Audio graph node specifications, frequency bin allocation, mathematical sub-bass normalization, and exact numerical parameters for all 5 factory EQ presets.
* **[03_KINETIC_LYRICS_SPEC.md](./docs/03_KINETIC_LYRICS_SPEC.md)**: Unified lyric AST, word-level linear gradient wipes, spring physics parameters, progressive depth-of-field equations, and direct DOM injection mechanisms.
* **[04_AI_VIDEO_DISCOVERY.md](./docs/04_AI_VIDEO_DISCOVERY.md)**: 3-stage visual pipeline: Gemini 1.5 Flash vibe prompts, concurrent multi-source scraper aggregation with 2.5s SLA, CLIP keyframe reranking formula, and dual-video canvas crossfader.
* **[05_API_AND_DATA_SCHEMAS.md](./docs/05_API_AND_DATA_SCHEMAS.md)**: Formal OpenAPI/JSON-RPC/WebSocket contracts, end-to-end TypeScript interfaces, and PostgreSQL/pgvector relational database schemas.
* **[06_IMPLEMENTATION_ROADMAP.md](./docs/06_IMPLEMENTATION_ROADMAP.md)**: Step-by-step 4-phase build guide with milestone definitions, automated verification test suites, and completion criteria.

---

## 4. Locked Tech Stack

```text
┌────────────────────────────────────────────────────────────────────────┐
│                          CLIENT APPLICATION                            │
│  React 18/19 (Vite + TypeScript)  │  Tailwind CSS 3.4+ / Vanilla CSS   │
│  Framer Motion 11 (Springs)       │  Web Audio API (Native DSP Graph)  │
│  HTML5 Canvas & Video API         │  CSS Custom Properties (60fps rAF) │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ HTTP / WebSocket / Stream Proxy
┌────────────────────────────────────────────────────────────────────────┐
│                        BACKEND ORCHESTRATION                           │
│  Node.js (NestJS / Express) OR Python (FastAPI 0.110+)                 │
│  Redis 7 (Job Queues & Stream Cache)                                   │
└────────────────────────────────────────────────────────────────────────┘
             │                                        │
             ▼                                        ▼
┌──────────────────────────┐             ┌───────────────────────────────┐
│     LYRICS PIPELINE      │             │     MULTIMODAL AI PIPELINE    │
│  LRCLIB API (Primary)    │             │  Google Gemini 1.5 Flash      │
│  faster-whisper (Worker) │             │  Hugging Face Transformers    │
└──────────────────────────┘             │  (Xenova/clip-vit-base-patch32)│
                                         │  Multi-Scrapers (Pexels,      │
                                         │  Pixabay, Reddit, yt-dlp)     │
                                         └───────────────────────────────┘
                                                      │
                                                      ▼
                                         ┌───────────────────────────────┐
                                         │     DATA & VECTOR CACHE       │
                                         │  Supabase (PostgreSQL 16)     │
                                         │  pgvector (512-dim Cosine)    │
                                         └───────────────────────────────┘
```

---

## 5. Local Development Prerequisites

Before initializing the workspace components:

1. **Node.js**: `v20.12.0 LTS` or higher
2. **Package Manager**: `pnpm` (v9.0+) or `npm` (v10.0+)
3. **Python Environment**: Python `3.11+` with `poetry` or `venv` (required for `faster-whisper` and backend workers)
4. **Media Binaries**:
   * `ffmpeg` (version 6.0+) accessible on system `$PATH`
   * `yt-dlp` (latest release) accessible on system `$PATH`
5. **Database**: Supabase local CLI (`supabase start`) or managed PostgreSQL 16 instance with the `pgvector` extension enabled.

---

## 6. Environment Variable Specification (`.env.example`)

Create a root `.env` or distinct service-level environment files following this deterministic specification:

```ini
# ==============================================================================
# VIBEFORGE CORE SYSTEM CONFIGURATION
# ==============================================================================
NODE_ENV=development
PORT=4000
VITE_APP_URL=http://localhost:5173
API_BASE_URL=http://localhost:4000/api/v1

# ==============================================================================
# GOOGLE AI (VIBE DIRECTOR)
# ==============================================================================
# Google Gemini 1.5 Flash API Key for Structured Vibe & Query Generation
GEMINI_API_KEY=AIzaSyD-YourGeminiApiKeyHere123456789
GEMINI_MODEL=gemini-1.5-flash

# ==============================================================================
# VECTOR DATABASE & PERSISTENCE (SUPABASE / POSTGRESQL)
# ==============================================================================
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
DATABASE_URL=postgresql://postgres:postgrespassword@localhost:54322/postgres

# (Optional Alternative) Pinecone Vector Storage
PINECONE_API_KEY=
PINECONE_ENVIRONMENT=us-east-1
PINECONE_INDEX_NAME=vibeforge-aesthetic-loops

# ==============================================================================
# MULTIMODAL VIDEO SCRAPING APIS
# ==============================================================================
# Pexels API (Free Tier: 200 requests/hr, 20,000 requests/month)
PEXELS_API_KEY=your_pexels_api_key_563492ad619fa00001000001

# Pixabay API (Free Tier: 5,000 requests/hr)
PIXABAY_API_KEY=your_pixabay_api_key_12345678-abcdef0123456789

# Reddit Scraper Configuration (Custom User-Agent to avoid 429 throttling)
REDDIT_USER_AGENT=web:com.vibeforge.visualizer:v1.0.0 (by /u/vibeforge_app)

# yt-dlp Video Extraction Settings
YTDLP_MAX_HEIGHT=1080
YTDLP_FORMAT=bestvideo[ext=mp4][height<=1080]+bestaudio[ext=m4a]/bestvideo[ext=mp4][height<=1080]/best[ext=mp4]
YTDLP_TIMEOUT_SECONDS=4

# ==============================================================================
# LYRICS EXTRACTION SERVICES
# ==============================================================================
# LRCLIB API Base URL (Public instance or self-hosted)
LRCLIB_API_BASE_URL=https://lrclib.net/api

# faster-whisper Fallback Worker Configuration
WHISPER_MODEL_SIZE=base.en
WHISPER_DEVICE=cuda
WHISPER_COMPUTE_TYPE=float16

# ==============================================================================
# CLIP EMBEDDINGS & RERANKER
# ==============================================================================
# Local Xenova/Transformers CLIP model cache
TRANSFORMERS_CACHE_DIR=./cache/models
CLIP_MODEL_NAME=Xenova/clip-vit-base-patch32
CLIP_DEVICE=cpu

# ==============================================================================
# AUDIO DSP & STREAM PROXY
# ==============================================================================
STREAM_PROXY_PORT=4001
STREAM_PROXY_CACHE_TTL_HOURS=24
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

---

## 7. Architectural Governance & Contribution Contract

All subsequent code generation in this repository **must** strictly conform to the schemas and mathematical contracts outlined in `/docs`. Any modification to the Web Audio node graph, the Lyric AST, or the CLIP scoring weights must first be reviewed and committed as a pull request to the respective architectural document.
