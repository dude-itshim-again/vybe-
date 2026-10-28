import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Play,
  Plus,
  Check,
  Disc,
  Heart,
  Loader2,
} from 'lucide-react';
import { TrackMetadata } from '../../providers/types';
import { EchoTrack, fetchCatalogSearch } from '../../services/streamResolver';
import { TrackActionButtons } from '../Library/TrackActionButtons';
import { userLibrary } from '../../services/userLibraryService';

interface SearchCatalogViewProps {
  onPlayTrack: (track: TrackMetadata) => void;
  onAddToQueue: (track: TrackMetadata) => void;
  onOpenAddToPlaylist?: (track: EchoTrack | TrackMetadata, anchorRect?: DOMRect) => void;
  onToggleLike?: (track: EchoTrack | TrackMetadata, isLiked: boolean) => void;
  currentTrackId?: string;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

const QUICK_SEARCH_PILLS = [
  'Starboy',
  'Travis Scott',
  'FE!N',
  'After Hours',
  'Daft Punk',
  'Kendrick Lamar',
  'The Weeknd',
  'Coldplay',
];

export const SearchCatalogView: React.FC<SearchCatalogViewProps> = ({
  onPlayTrack,
  onAddToQueue,
  onOpenAddToPlaylist,
  onToggleLike,
  currentTrackId,
  searchQuery = '',
  onSearchChange,
}) => {
  const [internalQuery, setInternalQuery] = useState<string>(searchQuery || 'Starboy');
  const [results, setResults] = useState<EchoTrack[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [queuedIds, setQueuedIds] = useState<Set<string>>(new Set());
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const executeSearch = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) {
      setResults([]);
      return;
    }
    setIsLoading(true);

    fetchCatalogSearch(trimmed)
      .then((tracks) => {
        if (tracks && tracks.length > 0) {
          setResults(tracks);
        } else {
          setResults([]);
        }
      })
      .catch((err) => {
        console.warn('[SearchCatalog] Search error:', err);
        setResults([]);
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  // Sync when prop searchQuery changes from the top utility bar
  useEffect(() => {
    if (searchQuery !== undefined && searchQuery.trim() !== '') {
      setInternalQuery(searchQuery);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        executeSearch(searchQuery);
      }, 280);
    }
  }, [searchQuery]);

  // Initial search on mount if no prop query provided
  useEffect(() => {
    const initialQ = searchQuery.trim() || internalQuery.trim() || 'Starboy';
    executeSearch(initialQ);
  }, []);

  const handlePillClick = (pill: string) => {
    setInternalQuery(pill);
    onSearchChange?.(pill);
    executeSearch(pill);
  };

  const handleQueueClick = (track: EchoTrack) => {
    onAddToQueue(track);
    setQueuedIds((prev) => new Set([...prev, track.id]));
    setTimeout(() => {
      setQueuedIds((prev) => {
        const next = new Set(prev);
        next.delete(track.id);
        return next;
      });
    }, 2000);
  };

  const formatTime = (secs?: number): string => {
    if (!secs || isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6 pb-24 max-w-[1480px] mx-auto select-none">
      {/* Trending Search Pills (Unified search input is exclusively in Top Header) */}
      <div className="relative rounded-[20px] glass-panel border border-white/12 p-3 sm:p-4 shadow-2xl flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto py-1 px-1 scrollbar-none flex-1">
          <span className="text-[10px] font-mono text-white/50 uppercase tracking-widest shrink-0 mr-1.5 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6] animate-pulse" />
            TRENDING:
          </span>
          {QUICK_SEARCH_PILLS.map((pill) => (
            <button
              key={pill}
              onClick={() => handlePillClick(pill)}
              className={`px-3 py-1 rounded-full text-xs font-mono shrink-0 transition-all border cursor-pointer ${
                (searchQuery || internalQuery).toLowerCase() === pill.toLowerCase()
                  ? 'bg-white text-black border-white font-bold shadow-md'
                  : 'bg-white/5 text-white/60 border-white/10 hover:text-white hover:bg-white/10'
              }`}
            >
              {pill}
            </button>
          ))}
        </div>
        {isLoading && (
          <div className="flex items-center gap-2 text-xs font-mono text-[#3B82F6] shrink-0 pr-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="hidden sm:inline">Searching...</span>
          </div>
        )}
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2.5">
          <h2 className="text-sm font-semibold tracking-wide text-white uppercase font-sans">
            Search Results
          </h2>
          {!isLoading && (
            <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/60">
              {results.length} tracks found
            </span>
          )}
        </div>
        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-0.5 rounded-full font-semibold">
          320kbps Lossless CDN
        </span>
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-16 rounded-[16px] glass-card border border-white/5 animate-pulse flex items-center px-4 gap-4"
            >
              <div className="w-11 h-11 rounded-[10px] bg-white/5" />
              <div className="space-y-1.5 flex-1">
                <div className="w-48 h-3.5 bg-white/5 rounded-full" />
                <div className="w-28 h-2.5 bg-white/5 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Search Results List */}
      {!isLoading && results.length > 0 && (
        <div className="rounded-[22px] glass-panel border border-white/10 overflow-hidden divide-y divide-white/5 shadow-2xl">
          {results.map((track, idx) => {
            const isCurrent = currentTrackId === track.id;
            const isQueued = queuedIds.has(track.id);
            const isLiked = userLibrary.isLiked(track.id);

            return (
              <div
                key={track.id}
                onClick={() => onPlayTrack(track)}
                className={`group flex items-center justify-between px-4 sm:px-5 py-3 hover:bg-white/[0.04] transition-all cursor-pointer ${
                  isCurrent ? 'bg-white/[0.08]' : ''
                }`}
              >
                {/* Left: Index + Artwork + Title & Artist */}
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <span className="text-xs font-mono text-white/40 w-5 text-right shrink-0 group-hover:text-white">
                    {idx + 1}
                  </span>

                  <div className="relative w-11 h-11 rounded-[10px] overflow-hidden bg-black/40 border border-white/10 shrink-0">
                    {track.artworkUrl ? (
                      <img
                        src={track.artworkUrl}
                        alt={track.title}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/40">
                        <Disc className="w-5 h-5" />
                      </div>
                    )}

                    {/* Quick Play Overlay Button */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4
                        className={`text-sm font-semibold truncate leading-tight ${
                          isCurrent ? 'text-[#3B82F6]' : 'text-white group-hover:text-[#60A5FA]'
                        }`}
                        title={track.title}
                      >
                        {track.title}
                      </h4>
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0 font-semibold">
                        320k
                      </span>
                    </div>
                    <p className="text-xs text-white/50 truncate mt-0.5 font-sans" title={track.artist}>
                      {track.artist} {track.album ? `• ${track.album}` : ''}
                    </p>
                  </div>
                </div>

                {/* Right: Actions (Play, Queue, Heart, Add to Playlist, Duration) */}
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <span className="text-xs font-mono text-white/40 hidden sm:block">
                    {formatTime(track.duration)}
                  </span>

                  {/* Play Now Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onPlayTrack(track);
                    }}
                    className="px-3.5 py-1.5 rounded-full bg-white text-black text-xs font-semibold flex items-center gap-1.5 transition-all hover:bg-white/90 active:scale-95 cursor-pointer shadow-md"
                    title="Play Now"
                  >
                    <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                    <span className="hidden sm:inline">Play</span>
                  </button>

                  {/* Integrated Track Action Buttons: Heart, + (Popover Menu), Download */}
                  <TrackActionButtons
                    track={track}
                    onOpenAddToPlaylist={onOpenAddToPlaylist}
                    onToggleLike={onToggleLike}
                    size="sm"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && results.length === 0 && (
        <div className="rounded-[22px] glass-panel border border-white/10 p-12 text-center space-y-3">
          <Disc className="w-10 h-10 text-white/30 mx-auto animate-spin" style={{ animationDuration: '8s' }} />
          <h3 className="text-base font-semibold text-white">No tracks found</h3>
          <p className="text-xs text-white/45 max-w-sm mx-auto font-sans">
            Try searching for a different song title or artist, or pick one of the trending pills above.
          </p>
        </div>
      )}
    </div>
  );
};
