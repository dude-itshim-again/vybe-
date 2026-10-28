import React, { useState, useEffect } from 'react';
import {
  Flame,
  Trophy,
  Zap,
  Activity,
  Headphones,
  Coffee,
  Play,
  Plus,
  Radio,
  Check,
} from 'lucide-react';
import { TrackMetadata } from '../../providers/types';
import { HomeSection, EchoTrack, fetchHomeFeed } from '../../services/streamResolver';
import { TrackActionButtons } from '../Library/TrackActionButtons';
import { MadeForYouRow } from '../Discovery/MadeForYouRow';

interface HomeCatalogViewProps {
  onPlayTrack: (track: TrackMetadata) => void;
  onAddToQueue: (track: TrackMetadata) => void;
  onOpenAddToPlaylist?: (track: EchoTrack | TrackMetadata, anchorRect?: DOMRect) => void;
  currentTrackId?: string;
  onPlayTracks?: (tracks: TrackMetadata[], mixTitle: string) => void;
  onOpenWrapped?: () => void;
  onOpenBlend?: () => void;
}

const SECTION_ICONS: Record<string, React.FC<{ className?: string }>> = {
  Flame,
  Trophy,
  Zap,
  Activity,
  Headphones,
  Coffee,
};

export const HomeCatalogView: React.FC<HomeCatalogViewProps> = ({
  onPlayTrack,
  onAddToQueue,
  onOpenAddToPlaylist,
  currentTrackId,
  onPlayTracks,
  onOpenWrapped,
  onOpenBlend,
}) => {
  const [sections, setSections] = useState<HomeSection[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [queuedIds, setQueuedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    fetchHomeFeed()
      .then((data) => {
        if (isMounted && data && data.length > 0) {
          setSections(data);
        }
      })
      .catch((err) => console.warn('[HomeCatalog] Load failed:', err))
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

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

  return (
    <div className="space-y-10 pb-20">
      {/* Nothing OS 5.0 Hero Banner */}
      <div className="relative rounded-3xl p-6 sm:p-8 bg-[#0c0c10]/90 border border-white/10 overflow-hidden shadow-2xl backdrop-blur-md">
        {/* Subtle Liquid Glass Dot Grid Accent */}
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, #ED5564 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />

        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-widest uppercase bg-[#ED5564]/20 text-[#ED5564] border border-[#ED5564]/30">
              ECHO-MUSIC 5.0
            </span>
            <span className="text-[11px] font-mono text-gray-400">•</span>
            <span className="text-[11px] font-mono text-cyan-400">320kbps Master Streams</span>
            <span className="text-[11px] font-mono text-gray-400">•</span>
            <span className="text-[11px] font-mono text-purple-400">Apple AutoMix Active</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
            Infinite High-Bitrate Catalog.
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-300 to-[#ED5564]">
              Zero Ads. Full DSP Equalizer.
            </span>
          </h1>

          <p className="text-xs sm:text-sm text-gray-400 font-sans leading-relaxed">
            Stream unlimited tracks through our CORS-safe gateway. Every song is processed in real time
            with our 60Hz Sub-Bass, 5-Band Parametric EQ, and 3-Tier Apple AutoMix engine.
          </p>
        </div>
      </div>

      {/* Flagship Discovery & Personalization: Made For You Row */}
      <MadeForYouRow
        onPlayTracks={(tracks, title) => {
          if (onPlayTracks) {
            onPlayTracks(tracks, title);
          } else if (tracks.length > 0) {
            onPlayTrack(tracks[0]);
          }
        }}
        onOpenWrapped={() => onOpenWrapped?.()}
        onOpenBlend={() => onOpenBlend?.()}
      />

      {/* Loading Skeletons */}
      {isLoading && (
        <div className="space-y-8">
          {[1, 2, 3].map((n) => (
            <div key={n} className="space-y-3 animate-pulse">
              <div className="h-6 w-48 bg-white/5 rounded-lg" />
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {[1, 2, 3, 4, 5].map((m) => (
                  <div key={m} className="aspect-square bg-white/[0.03] rounded-2xl border border-white/5" />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Curated Sections */}
      {!isLoading &&
        sections.map((sec) => {
          const IconComp = SECTION_ICONS[sec.icon] || Radio;

          return (
            <section key={sec.id} className="space-y-3.5">
              {/* Section Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-[#ED5564]">
                    <IconComp className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                      {sec.title}
                    </h2>
                    <p className="text-[11px] text-gray-400 font-mono hidden sm:block">
                      {sec.subtitle}
                    </p>
                  </div>
                </div>
              </div>

              {/* Grid / Horizontal Row */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
                {sec.tracks.map((track) => {
                  const isCurrent = currentTrackId === track.id;
                  const isQueued = queuedIds.has(track.id);

                  return (
                    <div
                      key={track.id}
                      className="group relative rounded-2xl bg-[#0e0f16]/60 border border-white/[0.08] p-3 hover:border-[#ED5564]/50 transition-all duration-200 hover:shadow-xl hover:shadow-[#ED5564]/5 flex flex-col justify-between"
                    >
                      {/* Artwork & Hover Play Button */}
                      <div className="relative aspect-square rounded-xl overflow-hidden bg-black/60 border border-white/5">
                        {track.artworkUrl ? (
                          <img
                            src={track.artworkUrl}
                            alt={track.title}
                            loading="lazy"
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-purple-950/40 text-purple-300">
                            <Radio className="w-8 h-8" />
                          </div>
                        )}

                        {/* Top Quality Badge */}
                        <div className="absolute top-2 left-2 z-10">
                          <span className="px-2 py-0.5 rounded-md text-[9px] font-mono font-bold tracking-wider uppercase bg-black/70 backdrop-blur-md text-emerald-400 border border-white/10 shadow-sm">
                            {track.quality || '320kbps'}
                          </span>
                        </div>

                        {/* Hover Overlay Buttons */}
                        <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <button
                            onClick={() => onPlayTrack(track)}
                            className="w-11 h-11 rounded-full bg-[#ED5564] hover:bg-[#ff6475] text-white flex items-center justify-center shadow-lg transform active:scale-95 transition-all cursor-pointer"
                            title="Play Now with AutoMix"
                          >
                            <Play className="w-5 h-5 fill-current ml-0.5" />
                          </button>

                          <button
                            onClick={() => handleQueueClick(track)}
                            className={`w-9 h-9 rounded-full flex items-center justify-center shadow-lg transition-all cursor-pointer ${
                              isQueued
                                ? 'bg-emerald-500 text-white'
                                : 'bg-white/20 hover:bg-white/30 text-white backdrop-blur-md'
                            }`}
                            title="Add to Up Next Queue"
                          >
                            {isQueued ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Meta Info & Quick Actions */}
                      <div className="mt-2.5 min-w-0 space-y-1">
                        <div className="flex items-center justify-between gap-1">
                          <h3
                            className={`text-xs font-bold truncate leading-tight transition-colors ${
                              isCurrent ? 'text-[#ED5564]' : 'text-white group-hover:text-cyan-300'
                            }`}
                            title={track.title}
                          >
                            {track.title}
                          </h3>
                        </div>

                        <div className="flex items-center justify-between gap-1">
                          <p className="text-[11px] text-gray-400 truncate flex-1" title={track.artist}>
                            {track.artist}
                          </p>

                          <TrackActionButtons
                            track={track}
                            onOpenAddToPlaylist={onOpenAddToPlaylist}
                            size="sm"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
    </div>
  );
};
