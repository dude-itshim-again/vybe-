import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  Shuffle,
  Check,
  Music,
  Trash2,
  Clock,
  ArrowDownToLine,
  Disc,
  Heart,
  X,
  Compass,
} from 'lucide-react';
import { EchoTrack } from '../../services/streamResolver';
import { TrackMetadata } from '../../providers/types';
import {
  userLibrary,
  VybePlaylist,
  LIKED_SONGS_PLAYLIST_ID,
  DOWNLOADED_SONGS_PLAYLIST_ID,
} from '../../services/userLibraryService';
import { offlineVault } from '../../services/offlineVault';
import { TrackActionButtons } from './TrackActionButtons';

interface PlaylistHeroViewProps {
  playlistId: string;
  onPlayTrack: (track: TrackMetadata) => void;
  onPlayAll: (tracks: TrackMetadata[], startWithShuffle?: boolean) => void;
  onOpenAddToPlaylist: (track: EchoTrack | TrackMetadata, anchorRect?: DOMRect) => void;
  onToggleLike?: (track: EchoTrack | TrackMetadata, isLiked: boolean) => void;
  onDeletePlaylist?: (playlistId: string) => void;
  onNavigateTab?: (tab: string) => void;
  currentTrackId?: string;
  isPlaying?: boolean;
}

