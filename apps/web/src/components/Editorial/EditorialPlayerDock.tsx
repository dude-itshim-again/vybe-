import React, { useState } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Heart,
  Mic2,
  Sliders,
  Volume2,
  VolumeX,
  Maximize2,
  Music,
  Disc3,
} from 'lucide-react';
import { TrackMetadata } from '../../providers/types';
import { userLibrary } from '../../services/userLibraryService';

interface EditorialPlayerDockProps {
  track: TrackMetadata;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  volume: number;
  isMuted: boolean;
  onVolumeChange: (vol: number) => void;
  onToggleMute: () => void;
  onOpenLyrics: () => void;
  onOpenQualityModal: () => void;
  onOpenStudioDrawer: () => void;
  onOpenQueueTab: () => void;
  isQueueActive: boolean;
  spatialMode: string;
  isAutoMixActive?: boolean;
  onToggleAutoMix?: () => void;
  isShuffleOn?: boolean;
  onToggleShuffle?: () => void;
  repeatMode?: 'off' | 'all' | 'one';
  onToggleRepeat?: () => void;
}

export const EditorialPlayerDock: React.FC<EditorialPlayerDockProps> = ({
  track,
  isPlaying,
  onTogglePlay,
  onNext,
  onPrev,
  currentTime,
  duration,
  onSeek,
  volume,
  isMuted,
  onVolumeChange,
  onToggleMute,
  onOpenLyrics,
  onOpenQualityModal,
  onOpenStudioDrawer,
  onOpenQueueTab,
  isQueueActive,
  isAutoMixActive = false,
  onToggleAutoMix,
  isShuffleOn: controlledShuffle,
  onToggleShuffle,
  repeatMode: controlledRepeatMode,
  onToggleRepeat,
}) => {
  const [isScrubbing, setIsScrubbing] = useState<boolean>(false);
  const [scrubValue, setScrubValue] = useState<number>(0);
  const [internalShuffle, setInternalShuffle] = useState<boolean>(false);
  const [internalRepeat, setInternalRepeat] = useState<boolean>(false);

  const shuffleActive = controlledShuffle !== undefined ? controlledShuffle : internalShuffle;
  const handleToggleShuffle = onToggleShuffle || (() => setInternalShuffle((s) => !s));

  const repeatActive = controlledRepeatMode !== undefined ? controlledRepeatMode !== 'off' : internalRepeat;
  const isRepeatOne = controlledRepeatMode === 'one';
  const handleToggleRepeat = onToggleRepeat || (() => setInternalRepeat((r) => !r));

  const displayTime = isScrubbing ? scrubValue : currentTime;
  const isLiked = track ? userLibrary.isLiked(track.id) : false;

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = duration > 0 ? Math.min(100, (displayTime / duration) * 100) : 0;

  return (
    <footer className="fixed bottom-0 left-0 right-0 h-[82px] z-40 bg-[#07080C]/88 border-t border-white/[0.18] backdrop-blur-[48px] saturate-[200%] px-5 sm:px-7 flex items-center justify-between select-none shadow-[0_-10px_35px_rgba(0,0,0,0.65)]">
      {/* ─────────────────────────────────────────────────────────────────────────
          LEFT (28%): Artwork, Track Title, Artist — Album, Heart Button
          ───────────────────────────────────────────────────────────────────────── */}
      <div className="w-[28%] min-w-0 flex items-center gap-3.5">
        {/* 48x48px Rounded Cover Art */}
        <div className="relative w-12 h-12 rounded-[12px] bg-white/5 border border-white/12 shrink-0 overflow-hidden shadow-md">
          {track.artworkUrl || track.coverUrl || track.image ? (
            <img
              src={track.artworkUrl || track.coverUrl || track.image}
              alt={track.title}
              onError={(e) => {
                const target = e.currentTarget as HTMLImageElement;
                if (!target.src.endsWith('logo.png')) {
                  target.src = './logo.png';
                }
              }}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-tr from-stone-800 to-zinc-900">
              <Music className="w-5 h-5 text-white/50" />
            </div>
          )}
        </div>

        {/* Track Title & Artist — Album */}
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-white tracking-tight truncate leading-tight">
            {track.title || 'No Track Playing'}
          </div>
          <div className="text-xs text-white/45 truncate mt-0.5 font-sans">
            {track.artist || 'Vybe Editorial'}{' '}
            {track.album ? `— ${track.album}` : ''}
          </div>
        </div>

        {/* Heart Toggle Button */}
        <button
          onClick={() => {
            if (track) userLibrary.toggleLike(track);
          }}
          className="p-1.5 text-white/40 hover:text-[#E86538] transition-colors cursor-pointer shrink-0"
          title={isLiked ? 'Unlike' : 'Like'}
        >
          <Heart
            className={`w-4 h-4 transition-transform active:scale-125 ${
              isLiked ? 'fill-[#E86538] text-[#E86538]' : ''
            }`}
          />
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────
          CENTER (44%): Controls (Shuffle, Prev, Glowing Play/Pause, Next, Repeat)
          & Interactive Scrub Bar
          ───────────────────────────────────────────────────────────────────────── */}
      <div className="w-[44%] max-w-xl flex flex-col items-center justify-center gap-1.5 px-4">
        {/* Top Row: Playback Controls */}
        <div className="flex items-center gap-5">
          {/* Shuffle */}
          <button
            onClick={handleToggleShuffle}
            className={`transition-colors cursor-pointer ${
              shuffleActive ? 'text-[#E86538]' : 'text-white/40 hover:text-white'
            }`}
            title={shuffleActive ? 'Shuffle On (S)' : 'Shuffle Off (S)'}
          >
            <Shuffle className="w-3.5 h-3.5" />
          </button>

          {/* Previous */}
          <button
            onClick={onPrev}
            className="text-white/70 hover:text-white transition-colors cursor-pointer active:scale-95"
            title="Previous Track (P / Shift+P)"
          >
            <SkipBack className="w-4 h-4 fill-current" />
          </button>

          {/* Glowing Circular Play/Pause Button (40x40px) */}
          <button
            onClick={onTogglePlay}
            className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-[0_0_16px_rgba(255,255,255,0.35)] cursor-pointer"
            title={isPlaying ? 'Pause (Space / K)' : 'Play (Space / K)'}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-current" />
            ) : (
              <Play className="w-4 h-4 fill-current ml-0.5" />
            )}
          </button>

          {/* Next */}
          <button
            onClick={onNext}
            className="text-white/70 hover:text-white transition-colors cursor-pointer active:scale-95"
            title="Next Track (N / Shift+N)"
          >
            <SkipForward className="w-4 h-4 fill-current" />
          </button>

          {/* Repeat */}
          <button
            onClick={handleToggleRepeat}
            className={`transition-colors cursor-pointer ${
              repeatActive ? 'text-[#E86538]' : 'text-white/40 hover:text-white'
            }`}
            title={isRepeatOne ? 'Repeat One (R)' : repeatActive ? 'Repeat All (R)' : 'Repeat Off (R)'}
          >
            {isRepeatOne ? (
              <Repeat1 className="w-3.5 h-3.5" />
            ) : (
              <Repeat className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {/* Bottom Row: Current Time + Interactive Scrub Bar + Total Duration */}
        <div className="w-full flex items-center gap-2.5">
          <span className="text-[11px] font-mono text-white/40 w-9 text-right shrink-0">
            {formatTime(displayTime)}
          </span>

          {/* Sleek Interactive Scrub Bar (3px default, 5px hover) */}
          <div className="relative flex-1 group py-2 cursor-pointer flex items-center">
            <div className="relative w-full h-[3px] group-hover:h-[5px] bg-white/15 rounded-full overflow-hidden transition-all">
              {/* Progress Fill with Glowing White/Coral Highlight */}
              <div
                className="h-full bg-white group-hover:bg-[#E86538] transition-all rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Hidden Input Range for Accurate Drag / Click */}
            <input
              type="range"
              min="0"
              max={duration || 100}
              step="0.1"
              value={displayTime}
              onMouseDown={() => setIsScrubbing(true)}
              onPointerDown={() => setIsScrubbing(true)}
              onInput={(e) => {
                const val = parseFloat((e.target as HTMLInputElement).value);
                setScrubValue(val);
                onSeek(val);
              }}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setScrubValue(val);
                onSeek(val);
              }}
              onMouseUp={(e) => {
                const val = parseFloat((e.target as HTMLInputElement).value);
                onSeek(val);
                setIsScrubbing(false);
              }}
              onPointerUp={(e) => {
                const val = parseFloat((e.target as HTMLInputElement).value);
                onSeek(val);
                setIsScrubbing(false);
              }}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>

          <span className="text-[11px] font-mono text-white/40 w-9 text-left shrink-0">
            {formatTime(duration)}
          </span>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────
          RIGHT (28%): LOSSLESS Badge, AutoMix Pill, Lyrics Pill, Queue/DSP, Volume Slider, Fullscreen
          ───────────────────────────────────────────────────────────────────────── */}
      <div className="w-[28%] flex items-center justify-end gap-2.5">
        {/* Frosted LOSSLESS Micro-Badge */}
        <button
          onClick={onOpenQualityModal}
          className="hidden lg:flex items-center gap-1 px-2.5 py-1 rounded-[8px] bg-white/[0.05] border border-white/20 text-[10px] font-mono font-bold tracking-wider text-white/80 hover:text-white hover:border-white/40 transition-all cursor-pointer shadow-sm"
          title="Audio Quality & Lossless DSP Settings"
        >
          <span>LOSSLESS</span>
        </button>

        {/* Compact AutoMix DJ Pill Button */}
        <button
          onClick={onToggleAutoMix}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-[8px] border text-[10px] font-mono font-bold transition-all cursor-pointer shadow-sm ${
            isAutoMixActive
              ? 'bg-[#E86538]/20 border-[#E86538]/50 text-[#E86538] shadow-[0_0_12px_rgba(232,101,56,0.35)]'
              : 'bg-white/[0.05] border-white/15 text-white/60 hover:text-white hover:bg-white/10'
          }`}
          title="Toggle AutoMix DJ Seamless Crossfade"
        >
          <Disc3 className={`w-3 h-3 ${isAutoMixActive ? 'animate-spin text-[#E86538]' : 'text-purple-400'}`} />
          <span>⚡ AutoMix DJ</span>
        </button>

        {/* Lyrics Button (Opens VybeKineticStage in fullscreen!) */}
        <button
          onClick={onOpenLyrics}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.08] hover:bg-white/[0.15] border border-white/15 text-xs font-semibold text-white transition-all cursor-pointer shadow-sm"
          title="Open Fullscreen Kinetic Lyrics & Neon Bezel Stage"
        >
          <Mic2 className="w-3.5 h-3.5 text-[#E86538]" />
          <span className="hidden sm:inline">Lyrics</span>
        </button>

        {/* Queue / DSP Drawer Toggle */}
        <button
          onClick={onOpenStudioDrawer}
          className="p-1.5 text-white/50 hover:text-white transition-colors cursor-pointer"
          title="Open EQ & Parametric DSP Studio"
        >
          <Sliders className="w-4 h-4" />
        </button>

        {/* Volume Control */}
        <div className="hidden sm:flex items-center gap-2">
          <button
            onClick={onToggleMute}
            className="text-white/50 hover:text-white transition-colors cursor-pointer"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="w-4 h-4 text-rose-400" />
            ) : (
              <Volume2 className="w-4 h-4" />
            )}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={isMuted ? 0 : volume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            className="w-16 lg:w-20 h-1 rounded-full accent-white cursor-pointer"
            title="Volume"
          />
        </div>

        {/* Fullscreen Expand Icon (also opens VybeKineticStage!) */}
        <button
          onClick={onOpenLyrics}
          className="p-1.5 text-white/50 hover:text-white transition-colors cursor-pointer"
          title="Fullscreen Kinetic Lyrics Stage"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>
    </footer>
  );
};
