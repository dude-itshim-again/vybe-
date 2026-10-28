import React, { useRef, useState, useEffect } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Upload,
  Music,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { AudioDSPEngine } from '../../audio/AudioDSPEngine';

interface TransportBarProps {
  engine: AudioDSPEngine | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  trackTitle: string;
  trackArtist?: string;
  artworkUrl?: string;
  isDemoLoaded: boolean;
  isLimiterBypassed: boolean;
  onTogglePlay: () => void;
  onSeek: (seconds: number) => void;
  onVolumeChange: (vol: number) => void;
  onToggleMute: () => void;
  onLoadFile: (file: File) => void;
  onLoadDemo: () => void;
  onToggleLimiter: () => void;
}

export const TransportBar: React.FC<TransportBarProps> = ({
  engine,
  isPlaying,
  currentTime,
  duration,
  volume,
  isMuted,
  trackTitle,
  trackArtist,
  artworkUrl,
  isDemoLoaded,
  isLimiterBypassed,
  onTogglePlay,
  onSeek,
  onVolumeChange,
  onToggleMute,
  onLoadFile,
  onLoadDemo,
  onToggleLimiter,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [reductionDb, setReductionDb] = useState<number>(0);
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  // Real-time gain reduction monitoring via rAF
  useEffect(() => {
    let animId: number;
    const pollReduction = () => {
      if (engine && isPlayingRef.current) {
        const red = engine.getReduction();
        setReductionDb(red);
      } else {
        setReductionDb(0);
      }
      animId = requestAnimationFrame(pollReduction);
    };
    animId = requestAnimationFrame(pollReduction);
    return () => cancelAnimationFrame(animId);
  }, [engine]);

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onLoadFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type.startsWith('audio/') || file.name.match(/\.(mp3|wav|flac|aac|m4a|ogg)$/i))) {
      onLoadFile(file);
    }
  };

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      className="glass-panel-glow rounded-2xl p-6 relative overflow-hidden transition-all duration-300"
    >
      {/* Top Bar: Track Meta & File Loaders */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        {/* Track Title & Artwork */}
        <div className="flex items-center space-x-3.5 min-w-0">
          {artworkUrl ? (
            <img
              src={artworkUrl}
              alt="Track Artwork"
              className="w-11 h-11 rounded-xl object-cover border border-purple-500/30 shadow-md shrink-0"
            />
          ) : (
            <div className="w-11 h-11 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
              <Music className="w-5 h-5" />
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              <h2 className="text-sm font-bold text-white truncate max-w-xs sm:max-w-md">
                {trackTitle}
              </h2>
              {isDemoLoaded && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-purple-500/15 text-purple-300 border border-purple-500/20 shrink-0">
                  SYNTH DEMO
                </span>
              )}
            </div>
            <p className="text-xs text-studio-muted truncate max-w-xs sm:max-w-md">
              {trackArtist || (isDemoLoaded ? '120BPM 808 Sub-Bass & Synthwave Loop' : 'Local User Audio Stream')}
            </p>
          </div>
        </div>

        {/* Action Buttons & Limiter */}
        <div className="flex flex-wrap items-center gap-2">
          {/* File Upload Button */}
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,.mp3,.wav,.flac,.aac"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/[0.04] hover:bg-white/[0.08] text-gray-200 hover:text-white border border-white/5 hover:border-white/20 transition-all"
            title="Load local MP3/WAV/FLAC"
          >
            <Upload className="w-3.5 h-3.5 text-cyan-400" />
            <span>Load Audio File</span>
          </button>

          {/* Load Synthetic Demo */}
          {!isDemoLoaded && (
            <button
              onClick={onLoadDemo}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/20 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Demo Beat</span>
            </button>
          )}

          {/* Limiter Bypass Button */}
          <button
            onClick={onToggleLimiter}
            className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              isLimiterBypassed
                ? 'bg-rose-500/10 text-rose-400 border-rose-500/30 shadow-[0_0_15px_-3px_#f43f5e]'
                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
            }`}
            title="Toggle Anti-Clip Limiter (DynamicsCompressorNode)"
          >
            {isLimiterBypassed ? (
              <>
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
                <span>LIMITER BYPASSED</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>ANTI-CLIP ACTIVE</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Scrubber Bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-xs font-mono text-studio-muted mb-1">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
        <div className="relative flex items-center">
          <input
            type="range"
            min="0"
            max={duration || 100}
            step="0.1"
            value={currentTime}
            onChange={(e) => onSeek(parseFloat(e.target.value))}
            className="w-full h-2 rounded-full accent-purple-500"
          />
        </div>
      </div>

      {/* Bottom Controls: Play/Pause, Volume, and Limiter Reduction Meter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-white/5">
        {/* Playback Button */}
        <div className="flex items-center space-x-4">
          <button
            onClick={onTogglePlay}
            className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-cyan-500 flex items-center justify-center text-white shadow-glow-purple hover:scale-105 active:scale-95 transition-transform"
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 fill-current" />
            ) : (
              <Play className="w-5 h-5 fill-current ml-0.5" />
            )}
          </button>

          {/* Volume Control */}
          <div className="flex items-center space-x-2">
            <button
              onClick={onToggleMute}
              className="p-2 rounded-lg text-studio-muted hover:text-white hover:bg-white/5 transition-colors"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4 text-rose-400" />
              ) : (
                <Volume2 className="w-4 h-4 text-gray-300" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={isMuted ? 0 : volume}
              onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
              className="w-20 sm:w-28 accent-cyan-400"
            />
            <span className="font-mono text-xs text-studio-muted w-8">
              {Math.round((isMuted ? 0 : volume) * 100)}%
            </span>
          </div>
        </div>

        {/* Real-Time Limiter Gain Reduction Meter */}
        <div className="flex items-center space-x-3 bg-black/30 px-3.5 py-2 rounded-xl border border-white/5">
          <div className="text-right">
            <div className="text-[10px] font-mono uppercase tracking-wider text-studio-muted">
              Compressor GR
            </div>
            <div className="font-mono text-xs font-bold text-emerald-400">
              {isLimiterBypassed ? '0.0 dB (OFF)' : `${reductionDb.toFixed(1)} dB`}
            </div>
          </div>

          {/* Visual Dynamic Reduction Bar */}
          <div className="w-24 h-3 bg-gray-800 rounded-full overflow-hidden flex items-center p-0.5 border border-white/5">
            <div
              className="h-full rounded-full transition-all duration-75"
              style={{
                width: isLimiterBypassed ? '0%' : `${Math.min(100, Math.abs(reductionDb) * 8)}%`,
                backgroundColor: Math.abs(reductionDb) > 6 ? '#f43f5e' : Math.abs(reductionDb) > 2 ? '#f59e0b' : '#10b981',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