export const PlaylistHeroView: React.FC<PlaylistHeroViewProps> = ({
  playlistId,
  onPlayTrack,
  onPlayAll,
  onOpenAddToPlaylist,
  onToggleLike,
  onDeletePlaylist,
  onNavigateTab,
  currentTrackId,
  isPlaying = false,
}) => {
  const [playlist, setPlaylist] = useState<VybePlaylist | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isDownloadingAll, setIsDownloadingAll] = useState<boolean>(false);
  const [downloadAllProgress, setDownloadAllProgress] = useState<{ current: number; total: number }>({
    current: 0,
    total: 0,
  });
  const [isAllDownloaded, setIsAllDownloaded] = useState<boolean>(false);

  const currentUser = userLibrary.getCurrentUser();

  const loadPlaylist = async () => {
    setIsLoading(true);
    const pl = await userLibrary.getPlaylistById(playlistId);
    setPlaylist(pl);
    if (pl && pl.tracks.length > 0) {
      const allDl = pl.tracks.every((t) => offlineVault.isDownloadedSync(t.id));
      setIsAllDownloaded(allDl);
    } else {
      setIsAllDownloaded(false);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadPlaylist();

    const unsubUser = userLibrary.subscribe(() => {
      loadPlaylist();
    });

    const unsubVault = offlineVault.subscribe(() => {
      if (playlist && playlist.tracks.length > 0) {
        const allDl = playlist.tracks.every((t) => offlineVault.isDownloadedSync(t.id));
        setIsAllDownloaded(allDl);
      }
    });

    return () => {
      unsubUser();
      unsubVault();
    };
  }, [playlistId]);

  if (isLoading || !playlist) {
    return (
      <div className="flex flex-col items-center justify-center py-28 space-y-4">
        <Disc className="w-10 h-10 text-[#E86538] animate-spin" />
        <p className="text-xs font-mono text-white/50 tracking-wider uppercase">Loading collection...</p>
      </div>
    );
  }

  const isLikedCollection = playlist.id === LIKED_SONGS_PLAYLIST_ID;
  const isDownloadedCollection = playlist.id === DOWNLOADED_SONGS_PLAYLIST_ID;
  const isCustom = !isLikedCollection && !isDownloadedCollection;

  // Calculate total playlist duration
  const totalSeconds = playlist.tracks.reduce((acc, t) => acc + (t.duration || 0), 0);
  const totalHours = Math.floor(totalSeconds / 3600);
  const totalMinutes = Math.floor((totalSeconds % 3600) / 60);
  const durationString =
    totalHours > 0
      ? `${totalHours} hr ${totalMinutes} min`
      : `${totalMinutes} min ${Math.floor(totalSeconds % 60)} sec`;

  const formatTrackDuration = (secs?: number) => {
    if (!secs || isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Play Entire Playlist
  const handlePlayEntirePlaylist = () => {
    if (playlist.tracks.length === 0) return;
    onPlayAll(playlist.tracks, false);
  };

  // Shuffle Entire Playlist
  const handleShufflePlaylist = () => {
    if (playlist.tracks.length === 0) return;
    onPlayAll(playlist.tracks, true);
  };

  // Sequentially Download Entire Playlist
  const handleDownloadEntirePlaylist = async () => {
    if (playlist.tracks.length === 0 || isDownloadingAll) return;

    setIsDownloadingAll(true);
    const total = playlist.tracks.length;
    setDownloadAllProgress({ current: 0, total });

    for (let i = 0; i < total; i++) {
      const track = playlist.tracks[i];
      setDownloadAllProgress({ current: i + 1, total });
      try {
        await offlineVault.downloadTrackForOffline(track);
      } catch (e) {
        console.warn(`[PlaylistDownload] Failed track ${track.title}:`, e);
      }
    }

    setIsDownloadingAll(false);
    setIsAllDownloaded(true);
  };

  const handleDeletePlaylist = () => {
    if (window.confirm(`Delete playlist "${playlist.name}"?`)) {
      userLibrary.deletePlaylist(playlist.id);
      onDeletePlaylist?.(playlist.id);
    }
  };

  const handleRemoveTrack = (trackId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    userLibrary.removeTrackFromPlaylist(playlist.id, trackId);
  };

  const isCurrentPlaylistPlaying =
    isPlaying && playlist.tracks.some((t) => t.id === currentTrackId);

  // Extract up to 4 distinct artworks for the dynamic 2x2 mosaic
  const distinctArtworks: string[] = [];
  for (const t of playlist.tracks) {
    if (t.artworkUrl && !distinctArtworks.includes(t.artworkUrl)) {
      distinctArtworks.push(t.artworkUrl);
      if (distinctArtworks.length === 4) break;
    }
  }

  return (
    <div className="space-y-7 pb-24 text-white">
      {/* =========================================================================
          1. COLLECTION HEADER CARD IN APPLE LIQUID GLASS
          ========================================================================= */}
      <section
        style={{
          backdropFilter: 'blur(40px) saturate(180%)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
          background: 'rgba(16, 18, 28, 0.70)',
          border: '1px solid rgba(255, 255, 255, 0.14)',
          borderRadius: '28px',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.55)',
        }}
        className="relative p-6 sm:p-8 overflow-hidden flex flex-col md:flex-row items-center md:items-end gap-6 sm:gap-8"
      >
        {/* Dynamic 2x2 Mosaic Cover Art Grid (176x176px) */}
        <div className="shrink-0 drop-shadow-[0_20px_35px_rgba(0,0,0,0.65)]">
          {distinctArtworks.length >= 4 ? (
            /* 2x2 Mosaic Grid */
            <div className="w-44 h-44 rounded-2xl overflow-hidden grid grid-cols-2 grid-rows-2 border border-white/20 shadow-2xl">
              {distinctArtworks.slice(0, 4).map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt="Mosaic slice"
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ))}
            </div>
          ) : isLikedCollection ? (
            /* Favorites Pinned Gradient Icon */
            <div className="w-44 h-44 rounded-2xl flex items-center justify-center border border-white/20 shadow-2xl bg-gradient-to-br from-[#E86538] via-[#FF3366] to-[#8E2DE2]">
              <Heart className="w-16 h-16 text-white fill-current drop-shadow-lg" />
            </div>
          ) : isDownloadedCollection ? (
            /* Offline Vault Pinned Gradient Icon */
            <div className="w-44 h-44 rounded-2xl flex items-center justify-center border border-white/20 shadow-2xl bg-gradient-to-br from-[#065f46] via-[#059669] to-[#10b981]">
              <ArrowDownToLine className="w-16 h-16 text-white stroke-[2.5] drop-shadow-lg" />
            </div>
          ) : distinctArtworks.length > 0 ? (
            /* 1-3 tracks: First artwork */
            <div className="w-44 h-44 rounded-2xl overflow-hidden border border-white/20 shadow-2xl bg-white/5">
              <img
                src={distinctArtworks[0]}
                alt={playlist.name}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            /* Empty Custom Playlist: Sleek Gradient Music Icon */
            <div
              className="w-44 h-44 rounded-2xl flex items-center justify-center border border-white/20 shadow-2xl"
              style={{
                background: playlist.coverGradient || 'linear-gradient(135deg, #1E1B4B 0%, #312E81 50%, #4C1D95 100%)',
              }}
            >
              <Music className="w-14 h-14 text-white/70 drop-shadow-md" />
            </div>
          )}
        </div>

        {/* Metadata & Controls */}
        <div className="min-w-0 flex-1 space-y-3.5 text-center md:text-left w-full">
          {/* Badge */}
          <div className="flex items-center justify-center md:justify-start gap-2">
            <span className="px-3 py-1 rounded-full text-[10px] font-mono font-bold tracking-widest uppercase bg-white/10 text-white/90 border border-white/15">
              {isLikedCollection
                ? 'FAVORITES'
                : isDownloadedCollection
                ? 'OFFLINE VAULT'
                : 'CUSTOM PLAYLIST'}
            </span>
            {isAllDownloaded && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-widest uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <Check className="w-3 h-3 stroke-[3]" />
                <span>OFFLINE READY</span>
              </span>
            )}
          </div>

          {/* Title */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight leading-tight">
            {playlist.name}
          </h1>

          {/* Description */}
          {playlist.description && (
            <p className="text-xs sm:text-sm text-white/55 font-sans max-w-2xl leading-relaxed">
              {playlist.description}
            </p>
          )}

          {/* Stats Bar */}
          <div className="flex items-center justify-center md:justify-start gap-2 text-xs font-mono text-white/60 pt-0.5">
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-[9px] text-white border border-white/20 shrink-0"
              style={{ backgroundColor: currentUser.avatarColor || '#8B5CF6' }}
            >
              {currentUser.name.slice(0, 1)}
            </div>
            <span className="font-semibold text-white/90">{currentUser.name}</span>
            <span>•</span>
            <span className="text-white/80">
              {playlist.tracks.length} {playlist.tracks.length === 1 ? 'song' : 'songs'}
            </span>
            {playlist.tracks.length > 0 && (
              <>
                <span>•</span>
                <span className="text-white/50">{durationString}</span>
              </>
            )}
          </div>

          {/* Primary Glass Pill Action Buttons */}
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 pt-2">
            {/* ▷ Play All */}
            <button
              onClick={handlePlayEntirePlaylist}
              disabled={playlist.tracks.length === 0}
              className="px-5 py-2.5 rounded-full bg-white text-black text-xs font-bold flex items-center gap-2 hover:bg-white/90 active:scale-95 disabled:opacity-40 disabled:hover:scale-100 transition-all cursor-pointer shadow-lg shadow-black/40"
              title={isCurrentPlaylistPlaying ? 'Pause Playlist' : 'Play All'}
            >
              {isCurrentPlaylistPlaying ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current ml-0.5" />
              )}
              <span>{isCurrentPlaylistPlaying ? 'Pause' : 'Play All'}</span>
            </button>

            {/* 🔀 Shuffle Play */}
            <button
              onClick={handleShufflePlaylist}
              disabled={playlist.tracks.length === 0}
              className="px-4 py-2.5 rounded-full bg-white/10 hover:bg-white/15 active:scale-95 text-white text-xs font-semibold border border-white/15 flex items-center gap-2 backdrop-blur-md disabled:opacity-40 disabled:hover:scale-100 transition-all cursor-pointer"
              title="Shuffle Play"
            >
              <Shuffle className="w-4 h-4" />
              <span>Shuffle Play</span>
            </button>

            {/* 🗑️ Delete Playlist (Custom Only) */}
            {isCustom && (
              <button
                onClick={handleDeletePlaylist}
                className="px-3.5 py-2.5 rounded-full bg-rose-500/10 hover:bg-rose-500/20 active:scale-95 text-rose-400 text-xs font-medium border border-rose-500/25 flex items-center gap-1.5 transition-all cursor-pointer"
                title="Delete Playlist"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Playlist</span>
              </button>
            )}

            {/* Offline Download Button */}
            <button
              onClick={handleDownloadEntirePlaylist}
              disabled={playlist.tracks.length === 0 || isDownloadingAll || isAllDownloaded}
              className={`px-3.5 py-2.5 rounded-full flex items-center gap-1.5 text-xs font-mono font-medium transition-all cursor-pointer border ${
                isAllDownloaded
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  : isDownloadingAll
                  ? 'bg-cyan-500/20 border-cyan-500/30 text-cyan-400 animate-pulse'
                  : 'bg-white/5 border-white/10 text-white/70 hover:text-white hover:bg-white/10'
              }`}
              title={
                isAllDownloaded
                  ? 'All tracks saved offline'
                  : isDownloadingAll
                  ? `Downloading ${downloadAllProgress.current} of ${downloadAllProgress.total}...`
                  : 'Download playlist offline'
              }
            >
              {isAllDownloaded ? (
                <>
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Offline Ready</span>
                </>
              ) : isDownloadingAll ? (
                <>
                  <ArrowDownToLine className="w-3.5 h-3.5 animate-bounce" />
                  <span>{downloadAllProgress.current}/{downloadAllProgress.total}</span>
                </>
              ) : (
                <>
                  <ArrowDownToLine className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Download</span>
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* =========================================================================
          2. TRACKLIST TABLE
          ========================================================================= */}
      <section
        style={{
          backdropFilter: 'blur(36px)',
          WebkitBackdropFilter: 'blur(36px)',
          background: 'rgba(16, 18, 28, 0.45)',
          border: '1px solid rgba(255, 255, 255, 0.10)',
          borderRadius: '24px',
        }}
        className="overflow-hidden shadow-xl"
      >
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-3 px-5 py-3 text-[10.5px] font-bold text-white/45 font-mono uppercase tracking-wider border-b border-white/[0.08] bg-white/[0.02]">
          <div className="col-span-1 text-center">#</div>
          <div className="col-span-6 sm:col-span-5">Title</div>
          <div className="col-span-3 sm:col-span-3">Artist</div>
          <div className="col-span-2 hidden sm:block">Album</div>
          <div className="col-span-2 sm:col-span-1 text-right flex items-center justify-end">
            <Clock className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Empty State */}
        {playlist.tracks.length === 0 ? (
          <div className="py-20 text-center flex flex-col items-center justify-center gap-3.5 px-4">
            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/30">
              {isLikedCollection ? (
                <Heart className="w-6 h-6 text-white/30" />
              ) : (
                <Music className="w-6 h-6 text-white/30" />
              )}
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">
                {isLikedCollection ? 'No favorites yet' : 'This playlist is empty'}
              </h3>
              <p className="text-xs text-white/45 font-sans max-w-sm mx-auto mt-1">
                {isLikedCollection
                  ? 'Click the heart icon (♥) on any track to add it to your favorites.'
                  : 'Use the "+" menu on any track row across Search or In Your Rotation to add songs here.'}
              </p>
            </div>

            {onNavigateTab && (
              <button
                onClick={() => onNavigateTab('search')}
                className="mt-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/15 text-white text-xs font-semibold border border-white/15 flex items-center gap-2 backdrop-blur-md transition-all cursor-pointer"
              >
                <Compass className="w-3.5 h-3.5 text-[#E86538]" />
                <span>Discover Songs</span>
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {playlist.tracks.map((track, idx) => {
              const isCurrent = track.id === currentTrackId;
              const isTrackPlaying = isCurrent && isPlaying;

              return (
                <div
                  key={`${track.id}-${idx}`}
                  onClick={() => onPlayTrack(track)}
                  className={`grid grid-cols-12 gap-3 px-5 py-3.5 items-center text-sm cursor-pointer transition-colors group ${
                    isCurrent
                      ? 'bg-white/[0.08] text-white font-medium'
                      : 'hover:bg-white/[0.04] text-white/80 hover:text-white'
                  }`}
                >
                  {/* Track Number / Equalizer */}
                  <div className="col-span-1 text-center font-mono text-xs text-white/40 group-hover:text-white">
                    {isTrackPlaying ? (
                      <div className="flex items-end justify-center gap-[2px] h-3.5">
                        <span className="w-[2.5px] bg-[#E86538] rounded-full animate-bounce h-3" style={{ animationDelay: '0ms' }} />
                        <span className="w-[2.5px] bg-[#E86538] rounded-full animate-bounce h-3.5 style={{ animationDelay: '150ms' }}" />
                        <span className="w-[2.5px] bg-[#E86538] rounded-full animate-bounce h-2" style={{ animationDelay: '300ms' }} />
                      </div>
                    ) : (
                      <span>{idx + 1}</span>
                    )}
                  </div>

                  {/* Title & Artwork */}
                  <div className="col-span-6 sm:col-span-5 flex items-center gap-3 truncate">
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
                        className="w-9 h-9 rounded-lg object-cover border border-white/10 shrink-0"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0 text-white/40">
                        <Music className="w-4 h-4" />
                      </div>
                    )}

                    <div className="min-w-0 flex-1 truncate">
                      <div className={`truncate font-semibold ${isCurrent ? 'text-[#E86538]' : 'text-white'}`}>
                        {track.title}
                      </div>
                      <div className="text-[11px] text-white/45 font-sans truncate sm:hidden">
                        {track.artist || 'Unknown Artist'}
                      </div>
                    </div>
                  </div>

                  {/* Artist */}
                  <div className="col-span-3 sm:col-span-3 truncate text-xs text-white/50 font-sans">
                    {track.artist || 'Unknown Artist'}
                  </div>

                  {/* Album */}
                  <div className="col-span-2 hidden sm:block truncate text-xs text-white/40 font-sans">
                    {track.album || 'Single'}
                  </div>

                  {/* Right Actions: Heart, Popover, Remove, Duration */}
                  <div className="col-span-2 sm:col-span-1 flex items-center justify-end gap-1.5">
                    <span className="font-mono text-xs text-white/40 hidden sm:inline mr-1">
                      {formatTrackDuration(track.duration)}
                    </span>

                    {/* Integrated Track Action Buttons: Heart (♥), + (Popover), Download */}
                    <TrackActionButtons
                      track={track}
                      onOpenAddToPlaylist={onOpenAddToPlaylist}
                      onToggleLike={onToggleLike}
                      size="sm"
                    />

                    {/* Remove from this custom playlist (×) */}
                    {isCustom && (
                      <button
                        onClick={(e) => handleRemoveTrack(track.id, e)}
                        className="p-1 rounded text-white/30 hover:text-rose-400 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        title="Remove from playlist"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
