import React, { useState } from 'react';
import {
  Sparkles,
  Film,
  SkipForward,
  Search,
  Link,
  Sliders,
  ChevronDown,
  X,
} from 'lucide-react';
import { VibeProfile, VideoCandidate } from '../../services/videoDiscoveryService';

interface VisualVibeBarProps {
  vibeProfile: VibeProfile | null;
  activeVideo: VideoCandidate | null;
  videoCandidates: VideoCandidate[];
  onSelectVideo: (video: VideoCandidate) => void;
  onNextVideo: () => void;
  videoOpacity: number;
  onOpacityChange: (opacity: number) => void;
  onCustomQuerySearch: (query: string) => void;
  onCustomUrlSubmit: (url: string) => void;
}

export const VisualVibeBar: React.FC<VisualVibeBarProps> = ({
  vibeProfile,
  activeVideo,
  videoCandidates,
  onSelectVideo,
  onNextVideo,
  videoOpacity,
  onOpacityChange,
  onCustomQuerySearch,
  onCustomUrlSubmit,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [customUrl, setCustomUrl] = useState('');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onCustomQuerySearch(searchQuery.trim());
      setSearchQuery('');
    }
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customUrl.trim()) {
      onCustomUrlSubmit(customUrl.trim());
      setCustomUrl('');
    }
  };

  const currentIdx = activeVideo
    ? videoCandidates.findIndex(v => v.id === activeVideo.id) + 1
    : 1;

  return (
    <>
      {/* Floating Compact Glass Pill (Bottom Right of Stage) */}
      <div className="absolute bottom-4 right-4 z-30 flex items-center space-x-2 bg-black/60 backdrop-blur-xl border border-white/10 p-1.5 rounded-2xl shadow-2xl text-xs">
        {/* Vibe Archetype Indicator */}
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center space-x-2 px-3 py-1.5 rounded-xl hover:bg-white/10 text-gray-200 transition-all text-left"
          title="Inspect AI Visual Vibe & Controls"
        >
          <div
            className="w-2.5 h-2.5 rounded-full animate-pulse shadow-sm"
            style={{
              backgroundColor: vibeProfile?.colorPalette.accentNeonHex || '#a855f7',
              boxShadow: `0 0 10px ${vibeProfile?.colorPalette.accentNeonHex || '#a855f7'}`,
            }}
          />
          <span className="font-semibold text-white truncate max-w-[140px] sm:max-w-[200px]">
            {vibeProfile?.archetype || 'Cyberpunk Abstract'}
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
        </button>

        {/* Quick Next Visual Loop Button */}
        <button
          onClick={onNextVideo}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/30 transition-all font-semibold"
          title="Next Visual Loop"
        >
          <SkipForward className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden sm:inline">Next Loop</span>
          <span className="text-[10px] font-mono text-purple-300/80">
            {currentIdx}/{Math.max(1, videoCandidates.length)}
          </span>
        </button>
      </div>

      {/* Expanded Vibe Director & Visual Controls Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-xl bg-[#0c0d14] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/[0.02]">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-purple-600/20 text-purple-400 flex items-center justify-center border border-purple-500/20">
                  <Film className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight">
                    AI Visual Director & Background Cinema
                  </h3>
                  <p className="text-xs text-gray-400">
                    Stage 4 Dual-Video Crossfade & Vibe Reranking Engine
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* AI Vibe Summary Card */}
              {vibeProfile && (
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Sparkles className="w-4 h-4 text-purple-400" />
                      <span className="text-xs font-bold uppercase tracking-wider text-purple-300">
                        {vibeProfile.archetype}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <div
                        className="w-3.5 h-3.5 rounded-full border border-white/20"
                        style={{ backgroundColor: vibeProfile.colorPalette.primaryHex }}
                        title="Primary"
                      />
                      <div
                        className="w-3.5 h-3.5 rounded-full border border-white/20"
                        style={{ backgroundColor: vibeProfile.colorPalette.secondaryHex }}
                        title="Secondary"
                      />
                      <div
                        className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-sm"
                        style={{
                          backgroundColor: vibeProfile.colorPalette.accentNeonHex,
                          boxShadow: `0 0 8px ${vibeProfile.colorPalette.accentNeonHex}`,
                        }}
                        title="Accent Neon"
                      />
                    </div>
                  </div>

                  <p className="text-xs text-gray-300 leading-relaxed italic">
                    "{vibeProfile.vibeSummary}"
                  </p>

                  <div className="pt-2 flex flex-wrap gap-2">
                    {vibeProfile.searchQueries.map((q, i) => (
                      <button
                        key={i}
                        onClick={() => onCustomQuerySearch(q.query)}
                        className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] font-mono text-cyan-300 border border-white/5 transition-all"
                      >
                        {q.query}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Matched Visual Loop Candidates */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-gray-300 font-semibold">
                  <span>Matched Video Loops ({videoCandidates.length}):</span>
                  <span className="text-[11px] font-mono text-gray-500">1200ms Crossfade</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  {videoCandidates.map((candidate) => {
                    const isSelected = activeVideo?.id === candidate.id;
                    return (
                      <button
                        key={candidate.id}
                        onClick={() => onSelectVideo(candidate)}
                        className={`p-2.5 rounded-xl text-left border transition-all flex flex-col justify-between ${
                          isSelected
                            ? 'bg-purple-600/20 border-purple-500 text-white shadow-lg shadow-purple-950/40'
                            : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.06] text-gray-300'
                        }`}
                      >
                        <div className="text-xs font-bold truncate w-full">{candidate.title}</div>
                        <div className="flex items-center justify-between text-[10px] text-gray-400 mt-2 font-mono">
                          <span className="uppercase tracking-wider">{candidate.source}</span>
                          {isSelected && <span className="text-cyan-400 font-bold">ACTIVE</span>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Video Opacity Dimmer Slider */}
              <div className="p-4 rounded-2xl bg-white/[0.015] border border-white/5 space-y-2">
                <div className="flex items-center justify-between text-xs text-gray-300 font-semibold">
                  <div className="flex items-center space-x-2">
                    <Sliders className="w-3.5 h-3.5 text-purple-400" />
                    <span>Background Video Opacity (Dimmer)</span>
                  </div>
                  <span className="font-mono text-xs text-cyan-400">
                    {Math.round(videoOpacity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="1.0"
                  step="0.05"
                  value={videoOpacity}
                  onChange={(e) => onOpacityChange(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>

              {/* Custom Search Query & URL Inputs */}
              <div className="space-y-3">
                {/* Search Term Input */}
                <form onSubmit={handleSearchSubmit} className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search video vibe (e.g. 'tokyo rain neon', 'aurora space')..."
                      className="w-full bg-white/[0.04] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-all"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs rounded-xl transition-all"
                  >
                    Find
                  </button>
                </form>

                {/* Direct MP4 / Stream URL Input */}
                <form onSubmit={handleUrlSubmit} className="flex gap-2">
                  <div className="relative flex-1">
                    <Link className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                    <input
                      type="url"
                      value={customUrl}
                      onChange={(e) => setCustomUrl(e.target.value)}
                      placeholder="Paste direct .mp4 or streaming video URL..."
                      className="w-full bg-white/[0.04] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-all font-mono"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs rounded-xl transition-all"
                  >
                    Play URL
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
