import React, { useState } from 'react';
import {
  Shuffle,
  Sparkles,
  X,
  Play,
  CheckCircle2,
  Flame,
} from 'lucide-react';
import {
  tasteBlend,
  PRESET_BLEND_PERSONAS,
  BlendPersona,
  BlendResult,
} from '../../services/socialEngine';
import { userLibrary } from '../../services/userLibraryService';
import { EchoTrack } from '../../services/streamResolver';

interface TasteBlendModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPlayBlendTracks: (tracks: EchoTrack[]) => void;
}

export const TasteBlendModal: React.FC<TasteBlendModalProps> = ({
  isOpen,
  onClose,
  onPlayBlendTracks,
}) => {
  const [selectedPersona, setSelectedPersona] = useState<BlendPersona>(PRESET_BLEND_PERSONAS[0]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [blendResult, setBlendResult] = useState<BlendResult | null>(null);

  const currentUser = userLibrary.getCurrentUser();

  if (!isOpen) return null;

  const handleGenerateBlend = async () => {
    setIsGenerating(true);
    try {
      const result = await tasteBlend.createBlendWithPersona(selectedPersona, currentUser);
      setBlendResult(result);
    } catch (e) {
      console.error('[TasteBlend] Generate error:', e);
    }
    setIsGenerating(false);
  };

  const handlePlayNow = () => {
    if (blendResult && blendResult.tracks.length > 0) {
      onPlayBlendTracks(blendResult.tracks);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div
        className="relative w-full max-w-xl bg-[#111116] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-pink-500 to-violet-500 flex items-center justify-center text-white shadow-md">
              <Shuffle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
                Vybe Taste Blend
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300">
                  Dual Avatars
                </span>
              </h2>
              <p className="text-xs text-zinc-400">Merge your music library with friends into a daily synced mix</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {!blendResult ? (
            <>
              {/* Persona Selector */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400 block mb-3">
                  Choose Friend or Artist Persona to Blend With:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {PRESET_BLEND_PERSONAS.map((p) => {
                    const isSelected = selectedPersona.id === p.id;
                    return (
                      <div
                        key={p.id}
                        onClick={() => setSelectedPersona(p)}
                        className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-white/[0.08] border-pink-500 shadow-md shadow-pink-950/30'
                            : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.05]'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold text-white flex-shrink-0"
                            style={{ backgroundColor: p.avatarColor }}
                          >
                            {p.avatarEmoji}
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold text-white leading-tight">{p.name}</h4>
                            <p className="text-[11px] text-zinc-400 mt-0.5 line-clamp-1">{p.bio}</p>
                          </div>
                        </div>
                        <div className="mt-2.5 flex flex-wrap gap-1">
                          {p.topGenres.map((g) => (
                            <span
                              key={g}
                              className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-zinc-300 font-medium"
                            >
                              {g}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={handleGenerateBlend}
                disabled={isGenerating}
                className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-bold text-sm tracking-wide shadow-lg shadow-pink-950 transition-all flex items-center justify-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <Sparkles className="w-4 h-4 animate-spin" />
                    Calculating Taste Match & Compiling Mix...
                  </>
                ) : (
                  <>
                    <Flame className="w-4 h-4" />
                    Create Blend with {selectedPersona.name.split('•')[0].trim()}
                  </>
                )}
              </button>
            </>
          ) : (
            /* Generated Blend Result View */
            <div className="space-y-6">
              {/* Match Card Hero */}
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-pink-950/40 via-purple-950/30 to-black p-6 border border-pink-500/30">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                  {/* Dual Avatars & Match */}
                  <div className="flex items-center gap-4">
                    <div className="flex items-center -space-x-4">
                      <div
                        className="w-14 h-14 rounded-full border-2 border-white flex items-center justify-center text-lg font-bold text-white shadow-xl"
                        style={{ backgroundColor: blendResult.userA.avatarColor }}
                      >
                        {blendResult.userA.name.charAt(0).toUpperCase()}
                      </div>
                      <div
                        className="w-14 h-14 rounded-full border-2 border-white flex items-center justify-center text-lg font-bold text-white shadow-xl"
                        style={{ backgroundColor: blendResult.userB.avatarColor }}
                      >
                        {blendResult.userB.name.charAt(0).toUpperCase()}
                      </div>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white">{blendResult.title}</h3>
                      <p className="text-xs text-zinc-300 flex items-center gap-1.5 mt-0.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        Saved to Your Library
                      </p>
                    </div>
                  </div>

                  {/* Match Meter */}
                  <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-white/5 border border-white/10 min-w-[120px]">
                    <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-amber-300 font-mono">
                      {blendResult.matchScore}%
                    </span>
                    <span className="text-[10px] text-zinc-400 uppercase font-semibold tracking-wider">
                      Taste Match
                    </span>
                  </div>
                </div>

                <div className="mt-5 flex gap-3">
                  <button
                    onClick={handlePlayNow}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-pink-500 hover:bg-pink-400 text-white font-semibold text-xs tracking-wide shadow-md flex items-center justify-center gap-2 transition-transform hover:scale-[1.02]"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    Play Blend Now (16 Songs)
                  </button>
                  <button
                    onClick={() => setBlendResult(null)}
                    className="py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white font-medium text-xs border border-white/10"
                  >
                    Blend Another
                  </button>
                </div>
              </div>

              {/* Interleaved Tracklist */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3 px-1">
                  Blended Mix (Interleaved Songs)
                </h4>
                <div className="space-y-2">
                  {blendResult.tracks.map((track, idx) => (
                    <div
                      key={`${track.id}-${idx}`}
                      className="p-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3 truncate">
                        <span className="text-xs font-mono text-zinc-500 w-4 text-center">{idx + 1}</span>
                        <div className="w-9 h-9 rounded-lg bg-zinc-800 overflow-hidden flex-shrink-0">
                          {track.artworkUrl ? (
                            <img src={track.artworkUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[10px] text-zinc-500">
                              ♪
                            </div>
                          )}
                        </div>
                        <div className="truncate">
                          <p className="text-xs font-medium text-white truncate">{track.title}</p>
                          <p className="text-[11px] text-zinc-400 truncate">{track.artist}</p>
                        </div>
                      </div>

                      {/* Contributor Avatar Tag */}
                      <div
                        className="px-2 py-0.5 rounded-full text-[10px] font-semibold text-white flex items-center gap-1.5 flex-shrink-0"
                        style={{ backgroundColor: `${track.contributedBy.avatarColor}44` }}
                      >
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: track.contributedBy.avatarColor }}
                        />
                        {track.contributedBy.name}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
