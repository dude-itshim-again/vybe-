# 05. API Contracts & Data Schemas Specification

## 1. REST & WebSocket API Contracts

VibeForge communicates across a standardized OpenAPI 3.1 / JSON-RPC contract suite, accompanied by a dedicated bidirectional WebSocket endpoint for streaming asynchronous AI pipeline progress.

### 1.1. Service Endpoint Matrix

| Method | Route Path | Description | Response Model / Status |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/tracks/analyze` | Initiates lyric retrieval, audio feature extraction, and Gemini vibe discovery | `200 OK` (Cache Hit) / `202 Accepted` (Queued) |
| `GET` | `/api/v1/tracks/:id/lyrics` | Returns normalized line- and word-level timecoded lyric AST | `200 OK` (`LyricTrackResponse`) |
| `GET` | `/api/v1/tracks/:id/visuals` | Returns CLIP-ranked cinematic background video loop stream URLs | `200 OK` (`VisualLoopsResponse`) |
| `GET` | `/api/v1/stream/proxy` | Streaming reverse proxy supporting HTTP 206 Partial Content & CORS bypass | `206 Partial Content` (Audio/Video binary stream) |
| `WS` | `/api/v1/tracks/:id/realtime-vibe` | WebSocket channel streaming pipeline stage progress & interim video hits | Dynamic frame events (`PipelineStatusEvent`) |

---

### 1.2. Endpoint Contract Specifications

#### 1.2.1. `POST /api/v1/tracks/analyze`

**Request Headers**:
```http
Content-Type: application/json
Accept: application/json
```

**Request Body Schema**:
```json
{
  "title": "Starboy",
  "artist": "The Weeknd",
  "album": "Starboy",
  "durationSeconds": 230.5,
  "audioUrl": "https://example-cdn.com/audio/starboy.mp3",
  "rawLrc": "[00:15.20] I'm tryna put you in the worst mood, ah...",
  "audioFeatures": {
    "bpm": 186.0,
    "key": "G Major",
    "energy": 0.82
  }
}
```

**Response `202 Accepted` (Async Pipeline Triggered)**:
```json
{
  "trackId": "d3b07384-d113-4a15-b77a-245a16d55209",
  "status": "processing",
  "estimatedCompletionMs": 3500,
  "wsEndpoint": "/api/v1/tracks/d3b07384-d113-4a15-b77a-245a16d55209/realtime-vibe",
  "stages": {
    "lyrics": "fetching_lrclib",
    "vibeDirector": "prompting_gemini",
    "scrapers": "pending",
    "reranker": "pending"
  }
}
```

**Response `200 OK` (Immediate Cache Hit)**:
```json
{
  "trackId": "d3b07384-d113-4a15-b77a-245a16d55209",
  "status": "cached",
  "lyricsReady": true,
  "visualsCount": 5,
  "data": {
    "vibeSummary": "Dark luxury and driving synthwave rhythms under midnight city lights.",
    "colorPalette": {
      "primaryHex": "#0b0c10",
      "secondaryHex": "#1f2833",
      "accentNeonHex": "#ff0055"
    }
  }
}
```

---

#### 1.2.2. `GET /api/v1/tracks/:id/lyrics`

**Response `200 OK`**:
```json
{
  "trackId": "d3b07384-d113-4a15-b77a-245a16d55209",
  "title": "Starboy",
  "artist": "The Weeknd",
  "duration": 230.5,
  "precision": "word",
  "source": "lrclib_synced",
  "offsetMs": 0,
  "lines": [
    {
      "id": "line-001",
      "lineIndex": 0,
      "text": "I'm tryna put you in the worst mood, ah",
      "startTime": 15.20,
      "endTime": 18.45,
      "duration": 3.25,
      "words": [
        { "id": "w-01", "word": "I'm", "startTime": 15.20, "endTime": 15.45, "duration": 0.25 },
        { "id": "w-02", "word": "tryna", "startTime": 15.48, "endTime": 15.80, "duration": 0.32 },
        { "id": "w-03", "word": "put", "startTime": 15.82, "endTime": 16.05, "duration": 0.23 },
        { "id": "w-04", "word": "you", "startTime": 16.08, "endTime": 16.30, "duration": 0.22 },
        { "id": "w-05", "word": "in", "startTime": 16.32, "endTime": 16.48, "duration": 0.16 },
        { "id": "w-06", "word": "the", "startTime": 16.50, "endTime": 16.65, "duration": 0.15 },
        { "id": "w-07", "word": "worst", "startTime": 16.68, "endTime": 17.10, "duration": 0.42 },
        { "id": "w-08", "word": "mood,", "startTime": 17.12, "endTime": 17.70, "duration": 0.58 },
        { "id": "w-09", "word": "ah", "startTime": 17.75, "endTime": 18.45, "duration": 0.70 }
      ]
    }
  ]
}
```

---

#### 1.2.3. `GET /api/v1/tracks/:id/visuals`

**Response `200 OK`**:
```json
{
  "trackId": "d3b07384-d113-4a15-b77a-245a16d55209",
  "vibeProfile": {
    "vibeSummary": "High-velocity neon red reflections on wet asphalt with retro-futuristic cityscapes.",
    "pacing": "fast_kinetic",
    "colorPalette": {
      "primaryHex": "#0b0c10",
      "secondaryHex": "#1f2833",
      "accentNeonHex": "#ff0055"
    }
  },
  "loops": [
    {
      "id": "loop-891",
      "rank": 1,
      "source": "pexels",
      "streamUrl": "https://images.pexels.com/videos/3129671/free-video-3129671.mp4",
      "proxyStreamUrl": "/api/v1/stream/proxy?url=https%3A%2F%2Fimages.pexels.com%2Fvideos%2F3129671%2Ffree-video-3129671.mp4",
      "duration": 18.4,
      "width": 1920,
      "height": 1080,
      "fps": 60,
      "clipScore": 0.842,
      "pacingCompatibility": 0.95
    },
    {
      "id": "loop-412",
      "rank": 2,
      "source": "reddit",
      "streamUrl": "https://v.redd.it/abcdef1234/DASH_1080.mp4",
      "proxyStreamUrl": "/api/v1/stream/proxy?url=https%3A%2F%2Fv.redd.it%2Fabcdef1234%2FDASH_1080.mp4",
      "duration": 12.0,
      "width": 1920,
      "height": 1080,
      "fps": 30,
      "clipScore": 0.789,
      "pacingCompatibility": 0.88
    }
  ]
}
```

---

#### 1.2.4. `WS /api/v1/tracks/:id/realtime-vibe`

Client connects via `new WebSocket('wss://api.vibeforge.live/api/v1/tracks/:id/realtime-vibe')`.

**Message Protocol (Server -> Client)**:
```typescript
export type WebSocketEvent =
  | { type: 'PIPELINE_STAGE_UPDATE'; stage: 'gemini' | 'scrapers' | 'clip'; status: 'started' | 'complete'; details?: string }
  | { type: 'VIBE_PROFILE_READY'; data: VibeProfile }
  | { type: 'VISUAL_CANDIDATE_DISCOVERED'; count: number; source: string }
  | { type: 'VISUAL_LOOPS_FINALIZED'; loops: VisualLoop[] }
  | { type: 'PIPELINE_ERROR'; stage: string; error: string };
