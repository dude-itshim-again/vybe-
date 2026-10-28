import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Play,
  Compass,
  Clock,
  Shuffle,
  Headphones,
} from 'lucide-react';
import {
  discoveryEngine,
  DaylistResult,
  DiscoverWeeklyResult,
} from '../../services/discoveryEngine';
import { userLibrary } from '../../services/userLibraryService';
import { TrackMetadata } from '../../providers/types';

interface MadeForYouRowProps {
  onPlayTracks: (tracks: TrackMetadata[], mixTitle: string) => void;
  onOpenWrapped: () => void;
  onOpenBlend: () => void;
}

export const MadeForYouRow: React.FC<MadeForYouRowProps> = ({
  onPlayTracks,
  onOpenWrapped,
  onOpenBlend,
}) => {
  const [daylist, setDaylist] = useState<DaylistResult | null>(null);
  const [discoverWeekly, setDiscoverWeekly] = useState<DiscoverWeeklyResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const currentUser = userLibrary.getCurrentUser();

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    Promise.all([discoveryEngine.getDaylist(), discoveryEngine.getDiscoverWeekly()])
      .then(([dl, dw]) => {
        if (isMounted) {
          setDaylist(dl);
          setDiscoverWeekly(dw);
        }
      })
      .catch((e) => console.warn('[MadeForYou] Load error:', e))
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handlePlayDaylist = () => {
    if (daylist && daylist.tracks.length > 0) {
      onPlayTracks(daylist.tracks, daylist.title);
    }
  };

  const handlePlayDiscoverWeekly = () => {
    if (discoverWeekly && discoverWeekly.tracks.length > 0) {
      onPlayTracks(discoverWeekly.tracks, 'Discover Weekly');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-6 w-36 bg-white/5 rounded-lg animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-44 rounded-2xl bg-white/[0.03] border border-white/5 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-pink-500/15 border border-pink-500/30 flex items-center justify-center text-pink-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Made For You</h2>
            <p className="text-[11px] text-zinc-400 font-mono">
              Dynamic Daylist • Discover Weekly • Vybe Wrapped
            </p>
          </div>
        </div>
        <button
          onClick={onOpenBlend}
          className="text-xs font-mono font-semibold text-pink-400 hover:text-pink-300 flex items-center gap-1.5 transition-colors"
        >
          <Shuffle className="w-3.5 h-3.5" />
          <span>Taste Blend</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 1. Dynamic Daylist Card */}
        {daylist && (
          <div
            className="group relative rounded-2xl p-5 border border-white/10 overflow-hidden shadow-xl hover:border-white/20 transition-all flex flex-col justify-between"
            style={{ background: daylist.coverGradient }}
          >
            <div className="relative z-10 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-widest font-black px-2 py-0.5 rounded-full bg-black/40 text-white backdrop-blur-md border border-white/10 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-cyan-400" />
                  {daylist.timeWindowName}
                </span>
                <span className="text-[10px] font-mono text-white/70">12 Songs</span>
              </div>

              <div>
                <h3 className="text-xl font-black text-white leading-tight drop-shadow-md">
                  {daylist.title}
                </h3>
                <p className="text-xs text-white/80 line-clamp-1 mt-0.5 drop-shadow-sm">
                  {daylist.subtitle}
                </p>
              </div>

              <div className="flex flex-wrap gap-1 pt-1">
                {daylist.vibes.map((v) => (
                  <span
                    key={v}
                    className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-white/15 text-white backdrop-blur-sm"
                  >
                    {v}
                  </span>
                ))}
              </div>
            </div>

            <div className="relative z-10 pt-4 flex items-center justify-between">
              <span className="text-[10px] text-white/70 font-mono">Updates automatically</span>
              <button
                onClick={handlePlayDaylist}
                className="w-10 h-10 rounded-full bg-white text-black hover:bg-zinc-200 flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95"
                title="Play Daylist"
              >
                <Play className="w-4 h-4 fill-current ml-0.5" />
              </button>
            </div>
          </div>
        )}

        {/* 2. Discover Weekly Card */}
        {discoverWeekly && (
          <div
            className="group relative rounded-2xl p-5 border border-white/10 overflow-hidden shadow-xl hover:border-white/20 transition-all flex flex-col justify-between"
            style={{ background: discoverWeekly.coverGradient }}
          >
            <div className="relative z-10 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-widest font-black px-2 py-0.5 rounded-full bg-black/40 text-emerald-400 backdrop-blur-md border border-emerald-500/20 flex items-center gap-1">
                  <Compass className="w-3 h-3 text-emerald-400" />
                  Every Monday Mix
                </span>
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white border border-white/20 shadow-sm"
                  style={{ backgroundColor: currentUser.avatarColor || '#10B981' }}
                  title={currentUser.name}
                >
                  {currentUser.name.charAt(0).toUpperCase()}
                </div>
              </div>

              <div>
                <h3 className="text-xl font-black text-white leading-tight drop-shadow-md">
                  Discover Weekly
                </h3>
                <p className="text-xs text-white/80 line-clamp-1 mt-0.5 drop-shadow-sm">
                  {discoverWeekly.subtitle}
                </p>
              </div>

              <div className="flex flex-wrap gap-1 pt-1">
                {discoverWeekly.topArtistsUsed.slice(0, 3).map((artist) => (
                  <span
                    key={artist}
                    className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-white/15 text-white backdrop-blur-sm"
                  >
                    Based on {artist}
                  </span>
                ))}
              </div>
            </div>

            <div className="relative z-10 pt-4 flex items-center justify-between">
              <span className="text-[10px] text-white/70 font-mono">Personalized catalog feed</span>
              <button
                onClick={handlePlayDiscoverWeekly}
                className="w-10 h-10 rounded-full bg-white text-black hover:bg-zinc-200 flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95"
                title="Play Discover Weekly"
              >
                <Play className="w-4 h-4 fill-current ml-0.5" />
              </button>
            </div>
          </div>
        )}

        {/* 3. Vybe Wrapped 2026 Interactive Story Banner Card */}
        <div
          onClick={onOpenWrapped}
          className="group relative rounded-2xl p-5 border border-purple-500/30 overflow-hidden shadow-xl hover:border-purple-500/60 transition-all flex flex-col justify-between cursor-pointer"
          style={{
            background: 'linear-gradient(135deg, #2D0B5A 0%, #17072E 50%, #070709 100%)',
          }}
        >
          {/* Subtle Ambient Pulse Orb */}
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-purple-500/20 blur-2xl pointer-events-none group-hover:scale-125 transition-transform" />

          <div className="relative z-10 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-widest font-black px-2 py-0.5 rounded-full bg-purple-500/30 text-purple-200 backdrop-blur-md border border-purple-500/40 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-purple-300" />
                Wrapped 2026
              </span>
              <span className="text-[10px] font-mono text-purple-300 font-bold">Interactive</span>
            </div>

            <div>
              <h3 className="text-xl font-black text-white leading-tight drop-shadow-md">
                Your Year In Sound
              </h3>
              <p className="text-xs text-purple-200/80 mt-0.5 line-clamp-1">
                5-Slide Story • Sonic Aura • Poster PNG
              </p>
            </div>

            <div className="flex items-center gap-2 pt-1 text-xs text-zinc-300">
              <Headphones className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-[11px] text-zinc-300">Tap to see your top songs & audio persona</span>
            </div>
          </div>

          <div className="relative z-10 pt-4 flex items-center justify-between">
            <span className="text-[10px] text-purple-400 font-mono font-semibold">Ready to view</span>
            <div className="px-3 py-1.5 rounded-xl bg-purple-500 text-white font-mono text-xs font-bold shadow-lg transition-transform group-hover:scale-105 flex items-center gap-1.5">
              <span>View Story</span>
              <Sparkles className="w-3 h-3" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
