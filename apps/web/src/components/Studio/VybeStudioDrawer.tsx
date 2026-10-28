import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ListMusic,
  Disc3,
  Sliders,
  Trash2,
  Play,
  Pause,
  Zap,
  Mic2,
  Sparkles,
  Volume2,
  Music,
  Check,
} from 'lucide-react';
import { TrackMetadata } from '../../providers/types';
import { QueuedTrack } from '../../hooks/useAudioEngine';
import { TransitionMode } from '../../audio/AudioDSPEngine';
import { EQPreset } from '../../audio/eqPresets';

export type StudioTab = 'queue' | 'automix' | 'dsp';

interface VybeStudioDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: StudioTab;
  currentTrack: TrackMetadata;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onTogglePlay: () => void;
  queue: QueuedTrack[];
  currentTrackIndex: number;
  onPlayTrackAtIndex: (index: number) => void;
  onRemoveFromQueue: (index: number) => void;
  onClearQueue: () => void;
  // AutoMix DJ controls
  transitionMode: TransitionMode;
  onSetTransitionMode: (mode: TransitionMode) => void;
  crossfadeDuration: number;
  onSetCrossfadeDuration: (dur: number) => void;
  onTriggerInstantDJTransition: () => void;
  isTransitioning?: boolean;
  activeDeckId?: 'A' | 'B';
  // Audio DSP controls
  vocalAttenuation: number;
  onSetVocalAttenuation: (level: number) => void;
  subBass: number;
  onSetSubBass: (val: number) => void;
  punch: number;
  onSetPunch: (val: number) => void;
  spatialMode: 'off' | 'spatial-3d' | 'concert-hall';
  onSetSpatialMode: (mode: 'off' | 'spatial-3d' | 'concert-hall') => void;
  activePresetId: string;
  onApplyPreset: (preset: EQPreset) => void;
  presets: EQPreset[];
}