```

---

## 2. End-to-End TypeScript Type Definitions

```typescript
// ==============================================================================
// TRACK & AUDIO METADATA
// ==============================================================================

export interface AudioFeatures {
  bpm: number;
  key: string;
  energy: number; // 0.0 - 1.0
  danceability?: number;
  valence?: number;
}

export interface TrackAnalysisRequest {
  title: string;
  artist: string;
  album?: string;
  durationSeconds: number;
  audioUrl?: string;
  rawLrc?: string;
  audioFeatures?: AudioFeatures;
}

export interface TrackAnalysisResponse {
  trackId: string;
  status: 'cached' | 'processing' | 'failed';
  estimatedCompletionMs?: number;
  wsEndpoint?: string;
  lyricsReady: boolean;
  visualsCount: number;
}

// ==============================================================================
// VIBE & AI VISUAL PROFILE
// ==============================================================================

export type VisualPacing = 'slow_atmospheric' | 'medium_groove' | 'fast_kinetic' | 'chaotic_strobe';

export interface ColorPalette {
  primaryHex: string;
  secondaryHex: string;
  accentNeonHex: string;
}

export interface VisualSearchQuery {
  query: string;
  intent: 'abstract_texture' | 'atmospheric_landscape' | 'rhythmic_motion';
}

