import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap,
  ListMusic,
  Plus,
  Check,
  FolderPlus,
  Music,
} from 'lucide-react';
import { TrackMetadata } from '../../providers/types';
import { userLibrary, VybePlaylist } from '../../services/userLibraryService';

interface TrackActionPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  track: TrackMetadata | null;
  anchorRect: DOMRect | null;
  onPlayNext: (track: TrackMetadata) => void;
  onAddToQueue: (track: TrackMetadata) => void;
  onCreatePlaylistWithTrack: (track: TrackMetadata) => void;
  onShowToast: (text: string, icon?: React.ReactNode) => void;
}

export const TrackActionPopover: React.FC<TrackActionPopoverProps> = ({
  isOpen,
  onClose,
  track,
  anchorRect,
  onPlayNext,
  onAddToQueue,
  onCreatePlaylistWithTrack,
  onShowToast,
}) => {
  const popoverRef = useRef<HTMLDivElement | null>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', onClose, true);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', onClose, true);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !track || !anchorRect) return null;

  const playlists = userLibrary.getUserPlaylists();

  // Smart floating positioning (clamped within viewport)
  const popoverWidth = 240;
  const popoverHeight = 280;

  let left = anchorRect.right - popoverWidth;
  if (left < 16) left = 16;
  if (left + popoverWidth > window.innerWidth - 16) {
    left = window.innerWidth - popoverWidth - 16;
  }

  let top = anchorRect.bottom + 8;
  if (top + popoverHeight > window.innerHeight - 20) {
    top = Math.max(16, anchorRect.top - popoverHeight - 8);
  }

  const handlePlayNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    onPlayNext(track);
    onShowToast(`Playing '${track.title}' next in queue`, <Zap className="w-3.5 h-3.5 text-[#E86538]" />);
    onClose();
  };

  const handleAddToQueue = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAddToQueue(track);
    onShowToast(`Added '${track.title}' to Up Next`, <ListMusic className="w-3.5 h-3.5 text-cyan-400" />);
    onClose();
  };

  const handleAddTrackToPlaylist = (e: React.MouseEvent, pl: VybePlaylist) => {
    e.stopPropagation();
    const alreadyIn = pl.tracks.some((t) => t.id === track.id || t.title === track.title);
    if (!alreadyIn) {
      userLibrary.addTrackToPlaylist(pl.id, track);
      onShowToast(`Saved to '${pl.name}'`, <Check className="w-3.5 h-3.5 text-emerald-400" />);
    } else {
      onShowToast(`Already in '${pl.name}'`, <Check className="w-3.5 h-3.5 text-white/50" />);
    }
    onClose();
  };

  const handleCreateNewPlaylist = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCreatePlaylistWithTrack(track);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] pointer-events-auto">
        <motion.div
          ref={popoverRef}
          initial={{ opacity: 0, scale: 0.94, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: -4 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
          style={{
            position: 'fixed',
            top: `${top}px`,
            left: `${left}px`,
            width: `${popoverWidth}px`,
            backdropFilter: 'blur(36px) saturate(190%)',
            WebkitBackdropFilter: 'blur(36px) saturate(190%)',
            background: 'rgba(16, 18, 28, 0.90)',
            border: '1px solid rgba(255, 255, 255, 0.16)',
            borderRadius: '16px',
            boxShadow: '0 18px 45px rgba(0, 0, 0, 0.65)',
          }}
          className="p-1.5 flex flex-col gap-1 select-none text-white overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header Track Peek */}
          <div className="px-3 py-2 border-b border-white/[0.08] mb-0.5 flex items-center gap-2">
            <div className="w-7 h-7 rounded-md overflow-hidden bg-white/5 shrink-0 border border-white/10 flex items-center justify-center">
              {track.artworkUrl ? (
                <img src={track.artworkUrl} alt={track.title} className="w-full h-full object-cover" />
              ) : (
                <Music className="w-3.5 h-3.5 text-white/40" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-white truncate leading-tight">{track.title}</div>
              <div className="text-[10px] text-white/45 truncate">{track.artist || 'Unknown Artist'}</div>
            </div>
          </div>

          {/* 1. ⚡ Play Next in Queue */}
          <button
            onClick={handlePlayNext}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-xs font-medium text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer text-left group"
          >
            <Zap className="w-3.5 h-3.5 text-[#E86538] group-hover:scale-110 transition-transform" />
            <span>Play Next in Queue</span>
          </button>

          {/* 2. ➕ Add to Up Next Queue */}
          <button
            onClick={handleAddToQueue}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-xs font-medium text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer text-left group"
          >
            <ListMusic className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition-transform" />
            <span>Add to Up Next Queue</span>
          </button>

          {/* Divider line */}
          <div className="h-[1px] bg-white/[0.08] my-1 mx-1.5" />

          {/* 3. Add to Playlist Sub-list */}
          <div className="px-3 pt-1 pb-0.5 text-[9.5px] font-mono uppercase tracking-wider text-white/40 font-bold">
            Add to Playlist
          </div>

          <div className="max-h-36 overflow-y-auto custom-scrollbar flex flex-col gap-0.5 pr-0.5">
            {playlists.length > 0 ? (
              playlists.map((pl) => {
                const alreadyIn = pl.tracks.some((t) => t.id === track.id || t.title === track.title);
                return (
                  <button
                    key={pl.id}
                    onClick={(e) => handleAddTrackToPlaylist(e, pl)}
                    className="w-full flex items-center justify-between px-3 py-1.5 rounded-[8px] text-xs text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer text-left"
                  >
                    <span className="truncate">{pl.name}</span>
                    {alreadyIn && <Check className="w-3 h-3 text-emerald-400 shrink-0" />}
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-1 text-[11px] text-white/30 italic">
                No custom playlists
              </div>
            )}
          </div>

          {/* + Create New Playlist with Track */}
          <button
            onClick={handleCreateNewPlaylist}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-[10px] text-xs font-semibold text-[#E86538] hover:bg-[#E86538]/15 transition-colors cursor-pointer text-left mt-0.5 border-t border-white/[0.06]"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span className="truncate">New Playlist with Track</span>
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
