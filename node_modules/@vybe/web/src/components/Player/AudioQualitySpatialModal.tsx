import React from 'react';
import {
  X,
  Volume2,
  Check,
  Disc,
} from 'lucide-react';

interface AudioQualitySpatialModalProps {
  isOpen: boolean;
  onClose: () => void;
  spatialMode: 'off' | 'spatial-3d' | 'concert-hall';
  onSetSpatialMode: (mode: 'off' | 'spatial-3d' | 'concert-hall') => void;
  signalPathInfo?: {
    format: string;
    sampleRate: number;
    bitDepth: string;
    spatialMode: string;
    spatialLabel: string;
    isSpatialActive: boolean;
    lufs: number;
    displayBadge: string;
  };
}

export const AudioQualitySpatialModal: React.FC<AudioQualitySpatialModalProps> = ({
  isOpen,
  onClose,
  spatialMode,
  onSetSpatialMode,
  signalPathInfo,
}) => {
  if (!isOpen) return null;

  const info = signalPathInfo || {
    format: '24-bit / 48kHz ALAC Lossless',
    sampleRate: 48000,
    bitDepth: '24-bit Integer / 32-bit Float DSP',
    spatialMode,
    spatialLabel: spatialMode === 'off' ? 'Stereo Lossless' : spatialMode === 'concert-hall' ? 'Concert Hall' : 'Spatial Audio 3D',
    isSpatialActive: spatialMode !== 'off',
    lufs: -16.0,
    displayBadge: `24-bit / 48kHz ALAC Lossless • ${spatialMode === 'off' ? 'Stereo Lossless' : 'Spatial 3D'} • -16 LUFS`,
  };

  const SPATIAL_OPTIONS: {
    id: 'off' | 'spatial-3d' | 'concert-hall';
    title: string;
    subtitle: string;
    badge: string;
  }[] = [
    {
      id: 'off',
      title: 'Stereo Lossless',
      subtitle: 'Pure bit-perfect stereo playback without acoustic processing.',
      badge: 'Direct Pass',
    },
    {
      id: 'spatial-3d',
      title: 'Spatial Audio 3D',
      subtitle: '12ms Haas micro-delay matrix & pinna filter expands the stereo soundstage into head-tracked 3D space.',
      badge: 'Binaural 3D',
    },
    {
      id: 'concert-hall',
      title: 'Concert Hall Ambience',
      subtitle: '28ms & 45ms early reflections with 6kHz lowpass room decay for live venue acoustic depth.',
      badge: 'Live Venue',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in select-none">
      <div
        className="relative w-full max-w-md bg-[#111116] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 border border-amber-500/20">
              <Disc className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
                Audio Quality & DSP
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
                  ALAC Lossless
                </span>
              </h2>
              <p className="text-xs text-zinc-400">Mastering Signal Path & Spatial 3D Audio</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Live Signal Path HUD */}
        <div className="p-4 bg-amber-950/20 border-b border-amber-500/15">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 font-bold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping inline-block" />
              Live Signal Path HUD
            </span>
            <span className="text-[10px] font-mono text-zinc-400">{info.lufs} LUFS</span>
          </div>

          <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 font-mono text-xs text-zinc-300 space-y-1">
            <div className="flex justify-between">
              <span className="text-zinc-500">Master Stream:</span>
              <span className="text-white font-medium">{info.format}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Processing Engine:</span>
              <span className="text-amber-300 font-medium">{info.bitDepth}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Spatial Dimension:</span>
              <span className="text-cyan-400 font-medium">{info.spatialLabel}</span>
            </div>
          </div>
        </div>

        {/* Spatial Audio Modes Selector */}
        <div className="p-6 space-y-3">
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 block mb-1">
            Spatial Audio (Binaural Widener):
          </label>

          {SPATIAL_OPTIONS.map((opt) => {
            const isSelected = spatialMode === opt.id;
            return (
              <div
                key={opt.id}
                onClick={() => onSetSpatialMode(opt.id)}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start justify-between gap-3 ${
                  isSelected
                    ? 'bg-amber-500/10 border-amber-500/50 shadow-md shadow-amber-950/20'
                    : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.05]'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-5 h-5 rounded-full border mt-0.5 flex items-center justify-center flex-shrink-0 transition-colors ${
                      isSelected
                        ? 'border-amber-400 bg-amber-400 text-black'
                        : 'border-zinc-700 bg-black/40'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-white">{opt.title}</h4>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/5 text-zinc-400">
                        {opt.badge}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{opt.subtitle}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Sound Check / LUFS normalization note */}
        <div className="px-6 py-4 bg-black/40 border-t border-white/5 flex items-center gap-3 text-xs text-zinc-400">
          <Volume2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>
            Apple Sound Check Normalization is active at <strong className="text-white">-16 LUFS</strong> with a 0.0dBFS True Peak Limiter ceiling.
          </span>
        </div>
      </div>
    </div>
  );
};
