import React, { useState, useEffect } from 'react';
import {
  Heart,
  Plus,
  ArrowDownToLine,
  Check,
  Download,
  Trash2,
  HardDriveDownload,
} from 'lucide-react';
import { EchoTrack } from '../../services/streamResolver';
import { TrackMetadata } from '../../providers/types';
import { offlineVault } from '../../services/offlineVault';
import { userLibrary } from '../../services/userLibraryService';

interface TrackActionButtonsProps {
  track: EchoTrack | TrackMetadata;
  onOpenAddToPlaylist?: (track: EchoTrack | TrackMetadata, anchorRect?: DOMRect) => void;
  onToggleLike?: (track: EchoTrack | TrackMetadata, isLiked: boolean) => void;
  className?: string;
  size?: 'sm' | 'md';
}

export const TrackActionButtons: React.FC<TrackActionButtonsProps> = ({
  track,
  onOpenAddToPlaylist,
  onToggleLike,
  className = '',
  size = 'md',
}) => {
  const [isLiked, setIsLiked] = useState<boolean>(() => userLibrary.isLiked(track.id));
  const [isDownloaded, setIsDownloaded] = useState<boolean>(() =>
    offlineVault.isDownloadedSync(track.id)
  );
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [showDownloadMenu, setShowDownloadMenu] = useState<boolean>(false);

  // Sync liked state
  useEffect(() => {
    setIsLiked(userLibrary.isLiked(track.id));
    const unsubscribe = userLibrary.subscribe(() => {
      setIsLiked(userLibrary.isLiked(track.id));
    });
    return unsubscribe;
  }, [track.id]);

  // Sync downloaded state & listen to progress
  useEffect(() => {
    let isMounted = true;

    offlineVault.isTrackDownloaded(track.id).then((dl) => {
      if (isMounted) setIsDownloaded(dl);
    });

    const unsubscribeVault = offlineVault.subscribe(() => {
      if (isMounted) {
        setIsDownloaded(offlineVault.isDownloadedSync(track.id));
      }
    });

    const unsubscribeProgress = offlineVault.subscribeToProgress(track.id, (pct) => {
      if (!isMounted) return;
      if (pct >= 100) {
        setDownloadProgress(null);
        setIsDownloaded(true);
      } else {
        setDownloadProgress(pct);
      }
    });

    return () => {
      isMounted = false;
      unsubscribeVault();
      unsubscribeProgress();
    };
  }, [track.id]);

  const handleToggleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = userLibrary.toggleLike(track);
    setIsLiked(next);
    onToggleLike?.(track, next);
  };

  const handleOpenAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    onOpenAddToPlaylist?.(track, rect);
  };

  const handleDownloadClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDownloaded) {
      setShowDownloadMenu(!showDownloadMenu);
      return;
    }

    try {
      setDownloadProgress(1);
      await offlineVault.downloadTrackForOffline(track, (pct) => {
        setDownloadProgress(pct);
      });
      setIsDownloaded(true);
      setDownloadProgress(null);
    } catch (err) {
      console.error('[TrackActions] Download error:', err);
      setDownloadProgress(null);
    }
  };

  const handleSaveToDisk = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDownloadMenu(false);
    try {
      await offlineVault.saveTrackToDeviceDisk(track.id);
    } catch (err) {
      console.warn('Export to disk error:', err);
    }
  };

  const handleRemoveDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDownloadMenu(false);
    await offlineVault.removeOfflineTrack(track.id);
    setIsDownloaded(false);
  };

  const iconSizeClass = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';
  const buttonPadding = size === 'sm' ? 'p-1' : 'p-1.5';

  return (
    <div className={`relative flex items-center gap-1.5 shrink-0 ${className}`}>
      {/* 1. ❤️ Liked Songs Heart Toggle */}
      <button
        onClick={handleToggleLike}
        className={`${buttonPadding} rounded-lg transition-all cursor-pointer ${
          isLiked
            ? 'text-[#ED5564] hover:text-[#f43f5e]'
            : 'text-gray-400 hover:text-white hover:bg-white/10'
        }`}
        title={isLiked ? 'Remove from Liked Songs' : 'Save to Liked Songs'}
      >
        <Heart
          className={`${iconSizeClass} ${isLiked ? 'fill-current' : ''} transition-transform active:scale-125`}
        />
      </button>

      {/* 2. ➕ Add to Playlist Trigger */}
      {onOpenAddToPlaylist && (
        <button
          onClick={handleOpenAdd}
          className={`${buttonPadding} rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer`}
          title="Add to Playlist"
        >
          <Plus className={iconSizeClass} />
        </button>
      )}

      {/* 3. ⬇️ Offline Download Indicator & Menu */}
      <div className="relative">
        <button
          onClick={handleDownloadClick}
          className={`${buttonPadding} rounded-full transition-all cursor-pointer flex items-center justify-center ${
            isDownloaded
              ? 'bg-[#1DB954]/20 text-[#1DB954] hover:bg-[#1DB954]/30'
              : downloadProgress !== null
              ? 'text-cyan-400'
              : 'text-gray-400 hover:text-white hover:bg-white/10'
          }`}
          title={
            isDownloaded
              ? 'Saved on device (Offline + Lyrics ready)'
              : downloadProgress !== null
              ? `Downloading: ${downloadProgress}%`
              : 'Download for offline playback'
          }
        >
          {downloadProgress !== null ? (
            /* Animated Radial Progress Ring */
            <div className="relative w-4 h-4 flex items-center justify-center">
              <svg className="w-4 h-4 -rotate-90" viewBox="0 0 24 24">
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="3"
                  className="text-white/20"
                  fill="none"
                />
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="3"
                  className="text-cyan-400 transition-all duration-150"
                  fill="none"
                  strokeDasharray={62.8}
                  strokeDashoffset={62.8 - (62.8 * (downloadProgress || 5)) / 100}
                />
              </svg>
              <span className="absolute text-[7px] font-mono font-bold text-cyan-300">
                {downloadProgress}%
              </span>
            </div>
          ) : isDownloaded ? (
            /* Solid Spotify Green Downloaded Badge (#1DB954) */
            <div className="w-4 h-4 rounded-full bg-[#1DB954] flex items-center justify-center text-black shadow-sm shadow-[#1DB954]/40">
              <ArrowDownToLine className="w-2.5 h-2.5 stroke-[2.5]" />
            </div>
          ) : (
            /* Subtle downward arrow */
            <Download className={iconSizeClass} />
          )}
        </button>

        {/* Downloaded Song Action Popover Menu */}
        {showDownloadMenu && isDownloaded && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute right-0 top-full mt-1.5 w-48 rounded-xl bg-[#121216] border border-white/15 shadow-2xl p-1 z-50 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wider text-[#1DB954] flex items-center gap-1.5 border-b border-white/10 mb-1">
              <Check className="w-3 h-3 stroke-[3]" />
              <span>Offline Ready</span>
            </div>

            <button
              onClick={handleSaveToDisk}
              className="w-full flex items-center gap-2 px-2.5 py-2 text-xs text-gray-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors text-left cursor-pointer"
            >
              <HardDriveDownload className="w-3.5 h-3.5 text-cyan-400" />
              <span>Export to Disk (.m4a)</span>
            </button>

            <button
              onClick={handleRemoveDownload}
              className="w-full flex items-center gap-2 px-2.5 py-2 text-xs text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors text-left cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Remove from Device</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
