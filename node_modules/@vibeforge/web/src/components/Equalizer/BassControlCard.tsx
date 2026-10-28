import React from 'react';
import { Disc, Zap, RotateCcw } from 'lucide-react';

interface BassControlCardProps {
  subBass: number;
  punch: number;
  onSubBassChange: (val: number) => void;
  onPunchChange: (val: number) => void;
}

export const BassControlCard: React.FC<BassControlCardProps> = ({
  subBass,
  punch,
  onSubBassChange,
  onPunchChange,
}) => {
  return (
    <div className="glass-panel-glow rounded-2xl p-5 sm:p-6 relative overflow-visible shrink-0 h-auto transition-all duration-200">
      {/* Background Audio-Reactive Ambient Glow */}
      <div 
        className="absolute -top-24 -left-24 w-64 h-64 rounded-full bg-purple-600/20 blur-3xl pointer-events-none transition-transform"
        style={{ transform: 'scale(calc(1 + var(--bass-energy, 0) * 0.8))' }}
      />
      <div 
        className="absolute -bottom-24 -right-24 w-64 h-64 rounded-full bg-cyan-500/15 blur-3xl pointer-events-none transition-transform"
        style={{ transform: 'scale(calc(1 + var(--bass-energy, 0) * 0.6))' }}
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-6 relative z-10">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <Zap className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white tracking-wide">Dual Bass Foundation</h2>
            <p className="text-xs text-studio-muted">Sub-Harmonic Shelf & Punch Resonator</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {/* Audio-reactive pulse indicator */}
          <div 
            className="px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider font-semibold border flex items-center space-x-1.5 transition-all"
            style={{
              borderColor: 'rgba(168, 85, 247, calc(var(--bass-energy, 0) * 0.8 + 0.2))',
              backgroundColor: 'rgba(168, 85, 247, calc(var(--bass-energy, 0) * 0.2 + 0.05))',
              color: '#d8b4fe'
            }}
          >
            <span 
              className="w-1.5 h-1.5 rounded-full bg-purple-400 inline-block transition-transform"
              style={{ transform: 'scale(calc(1 + var(--bass-energy, 0) * 1.5))' }}
            />
            <span>60FPS EMA</span>
          </div>

          <button
            onClick={() => {
              onSubBassChange(0);
              onPunchChange(0);
            }}
            title="Reset Bass to 0dB"
            className="p-1.5 rounded-lg text-studio-muted hover:text-white hover:bg-white/5 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Sliders Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
        {/* 60Hz Sub-Bass Shelf */}
        <div className="p-5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-purple-500/30 transition-all">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center space-x-2">
              <Disc className="w-4 h-4 text-purple-400" />
              <label htmlFor="sub-bass-slider" className="text-xs font-semibold text-gray-200">Sub-Bass Shelf</label>
            </div>
            <span className="font-mono text-xs font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
              {subBass > 0 ? `+${subBass.toFixed(1)}` : subBass.toFixed(1)} dB
            </span>
          </div>
          
          <div className="flex items-center space-x-3 mb-2">
            <span className="text-[10px] font-mono text-studio-muted">-12dB</span>
            <input
              id="sub-bass-slider"
              type="range"
              min="-12"
              max="15"
              step="0.5"
              value={subBass}
              onChange={(e) => onSubBassChange(parseFloat(e.target.value))}
              className="flex-1 accent-purple-500"
            />
            <span className="text-[10px] font-mono text-studio-muted">+15dB</span>
          </div>

          <div className="flex justify-between items-center text-[10px] text-studio-muted">
            <span>60 Hz Center</span>
            <span>Sub-Harmonics & 808 Body</span>
          </div>
        </div>

        {/* 120Hz Kick Punch */}
        <div className="p-5 rounded-xl bg-white/[0.02] border border-white/5 hover:border-cyan-500/30 transition-all">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center space-x-2">
              <Zap className="w-4 h-4 text-cyan-400" />
              <label htmlFor="punch-slider" className="text-xs font-semibold text-gray-200">Kick Punch Peak</label>
            </div>
            <span className="font-mono text-xs font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
              {punch > 0 ? `+${punch.toFixed(1)}` : punch.toFixed(1)} dB
            </span>
          </div>

          <div className="flex items-center space-x-3 mb-2">
            <span className="text-[10px] font-mono text-studio-muted">-12dB</span>
            <input
              id="punch-slider"
              type="range"
              min="-12"
              max="12"
              step="0.5"
              value={punch}
              onChange={(e) => onPunchChange(parseFloat(e.target.value))}
              className="flex-1 accent-cyan-500"
            />
            <span className="text-[10px] font-mono text-studio-muted">+12dB</span>
          </div>

          <div className="flex justify-between items-center text-[10px] text-studio-muted">
            <span>120 Hz Peak (Q = 1.2)</span>
            <span>Chest Thump & Transient Impact</span>
          </div>
        </div>
      </div>
    </div>
  );
};
