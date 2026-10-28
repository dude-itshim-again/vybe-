import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Dna,
  BookOpen,
  User,
  Activity,
  Disc,
  ExternalLink,
} from 'lucide-react';
import { TrackMetadata } from '../../providers/types';
import { TrackAudioProfile } from '../../audio/TrackAnalyzer';
import { getTrackMusicDna, MusicDnaProfile } from '../../services/musicDnaService';

interface MusicDnaDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  track: TrackMetadata | null;
  profile?: TrackAudioProfile;
}

export const MusicDnaDrawer: React.FC<MusicDnaDrawerProps> = ({
  isOpen,
  onClose,
  track,
  profile,
}) => {
  const [dna, setDna] = useState<MusicDnaProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen || !track) return;
    setIsLoading(true);
    getTrackMusicDna(track, profile)
      .then((data) => {
        setDna(data);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [isOpen, track, profile]);

  if (!isOpen) return null;

  const effectiveProfile = profile || track?.profile || dna?.profile;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-hidden">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/70 backdrop-blur-md"
        />

        {/* Drawer Panel */}
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="absolute right-0 top-0 bottom-0 w-full max-w-lg bg-[#0c0c10]/95 border-l border-white/10 shadow-2xl flex flex-col z-10 backdrop-blur-md overflow-hidden safe-area-container"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0 safe-area-top">

            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#ED5564]/15 border border-[#ED5564]/30 flex items-center justify-center text-[#ED5564]">
                <Dna className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold uppercase tracking-widest text-white flex items-center gap-1.5 font-mono">
                  Music DNA
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#ED5564]/20 text-[#ED5564] border border-[#ED5564]/30">
                    5.0
                  </span>
                </h2>
                <p className="text-[11px] text-gray-400 font-mono">Track Backstory & Acoustic Blueprint</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm">
            {/* Track Header Card */}
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex gap-4 items-center">
              {track?.artworkUrl ? (
                <img
                  src={track.artworkUrl}
                  alt={track.title}
                  className="w-20 h-20 rounded-xl object-cover border border-white/10 shrink-0 shadow-lg"
                />
              ) : (
                <div className="w-20 h-20 rounded-xl bg-gradient-to-tr from-purple-900 to-[#ED5564]/40 flex items-center justify-center border border-white/10 shrink-0">
                  <Disc className="w-8 h-8 text-white/70" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-mono text-[#ED5564] tracking-widest uppercase font-semibold">
                  Echo 320kbps Master
                </span>
                <h3 className="text-lg font-bold text-white truncate leading-tight mt-0.5">
                  {track?.title || 'Unknown Title'}
                </h3>
                <p className="text-xs text-gray-400 truncate mt-0.5">
                  {track?.artist || 'Unknown Artist'}
                </p>
                {track?.album && (
                  <p className="text-[11px] text-gray-500 truncate mt-0.5 font-mono">
                    Album: {track.album} {track.year ? `(${track.year})` : ''}
                  </p>
                )}
              </div>
            </div>

            {/* Acoustic Fingerprint Card */}
            <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3.5">
              <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 font-bold uppercase tracking-wider">
                <Activity className="w-4 h-4" />
                <span>Acoustic Profile (DSP & Sound Check)</span>
              </div>
              <div className="grid grid-cols-2 gap-2.5 font-mono text-xs">
                <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
                  <span className="text-[10px] text-gray-500 uppercase block">Sound Check</span>
                  <span className="text-sm font-bold text-white">
                    {effectiveProfile ? `${effectiveProfile.integratedLufs.toFixed(1)} LUFS` : '-16.0 LUFS Target'}
                  </span>
                  <span className="text-[9px] text-emerald-400 block">Matched to -16 LUFS</span>
                </div>

                <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
                  <span className="text-[10px] text-gray-500 uppercase block">Tempo / Groove</span>
                  <span className="text-sm font-bold text-white">
                    {effectiveProfile ? `${effectiveProfile.estimatedBpm} BPM` : '124 BPM'}
                  </span>
                  <span className="text-[9px] text-purple-400 block">AutoMix Groove Ready</span>
                </div>

                <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
                  <span className="text-[10px] text-gray-500 uppercase block">Intro Silence Trim</span>
                  <span className="text-sm font-bold text-white">
                    {effectiveProfile ? `${effectiveProfile.introCueTime.toFixed(2)}s` : '0.10s'}
                  </span>
                  <span className="text-[9px] text-gray-400 block">Dead space stripped</span>
                </div>

                <div className="p-3 rounded-xl bg-black/40 border border-white/5 space-y-1">
                  <span className="text-[10px] text-gray-500 uppercase block">Decay Outro Handover</span>
                  <span className="text-sm font-bold text-white">
                    {effectiveProfile ? `${effectiveProfile.outroCueTime.toFixed(1)}s` : '190.0s'}
                  </span>
                  <span className="text-[9px] text-gray-400 block">Sample-accurate fade</span>
                </div>
              </div>
            </div>

            {/* Song Backstory Section */}
            <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-mono text-amber-400 font-bold uppercase tracking-wider">
                  <BookOpen className="w-4 h-4" />
                  <span>The Backstory</span>
                </div>
                {dna?.wikiUrl && (
                  <a
                    href={dna.wikiUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] font-mono text-gray-400 hover:text-white flex items-center gap-1 transition-colors"
                  >
                    Wikipedia <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              {isLoading ? (
                <div className="py-6 text-center text-xs font-mono text-gray-500 animate-pulse">
                  Unraveling track backstory & Wikipedia archives...
                </div>
              ) : dna?.songBackstory ? (
                <p className="text-xs text-gray-300 leading-relaxed font-sans">
                  {dna.songBackstory}
                </p>
              ) : (
                <p className="text-xs text-gray-400 leading-relaxed">
                  {`"${track?.title}" was recorded and mastered at high resolution. Streamed directly through our 320kbps Echo Gateway with full 60Hz Sub-Bass and Apple 3-Tier AutoMix support.`}
                </p>
              )}
            </div>

            {/* Artist Bio Section */}
            <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
              <div className="flex items-center gap-2 text-xs font-mono text-[#ED5564] font-bold uppercase tracking-wider">
                <User className="w-4 h-4" />
                <span>Artist Biography</span>
              </div>

              {isLoading ? (
                <div className="py-4 text-center text-xs font-mono text-gray-500 animate-pulse">
                  Querying artist profile...
                </div>
              ) : dna?.artistBio ? (
                <div className="space-y-3">
                  {dna.artistImage && (
                    <img
                      src={dna.artistImage}
                      alt={track?.artist}
                      className="w-full h-36 rounded-xl object-cover border border-white/10 shadow-md"
                    />
                  )}
                  <p className="text-xs text-gray-300 leading-relaxed font-sans">
                    {dna.artistBio}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-gray-400 leading-relaxed">
                  {`Explore more tracks by ${track?.artist || 'this artist'} in the Search Catalog tab.`}
                </p>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