export interface ClipPrompts {
  positivePrompt: string;
  negativePrompt: string;
}

export interface VibeProfile {
  vibeSummary: string;
  pacing: VisualPacing;
  colorPalette: ColorPalette;
  searchQueries: VisualSearchQuery[];
  clipPrompts: ClipPrompts;
  embedding?: number[]; // 512-dimension vector
}

// ==============================================================================
// VISUAL CANDIDATES & LOOPS
// ==============================================================================

export type VideoSourceProvider = 'pexels' | 'pixabay' | 'reddit' | 'ytdlp';

export interface VisualCandidate {
  source: VideoSourceProvider;
  sourceId: string;
  streamUrl: string;
  duration: number;
  width: number;
  height: number;
  fps: number;
  keyframeUrls?: string[];
}

export interface VisualLoop {
  id: string;
  rank: number;
  source: VideoSourceProvider;
  streamUrl: string;
  proxyStreamUrl: string;
  duration: number;
  width: number;
  height: number;
  fps: number;
  clipScore: number;
  pacingCompatibility: number;
}

export interface VisualLoopsResponse {
  trackId: string;
  vibeProfile: VibeProfile;
  loops: VisualLoop[];
}

// ==============================================================================
// CLIENT PLAYBACK RUNTIME STATE
// ==============================================================================

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  activeLineIndex: number;
  activeWordIndex: number;
  bassEnergy: number; // Smoothed EMA (0.0 to 1.0)
  activePreset: string;
  activeLoopIndex: number;
}
```

---

## 3. Database Schema: Supabase PostgreSQL & pgvector DDL

The database stores track metadata, parsed lyrics, Gemini vibe profiles, and reusable visual video loops. The `pgvector` extension performs cosine similarity matching on 512-dimensional vector embeddings generated by CLIP.

### 3.1. Complete SQL Migration Script

```sql
-- =============================================================================
-- VIBEFORGE SCHEMA INITIALIZATION (PostgreSQL 16 + pgvector)
-- =============================================================================

-- Enable pgvector and UUID extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- -----------------------------------------------------------------------------
-- 1. TRACKS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tracks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    artist VARCHAR(255) NOT NULL,
    album VARCHAR(255),
    duration_seconds NUMERIC(8, 2) NOT NULL,
    audio_url TEXT,
    bpm NUMERIC(6, 2),
    key_signature VARCHAR(32),
    energy_score NUMERIC(3, 2),
    status VARCHAR(32) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_track_identity UNIQUE (title, artist, duration_seconds)
);

CREATE INDEX idx_tracks_lookup ON public.tracks (artist, title);

-- -----------------------------------------------------------------------------
-- 2. LYRICS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lyrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    track_id UUID NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
    precision VARCHAR(32) NOT NULL CHECK (precision IN ('line', 'word', 'syllable')),
    source VARCHAR(32) NOT NULL CHECK (source IN ('lrclib_synced', 'whisper_worker', 'embedded_id3', 'manual_lrc')),
    offset_ms INTEGER DEFAULT 0,
    raw_lrc TEXT,
    ast_json JSONB NOT NULL,
    word_count INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_track_lyrics UNIQUE (track_id)
);

