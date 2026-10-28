import React, { useState } from 'react';
import {
  Search,
  X,
  Music,
  Clock,
  Sparkles,
  FileText,
  UploadCloud,
  CheckCircle2,
  Sliders,
  RotateCcw,
} from 'lucide-react';
import { LRCLibRecord, searchLyrics } from '../../services/lrclibClient';
import { LyricTrack, parseLrc } from '../../services/lrcParser';

interface LyricsSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTrackTitle?: string;
  currentArtist?: string;
  syncOffsetMs: number;
  onAdjustSyncOffset: (deltaMs: number) => void;
  onSetSyncOffset: (valMs: number) => void;
  onSelectLRCLibRecord: (record: LRCLibRecord) => void;
  onImportCustomLyrics: (track: LyricTrack) => void;
}

export const LyricsSearchModal: React.FC<LyricsSearchModalProps> = ({
  isOpen,
  onClose,
  currentTrackTitle = '',
  currentArtist = '',
  syncOffsetMs,
  onAdjustSyncOffset,
  onSetSyncOffset,
  onSelectLRCLibRecord,
  onImportCustomLyrics,
}) => {
  const [activeTab, setActiveTab] = useState<'search' | 'custom'>('search');
  const [query, setQuery] = useState(`${currentArtist ? currentArtist + ' ' : ''}${currentTrackTitle}`.trim());
  const [results, setResults] = useState<LRCLibRecord[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [customLrcText, setCustomLrcText] = useState('');

  if (!isOpen) return null;

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setIsSearching(true);
    setHasSearched(true);
    try {
      const records = await searchLyrics(query);
      setResults(records);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleImportLrcFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setCustomLrcText(content);
      }
    };
    reader.readAsText(file);
  };

  const handleApplyCustomLyrics = () => {
    if (!customLrcText.trim()) return;

    const track = parseLrc(customLrcText, {
      title: currentTrackTitle || 'Custom LRC',
      artist: currentArtist || 'Imported Lyrics',
      source: 'manual_lrc',
    });

    onImportCustomLyrics(track);
    onClose();
  };

  const formatSecs = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-[#0c0d14] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/[0.02]">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-purple-600/20 text-purple-400 flex items-center justify-center border border-purple-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Lyrics & Timing Studio</h2>
              <p className="text-xs text-gray-400">Search LRCLIB database or calibrate kinetic timing</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-white/5 px-6 bg-black/30">
          <button
            onClick={() => setActiveTab('search')}
            className={`py-3 px-4 text-xs font-semibold flex items-center space-x-2 border-b-2 transition-all ${
              activeTab === 'search'
                ? 'border-purple-500 text-purple-400 bg-purple-500/5'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search LRCLIB Database</span>
          </button>
          <button
            onClick={() => setActiveTab('custom')}
            className={`py-3 px-4 text-xs font-semibold flex items-center space-x-2 border-b-2 transition-all ${
              activeTab === 'custom'
                ? 'border-purple-500 text-purple-400 bg-purple-500/5'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Import / Paste .LRC</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'search' ? (
            <div className="space-y-4">
              {/* Search input form */}
              <form onSubmit={handleSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search song title, artist, or keywords..."
                    className="w-full bg-white/[0.04] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-all"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSearching}
                  className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs rounded-xl shadow-lg shadow-purple-900/30 transition-all disabled:opacity-50"
                >
                  {isSearching ? 'Searching...' : 'Search'}
                </button>
              </form>

              {/* Results List */}
              <div className="space-y-2">
                {isSearching && (
                  <div className="py-12 text-center text-sm text-gray-400 animate-pulse">
                    Querying LRCLIB API...
                  </div>
                )}

                {!isSearching && results.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-[11px] font-mono uppercase tracking-wider text-gray-400 px-1">
                      Found {results.length} Matches on LRCLIB:
                    </div>
                    {results.map((rec) => (
                      <div
                        key={rec.id}
                        onClick={() => {
                          onSelectLRCLibRecord(rec);
                          onClose();
                        }}
                        className="p-3.5 rounded-2xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 hover:border-purple-500/30 flex items-center justify-between transition-all cursor-pointer group"
                      >
                        <div className="flex items-center space-x-3.5 min-w-0 pr-2">
                          <div className="w-10 h-10 rounded-xl bg-purple-950/40 border border-purple-500/20 flex items-center justify-center text-purple-400 group-hover:scale-105 transition-transform flex-shrink-0">
                            <Music className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-bold text-white group-hover:text-purple-300 transition-colors truncate">
                              {rec.trackName || rec.name}
                            </div>
                            <div className="text-xs text-gray-400 truncate">
                              {rec.artistName} {rec.albumName ? `• ${rec.albumName}` : ''}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 flex-shrink-0">
                          {rec.syncedLyrics ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Synced 60fps</span>
                            </span>
                          ) : rec.plainLyrics ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-mono text-zinc-400 bg-white/5 border border-white/10">
                              Plain Text
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-mono text-purple-400 bg-purple-500/10 border border-purple-500/20">
                              Instrumental
                            </span>
                          )}

                          {rec.duration > 0 && (
                            <span className="text-xs font-mono text-gray-500 flex items-center gap-1 pl-1">
                              <Clock className="w-3 h-3" />
                              {formatSecs(rec.duration)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!isSearching && hasSearched && results.length === 0 && (
                  <div className="py-12 text-center space-y-2">
                    <p className="text-sm text-gray-300">No matching lyrics found on LRCLIB.</p>
                    <p className="text-xs text-gray-500">
                      Try searching with just the song title, or switch to the "Import .LRC" tab.
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-gray-300">
                  Paste Raw LRC / ELRC Text:
                </label>
                <label className="cursor-pointer text-xs font-semibold text-purple-400 hover:text-purple-300 flex items-center gap-1.5 transition-colors">
                  <UploadCloud className="w-4 h-4" />
                  <span>Upload .lrc file</span>
                  <input
                    type="file"
                    accept=".lrc,.txt"
                    onChange={handleImportLrcFile}
                    className="hidden"
                  />
                </label>
              </div>

              <textarea
                value={customLrcText}
                onChange={(e) => setCustomLrcText(e.target.value)}
                placeholder="[00:12.50] Kinetic lyrics starting here&#10;[00:16.80] With automatic syllable-level interpolation..."
                rows={10}
                className="w-full bg-white/[0.03] border border-white/10 rounded-2xl p-4 font-mono text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-all resize-none"
              />

              <button
                onClick={handleApplyCustomLyrics}
                disabled={!customLrcText.trim()}
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-lg shadow-purple-900/30 transition-all"
              >
                Apply Custom Synced Lyrics
              </button>
            </div>
          )}

          {/* Calibrate Global Sync Offset Section */}
          <div className="pt-4 border-t border-white/5 space-y-3 bg-white/[0.015] p-4 rounded-2xl border border-white/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xs font-semibold text-gray-300">
                <Sliders className="w-3.5 h-3.5 text-purple-400" />
                <span>Microsecond Calibration Offset</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="font-mono text-xs font-bold text-cyan-400">
                  {syncOffsetMs > 0 ? `+${syncOffsetMs}` : syncOffsetMs} ms
                </span>
                {syncOffsetMs !== 0 && (
                  <button
                    onClick={() => onSetSyncOffset(0)}
                    title="Reset offset to 0ms"
                    className="p-1 text-gray-500 hover:text-white transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            <p className="text-[11px] text-gray-500">
              Nudge forward if lyrics appear after the singer sings; nudge backward if lyrics appear too early.
            </p>

            <div className="flex items-center gap-2">
              <button
                onClick={() => onAdjustSyncOffset(-250)}
                className="flex-1 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] font-mono text-gray-300 transition-all"
              >
                -250ms
              </button>
              <button
                onClick={() => onAdjustSyncOffset(-100)}
                className="flex-1 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] font-mono text-gray-300 transition-all"
              >
                -100ms
              </button>
              <button
                onClick={() => onAdjustSyncOffset(100)}
                className="flex-1 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] font-mono text-gray-300 transition-all"
              >
                +100ms
              </button>
              <button
                onClick={() => onAdjustSyncOffset(250)}
                className="flex-1 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] font-mono text-gray-300 transition-all"
              >
                +250ms
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
