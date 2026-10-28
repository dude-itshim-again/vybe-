import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Keyboard,
  Play,
  Volume2,
  Compass,
  Sparkles,
} from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  keys: string[];
  action: string;
  badge?: string;
}

interface ShortcutCategory {
  title: string;
  icon: React.ReactNode;
  shortcuts: ShortcutItem[];
}

const SHORTCUT_CATEGORIES: ShortcutCategory[] = [
  {
    title: 'Playback & Seeking',
    icon: <Play className="w-4 h-4 text-[#E86538]" />,
    shortcuts: [
      { keys: ['Space', 'K'], action: 'Toggle Play / Pause' },
      { keys: ['←', '→'], action: 'Seek backward / forward 5s' },
      { keys: ['Shift + ← / →'], action: 'Seek backward / forward 10s' },
      { keys: ['J'], action: 'Seek backward 10s' },
      { keys: ['Home'], action: 'Seek to track start (0:00)' },
      { keys: ['0 – 9'], action: 'Jump to 0% – 90% of track', badge: 'YouTube' },
      { keys: ['N', 'Shift + N'], action: 'Skip to Next track' },
      { keys: ['P', 'Shift + P'], action: 'Previous track / Restart' },
    ],
  },
  {
    title: 'Volume & Audio DSP',
    icon: <Volume2 className="w-4 h-4 text-cyan-400" />,
    shortcuts: [
      { keys: ['↑', '↓'], action: 'Volume up / down by 5%' },
      { keys: ['Shift + ↑ / ↓'], action: 'Jump volume to 100% or 10%' },
      { keys: ['M'], action: 'Toggle Mute / Unmute' },
      { keys: ['S'], action: 'Toggle Shuffle Mode' },
      { keys: ['R'], action: 'Cycle Repeat (Off → All → One)' },
      { keys: ['X'], action: 'Trigger AutoMix DJ Crossfade', badge: 'AutoMix' },
      { keys: ['V'], action: 'Toggle Vocal Cut (Karaoke -85%)', badge: 'DSP' },
    ],
  },
  {
    title: 'Navigation & Search',
    icon: <Compass className="w-4 h-4 text-purple-400" />,
    shortcuts: [
      { keys: ['⌘K', 'Ctrl+K', '/'], action: 'Focus Unified Search Bar' },
      { keys: ['F', 'L'], action: 'Toggle Fullscreen Lyrics Stage' },
      { keys: ['Q'], action: 'Toggle Studio & Queue Drawer' },
      { keys: ['H'], action: 'Favorite / Like playing track' },
      { keys: ['C'], action: 'Create New Custom Playlist' },
      { keys: ['?'], action: 'Open Shortcuts Cheat Sheet' },
      { keys: ['Esc'], action: 'Close any modal, drawer, or stage' },
    ],
  },
  {
    title: 'Hardware & Media Keys',
    icon: <Sparkles className="w-4 h-4 text-emerald-400" />,
    shortcuts: [
      { keys: ['MediaPlayPause'], action: 'OS / Bluetooth Play & Pause' },
      { keys: ['MediaTrackNext'], action: 'Headphone / Keyboard Next Track' },
      { keys: ['MediaTrackPrevious'], action: 'Headphone / Keyboard Prev Track' },
      { keys: ['Notification Player'], action: 'Lock-screen metadata & scrub sync' },
    ],
  },
];

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Apple Liquid Glass Backdrop Scrim */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/65 backdrop-blur-md"
        />

        {/* Modal Window: 2-Column Liquid Glass Modal */}
        <motion.div
          initial={{ scale: 0.94, opacity: 0, y: 16 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 12 }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          style={{
            backdropFilter: 'blur(40px) saturate(190%)',
            WebkitBackdropFilter: 'blur(40px) saturate(190%)',
            background: 'rgba(16, 18, 28, 0.90)',
            border: '1px solid rgba(255, 255, 255, 0.18)',
            borderRadius: '24px',
          }}
          className="relative w-full max-w-4xl p-6 sm:p-8 shadow-[0_24px_70px_rgba(0,0,0,0.7)] select-none text-white z-10 max-h-[88vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/10 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/[0.08] border border-white/15 flex items-center justify-center text-[#E86538] shadow-inner">
                <Keyboard className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white font-sans">
                    Pro Keyboard Shortcuts
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase bg-[#E86538]/20 text-[#E86538] border border-[#E86538]/30">
                    Pro Engine
                  </span>
                </div>
                <p className="text-xs text-white/50 font-sans mt-0.5">
                  Universal hotkeys for playback, audio DSP, and navigation
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 2-Column Categorized Shortcuts Grid */}
          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-5 overflow-y-auto custom-scrollbar pr-1 flex-1">
            {SHORTCUT_CATEGORIES.map((category) => (
              <div key={category.title} className="space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-white/70">
                  {category.icon}
                  <span>{category.title}</span>
                </div>

                <div className="flex flex-col gap-1.5 rounded-2xl bg-white/[0.03] border border-white/[0.08] p-2.5">
                  {category.shortcuts.map((shortcut, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-3 px-2.5 py-1.5 rounded-xl hover:bg-white/[0.05] transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs text-white/85 font-sans truncate">
                          {shortcut.action}
                        </span>
                        {shortcut.badge && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-white/10 text-white/60 border border-white/10 shrink-0">
                            {shortcut.badge}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {shortcut.keys.map((k, kIdx) => (
                          <React.Fragment key={kIdx}>
                            <kbd className="px-2 py-0.5 rounded-lg bg-white/[0.08] border border-white/15 text-[11px] font-mono text-white/90 shadow-sm min-w-[22px] text-center font-semibold">
                              {k}
                            </kbd>
                            {kIdx < shortcut.keys.length - 1 && (
                              <span className="text-[10px] text-white/30 font-mono">or</span>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footer Note */}
          <div className="pt-4 mt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-white/40 font-mono shrink-0">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#E86538]" />
              <span>Press <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white/80 border border-white/15 text-[10px]">?</kbd> anytime to toggle • Guaranteed input safety</span>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-full bg-white/10 hover:bg-white/15 text-white text-xs font-semibold border border-white/15 transition-all cursor-pointer"
            >
              Got it
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default KeyboardShortcutsModal;
