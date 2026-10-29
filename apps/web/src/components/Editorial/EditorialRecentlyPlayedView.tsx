import React from 'react';
import { Play, Clock, Music, Heart, Plus, Trash2 } from 'lucide-react';
import { EchoTrack } from '../../services/streamResolver';
import { TrackMetadata } from '../../providers/types';
import { userLibrary } from '../../services/userLibraryService';

interface EditorialRecentlyPlayedViewProps {
  recentlyPlayed: TrackMetadata[];
  onPlayTrack: (track: EchoTrack) => void;
  onPlayBatch: (tracks: EchoTrack[]) => void;
  onAddToQueue: (track: EchoTrack) => void;
  onOpenAddToPlaylist: (track: TrackMetadata, anchorRect?: DOMRect) => void;
  onToggleLike?: (track: TrackMetadata, isLiked: boolean) => void;
  onClearHistory: () => void;
  currentTrackId?: string;
}

export const EditorialRecentlyPlayedView: React.FC<EditorialRecentlyPlayedViewProps> = ({
  recentlyPlayed,
  onPlayTrack,
  onPlayBatch,
  onAddToQueue,
  onOpenAddToPlaylist,
  onToggleLike,
  onClearHistory,
  currentTrackId,
}) => {
  const formatDuration = (secs?: number) => {
    if (!secs) return '3:30';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const toEchoTrack = (t: TrackMetadata): EchoTrack => ({
    id: t.id,
    title: t.title,
    artist: t.artist,
    album: t.album,
    duration: t.duration,
    artworkUrl: t.artworkUrl,
    streamUrl: t.streamUrl || '',
    quality: '320kbps',
    source: 'saavn',
    sourceType: 'stream',
  });

  return (
    <div className="space-y-6 pb-28 max-w-[1480px] mx-auto select-none">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-sans">
            Recently Played
          </h1>
          <p className="text-xs text-white/45 font-sans mt-0.5">
            Your personal listening history and replay queue
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {recentlyPlayed.length > 0 && (
            <>
              <button
                onClick={() => onPlayBatch(recentlyPlayed.map(toEchoTrack))}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white text-black text-xs font-bold hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-md"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Replay All</span>
              </button>

              <button
                onClick={onClearHistory}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/50 hover:text-rose-400 text-xs font-mono transition-colors cursor-pointer"
                title="Clear playback history"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Clean Vertical Track List */}
      {recentlyPlayed.length > 0 ? (
        <div className="rounded-[20px] border border-white/10 glass-panel overflow-hidden shadow-xl divide-y divide-white/5">
          {recentlyPlayed.map((track, idx) => {
            const isCurrent = currentTrackId === track.id;
            const isLiked = userLibrary.isLiked(track.id);

            return (
              <div
                key={`${track.id}-${idx}`}
                onClick={() => onPlayTrack(toEchoTrack(track))}
                className={`grid grid-cols-12 gap-3 px-5 py-3.5 items-center text-sm cursor-pointer transition-colors group ${
                  isCurrent
                    ? 'bg-white/[0.08] text-[#E86538] font-medium'
                    : 'hover:bg-white/[0.04] text-white/70 hover:text-white'
                }`}
              >
                <div className="col-span-1 text-center font-mono text-xs text-white/40 group-hover:text-white">
                  {isCurrent ? (
                    <span className="text-[#E86538] font-bold">▶</span>
                  ) : (
                    idx + 1
                  )}
                </div>

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
                      className="w-9 h-9 rounded-md object-cover border border-white/10 shrink-0"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-md bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                      <Music className="w-4 h-4 text-white/40" />
                    </div>
                  )}
                  <div className="truncate min-w-0">
                    <div className={`truncate ${isCurrent ? 'font-bold text-white' : ''}`}>
                      {track.title}
                    </div>
                    <div className="text-xs text-white/45 truncate sm:hidden font-sans">
                      {track.artist || 'Unknown Artist'}
                    </div>
                  </div>
                </div>

                <div className="col-span-3 sm:col-span-3 truncate text-xs text-white/50 font-sans hidden sm:block">
                  {track.artist || 'Unknown Artist'}
                </div>

                <div className="col-span-2 hidden sm:flex items-center justify-end font-mono text-xs text-white/40">
                  {formatDuration(track.duration)}
                </div>

                <div className="col-span-5 sm:col-span-1 flex items-center justify-end gap-1.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const next = userLibrary.toggleLike(toEchoTrack(track));
                      onToggleLike?.(track, next);
                    }}
                    className="p-1.5 text-white/40 hover:text-[#E86538] transition-colors"
                    title={isLiked ? 'Unlike' : 'Like'}
                  >
                    <Heart
                      className={`w-3.5 h-3.5 ${
                        isLiked ? 'fill-[#E86538] text-[#E86538]' : ''
                      }`}
                    />
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      onOpenAddToPlaylist(track, rect);
                    }}
                    className="p-1.5 rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                    title="Add to playlist or queue"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-[20px] p-12 text-center glass-panel border border-white/10 flex flex-col items-center justify-center gap-2">
          <Clock className="w-8 h-8 text-white/20" />
          <p className="text-sm text-white/60 font-sans font-semibold">
            No recently played tracks
          </p>
          <p className="text-xs text-white/35 font-sans">
            Play any song from Discover, Search, or Radio to see your listening rotation here
          </p>
        </div>
      )}
    </div>
  );
};
