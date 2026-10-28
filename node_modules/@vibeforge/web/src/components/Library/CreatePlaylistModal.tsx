import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, FolderPlus, Music } from 'lucide-react';
import { userLibrary, VybePlaylist } from '../../services/userLibraryService';
import { TrackMetadata } from '../../providers/types';

interface CreatePlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (playlist: VybePlaylist) => void;
  initialTrack?: TrackMetadata | null;
}

export const CreatePlaylistModal: React.FC<CreatePlaylistModalProps> = ({
  isOpen,
  onClose,
  onCreated,
  initialTrack,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [mood, setMood] = useState('Deep Flow');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setDescription('');
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    const fullDesc = description.trim()
      ? `${description.trim()} • Mood: ${mood}`
      : `Mood: ${mood}`;

    const newPl = userLibrary.createPlaylist(trimmed, fullDesc);
    if (initialTrack) {
      userLibrary.addTrackToPlaylist(newPl.id, initialTrack);
    }
    onCreated(newPl);
    onClose();
  };

  const MOOD_PILLS = ['Late Night', 'Deep Flow', 'Workout', 'Chill', 'Melodic Focus', 'Rave'];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Apple Liquid Glass Backdrop Scrim */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 16 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.94, opacity: 0, y: 12 }}
          transition={{ type: 'spring', damping: 26, stiffness: 280 }}
          style={{
            backdropFilter: 'blur(40px)',
            background: 'rgba(16, 18, 28, 0.85)',
            border: '1px solid rgba(255, 255, 255, 0.18)',
            borderRadius: '24px',
          }}
          className="relative w-full max-w-md p-6 sm:p-7 shadow-[0_24px_70px_rgba(0,0,0,0.65)] select-none text-white z-10"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#E86538]/20 border border-[#E86538]/40 flex items-center justify-center text-[#E86538] shadow-[0_0_15px_rgba(232,101,56,0.3)]">
                <FolderPlus className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold tracking-tight text-white font-sans">
                  New Playlist
                </h2>
                <p className="text-xs text-white/45 font-sans">
                  Create a custom editorial collection
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            {initialTrack && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#E86538]/15 border border-[#E86538]/30 text-xs text-[#E86538]">
                <Music className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Will automatically add <strong>{initialTrack.title}</strong></span>
              </div>
            )}
            <div>
              <label className="block text-[11px] font-mono tracking-wider uppercase text-white/50 mb-1.5 font-semibold">
                Playlist Name
              </label>
              <input
                ref={inputRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Midnight Waves, Cyber Drive..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.06] border border-white/15 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#E86538]/70 focus:bg-white/[0.09] transition-all font-sans"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono tracking-wider uppercase text-white/50 mb-1.5 font-semibold">
                Description / Mood Tag
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional notes or vibes..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/[0.06] border border-white/15 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#E86538]/70 focus:bg-white/[0.09] transition-all font-sans"
              />
            </div>

            {/* Mood Pills */}
            <div>
              <span className="block text-[10px] font-mono tracking-wider uppercase text-white/40 mb-2">
                Quick Mood Presets
              </span>
              <div className="flex flex-wrap gap-1.5">
                {MOOD_PILLS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMood(m)}
                    className={`px-2.5 py-1 rounded-full text-xs font-mono transition-all border cursor-pointer ${
                      mood === m
                        ? 'bg-[#E86538]/25 text-[#E86538] border-[#E86538]/50 shadow-[0_0_12px_rgba(232,101,56,0.3)] font-semibold'
                        : 'bg-white/5 text-white/60 border-white/10 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-full text-xs font-semibold text-white/60 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={!name.trim()}
                className={`flex items-center gap-1.5 px-5 py-2 rounded-full text-xs font-bold transition-all cursor-pointer shadow-lg ${
                  name.trim()
                    ? 'bg-[#E86538] text-white hover:bg-[#F0774D] shadow-[0_0_20px_rgba(232,101,56,0.45)]'
                    : 'bg-white/10 text-white/30 cursor-not-allowed'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Create Playlist</span>
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
