import React, { useEffect, useRef } from 'react';
import { AudioDSPEngine } from '../../audio/AudioDSPEngine';
import { Activity } from 'lucide-react';

interface SpectrumCanvasProps {
  engine: AudioDSPEngine | null;
  isPlaying: boolean;
}

export const SpectrumCanvas: React.FC<SpectrumCanvasProps> = ({ engine, isPlaying }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    const binBuffer = new Uint8Array(256);

    // Prepare frequency sample points for the composite EQ curve (logarithmic distribution from 20Hz to 20kHz)
    const numPoints = 180;
    const frequencies = new Float32Array(numPoints);
    for (let i = 0; i < numPoints; i++) {
      // Logarithmic spacing: 20Hz * (20000 / 20) ^ (i / (numPoints - 1))
      frequencies[i] = 20 * Math.pow(20000 / 20, i / (numPoints - 1));
    }

    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      // Clear Canvas with subtle dark glass gradient
      ctx.fillStyle = '#0a0b10';
      ctx.fillRect(0, 0, width, height);

      // Draw Grid Lines (dB and Frequencies)
      drawGrid(ctx, width, height);

      if (engine) {
        // Read live FFT data if audio is active
        if (isPlayingRef.current) {
          engine.getFrequencyData(binBuffer);
        } else {
          // Decay buffer
          for (let i = 0; i < binBuffer.length; i++) {
            binBuffer[i] = Math.max(0, binBuffer[i] * 0.92);
          }
        }

        // 1. Draw Spectrum Frequency Bars with Neon Gradient
        drawSpectrumBars(ctx, binBuffer, width, height);

        // 2. Draw Mathematical Active EQ Composite Curve
        const eqCurveDb = engine.getCompositeFrequencyResponse(frequencies);
        drawEqCurve(ctx, frequencies, eqCurveDb, width, height);
      }

      ctx.restore();
      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [engine]);

  return (
    <div className="glass-panel rounded-2xl p-5 sm:p-6 relative overflow-visible shrink-0 h-auto">
      {/* Canvas Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white tracking-wide">Live Spectrum & EQ Curve</h2>
            <p className="text-xs text-studio-muted">Real-Time FFT 512 Frequency Response Analysis</p>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center space-x-4 text-xs font-mono">
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-1 rounded bg-gradient-to-r from-purple-500 to-cyan-400 inline-block" />
            <span className="text-gray-400">Audio FFT Spectrum</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-3 h-0.5 rounded bg-amber-400 inline-block shadow-[0_0_8px_#f59e0b]" />
            <span className="text-amber-400 font-semibold">Active EQ Curve (dB)</span>
          </div>
        </div>
      </div>

      {/* Canvas Element */}
      <div className="w-full h-64 relative rounded-xl overflow-hidden border border-white/5 bg-black/40">
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>
    </div>
  );
};

// Helper: Draw Frequency & dB Grid
function drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.lineWidth = 1;

  // dB horizontal lines (-12dB, 0dB, +12dB)
  const zeroY = height * 0.5;
  const plus12Y = height * 0.18;
  const minus12Y = height * 0.82;

  [plus12Y, zeroY, minus12Y].forEach((y, i) => {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();

    ctx.fillStyle = i === 1 ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.15)';
    ctx.font = '10px JetBrains Mono, monospace';
    const label = i === 0 ? '+12 dB' : i === 1 ? '  0 dB' : '-12 dB';
    ctx.fillText(label, 8, y - 4);
  });

  // Frequency vertical guide markers (60Hz, 120Hz, 1kHz, 5kHz, 10kHz)
  const keyFreqs = [60, 120, 500, 1500, 4000, 10000];
  keyFreqs.forEach((freq) => {
    const x = freqToX(freq, width);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.font = '9px JetBrains Mono, monospace';
    const label = freq >= 1000 ? `${freq / 1000}k` : `${freq}Hz`;
    ctx.fillText(label, x + 3, height - 8);
  });
}

// Convert frequency (20Hz to 20kHz) to log X coordinate
function freqToX(freq: number, width: number): number {
  const minLog = Math.log10(20);
  const maxLog = Math.log10(20000);
  const freqLog = Math.log10(Math.max(20, Math.min(20000, freq)));
  return ((freqLog - minLog) / (maxLog - minLog)) * width;
}

// Draw Spectrum FFT Bars
function drawSpectrumBars(
  ctx: CanvasRenderingContext2D,
  buffer: Uint8Array,
  width: number,
  height: number
) {
  const barCount = 72;
  const barWidth = (width / barCount) - 2;

  const gradient = ctx.createLinearGradient(0, height, 0, 0);
  gradient.addColorStop(0, 'rgba(168, 85, 247, 0.15)'); // Deep purple base
  gradient.addColorStop(0.5, 'rgba(168, 85, 247, 0.6)'); // Purple mid
  gradient.addColorStop(1, 'rgba(6, 182, 212, 0.9)');    // Cyan peak

  ctx.fillStyle = gradient;

  for (let i = 0; i < barCount; i++) {
    // Non-linear bin grouping to distribute low bass vs high treble appropriately
    const binIndex = Math.min(
      buffer.length - 1,
      Math.floor(Math.pow(i / barCount, 1.8) * buffer.length)
    );
    const value = buffer[binIndex];
    const percent = value / 255;
    const barHeight = Math.max(2, percent * (height * 0.88));
    const x = i * (barWidth + 2);
    const y = height - barHeight;

    // Rounded bar tops
    ctx.beginPath();
    ctx.roundRect(x, y, barWidth, barHeight, [3, 3, 0, 0]);
    ctx.fill();
  }
}

// Draw Smooth Mathematical EQ Curve
function drawEqCurve(
  ctx: CanvasRenderingContext2D,
  frequencies: Float32Array,
  gainsDb: Float32Array,
  width: number,
  height: number
) {
  ctx.beginPath();
  const zeroY = height * 0.5;
  const pixelsPerDb = (height * 0.32) / 12; // 12dB maps to 32% of height

  for (let i = 0; i < frequencies.length; i++) {
    const x = freqToX(frequencies[i], width);
    const y = zeroY - gainsDb[i] * pixelsPerDb;

    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }

  // Neon EQ Curve Stroke
  ctx.shadowColor = '#f59e0b';
  ctx.shadowBlur = 8;
  ctx.strokeStyle = '#fcd34d'; // Amber light
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Reset shadow
  ctx.shadowBlur = 0;
}
