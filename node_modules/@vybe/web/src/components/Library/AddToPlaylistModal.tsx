import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Plus,
  Music,
  Check,
  ListPlus,
} from 'lucide-react';
import { EchoTrack } from '../../services/streamResolver';
import { TrackMetadata } from '../../providers/types';
import { userLibrary, VybePlaylist } from '../../services/userLibraryService';

interface AddToPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  track: EchoTrack | TrackMetadata | null;
}

export const AddToPlaylistModal: React.FC<AddToPlaylistModalProps> = ({
  isOpen,
  onClose,
  track,
}) => {
  const [newPlaylistName, setNewPlaylistName] = useState<string>('');
  const [justAddedId, setJustAddedId] = useState<string | null>(null);

  if (!isOpen || !track) return null;

  const playlists = userLibrary.getUserPlaylists();

  const handleCreateAndAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;

    const newPl = userLibrary.createPlaylist(newPlaylistName.trim());
    userLibrary.addTrackToPlaylist(newPl.id, track);
    setJustAddedId(newPl.id);
    setNewPlaylistName('');
    setTimeout(() => {
      onClose();
    }, 900);
  };

  const handleTogglePlaylist = (playlist: VybePlaylist) => {
    const alreadyIn = playlist.tracks.some((t) => t.id === track.id);
    if (alreadyIn) {
      userLibrary.removeTrackFromPlaylist(playlist.id, track.id);
    } else {
      userLibrary.addTrackToPlaylist(playlist.id, track);
      setJustAddedId(playlist.id);
      setTimeout(() => setJustAddedId(null), 1800);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop Scrim */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/75 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 15 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="relative w-full max-w-md rounded-3xl bg-[#0e0e13] border border-white/15 p-6 shadow-2xl z-10 flex flex-col gap-5 text-white"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <ListPlus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">Add to Playlist</h3>
                <p className="text-xs text-gray-400 font-mono">Curate your personal collection</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Target Track Preview */}
          <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-white/[0.04] border border-white/5">
            <div className="w-12 h-12 rounded-xl bg-purple-900/40 border border-white/10 flex items-center justify-center shrink-0 overflow-hidden">
              {track.artworkUrl ? (
                <img src={track.artworkUrl} alt={track.title} className="w-full h-full object-cover" />
              ) : (
                <Music className="w-6 h-6 text-purple-300" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-white truncate">{track.title}</div>
              <div className="text-xs text-gray-400 truncate">{track.artist || 'Unknown Artist'}</div>
            </div>
          </div>

          {/* Create New Playlist Input */}
          <form onSubmit={handleCreateAndAdd} className="flex gap-2">
            <input
              type="text"
              placeholder="Create new playlist..."
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50 transition-colors"
            />
            <button
              type="submit"
              disabled={!newPlaylistName.trim()}
              className="px-4 py-2.5 rounded-xl bg-[#ED5564] hover:bg-[#ED5564]/90 disabled:opacity-40 disabled:hover:bg-[#ED5564] text-white text-xs font-mono font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create</span>
            </button>
          </form>

          {/* User Playlists List */}
          <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto pr-1">
            <div className="text-[11px] font-mono uppercase tracking-wider text-gray-400 px-1 mb-1">
              Your Playlists ({playlists.length})
            </div>

            {playlists.length === 0 ? (
              <div className="py-6 text-center text-xs text-gray-500 font-mono">
                No custom playlists yet. Create one above!
              </div>
            ) : (
              playlists.map((pl) => {
                const alreadyIn = pl.tracks.some((t) => t.id === track.id);
                const isJustAdded = justAddedId === pl.id;

                return (
                  <button
                    key={pl.id}
                    onClick={() => handleTogglePlaylist(pl)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl transition-all cursor-pointer text-left border ${
                      alreadyIn || isJustAdded
                        ? 'bg-purple-600/15 border-purple-500/30 text-white'
                        : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.06] text-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-8 h-8 rounded-lg shrink-0 flex items-center justify-center text-white text-xs font-black shadow"
                        style={{ background: pl.coverGradient }}
                      >
                        <Music className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold truncate">{pl.name}</div>
                        <div className="text-[10px] text-gray-400 font-mono">
                          {pl.tracks.length} {pl.tracks.length === 1 ? 'song' : 'songs'}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 pl-2">
                      {alreadyIn || isJustAdded ? (
                        <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-white/5 border border-white/10 text-gray-400 flex items-center justify-center group-hover:border-white/30">
                          <Plus className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