export const VybeStudioDrawer: React.FC<VybeStudioDrawerProps> = ({
  isOpen,
  onClose,
  initialTab = 'queue',
  currentTrack,
  isPlaying,
  currentTime,
  duration,
  onTogglePlay,
  queue,
  currentTrackIndex,
  onPlayTrackAtIndex,
  onRemoveFromQueue,
  onClearQueue,
  transitionMode,
  onSetTransitionMode,
  crossfadeDuration,
  onSetCrossfadeDuration,
  onTriggerInstantDJTransition,
  isTransitioning = false,
  activeDeckId = 'A',
  vocalAttenuation,
  onSetVocalAttenuation,
  subBass,
  onSetSubBass,
  punch,
  onSetPunch,
  spatialMode,
  onSetSpatialMode,
  activePresetId,
  onApplyPreset,
  presets,
}) => {
  const [activeTab, setActiveTab] = useState<StudioTab>(initialTab);

  // Sync initial tab when drawer opens
  React.useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  const formatTime = (secs?: number) => {
    if (!secs || isNaN(secs) || secs <= 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const isAutoMixOn = transitionMode === 'automix';

  // Handle Quick DSP Presets
  const handleQuickPreset = (presetKey: 'flat' | 'vinyl' | 'subbass' | 'vocal') => {
    if (presetKey === 'flat') {
      const p = presets.find((pr) => pr.id === 'flat') || presets[0];
      if (p) onApplyPreset(p);
    } else if (presetKey === 'vinyl') {
      const p = presets.find((pr) => pr.id === 'lateNightLoFi') || {
        id: 'lateNightLoFi',
        name: 'Warm Vinyl',
        description: 'Warm rolled-off highs, vinyl body',
        subBass: 5.0,
        punch: 3.0,
        bands: [2.0, 1.0, -2.5, -4.0, -7.5],
        accentColor: '#f59e0b',
      };
      onApplyPreset(p as EQPreset);
    } else if (presetKey === 'subbass') {
      const p = presets.find((pr) => pr.id === 'subBassRattler') || {
        id: 'subBassRattler',
        name: 'Sub-Bass Heavy',
        description: 'Deep 808 foundation',
        subBass: 9.0,
        punch: 4.5,
        bands: [2.0, -1.5, -2.0, 1.0, 1.5],
        accentColor: '#a855f7',
      };
      onApplyPreset(p as EQPreset);
    } else if (presetKey === 'vocal') {
      const p = presets.find((pr) => pr.id === 'vocalClarity') || {
        id: 'vocalClarity',
        name: 'Late Night Vocal',
        description: 'Acoustic vocal presence',
        subBass: -6.0,
        punch: -3.0,
        bands: [-2.0, -3.5, 3.5, 6.0, 2.5],
        accentColor: '#06b6d4',
      };
      onApplyPreset(p as EQPreset);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end pointer-events-auto">
          {/* Subtle Scrim Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
          />

          {/* Right-Side Liquid Glass Drawer: 360px width */}
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            style={{
              width: '360px',
              maxWidth: '92vw',
              backdropFilter: 'blur(44px) saturate(190%)',
              WebkitBackdropFilter: 'blur(44px) saturate(190%)',
              background: 'rgba(14, 16, 26, 0.78)',
              borderLeft: '1px solid rgba(255, 255, 255, 0.14)',
            }}
            className="relative h-full flex flex-col z-10 shadow-[-14px_0_45px_rgba(0,0,0,0.65)] select-none overflow-hidden"
          >
            {/* ─────────────────────────────────────────────────────────────────
                DRAWER HEADER & 3-TAB FROSTED PILL SWITCHER
                ───────────────────────────────────────────────────────────────── */}
            <div className="px-5 pt-5 pb-4 border-b border-white/10 flex flex-col gap-3.5 shrink-0 bg-white/[0.02]">
              {/* Top Title Bar */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#E86538] to-purple-600 flex items-center justify-center text-white shadow-md">
                    <Sliders className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white tracking-wide font-sans leading-tight">
                      Vybe Studio
                    </h2>
                    <p className="text-[10px] text-white/45 font-mono">
                      Queue • AutoMix DJ • DSP
                    </p>
                  </div>
                </div>

                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  title="Close Studio"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* 3-Tab Frosted Pill Switcher: Queue | AutoMix DJ | Audio DSP */}
              <div className="grid grid-cols-3 p-1 rounded-full bg-white/[0.06] border border-white/10 text-xs font-semibold">
                <button
                  onClick={() => setActiveTab('queue')}
                  className={`flex items-center justify-center gap-1.5 py-1.5 rounded-full transition-all cursor-pointer ${
                    activeTab === 'queue'
                      ? 'bg-white/20 text-white font-bold shadow-sm border border-white/25'
                      : 'text-white/50 hover:text-white'
                  }`}
                >
                  <ListMusic className="w-3.5 h-3.5" />
                  <span>Queue</span>
                </button>

                <button
                  onClick={() => setActiveTab('automix')}
                  className={`flex items-center justify-center gap-1.5 py-1.5 rounded-full transition-all cursor-pointer ${
                    activeTab === 'automix'
                      ? 'bg-[#E86538]/30 text-white font-bold shadow-sm border border-[#E86538]/40'
                      : 'text-white/50 hover:text-white'
                  }`}
                >
                  <Disc3
                    className={`w-3.5 h-3.5 ${
                      isAutoMixOn ? 'text-[#E86538] animate-spin' : ''
                    }`}
                  />
                  <span>AutoMix</span>
                </button>

                <button
                  onClick={() => setActiveTab('dsp')}
                  className={`flex items-center justify-center gap-1.5 py-1.5 rounded-full transition-all cursor-pointer ${
                    activeTab === 'dsp'
                      ? 'bg-purple-600/30 text-white font-bold shadow-sm border border-purple-500/40'
                      : 'text-white/50 hover:text-white'
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5 text-purple-300" />
                  <span>Audio DSP</span>
                </button>
              </div>
            </div>

            {/* ─────────────────────────────────────────────────────────────────
                DRAWER BODY CONTENT (SCROLLABLE)
                ───────────────────────────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-5 flex flex-col gap-5">
              {/* ═════════════════════════════════════════════════════════════════
                  TAB 1: QUEUE (UP NEXT)
                  ═════════════════════════════════════════════════════════════════ */}
              {activeTab === 'queue' && (
                <div className="flex flex-col gap-4">
                  {/* NOW PLAYING MINI CARD */}
                  <div className="rounded-[16px] p-3.5 bg-white/[0.05] border border-white/12 shadow-lg flex items-center gap-3">
                    <div className="relative w-12 h-12 rounded-[10px] overflow-hidden bg-white/5 border border-white/10 shrink-0 shadow">
                      {currentTrack?.artworkUrl ? (
                        <img
                          src={currentTrack.artworkUrl}
                          alt={currentTrack.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-white/5">
                          <Music className="w-5 h-5 text-white/40" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[9px] font-mono font-bold tracking-wider uppercase text-[#E86538] bg-[#E86538]/15 px-1.5 py-0.5 rounded border border-[#E86538]/25">
                          {isPlaying ? 'Now Playing' : 'Paused'}
                        </span>
                        <span className="text-[9px] font-mono text-white/40">
                          320kbps
                        </span>
                      </div>
                      <h4 className="text-xs font-semibold text-white truncate leading-snug">
                        {currentTrack?.title || 'No Track Loaded'}
                      </h4>
                      <p className="text-[11px] text-white/50 truncate font-sans">
                        {currentTrack?.artist || 'Unknown Artist'}
                      </p>
                    </div>

                    <button
                      onClick={onTogglePlay}
                      className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow cursor-pointer shrink-0"
                      title={isPlaying ? 'Pause' : 'Play'}
                    >
                      {isPlaying ? (
                        <Pause className="w-3.5 h-3.5 fill-current" />
                      ) : (
                        <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                      )}
                    </button>
                  </div>

                  {/* QUEUE CONTROLS HEADER */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white tracking-wide uppercase font-mono">
                        Up Next
                      </span>
                      <span className="text-[10px] font-mono text-white/40 px-1.5 py-0.5 rounded-full bg-white/5 border border-white/10">
                        {queue.length}
                      </span>
                    </div>

                    {queue.length > 1 && (
                      <button
                        onClick={onClearQueue}
                        className="flex items-center gap-1 text-[11px] text-white/40 hover:text-rose-400 transition-colors cursor-pointer font-mono"
                        title="Clear Upcoming Queue"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Clear Queue</span>
                      </button>
                    )}
                  </div>

                  {/* QUEUE LIST */}
                  <div className="flex flex-col gap-1.5">
                    {queue.map((track, idx) => {
                      const isCurrent = idx === currentTrackIndex;

                      return (
                        <div
                          key={track.id || `${track.title}-${idx}`}
                          onClick={() => onPlayTrackAtIndex(idx)}
                          className={`group flex items-center justify-between gap-2.5 p-2 rounded-[12px] transition-all cursor-pointer ${
                            isCurrent
                              ? 'bg-white/[0.09] text-white border border-[#E86538]/30 shadow-sm'
                              : 'hover:bg-white/[0.04] text-white/70 hover:text-white border border-transparent'
                          }`}
                        >
                          {/* Left: Index / Waveform + Cover Thumb */}
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="w-5 flex items-center justify-center shrink-0 font-mono text-[11px] text-white/40">
                              {isCurrent && isPlaying ? (
                                <div className="flex items-end gap-[1.5px] h-3">
                                  <span className="w-[2px] h-2.5 bg-[#E86538] rounded-full animate-bounce" />
                                  <span className="w-[2px] h-3 bg-white rounded-full animate-bounce delay-100" />
                                  <span className="w-[2px] h-1.5 bg-[#E86538] rounded-full animate-bounce delay-200" />
                                </div>
                              ) : (
                                <span>{idx + 1}</span>
                              )}
                            </div>

                            <div className="w-9 h-9 rounded-[8px] overflow-hidden bg-white/5 border border-white/10 shrink-0">
                              {track.artworkUrl ? (
                                <img
                                  src={track.artworkUrl}
                                  alt={track.title}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Music className="w-3.5 h-3.5 text-white/30" />
                                </div>
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div
                                className={`text-xs font-semibold truncate ${
                                  isCurrent ? 'text-[#E86538]' : 'text-white'
                                }`}
                              >
                                {track.title}
                              </div>
                              <div className="text-[10px] text-white/45 truncate font-sans">
                                {track.artist || 'Unknown Artist'}
                              </div>
                            </div>
                          </div>

                          {/* Right: Duration + Remove Button */}
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] font-mono text-white/35">
                              {formatTime(track.duration)}
                            </span>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onRemoveFromQueue(idx);
                              }}
                              className="p-1 rounded-md text-white/20 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                              title="Remove from Queue"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {queue.length === 0 && (
                      <div className="py-8 text-center text-xs text-white/35 font-sans">
                        Queue is empty. Select any song or mix to start listening!
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ═════════════════════════════════════════════════════════════════
                  TAB 2: AUTOMIX DJ
                  ═════════════════════════════════════════════════════════════════ */}
              {activeTab === 'automix' && (
                <div className="flex flex-col gap-5">
                  {/* MASTER AUTOMIX TOGGLE CARD */}
                  <div className="p-4 rounded-[18px] bg-white/[0.04] border border-white/10 shadow-lg flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-[#E86538]/20 border border-[#E86538]/30 flex items-center justify-center text-[#E86538]">
                          <Zap className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white font-sans">
                            AutoMix Crossfade
                          </div>
                          <div className="text-[10px] text-white/45 font-mono">
                            Apple Music iOS 26 DJ Engine
                          </div>
                        </div>
                      </div>

                      {/* On/Off Switch */}
                      <button
                        onClick={() =>
                          onSetTransitionMode(isAutoMixOn ? 'gapless' : 'automix')
                        }
                        className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer border ${
                          isAutoMixOn
                            ? 'bg-[#E86538] border-[#E86538]'
                            : 'bg-white/10 border-white/15'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform ${
                            isAutoMixOn ? 'translate-x-6' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    <p className="text-[11px] text-white/55 font-sans leading-relaxed">
                      Harmonic phrase-matching, 340Hz high-pass vocal teasing, and
                      real-time 808 kick-drop detection for seamless blends.
                    </p>
                  </div>

                  {/* CROSSFADE DURATION SELECTOR PILLS */}
                  <div className="flex flex-col gap-2.5 p-4 rounded-[18px] bg-white/[0.04] border border-white/10 shadow-lg">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="font-bold text-white/80">
                        CROSSFADE DURATION
                      </span>
                      <span className="text-[#E86538] font-bold">
                        {crossfadeDuration}s Blend
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-1">
                      {[4, 8, 12].map((seconds) => {
                        const isSelected = crossfadeDuration === seconds;
                        return (
                          <button
                            key={seconds}
                            onClick={() => onSetCrossfadeDuration(seconds)}
                            className={`py-2 px-3 rounded-[12px] text-xs font-mono font-bold transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-[#E86538]/25 border border-[#E86538] text-white shadow-[0_0_12px_rgba(232,101,56,0.4)]'
                                : 'bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10'
                            }`}
                          >
                            {seconds}s
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* TRIGGER INSTANT DJ TRANSITION NOW BUTTON */}
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={onTriggerInstantDJTransition}
                      disabled={isTransitioning}
                      className={`w-full py-3.5 px-4 rounded-[16px] font-bold text-xs font-sans tracking-wide transition-all shadow-xl flex items-center justify-center gap-2 cursor-pointer ${
                        isTransitioning
                          ? 'bg-purple-600/40 text-purple-200 border border-purple-400/30 animate-pulse cursor-wait'
                          : 'bg-gradient-to-r from-[#E86538] via-purple-600 to-indigo-600 text-white hover:brightness-110 active:scale-[0.98] shadow-[0_4px_22px_rgba(232,101,56,0.35)]'
                      }`}
                    >
                      <Zap className="w-4 h-4 fill-current text-white" />
                      <span>
                        {isTransitioning
                          ? 'DJ Crossfade In Progress...'
                          : '⚡ Trigger Instant DJ Transition Now'}
                      </span>
                    </button>
                    <p className="text-[10px] text-white/40 text-center font-mono">
                      Immediately sweeps EQ filters & crossfades to next queued track
                    </p>
                  </div>

                  {/* DUAL DECK HARDWARE STATUS */}
                  <div className="p-3.5 rounded-[16px] bg-white/[0.03] border border-white/10 flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-white/60">Active Deck:</span>
                      <span className="font-bold text-white">Deck {activeDeckId}</span>
                    </div>

                    <div className="text-[10px] text-white/40">
                      Standby: Deck {activeDeckId === 'A' ? 'B' : 'A'}
                    </div>
                  </div>
                </div>
              )}

              {/* ═════════════════════════════════════════════════════════════════
                  TAB 3: AUDIO DSP (LOSSLESS STUDIO)
                  ═════════════════════════════════════════════════════════════════ */}
              {activeTab === 'dsp' && (
                <div className="flex flex-col gap-5">
                  {/* VOCAL ATTENUATION (KARAOKE CUT) SLIDER */}
                  <div className="p-4 rounded-[18px] bg-white/[0.04] border border-white/10 shadow-lg flex flex-col gap-2.5">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <div className="flex items-center gap-2">
                        <Mic2 className="w-3.5 h-3.5 text-[#E86538]" />
                        <span className="font-bold text-white">
                          Vocal Cut (Karaoke)
                        </span>
                      </div>
                      <span className="font-bold text-[#E86538]">
                        {Math.round(vocalAttenuation * 100)}%
                      </span>
                    </div>

                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={vocalAttenuation}
                      onChange={(e) =>
                        onSetVocalAttenuation(parseFloat(e.target.value))
                      }
                      className="w-full h-1.5 rounded-full accent-[#E86538] cursor-pointer"
                    />

                    <div className="flex justify-between text-[9.5px] font-mono text-white/40">
                      <span>Full Vocals (0%)</span>
                      <span>Instrumental Solo (100%)</span>
                    </div>
                  </div>

                  {/* BASS BOOST SLIDER (0dB – +12dB) */}
                  <div className="p-4 rounded-[18px] bg-white/[0.04] border border-white/10 shadow-lg flex flex-col gap-2.5">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="font-bold text-white">
                        60Hz Sub-Bass Boost
                      </span>
                      <span className="font-bold text-emerald-400">
                        {subBass >= 0 ? `+${subBass.toFixed(1)}` : subBass.toFixed(1)} dB
                      </span>
                    </div>

                    <input
                      type="range"
                      min="0"
                      max="12"
                      step="0.5"
                      value={Math.max(0, subBass)}
                      onChange={(e) => onSetSubBass(parseFloat(e.target.value))}
                      className="w-full h-1.5 rounded-full accent-emerald-400 cursor-pointer"
                    />

                    <div className="flex justify-between text-[9.5px] font-mono text-white/40">
                      <span>0.0 dB</span>
                      <span>+6.0 dB</span>
                      <span>+12.0 dB</span>
                    </div>
                  </div>

                  {/* SPATIAL PRESENCE SLIDER & MODE */}
                  <div className="p-4 rounded-[18px] bg-white/[0.04] border border-white/10 shadow-lg flex flex-col gap-2.5">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="font-bold text-white">
                        120Hz Punch / Presence
                      </span>
                      <span className="font-bold text-cyan-400">
                        {punch >= 0 ? `+${punch.toFixed(1)}` : punch.toFixed(1)} dB
                      </span>
                    </div>

                    <input
                      type="range"
                      min="0"
                      max="12"
                      step="0.5"
                      value={Math.max(0, punch)}
                      onChange={(e) => onSetPunch(parseFloat(e.target.value))}
                      className="w-full h-1.5 rounded-full accent-cyan-400 cursor-pointer"
                    />

                    {/* Spatial 3D Mode Pills */}
                    <div className="pt-2">
                      <div className="text-[10px] font-mono uppercase text-white/40 mb-1.5">
                        Spatial Stage
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        {(['off', 'spatial-3d', 'concert-hall'] as const).map(
                          (mode) => {
                            const isCurrent = spatialMode === mode;
                            const label =
                              mode === 'off'
                                ? 'Stereo'
                                : mode === 'spatial-3d'
                                ? 'Spatial 3D'
                                : 'Concert';
                            return (
                              <button
                                key={mode}
                                onClick={() => onSetSpatialMode(mode)}
                                className={`py-1.5 px-1 rounded-[8px] text-[10px] font-mono font-bold transition-all cursor-pointer text-center ${
                                  isCurrent
                                    ? 'bg-cyan-500/20 border border-cyan-400 text-cyan-300'
                                    : 'bg-white/5 border border-white/10 text-white/50 hover:text-white'
                                }`}
                              >
                                {label}
                              </button>
                            );
                          }
                        )}
                      </div>
                    </div>
                  </div>

                  {/* QUICK PRESET PILLS: Flat, Warm Vinyl, Sub-Bass Heavy, Late Night Vocal */}
                  <div className="flex flex-col gap-2">
                    <span className="text-[10px] font-mono tracking-wider uppercase text-white/45 font-bold">
                      Quick Soundstage Presets
                    </span>

                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { key: 'flat', label: 'Flat', desc: 'Reference' },
                        { key: 'vinyl', label: 'Warm Vinyl', desc: 'Analog Tape' },
                        { key: 'subbass', label: 'Sub-Bass Heavy', desc: '808 Rattler' },
                        { key: 'vocal', label: 'Late Night Vocal', desc: 'Clarity' },
                      ].map((item) => (
                        <button
                          key={item.key}
                          onClick={() =>
                            handleQuickPreset(
                              item.key as 'flat' | 'vinyl' | 'subbass' | 'vocal'
                            )
                          }
                          className="flex flex-col text-left p-2.5 rounded-[12px] bg-white/5 border border-white/10 hover:border-white/25 hover:bg-white/10 transition-all cursor-pointer group"
                        >
                          <span className="text-xs font-semibold text-white group-hover:text-[#E86538] transition-colors">
                            {item.label}
                          </span>
                          <span className="text-[9.5px] font-mono text-white/40">
                            {item.desc}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
};
