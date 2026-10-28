import React, { useState, useEffect } from 'react';
import {
  Library,
  Plus,
  Heart,
  Download,
  Pin,
  Check,
  Folder,
  WifiOff,
  Zap,
} from 'lucide-react';
import {
  userLibrary,
  VybePlaylist,
  LIKED_SONGS_PLAYLIST_ID,
  DOWNLOADED_SONGS_PLAYLIST_ID,
} from '../../services/userLibraryService';
import { offlineVault, StorageStats } from '../../services/offlineVault';
import { MosaicArtwork } from './MosaicArtwork';

interface SidebarLibraryProps {
  activePlaylistId: string | null;
  onSelectPlaylist: (playlistId: string) => void;
  onCreatePlaylistRequest?: () => void;
  onUploadLocalFiles?: () => void;
  className?: string;
}

type LibraryFilter = 'all' | 'playlists' | 'downloaded' | 'local';

export const SidebarLibrary: React.FC<SidebarLibraryProps> = ({
  activePlaylistId,
  onSelectPlaylist,
  onCreatePlaylistRequest,
  onUploadLocalFiles,
  className = '',
}) => {
  const [filter, setFilter] = useState<LibraryFilter>('all');
  const [playlists, setPlaylists] = useState<VybePlaylist[]>(() =>
    userLibrary.getUserPlaylists()
  );
  const [likedCount, setLikedCount] = useState<number>(() => userLibrary.getLikedTracks().length);
  const [offlineStats, setOfflineStats] = useState<StorageStats>({
    count: 0,
    totalBytes: 0,
    totalMB: '0.0',
  });
  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(() =>
    userLibrary.getOfflineMode()
  );
  const [downloadedStatusMap, setDownloadedStatusMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const update = () => {
      setPlaylists(userLibrary.getUserPlaylists());
      setLikedCount(userLibrary.getLikedTracks().length);
      setIsOfflineMode(userLibrary.getOfflineMode());
    };

    update();
    const unsubUser = userLibrary.subscribe(update);

    const updateVault = () => {
      offlineVault.getStorageStats().then(setOfflineStats);
    };
    updateVault();
    const unsubVault = offlineVault.subscribe(updateVault);

    return () => {
      unsubUser();
      unsubVault();
    };
  }, []);

  // Compute if all tracks in custom playlists are downloaded
  useEffect(() => {
    let isMounted = true;
    (async () => {
      const status: Record<string, boolean> = {};
      for (const pl of playlists) {
        if (pl.tracks.length > 0) {
          const allDl = pl.tracks.every((t) => offlineVault.isDownloadedSync(t.id));
          status[pl.id] = allDl;
        } else {
          status[pl.id] = false;
        }
      }
      if (isMounted) setDownloadedStatusMap(status);
    })();
    return () => {
      isMounted = false;
    };
  }, [playlists, offlineStats.count]);

  const handleToggleOfflineMode = () => {
    const next = userLibrary.toggleOfflineMode();
    setIsOfflineMode(next);
  };

  const handleCreatePlaylist = () => {
    if (onCreatePlaylistRequest) {
      onCreatePlaylistRequest();
      return;
    }
    const name = window.prompt('Enter new playlist name:');
    if (name && name.trim()) {
      const pl = userLibrary.createPlaylist(name.trim());
      onSelectPlaylist(pl.id);
    }
  };

  // Filter items
  const showLiked = filter === 'all' || filter === 'playlists';
  const showDownloaded = filter === 'all' || filter === 'downloaded';
  const showCustomPlaylists =
    filter === 'all' ||
    filter === 'playlists' ||
    (filter === 'downloaded' && playlists.some((p) => downloadedStatusMap[p.id]));

  return (
    <aside
      className={`flex flex-col h-full bg-[#09090d]/95 border-r border-white/10 backdrop-blur-xl p-3 sm:p-4 gap-3.5 select-none ${className}`}
    >
      {/* Header: Title + Create Playlist button */}
      <div className="flex items-center justify-between px-1.5 pt-1">
        <div className="flex items-center gap-2.5 text-gray-300 hover:text-white transition-colors cursor-default">
          <Library className="w-5 h-5 text-gray-400" />
          <span className="font-mono font-bold text-sm tracking-wide text-white uppercase">
            Your Library
          </span>
        </div>

        <button
          onClick={handleCreatePlaylist}
          className="p-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-gray-300 hover:text-white border border-white/10 transition-all cursor-pointer shadow-sm active:scale-95"
          title="Create Playlist"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Spotify Filter Pills Row */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
        {(['all', 'playlists', 'downloaded', 'local'] as LibraryFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-full text-xs font-mono font-semibold capitalize shrink-0 transition-all cursor-pointer ${
              filter === f
                ? 'bg-white text-black font-bold shadow-md'
                : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'
            }`}
          >
            {f === 'local' ? 'Local Files' : f}
          </button>
        ))}
      </div>

      {/* Sleek Offline Mode Toggle Switcher */}
      <div className="px-1">
        <button
          onClick={handleToggleOfflineMode}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-2xl border text-xs font-mono font-bold transition-all cursor-pointer ${
            isOfflineMode
              ? 'bg-[#1DB954]/15 border-[#1DB954]/40 text-[#1DB954] shadow-[0_0_15px_rgba(29,185,84,0.2)]'
              : 'bg-white/[0.03] border-white/10 text-gray-400 hover:text-white hover:bg-white/[0.06]'
          }`}
          title="Toggle strict offline mode to play solely from local device disk"
        >
          <div className="flex items-center gap-2">
            {isOfflineMode ? (
              <Zap className="w-3.5 h-3.5 text-[#1DB954] fill-current animate-pulse" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-gray-500" />
            )}
            <span>Offline Mode: {isOfflineMode ? 'ON' : 'OFF'}</span>
          </div>

          <div
            className={`w-8 h-4 rounded-full p-0.5 transition-colors ${
              isOfflineMode ? 'bg-[#1DB954]' : 'bg-white/20'
            }`}
          >
            <div
              className={`w-3 h-3 rounded-full bg-white transition-transform ${
                isOfflineMode ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </div>
        </button>
      </div>

      {/* Library Collections List */}
      <div className="flex-1 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
        {/* PINNED ROW 1: Liked Songs */}
        {showLiked && (
          <button
            onClick={() => onSelectPlaylist(LIKED_SONGS_PLAYLIST_ID)}
            className={`w-full flex items-center gap-3 p-2.5 rounded-2xl transition-all cursor-pointer text-left border ${
              activePlaylistId === LIKED_SONGS_PLAYLIST_ID
                ? 'bg-purple-950/40 border-purple-500/40 shadow-lg text-white'
                : 'bg-transparent border-transparent hover:bg-white/[0.04] text-gray-300'
            }`}
          >
            <div className="relative w-11 h-11 rounded-xl bg-gradient-to-tr from-[#450af5] via-[#8E2DE2] to-[#FF416C] flex items-center justify-center shrink-0 shadow-md">
              <Heart className="w-5 h-5 text-white fill-current drop-shadow" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs sm:text-sm font-bold text-white truncate">
                  Liked Songs
                </span>
                <Pin className="w-3 h-3 text-cyan-400 rotate-45 shrink-0" />
              </div>
              <div className="text-[11px] text-gray-400 font-mono mt-0.5">
                Playlist • {likedCount} {likedCount === 1 ? 'song' : 'songs'}
              </div>
            </div>
          </button>
        )}

        {/* PINNED ROW 2: Downloaded Music */}
        {showDownloaded && (
          <button
            onClick={() => onSelectPlaylist(DOWNLOADED_SONGS_PLAYLIST_ID)}
            className={`w-full flex items-center gap-3 p-2.5 rounded-2xl transition-all cursor-pointer text-left border ${
              activePlaylistId === DOWNLOADED_SONGS_PLAYLIST_ID
                ? 'bg-emerald-950/40 border-emerald-500/40 shadow-lg text-white'
                : 'bg-transparent border-transparent hover:bg-white/[0.04] text-gray-300'
            }`}
          >
            <div className="relative w-11 h-11 rounded-xl bg-gradient-to-tr from-[#065f46] via-[#059669] to-[#10b981] flex items-center justify-center shrink-0 shadow-md">
              <Download className="w-5 h-5 text-white stroke-[2.5] drop-shadow" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs sm:text-sm font-bold text-white truncate">
                  Downloaded Music
                </span>
                <Pin className="w-3 h-3 text-[#1DB954] rotate-45 shrink-0" />
              </div>
              <div className="text-[11px] text-gray-400 font-mono mt-0.5 flex items-center gap-1.5">
                <span>
                  {offlineStats.count} {offlineStats.count === 1 ? 'song' : 'songs'}
                </span>
                <span>•</span>
                <span className="text-emerald-400 font-bold">{offlineStats.totalMB} MB</span>
              </div>
            </div>
          </button>
        )}

        {/* LOCAL FILES (If Filtered) */}
        {filter === 'local' && (
          <button
            onClick={onUploadLocalFiles}
            className="w-full flex items-center gap-3 p-2.5 rounded-2xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 transition-all cursor-pointer text-left"
          >
            <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center shrink-0 text-cyan-400">
              <Folder className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-white truncate">+ Upload Local Files</div>
              <div className="text-[11px] text-gray-400 font-mono mt-0.5">MP3, FLAC, WAV, M4A</div>
            </div>
          </button>
        )}

        {/* CUSTOM USER PLAYLISTS */}
        {showCustomPlaylists &&
          playlists.map((pl) => {
            const isActive = activePlaylistId === pl.id;
            const isAllDownloaded = downloadedStatusMap[pl.id];

            return (
              <button
                key={pl.id}
                onClick={() => onSelectPlaylist(pl.id)}
                className={`w-full flex items-center gap-3 p-2.5 rounded-2xl transition-all cursor-pointer text-left border ${
                  isActive
                    ? 'bg-purple-900/30 border-purple-500/40 shadow-lg text-white'
                    : 'bg-transparent border-transparent hover:bg-white/[0.04] text-gray-300'
                }`}
              >
                {/* 2x2 Mosaic / Cover Art */}
                <MosaicArtwork
                  tracks={pl.tracks}
                  coverGradient={pl.coverGradient}
                  size={44}
                  className="rounded-xl shrink-0"
                />

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs sm:text-sm font-semibold text-white truncate">
                      {pl.name}
                    </span>
                    {isAllDownloaded && (
                      <div
                        className="w-3.5 h-3.5 rounded-full bg-[#1DB954] flex items-center justify-center text-black shrink-0"
                        title="All songs in this playlist are saved offline"
                      >
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </div>
                    )}
                  </div>

                  <div className="text-[11px] text-gray-400 font-mono mt-0.5">
                    Playlist • {pl.tracks.length} {pl.tracks.length === 1 ? 'song' : 'songs'}
                  </div>
                </div>
              </button>
            );
          })}
      </div>
    </aside>
  );
};
