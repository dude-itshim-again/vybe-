import React, { useState } from 'react';
import {
  X,
  Download,
  Check,
  Palette,
  Sparkles,
  Music,
} from 'lucide-react';
import { TrackMetadata } from '../../providers/types';

export interface LyricCardItem {
  id?: string;
  startTime?: number;
  text: string;
}

interface LyricCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  track: TrackMetadata | null;
  lyrics: LyricCardItem[];
  activeLineIndex: number;
}

interface PaletteOption {
  id: string;
  name: string;
  bgColor: string;
  textColor: string;
  accentColor: string;
  gradient: string;
}

const PALETTES: PaletteOption[] = [
  {
    id: 'oxblood',
    name: 'Oxblood & Cream',
    bgColor: '#3A090D',
    textColor: '#F7EDE8',
    accentColor: '#ED5564',
    gradient: 'linear-gradient(135deg, #3A090D 0%, #170406 100%)',
  },
  {
    id: 'noir',
    name: 'Noir Strobe',
    bgColor: '#0A0A0E',
    textColor: '#FFFFFF',
    accentColor: '#22C55E',
    gradient: 'linear-gradient(135deg, #111116 0%, #050507 100%)',
  },
  {
    id: 'spotify',
    name: 'Spotify Emerald',
    bgColor: '#121212',
    textColor: '#FFFFFF',
    accentColor: '#1DB954',
    gradient: 'linear-gradient(135deg, #18281E 0%, #0D1611 100%)',
  },
  {
    id: 'liquid-violet',
    name: 'Liquid Violet',
    bgColor: '#17072B',
    textColor: '#F5F3FF',
    accentColor: '#C084FC',
    gradient: 'linear-gradient(135deg, #250C46 0%, #0F031E 100%)',
  },
];

