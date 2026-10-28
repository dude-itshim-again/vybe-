import React, { useState, useMemo } from 'react';
import {
  Play,
  Pause,
  Heart,
  Plus,
  ArrowRight,
  Loader2,
  Volume2,
} from 'lucide-react';
import { TrackMetadata } from '../../providers/types';
import { userLibrary } from '../../services/userLibraryService';
import { fetchCatalogSearch, resolveStreamUrl } from '../../services/streamResolver';

interface EditorialHomeViewProps {
  onPlayTrack: (track: TrackMetadata) => void;
  onPlayBatch: (tracks: TrackMetadata[], title?: string) => void;
  onPlayBlendWithAutoMix?: (tracks: TrackMetadata[], title?: string) => void;
  onAddToQueue: (track: TrackMetadata) => void;
  onOpenAddToPlaylist: (track: TrackMetadata, anchorRect?: DOMRect) => void;
  onToggleLike?: (track: TrackMetadata, isLiked: boolean) => void;
  currentTrack: TrackMetadata;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onNavigateTab: (tab: 'home' | 'search' | 'radio' | 'queue' | 'playlist' | 'library') => void;
  onOpenLyrics: () => void;
  recentlyPlayed?: TrackMetadata[];
}

interface HeroSlide {
  id: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  meta: string;
  visualUrl: string;
  query: string;
}

// Curated Hero Carousel Slides matching the editorial specifications
const HERO_SLIDES: HeroSlide[] = [
  {
    id: 'hero-0',
    eyebrow: 'THE ART OF SLOWING DOWN',
    title: 'Somewhere, out of time.',
    subtitle: 'A softer pace. A deeper listen. Drift through ambient textures, warm electronics, and everything in between.',
    meta: '32 tracks · 2 hr 18 min',
    visualUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
    query: 'Tycho Bonobo Ambient Chill',
  },
  {
    id: 'hero-1',
    eyebrow: 'AFTER HOURS FREQUENCY',
    title: 'Neon silhouettes.',
    subtitle: 'Minimal synthwave, nocturnal reverberations, and 80s analog pulse under midnight city lights.',
    meta: '28 tracks · 1 hr 54 min',
    visualUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1200&q=80',
    query: 'The Weeknd After Hours Synthwave',
  },
  {
    id: 'hero-2',
    eyebrow: 'ANALOG WARMTH',
    title: 'Velvet & vinyl.',
    subtitle: 'Dusted tape saturation, organic neo-soul grooves, and breezy vintage guitar riffs.',
    meta: '35 tracks · 2 hr 10 min',
    visualUrl: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=1200&q=80',
    query: 'FKJ Masego Tom Misch Khruangbin',
  },
];

// 5 "Find your frequency" cards matching the exact specified queries
const FREQUENCY_CARDS = [
  {
    id: 'freq-electronic',
    genre: 'ELECTRONIC',
    title: 'Blue reverie',
    artists: 'Floating Points, Bonobo, Kiasmos',
    imageUrl: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=500&q=80',
    query: 'Floating Points Bonobo Kiasmos',
  },
  {
    id: 'freq-indie',
    genre: 'INDIE & ALTERNATIVE',
    title: 'Soft focus',
    artists: 'Men I Trust, Crumb, BADBADNOTGOOD',
    imageUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=500&q=80',
    query: 'Men I Trust Crumb BADBADNOTGOOD',
  },
  {
    id: 'freq-leftfield',
    genre: 'LEFTFIELD',
    title: 'Future forms',
    artists: 'Jon Hopkins, Rival Consoles, Bicep',
    imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=500&q=80',
    query: 'Jon Hopkins Bicep Four Tet',
  },
  {
    id: 'freq-jazz',
    genre: 'JAZZ & SOUL',
    title: 'The listening room',
    artists: 'Bill Evans, Yussef Dayes, Alfa Mist',
    imageUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=500&q=80',
    query: 'Bill Evans Alfa Mist Yussef Dayes',
  },
  {
    id: 'freq-soulful',
    genre: 'SOULFUL SELECTS',
    title: 'Golden hour',
    artists: 'Khruangbin, SAULT, Jordan Rakei',
    imageUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=500&q=80',
    query: 'Khruangbin Jordan Rakei SAULT',
  },
];

