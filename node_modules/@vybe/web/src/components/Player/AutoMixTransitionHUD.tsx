import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AutoMixProgress } from '../../audio/AudioDSPEngine';
import { Disc3, ArrowRight } from 'lucide-react';

interface AutoMixTransitionHUDProps {
  progress: AutoMixProgress | null;
}

export const AutoMixTransitionHUD: React.FC<AutoMixTransitionHUDProps> = ({ progress }) => {
  if (!progress || !progress.isActive) return null;

  const pct = Math.round(progress.progress * 100);
  const isSwap = Boolean(progress.isBassSwapped || progress.progress >= 0.5);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -30, opacity: 0, scale: 0.92 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: -20, opacity: 0, scale: 0.95 }}
        transition={{ type: 'spring', damping: 24, stiffness: 300 }}
        className="fixed top-18 left-1/2 -translate-x-1/2 z-50 pointer-events-none select-none max-w-lg w-full px-4"
      >
        <div className="relative rounded-2xl bg-[#0c0c10]/90 backdrop-blur-md border border-purple-500/30 p-3 sm:px-4 sm:py-3 shadow-2xl shadow-purple-950/60 overflow-hidden">
          {/* Dynamic Audio-Reactive Background Glow */}
          <div
            className="absolute inset-0 pointer-events-none opacity-25"
            style={{
              background:
                'radial-gradient(ellipse at 50% 50%, rgba(168, 85, 247, 0.45) 0%, transparent 70%)',
            }}
          />

          {/* Top Row: Deck A -> Deck B + Badges + Live Percent */}
          <div className="relative z-10 flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center space-x-2">
              {/* Spinning DJ Vinyl Indicator */}
              <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-purple-600 to-cyan-500 flex items-center justify-center text-white shadow-md">
                <Disc3 className="w-3.5 h-3.5 animate-spin" />
              </div>

              {/* Deck Handover Label */}
              <div className="flex items-center space-x-1.5 font-mono text-[11px] font-bold">
                <span className="text-purple-300 bg-purple-500/20 px-1.5 py-0.2 rounded border border-purple-500/30">
                  DECK {progress.outgoingDeckId}
                </span>
                <ArrowRight className="w-3 h-3 text-cyan-400" />
                <span className="text-cyan-300 bg-cyan-500/20 px-1.5 py-0.2 rounded border border-cyan-500/30">
                  DECK {progress.incomingDeckId}
                </span>
              </div>

              <span className="text-gray-500 text-xs">•</span>

              {/* Status Badge */}
              <span
                className={`px-2 py-0.2 rounded-full text-[10px] font-mono tracking-wider font-semibold border transition-all ${
                  isSwap
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-[0_0_10px_#10b981]'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                }`}
              >
                {isSwap ? 'BASS SWAPPED (FULL SUB)' : 'BASS SWAP @ 50%'}
              </span>
            </div>

            {/* Live Percentage */}
            <div className="font-mono text-xs font-black text-cyan-300 bg-white/5 px-2 py-0.5 rounded-lg border border-white/10">
              {pct}%
            </div>
          </div>

          {/* Dual Miniature Bars for Volume and Bass Frequencies */}
          <div className="relative z-10 grid grid-cols-2 gap-3 text-[10px] font-mono">
            {/* Outgoing Deck Level & Filter */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-gray-400">
                <span className="truncate max-w-[120px]">
                  {progress.outgoingTrack?.title || `Deck ${progress.outgoingDeckId}`}
                </span>
                <span className="text-purple-300">
                  {Math.round(progress.outgoingVolume * 100)}%
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-purple-500 to-rose-400 transition-all duration-75"
                  style={{ width: `${Math.round(progress.outgoingVolume * 100)}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[9px] text-gray-500">
                <span>HP: {Math.round(progress.outgoingHighPass ?? 20)}Hz</span>
                <span>LP: {Math.round(progress.outgoingLowPass ?? 20000)}Hz</span>
              </div>
            </div>

            {/* Incoming Deck Level & Filter */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-gray-400">
                <span className="truncate max-w-[120px]">
                  {progress.incomingTrack?.title || `Deck ${progress.incomingDeckId}`}
                </span>
                <span className="text-cyan-300">
                  {Math.round(progress.incomingVolume * 100)}%
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all duration-75"
                  style={{ width: `${Math.round(progress.incomingVolume * 100)}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[9px] text-gray-500">
                <span>HP: {Math.round(progress.incomingHighPass ?? 20)}Hz</span>
                <span>LP: {Math.round(progress.incomingLowPass ?? 20000)}Hz</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