export const LyricCardModal: React.FC<LyricCardModalProps> = ({
  isOpen,
  onClose,
  track,
  lyrics,
  activeLineIndex,
}) => {
  const [selectedIndices, setSelectedIndices] = useState<number[]>(() => {
    const validIdx = activeLineIndex >= 0 ? activeLineIndex : 0;
    const indices: number[] = [validIdx];
    if (lyrics.length > validIdx + 1) indices.push(validIdx + 1);
    return indices;
  });
  const [activePalette, setActivePalette] = useState<PaletteOption>(PALETTES[0]);
  const [isGenerating, setIsGenerating] = useState(false);

  if (!isOpen || !track) return null;

  const toggleLine = (index: number) => {
    if (selectedIndices.includes(index)) {
      if (selectedIndices.length > 1) {
        setSelectedIndices(selectedIndices.filter((i) => i !== index));
      }
    } else {
      if (selectedIndices.length < 4) {
        setSelectedIndices([...selectedIndices, index].sort((a, b) => a - b));
      }
    }
  };

  const renderCardToCanvas = async (canvas: HTMLCanvasElement): Promise<void> => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = 1080;
    const height = 1350;
    canvas.width = width;
    canvas.height = height;

    // 1. Background gradient
    const grad = ctx.createLinearGradient(0, 0, width, height);
    if (activePalette.id === 'oxblood') {
      grad.addColorStop(0, '#420B10');
      grad.addColorStop(1, '#1A0406');
    } else if (activePalette.id === 'noir') {
      grad.addColorStop(0, '#15151B');
      grad.addColorStop(1, '#050508');
    } else if (activePalette.id === 'spotify') {
      grad.addColorStop(0, '#1C3125');
      grad.addColorStop(1, '#0C1510');
    } else {
      grad.addColorStop(0, '#280E49');
      grad.addColorStop(1, '#0E041E');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Subtle background mesh glow
    const glow = ctx.createRadialGradient(width / 2, height / 2, 50, width / 2, height / 2, 600);
    glow.addColorStop(0, `${activePalette.accentColor}25`);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    // 2. Track Artwork & Header
    let artworkLoaded = false;
    if (track.artworkUrl) {
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = track.artworkUrl!;
        });
        // Rounded artwork card
        ctx.save();
        ctx.beginPath();
        ctx.roundRect?.(100, 100, 140, 140, 24);
        ctx.clip();
        ctx.drawImage(img, 100, 100, 140, 140);
        ctx.restore();
        artworkLoaded = true;
      } catch (_) {}
    }

    if (!artworkLoaded) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.roundRect?.(100, 100, 140, 140, 24);
      ctx.fill();
    }

    // Title and Artist
    ctx.fillStyle = activePalette.textColor;
    ctx.font = 'bold 36px sans-serif';
    const cleanTitle = track.title.length > 28 ? `${track.title.slice(0, 26)}...` : track.title;
    ctx.fillText(cleanTitle, 270, 160);

    ctx.fillStyle = `${activePalette.textColor}99`;
    ctx.font = '26px sans-serif';
    ctx.fillText(track.artist || 'Unknown Artist', 270, 210);

    // Quote Mark
    ctx.fillStyle = activePalette.accentColor;
    ctx.font = 'bold 120px serif';
    ctx.fillText('“', 100, 420);

    // Selected Lyrics Text
    const linesToDraw = selectedIndices
      .map((i) => lyrics[i]?.text)
      .filter((t): t is string => Boolean(t && t.trim()));

    let currentY = 500;
    ctx.fillStyle = activePalette.textColor;
    ctx.font = 'bold 54px sans-serif';

    linesToDraw.forEach((line) => {
      // Word wrap
      const words = line.split(' ');
      let currentLine = '';

      for (let n = 0; n < words.length; n++) {
        const testLine = currentLine + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > 860 && n > 0) {
          ctx.fillText(currentLine.trim(), 100, currentY);
          currentLine = words[n] + ' ';
          currentY += 76;
        } else {
          currentLine = testLine;
        }
      }
      ctx.fillText(currentLine.trim(), 100, currentY);
      currentY += 100;
    });

    // Footer Watermark Card
    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.roundRect?.(100, 1180, 880, 80, 20);
    ctx.fill();

    ctx.fillStyle = activePalette.accentColor;
    ctx.font = 'bold 22px monospace';
    ctx.fillText('VYBE MUSIC', 140, 1230);

    ctx.fillStyle = `${activePalette.textColor}80`;
    ctx.font = '20px sans-serif';
    ctx.fillText('• Synced Kinetic Lyrics', 310, 1230);
  };

  const handleDownload = async () => {
    setIsGenerating(true);
    try {
      const offscreen = document.createElement('canvas');
      await renderCardToCanvas(offscreen);
      const dataUrl = offscreen.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `Vybe-Lyrics-${track.title.replace(/\s+/g, '-')}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error('[LyricCard] Download failed:', e);
    }
    setIsGenerating(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <div
        className="relative w-full max-w-2xl bg-[#111116] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-pink-500/10 flex items-center justify-center text-pink-400 border border-pink-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Share Lyric Card</h2>
              <p className="text-xs text-zinc-400">1080x1350 High-Res Story Post</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content grid */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: Lyric line selector & palette picker */}
          <div className="space-y-5">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 block mb-2">
                1. Select Lines (Pick 1 to 4):
              </label>
              <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1 border border-white/5 rounded-xl p-2 bg-black/30">
                {lyrics.map((line, idx) => {
                  const isSelected = selectedIndices.includes(idx);
                  return (
                    <div
                      key={`${line.id || idx}-${idx}`}
                      onClick={() => toggleLine(idx)}
                      className={`p-2.5 rounded-lg text-xs cursor-pointer transition-all flex items-start gap-2.5 ${
                        isSelected
                          ? 'bg-pink-500/20 border border-pink-500/40 text-white font-medium'
                          : 'hover:bg-white/5 text-zinc-400'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center flex-shrink-0 border ${
                          isSelected
                            ? 'bg-pink-500 border-pink-400 text-white'
                            : 'border-zinc-700 bg-black/40'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <span className="leading-relaxed">{line.text}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Palette Options */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 block mb-2 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-zinc-400" />
                2. Theme Palette:
              </label>
              <div className="grid grid-cols-2 gap-2">
                {PALETTES.map((pal) => {
                  const isSelected = activePalette.id === pal.id;
                  return (
                    <button
                      key={pal.id}
                      onClick={() => setActivePalette(pal)}
                      className={`p-2.5 rounded-xl border text-left text-xs font-medium transition-all flex items-center gap-2.5 ${
                        isSelected
                          ? 'border-white text-white shadow-md'
                          : 'border-white/5 text-zinc-400 hover:text-white bg-white/[0.02]'
                      }`}
                      style={{ background: pal.gradient }}
                    >
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-white/20 flex-shrink-0"
                        style={{ backgroundColor: pal.accentColor }}
                      />
                      <span className="truncate">{pal.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right: Live Card Preview */}
          <div className="flex flex-col justify-between">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 block mb-2">
                Preview:
              </label>
              <div
                className="aspect-[4/5] rounded-2xl p-5 border border-white/10 shadow-xl flex flex-col justify-between overflow-hidden relative"
                style={{ background: activePalette.gradient }}
              >
                {/* Header */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-black/40 overflow-hidden border border-white/10 flex-shrink-0">
                    {track.artworkUrl ? (
                      <img src={track.artworkUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Music className="w-4 h-4 text-zinc-500 m-3" />
                    )}
                  </div>
                  <div className="truncate">
                    <p className="text-xs font-bold truncate" style={{ color: activePalette.textColor }}>
                      {track.title}
                    </p>
                    <p className="text-[10px] truncate" style={{ color: `${activePalette.textColor}80` }}>
                      {track.artist}
                    </p>
                  </div>
                </div>

                {/* Lyrics text */}
                <div className="my-auto space-y-2 py-4">
                  <span
                    className="text-4xl font-serif block -mb-2 leading-none"
                    style={{ color: activePalette.accentColor }}
                  >
                    “
                  </span>
                  {selectedIndices.map((i) => (
                    <p
                      key={i}
                      className="text-sm sm:text-base font-bold leading-snug tracking-tight"
                      style={{ color: activePalette.textColor }}
                    >
                      {lyrics[i]?.text}
                    </p>
                  ))}
                </div>

                {/* Footer */}
                <div className="pt-3 border-t border-white/10 flex items-center justify-between text-[10px]">
                  <span className="font-mono font-bold" style={{ color: activePalette.accentColor }}>
                    VYBE MUSIC
                  </span>
                  <span style={{ color: `${activePalette.textColor}80` }}>Synced Kinetic Lyrics</span>
                </div>
              </div>
            </div>

            {/* Download Button */}
            <button
              onClick={handleDownload}
              disabled={isGenerating}
              className="mt-4 w-full py-3 px-4 rounded-xl bg-white text-black font-bold text-xs uppercase tracking-wider hover:bg-zinc-200 transition-transform active:scale-[0.98] shadow-lg flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              {isGenerating ? 'Rendering High-Res PNG...' : 'Download Lyric Card (PNG)'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
