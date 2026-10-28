import React, { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

interface SplashScreenProps {
  onComplete?: () => void;
  onDone?: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = React.memo(({ onComplete, onDone }) => {
  const [isFadingOut, setIsFadingOut] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const userManuallyMutedRef = useRef<boolean>(false);
  const playbackStartedRef = useRef<boolean>(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const bgVideoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasFinishedRef = useRef<boolean>(false);

  // Smooth audio fade out before finishing
  const fadeAudioOut = () => {
    const vid = videoRef.current;
    if (!vid || vid.muted) return;
    const startVol = vid.volume;
    const startTime = Date.now();
    const dur = 500;
    const step = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1, elapsed / dur);
      if (vid) {
        vid.volume = Math.max(0, startVol * (1 - progress));
      }
      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };
    requestAnimationFrame(step);
  };

  const handleFinish = () => {
    if (hasFinishedRef.current) return;
    hasFinishedRef.current = true;
    fadeAudioOut();
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
    setIsFadingOut(true);
    setTimeout(() => {
      onComplete?.();
      onDone?.();
    }, 600);
  };

  useEffect(() => {
    // 7-second safety fallback timer in case autoplay is blocked or video fails
    timerRef.current = setTimeout(() => {
      handleFinish();
    }, 7000);

    // Attempt video playback with audio ALWAYS UNMUTED by default
    if (videoRef.current) {
      videoRef.current.muted = false;
      videoRef.current.volume = 1.0;
      videoRef.current
        .play()
        .then(() => {
          if (!userManuallyMutedRef.current) {
            videoRef.current!.muted = false;
            setIsMuted(false);
          }
        })
        .catch((err) => {
          console.warn(
            '[SplashScreen] Unmuted autoplay pending user interaction, starting video playback:',
            err
          );
          if (videoRef.current && !userManuallyMutedRef.current) {
            videoRef.current.muted = true;
            videoRef.current
              .play()
              .then(() => {
                if (!userManuallyMutedRef.current && videoRef.current) {
                  // Attempt immediate unmuting once stream starts
                  videoRef.current.muted = false;
                }
              })
              .catch(() => {});
          }
        });
    }

    // Keep background bleed video muted (visuals only, no doubled audio)
    if (bgVideoRef.current) {
      bgVideoRef.current.muted = true;
      bgVideoRef.current.play().catch(() => {});
    }

    // Unmute immediately on any user interaction if browser deferred audio
    const handleGestureUnmute = () => {
      if (!userManuallyMutedRef.current && videoRef.current) {
        videoRef.current.muted = false;
        videoRef.current.volume = 1.0;
        setIsMuted(false);
      }
    };

    window.addEventListener('pointerdown', handleGestureUnmute, { once: true });
    window.addEventListener('click', handleGestureUnmute, { once: true });
    window.addEventListener('keydown', handleGestureUnmute, { once: true });
    window.addEventListener('touchstart', handleGestureUnmute, { once: true });

    // Dynamic Edge & Flash Color Sync:
    // Samples top-left pixel (2, 2) every frame using requestAnimationFrame
    // to dynamically set container backgroundColor (instant full-bleed edge-to-edge white flashes)
    const sampleColor = () => {
      const vid = videoRef.current;
      const container = containerRef.current;
      if (vid && container && vid.readyState >= 2) {
        try {
          if (!canvasRef.current) {
            const canvas = document.createElement('canvas');
            canvas.width = 1;
            canvas.height = 1;
            canvasRef.current = canvas;
          }
          const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(vid, 2, 2, 1, 1, 0, 0, 1, 1);
            const pixel = ctx.getImageData(0, 0, 1, 1).data;
            container.style.backgroundColor = `rgb(${pixel[0]}, ${pixel[1]}, ${pixel[2]})`;
          }
        } catch {
          // Canvas read fallback
        }
      }

      if (!hasFinishedRef.current) {
        rafRef.current = requestAnimationFrame(sampleColor);
      }
    };

    rafRef.current = requestAnimationFrame(sampleColor);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('pointerdown', handleGestureUnmute);
      window.removeEventListener('click', handleGestureUnmute);
      window.removeEventListener('keydown', handleGestureUnmute);
      window.removeEventListener('touchstart', handleGestureUnmute);
    };
  }, []);

  const handleTimeUpdate = () => {
    if (videoRef.current && bgVideoRef.current) {
      const diff = Math.abs(videoRef.current.currentTime - bgVideoRef.current.currentTime);
      if (diff > 0.08) {
        bgVideoRef.current.currentTime = videoRef.current.currentTime;
      }
    }
  };

  const handleToggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!videoRef.current) return;

    if (isMuted) {
      // User explicitly unmuted
      userManuallyMutedRef.current = false;
      videoRef.current.muted = false;
      videoRef.current.volume = 1.0;
      setIsMuted(false);
    } else {
      // User explicitly muted
      userManuallyMutedRef.current = true;
      videoRef.current.muted = true;
      setIsMuted(true);
    }
  };

  const handleContainerClick = () => {
    // If user clicks anywhere on the splash screen and audio is not user-muted, ensure unmuted
    if (!userManuallyMutedRef.current && videoRef.current && videoRef.current.muted) {
      videoRef.current.muted = false;
      videoRef.current.volume = 1.0;
      setIsMuted(false);
    }
  };

  return (
    <div
      ref={containerRef}
      onClick={handleContainerClick}
      className={`fixed inset-0 w-screen h-screen overflow-hidden z-[9999] bg-black flex items-center justify-center select-none transition-opacity duration-600 ease-out cursor-pointer ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'
      }`}
      style={{ transition: 'opacity 600ms ease' }}
    >
      {/* Layer 1: Full-Screen Bleed Background Video (Muted, Visuals Only) */}
      <video
        ref={bgVideoRef}
        src="/vybe-intro.mp4"
        autoPlay
        muted
        playsInline
        className="absolute inset-0 w-screen h-screen object-cover scale-125 blur-xl opacity-95 pointer-events-none z-0"
      />

      {/* Layer 2: Crisp Foreground Video (Full Viewport Cover, Edge-to-Edge with Full Audio) */}
      <video
        ref={videoRef}
        src="/vybe-intro.mp4"
        autoPlay
        playsInline
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleFinish}
        onError={handleFinish}
        className="relative z-10 w-screen h-screen object-cover"
      />

      {/* Interactive Sound Mute / Unmute Button in Bottom-Left */}
      <button
        onClick={handleToggleMute}
        className="fixed bottom-6 left-6 z-20 text-xs text-white/90 hover:text-white transition-all cursor-pointer px-4 py-2 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/20 shadow-lg flex items-center gap-2 group active:scale-95"
        title={isMuted ? 'Unmute intro audio' : 'Mute intro audio'}
      >
        {isMuted ? (
          <>
            <VolumeX className="w-3.5 h-3.5 text-rose-400 group-hover:scale-110 transition-transform" />
            <span className="font-sans font-medium text-white/90">Unmute</span>
          </>
        ) : (
          <>
            <Volume2 className="w-3.5 h-3.5 text-emerald-400 group-hover:scale-110 transition-transform animate-pulse" />
            <span className="font-sans font-medium text-white/90">Mute</span>
          </>
        )}
      </button>

      {/* Subtle Skip Intro Button in Bottom-Right Corner */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          handleFinish();
        }}
        className="fixed bottom-6 right-6 z-20 text-xs text-white/70 hover:text-white transition-all cursor-pointer px-4 py-2 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md border border-white/20 shadow-lg active:scale-95 flex items-center gap-1.5 font-medium"
      >
        <span>Skip Intro</span>
        <span>→</span>
      </button>
    </div>
  );
});

export default SplashScreen;
