import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  ListMusic,
  Sparkles,
  Zap,
  Trash2,
  ChevronUp,
  ChevronDown,
  Upload,
  Music2,
} from 'lucide-react';
import { QueuedTrack } from '../../hooks/useAudioEngine';
import { TransitionMode } from '../../audio/AudioDSPEngine';

interface QueueAutoMixDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  queue: QueuedTrack[];
  transitionMode: TransitionMode;
  transitionDuration: number;
  onSetTransitionMode: (mode: TransitionMode) => void;
  onSetTransitionDuration: (dur: number) => void;
  onMixNextTrackNow: () => void;
  onAddFiles: (files: File[]) => void;
  onRemoveFromQueue: (index: number) => void;
  onMoveInQueue: (fromIndex: number, toIndex: number) => void;
  onClearQueue: () => void;
  isTransitioning?: boolean;
}

export const QueueAutoMixDrawer: React.FC<QueueAutoMixDrawerProps> = ({
  isOpen,
  onClose,
  queue,
  transitionMode,
  transitionDuration,
  onSetTransitionMode,
  onSetTransitionDuration,
  onMixNextTrackNow,
  onAddFiles,
  onRemoveFromQueue,
  onMoveInQueue,
  onClearQueue,
  isTransitioning = false,
}) => {
  const multiFileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onAddFiles(Array.from(files));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const audioFiles = Array.from(files).filter(
        (f) => f.type.startsWith('audio/') || f.name.match(/\.(mp3|wav|flac|m4a|aac|ogg)$/i)
      );
      if (audioFiles.length > 0) {
        onAddFiles(audioFiles);
      }
    }
  };

  const formatSecs = (secs?: number) => {
    if (!secs || isNaN(secs) || secs <= 0) return '--:--';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex justify-end pointer-events-auto">
        {/* Backdrop Scrim */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/65 backdrop-blur-sm"
        />

        {/* Slide-out Drawer Panel */}
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 240 }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="relative w-full max-w-lg h-full glass-panel border-l border-white/10 p-5 sm:p-6 shadow-2xl flex flex-col overflow-y-auto space-y-5 z-10 bg-[#0c0c10]/95 backdrop-blur-md"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-cyan-500 flex items-center justify-center text-white shadow-lg">
                <ListMusic className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white tracking-wide">
                  Queue & AutoMix Engine
                </h2>
                <p className="text-xs text-studio-muted">
                  Apple Music-Style Dual-Deck DJ Transitions
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* AUTOMIX CONTROL CAPSULE */}
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xs font-bold text-purple-300">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span>AutoMix Transition Mode</span>
              </div>
              <span className="font-mono text-xs text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                {transitionDuration}s Blend
              </span>
            </div>

            {/* 3 Transition Modes: AutoMix | Crossfade | Off */}
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-black/40 border border-white/5 text-xs font-semibold">
              <button
                onClick={() => onSetTransitionMode('automix')}
                className={`py-2 px-1 rounded-lg text-center transition-all ${
                  transitionMode === 'automix'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-900/40 font-bold'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                ✨ AutoMix (DJ)
              </button>

              <button
                onClick={() => onSetTransitionMode('crossfade')}
                className={`py-2 px-1 rounded-lg text-center transition-all ${
                  transitionMode === 'crossfade'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-900/40 font-bold'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Crossfade
              </button>

              <button
                onClick={() => onSetTransitionMode('gapless')}
                className={`py-2 px-1 rounded-lg text-center transition-all ${
                  transitionMode === 'gapless'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-900/40 font-bold'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Gapless
              </button>
            </div>

            <div className="text-[11px] text-gray-400">
              {transitionMode === 'automix' && (
                <span>
                  🎧 <strong>DJ Bass Swap</strong>: Incoming track starts with high-passed vocals/melody; sweeps full sub-bass in at 50% midpoint while outgoing bass dissolves.
                </span>
              )}
              {transitionMode === 'crossfade' && (
                <span>
                  🎚️ <strong>Equal-Power Crossfade</strong>: Smooth acoustic power blend without filter sweeps.
                </span>
              )}
              {transitionMode === 'gapless' && (
                <span>
                  ⏹️ <strong>Gapless</strong>: Track finishes and immediately begins the next song.
                </span>
              )}
            </div>

            {/* Transition Duration Slider */}
            {transitionMode !== 'gapless' && (
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between text-xs font-mono text-gray-300">
                  <span>Transition Duration:</span>
                  <span className="font-bold text-cyan-400">{transitionDuration} seconds</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-mono text-gray-500">4s</span>
                  <input
                    type="range"
                    min="4"
                    max="16"
                    step="1"
                    value={transitionDuration}
                    onChange={(e) => onSetTransitionDuration(parseInt(e.target.value, 10))}
                    className="flex-1 accent-purple-500 h-1.5"
                  />
                  <span className="text-[10px] font-mono text-gray-500">16s</span>
                </div>
              </div>
            )}

            {/* ⚡ Instant Manual Trigger: Mix Next Track Now Button */}
            <button
              onClick={onMixNextTrackNow}
              disabled={isTransitioning || queue.length === 0}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-500 hover:from-purple-500 hover:to-cyan-400 disabled:opacity-40 text-white text-xs font-bold tracking-wide shadow-lg shadow-purple-900/30 flex items-center justify-center space-x-2 transition-all active:scale-[0.98]"
            >
              <Zap className="w-4 h-4 text-amber-300 fill-current animate-pulse" />
              <span>
                {isTransitioning
                  ? 'AutoMixing in Progress...'
                  : queue.length === 0
                  ? 'Add Songs to Queue to Mix'
                  : '⚡ Mix Next Track Now'}
              </span>
            </button>
          </div>

          {/* UP NEXT QUEUE LIST HEADER */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-white tracking-wide">
                Up Next ({queue.length})
              </span>
              <span className="text-[10px] font-mono text-studio-muted">
                • Auto-mixes on outro
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <input
                ref={multiFileInputRef}
                type="file"
                multiple
                accept="audio/*,.mp3,.wav,.flac,.m4a,.aac"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                onClick={() => multiFileInputRef.current?.click()}
                className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-cyan-300 font-semibold border border-white/5 transition-all"
                title="Add multiple audio files to queue"
              >
                <Upload className="w-3 h-3" />
                <span>+ Add Files</span>
              </button>

              {queue.length > 0 && (
                <button
                  onClick={onClearQueue}
                  className="p-1 rounded-lg text-gray-500 hover:text-rose-400 hover:bg-white/5 transition-all"
                  title="Clear Queue"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* QUEUE ITEMS LIST */}
          <div className="flex-1 space-y-2 overflow-y-auto pr-1">
            {queue.length > 0 ? (
              queue.map((track, idx) => (
                <div
                  key={`${track.id}-${idx}`}
                  className="p-3 rounded-2xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 hover:border-purple-500/25 transition-all flex items-center justify-between gap-3 group"
                >
                  <div className="flex items-center space-x-3 min-w-0 pr-1">
                    <span className="font-mono text-xs font-bold text-gray-500 w-4 text-center">
                      {idx + 1}
                    </span>

                    <div className="w-8 h-8 rounded-xl bg-purple-950/40 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
                      <Music2 className="w-4 h-4" />
                    </div>

                    <div className="min-w-0">
                      <div className="text-xs font-bold text-white truncate max-w-[160px] sm:max-w-[200px]">
                        {track.title}
                      </div>
                      <div className="text-[10px] text-gray-400 truncate max-w-[160px] sm:max-w-[200px] flex items-center space-x-1.5">
                        <span>{track.artist || 'Local Audio'}</span>
                        {track.duration && (
                          <>
                            <span>•</span>
                            <span className="font-mono">{formatSecs(track.duration)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Badges & Reorder / Remove Controls */}
                  <div className="flex items-center space-x-1.5 shrink-0">
                    {/* Lyrics Status Badge */}
                    <span
                      className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-semibold border ${
                        track.lyricsTrack || track.lyricsStatus?.includes('Ready')
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20 animate-pulse'
                      }`}
                    >
                      {track.lyricsTrack ? 'Lyrics Ready' : track.lyricsStatus || 'Pending'}
                    </span>

                    {/* Reorder Buttons */}
                    <div className="flex flex-col">
                      <button
                        onClick={() => onMoveInQueue(idx, idx - 1)}
                        disabled={idx === 0}
                        className="p-0.5 text-gray-500 hover:text-white disabled:opacity-20 transition-all"
                        title="Move Up"
                      >
                        <ChevronUp className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => onMoveInQueue(idx, idx + 1)}
                        disabled={idx === queue.length - 1}
                        className="p-0.5 text-gray-500 hover:text-white disabled:opacity-20 transition-all"
                        title="Move Down"
                      >
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Remove Button */}
                    <button
                      onClick={() => onRemoveFromQueue(idx)}
                      className="p-1 rounded-lg text-gray-500 hover:text-rose-400 transition-all"
                      title="Remove from Queue"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-12 flex flex-col items-center justify-center text-center space-y-3 border-2 border-dashed border-white/5 rounded-2xl p-6">
                <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400">
                  <ListMusic className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xs font-bold text-gray-300">Queue is Empty</div>
                  <div className="text-[11px] text-gray-500 max-w-xs mt-1">
                    Drag and drop multiple audio files here or click below to build your seamless DJ mix.
                  </div>
                </div>
                <button
                  onClick={() => multiFileInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-semibold text-white shadow-md transition-all"
                >
                  Select Audio Files
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