CREATE INDEX idx_lyrics_track_id ON public.lyrics (track_id);

-- -----------------------------------------------------------------------------
-- 3. VIBE PROFILES TABLE (With 512-dim Semantic Vector)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vibe_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    track_id UUID NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
    vibe_summary TEXT NOT NULL,
    pacing VARCHAR(32) NOT NULL,
    color_palette JSONB NOT NULL,
    search_queries JSONB NOT NULL,
    positive_prompt TEXT NOT NULL,
    negative_prompt TEXT NOT NULL,
    vibe_embedding vector(512), -- CLIP text embedding of positive_prompt
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_track_vibe UNIQUE (track_id)
);

-- HNSW Vector Index for Instant Vibe Cache Similarity Matches
CREATE INDEX idx_vibe_profiles_hnsw ON public.vibe_profiles 
USING hnsw (vibe_embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- -----------------------------------------------------------------------------
-- 4. VISUAL LOOPS TABLE (Universal Pool of Aesthetic Video Loops)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.visual_loops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source VARCHAR(32) NOT NULL CHECK (source IN ('pexels', 'pixabay', 'reddit', 'ytdlp')),
    source_id VARCHAR(255) NOT NULL,
    stream_url TEXT NOT NULL,
    duration NUMERIC(6, 2) NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    fps INTEGER DEFAULT 30,
    keyframe_embedding vector(512) NOT NULL, -- Average CLIP keyframe embedding
    mean_luminance NUMERIC(5, 2),
    edge_density NUMERIC(4, 3),
    access_count INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_verified_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_source_video UNIQUE (source, source_id)
);

-- HNSW Vector Index for Visual Loop Reranking & Retrieval
CREATE INDEX idx_visual_loops_hnsw ON public.visual_loops 
USING hnsw (keyframe_embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- -----------------------------------------------------------------------------
-- 5. TRACK-VISUAL ASSOCIATIONS (Junction Table)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.track_visual_associations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    track_id UUID NOT NULL REFERENCES public.tracks(id) ON DELETE CASCADE,
    visual_loop_id UUID NOT NULL REFERENCES public.visual_loops(id) ON DELETE CASCADE,
    rank INTEGER NOT NULL,
    clip_score NUMERIC(5, 4) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_track_loop_rank UNIQUE (track_id, rank)
);

CREATE INDEX idx_track_visuals ON public.track_visual_associations (track_id, rank);
```

---

## 4. Vector DB Alternative: Pinecone Configuration Schema

For deployments using Pinecone serverless vector storage instead of pgvector:

* **Index Name**: `vibeforge-aesthetic-loops`
* **Dimension**: `512`
* **Metric**: `cosine`
* **Cloud / Region**: `aws` / `us-east-1`
* **Metadata Schema**:
  ```json
  {
    "source": "pexels",
    "sourceId": "3129671",
    "streamUrl": "https://images.pexels.com/videos/3129671/free-video-3129671.mp4",
    "duration": 18.4,
    "width": 1920,
    "height": 1080,
    "pacing": "fast_kinetic",
    "meanLuminance": 48.2
  }
  ```

---

## 5. Cache Eviction & Stream Health Verification Strategy

External video CDN links (especially Reddit and yt-dlp direct media URLs) may expire or rotate after $6\text{ to }24\text{ hours}$.

1. **Lazy Head Validation**:
   When reading a cached video stream URL, the API issues a rapid `HEAD` request with a $500\text{ms}$ timeout. If the server responds with `403 Forbidden` or `404 Not Found`:
   * The cached URL is marked invalid.
   * The scraper pipeline re-resolves the fresh direct stream URL in the background.
2. **LRU Cache Maintenance**:
   A daily cron job prunes entries from `visual_loops` where `last_verified_at < NOW() - INTERVAL '30 days'` and `access_count < 3`, conserving vector storage and disk capacity.
