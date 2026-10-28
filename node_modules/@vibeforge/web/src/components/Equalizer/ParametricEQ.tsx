import React from 'react';
import { Sliders, Sparkles, RotateCcw } from 'lucide-react';
import { EQPreset } from '../../audio/eqPresets';

interface ParametricEQProps {
  bands: [number, number, number, number, number];
  activePresetId: string;
  presets: EQPreset[];
  onBandChange: (index: number, val: number) => void;
  onApplyPreset: (preset: EQPreset) => void;
  onReset: () => void;
}

const BAND_LABELS = [
  { freq: '125 Hz', name: 'Low-Mid', desc: 'Body & Warmth' },
  { freq: '500 Hz', name: 'Mid', desc: 'Clutter / Boxiness' },
  { freq: '1.5 kHz', name: 'High-Mid', desc: 'Vocal Cut' },
  { freq: '4 kHz', name: 'Presence', desc: 'Articulation' },
  { freq: '10 kHz', name: 'Air', desc: 'Sheen & Brilliance' },
];

export const ParametricEQ: React.FC<ParametricEQProps> = ({
  bands,
  activePresetId,
  presets,
  onBandChange,
  onApplyPreset,
  onReset,
}) => {
  return (
    <div className="glass-panel rounded-2xl p-5 sm:p-6 relative overflow-visible shrink-0 h-auto">
      {/* Header & Presets */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white tracking-wide">5-Band Parametric Equalizer</h2>
            <p className="text-xs text-studio-muted">Precision Q=1.4 Peaking Stage (-12dB to +12dB)</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={onReset}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-studio-muted hover:text-white bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset EQ</span>
          </button>
        </div>
      </div>

      {/* Preset Pills */}
      <div className="mb-6">
        <div className="flex items-center space-x-2 mb-2 text-xs text-studio-muted font-medium">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Factory Presets:</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {presets.map((preset) => {
            const isActive = activePresetId === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => onApplyPreset(preset)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center space-x-2 border ${
                  isActive
                    ? 'bg-white/10 text-white shadow-lg'
                    : 'bg-white/[0.02] text-gray-400 hover:text-white hover:bg-white/[0.06] border-white/5'
                }`}
                style={{
                  borderColor: isActive ? preset.accentColor : undefined,
                  boxShadow: isActive ? `0 0 15px -3px ${preset.accentColor}40` : undefined,
                }}
              >
                <span
                  className="w-2 h-2 rounded-full inline-block"
                  style={{ backgroundColor: preset.accentColor }}
                />
                <span>{preset.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 5-Band Vertical Faders */}
      <div className="grid grid-cols-5 gap-3 sm:gap-4 p-5 rounded-xl bg-black/20 border border-white/5">
        {bands.map((gain, idx) => {
          const info = BAND_LABELS[idx];
          const isPositive = gain > 0;
          const isZero = gain === 0;

          return (
            <div key={info.freq} className="flex flex-col items-center">
              {/* dB Readout */}
              <span
                className={`font-mono text-xs font-bold px-2 py-0.5 rounded border mb-3 transition-colors ${
                  isZero
                    ? 'text-gray-400 bg-white/5 border-white/5'
                    : isPositive
                    ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                    : 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                }`}
              >
                {gain > 0 ? `+${gain.toFixed(1)}` : gain.toFixed(1)}
              </span>

              {/* Fader Track & Thumb */}
              <div className="relative h-44 flex items-center justify-center my-1">
                {/* Center 0dB Reference Line */}
                <div className="absolute w-6 h-[1px] bg-white/20 z-0 pointer-events-none" />

                <input
                  type="range"
                  min="-12"
                  max="12"
                  step="0.5"
                  value={gain}
                  onChange={(e) => onBandChange(idx, parseFloat(e.target.value))}
                  className="h-40 w-3 accent-purple-400"
                  style={{
                    writingMode: 'vertical-lr',
                    direction: 'rtl',
                    WebkitAppearance: 'slider-vertical',
                  }}
                />
              </div>

              {/* Frequency Label */}
              <div className="mt-3 text-center">
                <span className="block font-mono text-xs font-semibold text-gray-200">
                  {info.freq}
                </span>
                <span className="block text-[10px] text-studio-muted truncate max-w-[70px]">
                  {info.name}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
