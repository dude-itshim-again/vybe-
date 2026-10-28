import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  ChevronRight,
  ChevronLeft,
  Download,
  Share2,
  Sparkles,
  Music,
  Headphones,
  Award,
  Flame,
  Check,
} from 'lucide-react';
import { discoveryEngine, WrappedStats } from '../../services/discoveryEngine';
import { userLibrary } from '../../services/userLibraryService';
import { TrackMetadata } from '../../providers/types';

interface VybeWrappedModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPlaySong?: (track: TrackMetadata) => void;
}

export const VybeWrappedModal: React.FC<VybeWrappedModalProps> = ({
  isOpen,
  onClose,
  onPlaySong,
}) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [stats, setStats] = useState<WrappedStats | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const progressTimerRef = useRef<any>(null);

  const currentUser = userLibrary.getCurrentUser();
  const SLIDE_DURATION = 6500; // 6.5s per slide

  useEffect(() => {
    if (!isOpen) return;
    const computedStats = discoveryEngine.getWrappedStats();
    setStats(computedStats);
    setCurrentSlide(0);
  }, [isOpen]);

  // Auto-advance story slides
  useEffect(() => {
    if (!isOpen || isPaused) return;

    progressTimerRef.current = setTimeout(() => {
      setCurrentSlide((prev) => {
        if (prev < 4) return prev + 1;
        return prev; // Stay on last slide
      });
    }, SLIDE_DURATION);

    return () => {
      if (progressTimerRef.current) clearTimeout(progressTimerRef.current);
    };
  }, [isOpen, currentSlide, isPaused]);

  if (!isOpen || !stats) return null;

  const nextSlide = () => {
    if (currentSlide < 4) setCurrentSlide(currentSlide + 1);
  };

  const prevSlide = () => {
    if (currentSlide > 0) setCurrentSlide(currentSlide - 1);
  };

  const handleDownloadPoster = async () => {
    setIsDownloading(true);
    try {
      const dataUrl = await discoveryEngine.generateWrappedPosterPng(
        stats,
        currentUser.name || 'Vyber'
      );
      const link = document.createElement('a');
      link.download = `Vybe-Wrapped-2026-${currentUser.name.replace(/\s+/g, '-')}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error('[VybeWrapped] Poster download failed:', e);
    }
    setIsDownloading(false);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator
        .share({
          title: 'My Vybe Wrapped 2026',
          text: `I listened to ${stats.totalMinutesListened} minutes of music on Vybe! My top style: ${stats.topAudioStyle.title}.`,
          url: window.location.href,
        })
        .catch(() => {});
    } else {
      navigator.clipboard.writeText(
        `I listened to ${stats.totalMinutesListened} minutes of music on Vybe! My top style: ${stats.topAudioStyle.title}. Check it out on Vybe!`
      );
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/90 backdrop-blur-xl animate-fade-in select-none">
      <div
        className="relative w-full max-w-md h-[90vh] max-h-[820px] bg-[#07070a] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col justify-between"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {/* Top Story Progress Bars */}
        <div className="absolute top-4 left-4 right-4 z-30 flex gap-1.5">
          {[0, 1, 2, 3, 4].map((index) => (
            <div
              key={index}
              className="h-1 flex-1 rounded-full bg-white/20 overflow-hidden backdrop-blur-sm cursor-pointer"
              onClick={() => setCurrentSlide(index)}
            >
              <div
                className={`h-full bg-white transition-all duration-200 ${
                  index < currentSlide
                    ? 'w-full'
                    : index === currentSlide
                    ? 'w-full animate-progress'
                    : 'w-0'
                }`}
                style={{
                  animationDuration: `${SLIDE_DURATION}ms`,
                  animationPlayState: isPaused ? 'paused' : 'running',
                }}
              />
            </div>
          ))}
        </div>

        {/* Top Header Actions */}
        <div className="absolute top-8 left-4 right-4 z-30 flex items-center justify-between text-white/80">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold tracking-widest text-white uppercase bg-black/40 px-2.5 py-1 rounded-full border border-white/10 backdrop-blur-md">
              Vybe Wrapped 2026
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-black/40 hover:bg-black/60 text-white/80 hover:text-white border border-white/10 backdrop-blur-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Story Slide Canvas / Content */}
        <div className="relative flex-1 flex flex-col justify-center px-6 pt-20 pb-8 z-10 overflow-hidden">
          {/* SLIDE 0: Total Minutes & Percentile */}
          {currentSlide === 0 && (
            <div className="space-y-6 text-center animate-fade-in">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-purple-600 to-emerald-400 flex items-center justify-center mx-auto shadow-2xl shadow-purple-900/40">
                <Headphones className="w-10 h-10 text-white" />
              </div>

              <div>
                <span className="text-xs font-mono tracking-widest uppercase text-emerald-400 font-bold block mb-1">
                  {currentUser.name}'s Sonic Journey
                </span>
                <h3 className="text-4xl sm:text-5xl font-black text-white tracking-tight">
                  {stats.totalMinutesListened.toLocaleString()}
                  <span className="text-xl sm:text-2xl text-zinc-400 font-normal ml-2">mins</span>
                </h3>
                <p className="text-sm text-zinc-300 mt-2 font-medium">of immersion through sound</p>
              </div>

              <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-md text-left">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                    ★
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">{stats.percentileText}</h4>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      You explored {stats.totalUniqueSongs} unique tracks this year across Web, Electron, and Android.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SLIDE 1: Top 5 Songs */}
          {currentSlide === 1 && (
            <div className="space-y-4 animate-fade-in">
              <div className="text-center mb-4">
                <span className="text-xs font-mono uppercase tracking-widest text-cyan-400 font-bold block">
                  On Repeat All Year
                </span>
                <h3 className="text-2xl font-black text-white">Your Top Songs</h3>
              </div>

              <div className="space-y-2.5">
                {stats.topTracks.slice(0, 5).map((track, idx) => (
                  <div
                    key={`${track.id}-${idx}`}
                    className="p-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 flex items-center justify-between group transition-all"
                  >
                    <div className="flex items-center gap-3.5 truncate">
                      <span className="font-mono text-base font-black text-cyan-400 w-5 text-center">
                        {idx + 1}
                      </span>
                      <div className="w-11 h-11 rounded-xl bg-zinc-800 overflow-hidden flex-shrink-0">
                        {track.artworkUrl ? (
                          <img src={track.artworkUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs text-zinc-500">
                            ♪
                          </div>
                        )}
                      </div>
                      <div className="truncate">
                        <p className="text-sm font-semibold text-white truncate">{track.title}</p>
                        <p className="text-xs text-zinc-400 truncate">{track.artist}</p>
                      </div>
                    </div>

                    {onPlaySong && (
                      <button
                        onClick={() => onPlaySong(track)}
                        className="p-2 rounded-xl bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500 hover:text-white transition-colors"
                        title="Play Song"
                      >
                        <Music className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SLIDE 2: Top 5 Artists */}
          {currentSlide === 2 && (
            <div className="space-y-4 animate-fade-in">
              <div className="text-center mb-4">
                <span className="text-xs font-mono uppercase tracking-widest text-rose-400 font-bold block">
                  The Creators You Loved
                </span>
                <h3 className="text-2xl font-black text-white">Your Top Artists</h3>
              </div>

              <div className="space-y-3">
                {stats.topArtists.slice(0, 5).map((artist, idx) => (
                  <div
                    key={artist.name}
                    className="p-3 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3.5">
                      <span className="font-mono text-base font-black text-rose-400 w-5 text-center">
                        {idx + 1}
                      </span>
                      <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-rose-600 to-purple-600 flex items-center justify-center font-bold text-white text-base shadow-md">
                        {artist.name.charAt(0)}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">{artist.name}</h4>
                        <p className="text-xs text-zinc-400">{artist.minutesListened} minutes streamed</p>
                      </div>
                    </div>
                    <Award className="w-4 h-4 text-rose-400" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SLIDE 3: Audio Style Persona */}
          {currentSlide === 3 && (
            <div className="space-y-6 text-center animate-fade-in">
              <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-amber-500 to-rose-600 flex items-center justify-center mx-auto shadow-2xl shadow-amber-900/40">
                <Flame className="w-10 h-10 text-white" />
              </div>

              <div>
                <span className="text-xs font-mono uppercase tracking-widest text-amber-400 font-bold block mb-1">
                  Acoustic Identity
                </span>
                <h3 className="text-3xl font-black text-white tracking-tight">
                  {stats.topAudioStyle.title}
                </h3>
                <div className="inline-block px-3 py-1 mt-2 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 font-mono text-xs font-bold">
                  {stats.topAudioStyle.badge}
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-md text-left">
                <p className="text-sm text-zinc-300 leading-relaxed">
                  {stats.topAudioStyle.description}
                </p>
              </div>
            </div>
          )}

          {/* SLIDE 4: Sonic Aura & Share Poster */}
          {currentSlide === 4 && (
            <div className="space-y-6 text-center animate-fade-in">
              {/* Dynamic Aura Orb */}
              <div className="relative w-36 h-36 mx-auto flex items-center justify-center">
                <div
                  className="absolute inset-0 rounded-full blur-2xl opacity-75 animate-pulse"
                  style={{
                    background: `radial-gradient(circle, ${stats.sonicAura.primaryColor} 0%, ${stats.sonicAura.secondaryColor} 100%)`,
                  }}
                />
                <div
                  className="relative w-28 h-28 rounded-full border border-white/30 backdrop-blur-lg flex items-center justify-center shadow-2xl"
                  style={{
                    background: `linear-gradient(135deg, ${stats.sonicAura.primaryColor}88, ${stats.sonicAura.secondaryColor}aa)`,
                  }}
                >
                  <Sparkles className="w-10 h-10 text-white" />
                </div>
              </div>

              <div>
                <span className="text-xs font-mono uppercase tracking-widest text-purple-400 font-bold block mb-1">
                  Your Sonic Aura
                </span>
                <h3 className="text-2xl font-black text-white">{stats.sonicAura.title}</h3>
                <p className="text-xs text-zinc-300 mt-1 max-w-xs mx-auto">
                  {stats.sonicAura.description}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2.5 pt-2">
                <button
                  onClick={handleDownloadPoster}
                  disabled={isDownloading}
                  className="w-full py-3.5 px-4 rounded-2xl bg-white text-black font-black text-xs uppercase tracking-wider hover:bg-zinc-200 transition-transform active:scale-[0.98] shadow-lg flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  {isDownloading ? 'Rendering 1080x1920 Poster...' : 'Download Wrapped Poster (PNG)'}
                </button>

                <button
                  onClick={handleShare}
                  className="w-full py-3 px-4 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-semibold text-xs tracking-wider border border-white/10 transition-colors flex items-center justify-center gap-2"
                >
                  {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
                  {isCopied ? 'Link Copied!' : 'Share to Instagram / Friends'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Invisible Click Zones for Left / Right Tap Navigation */}
        <div
          className="absolute inset-y-20 left-0 w-1/3 z-20 cursor-pointer"
          onClick={prevSlide}
          title="Previous slide"
        />
        <div
          className="absolute inset-y-20 right-0 w-1/3 z-20 cursor-pointer"
          onClick={nextSlide}
          title="Next slide"
        />

        {/* Bottom Navigation Buttons */}
        <div className="p-4 border-t border-white/5 flex items-center justify-between text-xs text-zinc-500 font-mono z-30 bg-black/40 backdrop-blur-md">
          <button
            onClick={prevSlide}
            disabled={currentSlide === 0}
            className={`p-2 rounded-xl flex items-center gap-1 ${
              currentSlide === 0 ? 'opacity-30 cursor-not-allowed' : 'text-white hover:bg-white/5'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
            Prev
          </button>
          <span>
            {currentSlide + 1} / 5
          </span>
          <button
            onClick={nextSlide}
            disabled={currentSlide === 4}
            className={`p-2 rounded-xl flex items-center gap-1 ${
              currentSlide === 4 ? 'opacity-30 cursor-not-allowed' : 'text-white hover:bg-white/5'
            }`}
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