// Baseline curated rotation tracks
const DEFAULT_ROTATION_TRACKS: TrackMetadata[] = [
  {
    id: 'curated-a-walk',
    title: 'A Walk',
    artist: 'Tycho',
    album: 'Dive',
    duration: 316,
    artworkUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=300&q=80',
    searchQuery: 'A Walk Tycho',
    sourceType: 'stream',
  },
  {
    id: 'curated-kerala',
    title: 'Kerala',
    artist: 'Bonobo',
    album: 'Migration',
    duration: 237,
    artworkUrl: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=300&q=80',
    searchQuery: 'Kerala Bonobo',
    sourceType: 'stream',
  },
  {
    id: 'curated-tadow',
    title: 'Tadow',
    artist: 'Masego, FKJ',
    album: 'Lady Lady',
    duration: 302,
    artworkUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=300&q=80',
    searchQuery: 'Tadow Masego FKJ',
    sourceType: 'stream',
  },
];

export const EditorialHomeView: React.FC<EditorialHomeViewProps> = ({
  onPlayTrack,
  onPlayBatch,
  onPlayBlendWithAutoMix,
  onAddToQueue,
  onOpenAddToPlaylist,
  onToggleLike,
  currentTrack,
  isPlaying,
  onTogglePlay,
  onNavigateTab,
  recentlyPlayed = [],
}) => {
  const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(0);
  const activeSlide = HERO_SLIDES[currentSlideIndex];

  // Loading states
  const [isHeroLoading, setIsHeroLoading] = useState<boolean>(false);
  const [activeHeroQuery, setActiveHeroQuery] = useState<string | null>(null);

  const [loadingFrequencyId, setLoadingFrequencyId] = useState<string | null>(null);
  const [activeFrequencyId, setActiveFrequencyId] = useState<string | null>(null);

  const [loadingRowId, setLoadingRowId] = useState<string | null>(null);
  const [isBlendLoading, setIsBlendLoading] = useState<boolean>(false);

  // Dynamically prepend user's recently played tracks to the Rotation list
  const displayRotation = useMemo(() => {
    const list: TrackMetadata[] = [];
    const seen = new Set<string>();

    if (recentlyPlayed && recentlyPlayed.length > 0) {
      for (const t of recentlyPlayed) {
        if (t && t.title && !seen.has(t.title.toLowerCase())) {
          seen.add(t.title.toLowerCase());
          list.push(t);
        }
      }
    }

    for (const t of DEFAULT_ROTATION_TRACKS) {
      if (!seen.has(t.title.toLowerCase())) {
        seen.add(t.title.toLowerCase());
        list.push(t);
      }
    }

    return list.slice(0, 10);
  }, [recentlyPlayed]);

  // Helper to format track durations
  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // 1. HERO BANNER PLAY HANDLER
  const handlePlayHero = async () => {
    if (activeHeroQuery === activeSlide.query && isPlaying) {
      onTogglePlay();
      return;
    }

    setIsHeroLoading(true);
    try {
      const results = await fetchCatalogSearch(activeSlide.query, 20);
      if (results && results.length > 0) {
        setActiveHeroQuery(activeSlide.query);
        onPlayBatch(results, activeSlide.title);
      }
    } catch (err) {
      console.warn('[EditorialHomeView] Hero search stream error:', err);
    } finally {
      setIsHeroLoading(false);
    }
  };

  // 2. FIND YOUR FREQUENCY PLAY HANDLER
  const handlePlayFrequencyCard = async (card: typeof FREQUENCY_CARDS[0]) => {
    if (activeFrequencyId === card.id && isPlaying) {
      onTogglePlay();
      return;
    }

    setLoadingFrequencyId(card.id);
    try {
      const results = await fetchCatalogSearch(card.query, 20);
      if (results && results.length > 0) {
        setActiveFrequencyId(card.id);
        onPlayBatch(results, card.title);
      }
    } catch (err) {
      console.warn('[EditorialHomeView] Frequency mix search error:', err);
    } finally {
      setLoadingFrequencyId(null);
    }
  };

  // 3. IN YOUR ROTATION ROW PLAY HANDLER
  const handlePlayRotationRow = async (track: TrackMetadata) => {
    const isCurrent =
      (currentTrack?.id && currentTrack.id === track.id) ||
      (currentTrack?.title && currentTrack.title.toLowerCase() === track.title.toLowerCase());

    if (isCurrent) {
      onTogglePlay();
      return;
    }

    // If it already has a direct streamUrl, play immediately!
    if (track.streamUrl && !track.streamUrl.startsWith('blob:') && track.sourceType === 'stream') {
      onPlayTrack(track);
      return;
    }

    // Resolve real 320kbps song via catalog search
    const trackKey = track.id || track.title;
    setLoadingRowId(trackKey);
    try {
      const q = track.searchQuery || `${track.title} ${track.artist}`;
      const results = await fetchCatalogSearch(q, 1);
      if (results && results.length > 0) {
        onPlayTrack({
          ...track,
          ...results[0],
          streamUrl: resolveStreamUrl(results[0].streamUrl),
        });
      } else {
        onPlayTrack(track);
      }
    } catch (err) {
      console.warn('[EditorialHomeView] Failed to resolve rotation song:', err);
      onPlayTrack(track);
    } finally {
      setLoadingRowId(null);
    }
  };

  // 4. MADE FOR YOUR MONDAY (DAILY BLEND) HANDLER
  const handlePlayDailyBlend = async () => {
    setIsBlendLoading(true);
    try {
      const liked = userLibrary.getLikedTracks();
      const userArtists = Array.from(
        new Set([
          ...(recentlyPlayed || []).map((t) => t.artist),
          ...liked.map((t) => t.artist),
        ].filter(Boolean))
      ).slice(0, 4);

      const blendQuery =
        userArtists.length > 0
          ? userArtists.join(' ')
          : 'Tycho Maribou State Rüfüs Du Sol';

      const results = await fetchCatalogSearch(blendQuery, 20);
      if (results && results.length > 0) {
        if (onPlayBlendWithAutoMix) {
          onPlayBlendWithAutoMix(results, 'Familiar, but new.');
        } else {
          onPlayBatch(results, 'Familiar, but new.');
        }
      }
    } catch (err) {
      console.warn('[EditorialHomeView] Daily blend search error:', err);
    } finally {
      setIsBlendLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[1480px] mx-auto flex flex-col gap-9 pb-28 pt-2 select-none">
      {/* ─────────────────────────────────────────────────────────────────────────
          1. EDITORIAL SECTION HEADER (MATCHING "form." SCREENSHOT)
          ───────────────────────────────────────────────────────────────────────── */}
      <div className="flex items-baseline justify-between pt-1">
        <h1 className="text-3xl sm:text-[34px] font-medium tracking-tight text-white leading-tight font-sans">
          A little more discovery.
        </h1>
        <div className="text-[11px] font-mono tracking-[0.16em] uppercase text-white/40 font-semibold">
          MONDAY SELECTS / 026
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────
          2. SPLIT HERO BANNER CARD (52% REFRACTIVE GLASS / 48% SUNSET VISUAL)
          ───────────────────────────────────────────────────────────────────────── */}
      <section className="relative w-full min-h-[280px] sm:min-h-[300px] rounded-[24px] overflow-hidden glass-panel border border-white/14 shadow-[0_24px_50px_rgba(0,0,0,0.55)] flex flex-col md:flex-row">
        {/* Left 52%: Refractive Smoked Glass Editorial Details */}
        <div className="w-full md:w-[52%] p-8 sm:p-10 flex flex-col justify-between z-10 bg-gradient-to-r from-white/[0.04] to-transparent">
          <div>
            {/* Coral Eyebrow */}
            <div className="flex items-center gap-2 mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E86538] shadow-[0_0_8px_#E86538]" />
              <span className="text-[11px] font-mono tracking-[0.14em] uppercase text-white/70 font-semibold">
                {activeSlide.eyebrow}
              </span>
            </div>

            {/* Instrument Serif Large Headline */}
            <h2 className="font-editorial text-[42px] sm:text-[48px] lg:text-[52px] font-normal text-white leading-[1.04] tracking-[-0.01em] mb-4">
              {activeSlide.title}
            </h2>

            {/* Editorial Subtitle */}
            <p className="text-[13.5px] text-white/65 font-sans leading-relaxed max-w-md font-normal">
              {activeSlide.subtitle}
            </p>
          </div>

          {/* Bottom CTA Row: Pill Listen Now Button + Metadata */}
          <div className="flex items-center gap-4 pt-6">
            <button
              onClick={handlePlayHero}
              disabled={isHeroLoading}
              className="flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-white text-black font-semibold text-xs transition-all duration-200 hover:bg-white/90 hover:scale-[1.02] active:scale-[0.98] shadow-lg cursor-pointer"
            >
              {isHeroLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-black" />
                  <span>Loading...</span>
                </>
              ) : isPlaying && activeHeroQuery === activeSlide.query ? (
                <>
                  <Pause className="w-3.5 h-3.5 fill-current" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                  <span>Listen now</span>
                </>
              )}
            </button>

            <span className="text-xs text-white/45 font-mono tracking-tight">
              {activeSlide.meta}
            </span>
          </div>
        </div>

        {/* Right 48%: Atmospheric High-Resolution Editorial Visual */}
        <div className="relative w-full md:w-[48%] min-h-[220px] md:min-h-full overflow-hidden">
          <img
            src={activeSlide.visualUrl}
            alt={activeSlide.title}
            className="w-full h-full object-cover transition-opacity duration-700 select-none pointer-events-none"
          />
          {/* Smooth left-edge gradient mask into dark smoked glass */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#0e1018]/90 via-transparent to-black/25 pointer-events-none" />

          {/* 3 Carousel Indicator Pills in Bottom-Right Corner */}
          <div className="absolute bottom-4 right-5 flex items-center gap-1.5 z-20">
            {HERO_SLIDES.map((slide, idx) => (
              <button
                key={slide.id}
                onClick={() => setCurrentSlideIndex(idx)}
                className={`transition-all duration-300 rounded-full cursor-pointer ${
                  currentSlideIndex === idx
                    ? 'w-6 h-1.5 bg-white shadow-sm'
                    : 'w-2 h-1.5 bg-white/30 hover:bg-white/60'
                }`}
                title={slide.title}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────
          3. "FIND YOUR FREQUENCY" 5-CARD ROW
          ───────────────────────────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-4">
        {/* Row Header */}
        <div className="flex items-baseline justify-between">
          <div className="flex items-baseline gap-3">
            <h2 className="text-xl sm:text-2xl font-semibold text-white tracking-tight font-sans">
              Find your frequency
            </h2>
            <span className="text-xs text-white/45 font-sans hidden sm:inline">
              Selected by us. Discovered by you.
            </span>
          </div>
          <button
            onClick={() => onNavigateTab('search')}
            className="flex items-center gap-1 text-xs text-white/50 hover:text-white transition-colors cursor-pointer group font-sans"
          >
            <span>Explore all</span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>

        {/* 5 Responsive Square Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-4.5">
          {FREQUENCY_CARDS.map((card) => {
            const isCardActive = activeFrequencyId === card.id && isPlaying;
            const isCardLoading = loadingFrequencyId === card.id;

            return (
              <div
                key={card.id}
                onClick={() => handlePlayFrequencyCard(card)}
                className={`glass-card group relative rounded-[18px] p-3 border transition-all duration-300 cursor-pointer flex flex-col gap-3 overflow-hidden ${
                  isCardActive
                    ? 'border-[#E86538]/60 bg-white/[0.08] shadow-[0_0_24px_rgba(232,101,56,0.35)]'
                    : 'border-white/10 hover:border-white/25'
                }`}
              >
                {/* Square Artwork */}
                <div className="relative w-full aspect-square rounded-[14px] overflow-hidden bg-white/5">
                  <img
                    src={card.imageUrl}
                    alt={card.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                  <div
                    className={`absolute inset-0 transition-colors ${
                      isCardActive ? 'bg-black/30' : 'bg-black/20 group-hover:bg-black/10'
                    }`}
                  />

                  {/* Active Equalizer Indicator */}
                  {isCardActive && (
                    <div className="absolute top-2.5 left-2.5 px-2 py-1 rounded-full bg-black/70 backdrop-blur-md border border-[#E86538]/40 flex items-center gap-1.5 shadow-md">
                      <div className="flex items-end gap-[1.5px] h-2.5">
                        <span className="w-[2px] h-2 bg-[#E86538] rounded-full animate-bounce" />
                        <span className="w-[2px] h-2.5 bg-white rounded-full animate-bounce delay-100" />
                        <span className="w-[2px] h-1.5 bg-[#E86538] rounded-full animate-bounce delay-200" />
                      </div>
                      <span className="text-[9px] font-mono font-bold text-[#E86538] tracking-wider uppercase">
                        LIVE
                      </span>
                    </div>
                  )}

                  {/* Floating Play Indicator Button on Hover or Loading */}
                  <div
                    className={`absolute right-2.5 bottom-2.5 w-9 h-9 rounded-full bg-white text-black flex items-center justify-center transition-all duration-200 shadow-lg ${
                      isCardActive || isCardLoading
                        ? 'opacity-100 translate-y-0'
                        : 'opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0'
                    }`}
                  >
                    {isCardLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin text-[#E86538]" />
                    ) : isCardActive ? (
                      <Pause className="w-4 h-4 fill-current text-black" />
                    ) : (
                      <Play className="w-4 h-4 fill-current ml-0.5 text-black" />
                    )}
                  </div>
                </div>

                {/* Card Meta & Typography */}
                <div className="flex flex-col min-w-0 px-0.5 pb-1">
                  <span className="text-[9.5px] font-mono tracking-[0.14em] uppercase text-white/40 font-semibold truncate mb-1">
                    {card.genre}
                  </span>
                  <h3
                    className={`text-sm font-semibold tracking-tight truncate leading-snug transition-colors ${
                      isCardActive ? 'text-[#E86538]' : 'text-white group-hover:text-[#E86538]'
                    }`}
                  >
                    {card.title}
                  </h3>
                  <p className="text-[11.5px] text-white/50 truncate font-sans mt-0.5">
                    {card.artists}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────────────────
          4. BOTTOM 2-COLUMN SPLIT: "IN YOUR ROTATION" (58%) & "MADE FOR YOUR MONDAY" (42%)
          ───────────────────────────────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN (58% / 7 cols): "In your rotation" */}
        <div className="lg:col-span-7 flex flex-col gap-3.5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl font-semibold text-white tracking-tight font-sans">
              In your rotation
            </h2>
            <button
              onClick={() => onNavigateTab('queue')}
              className="flex items-center gap-1 text-xs text-white/50 hover:text-white transition-colors cursor-pointer group font-sans"
            >
              <span>View all</span>
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>

          {/* Track List */}
          <div className="flex flex-col rounded-[20px] glass-panel border border-white/10 p-2 overflow-hidden shadow-xl">
            {displayRotation.map((track) => {
              const isCurrent =
                (currentTrack?.id && currentTrack.id === track.id) ||
                (currentTrack?.title &&
                  currentTrack.title.toLowerCase() === track.title.toLowerCase());
              const isTrackPlaying = isCurrent && isPlaying;
              const isLiked = userLibrary.isLiked(track.id);
              const isRowLoading = loadingRowId === (track.id || track.title);

              return (
                <div
                  key={track.id || track.title}
                  onClick={() => handlePlayRotationRow(track)}
                  className={`group relative flex items-center justify-between gap-3 px-3 py-2.5 rounded-[14px] transition-all cursor-pointer ${
                    isCurrent
                      ? 'bg-white/[0.08] text-white'
                      : 'hover:bg-white/[0.04] text-white/80'
                  }`}
                >
                  {/* Left: Play/Waveform + Artwork + Title & Artist */}
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    {/* Play/Waveform Indicator */}
                    <div className="w-5 flex items-center justify-center shrink-0">
                      {isRowLoading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#E86538]" />
                      ) : isTrackPlaying ? (
                        <div className="flex items-end gap-[2px] h-3.5">
                          <span className="w-[3px] bg-[#E86538] rounded-full animate-pulse h-3" />
                          <span className="w-[3px] bg-[#E86538] rounded-full animate-pulse h-4 delay-100" />
                          <span className="w-[3px] bg-[#E86538] rounded-full animate-pulse h-2 delay-200" />
                        </div>
                      ) : (
                        <Play className="w-3.5 h-3.5 fill-current text-white/40 group-hover:text-white transition-colors ml-0.5" />
                      )}
                    </div>

                    {/* Artwork */}
                    <div className="w-11 h-11 rounded-[10px] overflow-hidden bg-white/5 shrink-0 border border-white/10">
                      {track.artworkUrl ? (
                        <img
                          src={track.artworkUrl}
                          alt={track.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-white/10">
                          <Volume2 className="w-4 h-4 text-white/40" />
                        </div>
                      )}
                    </div>

                    {/* Title & Artist */}
                    <div className="min-w-0 flex-1">
                      <div
                        className={`text-sm font-semibold truncate ${
                          isCurrent ? 'text-[#E86538]' : 'text-white'
                        }`}
                      >
                        {track.title}
                      </div>
                      <div className="text-xs text-white/50 truncate font-sans">
                        {track.artist}
                      </div>
                    </div>
                  </div>

                  {/* Middle: Album Name */}
                  <div className="hidden sm:block w-32 lg:w-36 text-xs text-white/40 truncate font-sans">
                    {track.album || 'Single'}
                  </div>

                  {/* Right: Heart + Plus + Duration */}
                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const next = userLibrary.toggleLike(track);
                        onToggleLike?.(track, next);
                      }}
                      className="p-1.5 text-white/35 hover:text-[#E86538] transition-colors cursor-pointer"
                      title={isLiked ? 'Unlike' : 'Like'}
                    >
                      <Heart
                        className={`w-3.5 h-3.5 ${
                          isLiked ? 'fill-[#E86538] text-[#E86538]' : ''
                        }`}
                      />
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        onOpenAddToPlaylist(track, rect);
                      }}
                      className="p-1.5 text-white/35 hover:text-white transition-colors cursor-pointer"
                      title="Add to playlist or queue"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>

                    <span className="text-xs font-mono text-white/40 w-10 text-right">
                      {formatTime(track.duration || 0)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMN (42% / 5 cols): "Made for your Monday" Daily Blend Card */}
        <div className="lg:col-span-5 flex flex-col gap-3.5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl font-semibold text-white tracking-tight font-sans">
              Made for your Monday
            </h2>
            <button
              onClick={handlePlayDailyBlend}
              className="flex items-center gap-1 text-xs text-white/50 hover:text-white transition-colors cursor-pointer group font-sans"
            >
              <span>Your mixes</span>
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>

          {/* Refractive Liquid Glass Card (20px radius, 20px padding) */}
          <div className="relative rounded-[22px] glass-panel border border-white/12 p-5 sm:p-6 shadow-xl flex flex-col sm:flex-row gap-5 items-center">
            {/* 145x145px Rounded Cover */}
            <div className="relative w-36 h-36 rounded-[16px] overflow-hidden bg-white/5 shrink-0 border border-white/10 shadow-md">
              <img
                src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=400&q=80"
                alt="Your Daily Blend"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/15" />
            </div>

            {/* Daily Blend Content */}
            <div className="flex-1 flex flex-col justify-between min-h-[145px] w-full">
              <div>
                <span className="text-[10px] font-mono tracking-[0.14em] uppercase text-white/45 font-semibold block mb-1">
                  YOUR DAILY BLEND
                </span>
                <h3 className="font-editorial text-[28px] sm:text-[32px] font-normal text-white leading-tight mb-2">
                  Familiar, but new.
                </h3>
                <p className="text-xs text-white/60 leading-relaxed font-sans">
                  Curated blend tailored from your session & liked artists, seamlessly mixed with AutoMix.
                </p>
              </div>

              {/* Card Footer: Metadata + Circular Play Button */}
              <div className="flex items-center justify-between pt-4 mt-auto">
                <span className="text-[11px] font-mono text-white/40">
                  20 tracks · AutoMix Blend
                </span>

                <button
                  onClick={handlePlayDailyBlend}
                  disabled={isBlendLoading}
                  className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-md cursor-pointer shrink-0"
                  title="Play Your Daily Blend with AutoMix"
                >
                  {isBlendLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-black" />
                  ) : (
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default EditorialHomeView;
