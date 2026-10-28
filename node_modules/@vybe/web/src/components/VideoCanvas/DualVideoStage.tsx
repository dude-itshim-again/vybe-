import React, { useRef, useState, useEffect } from 'react';

interface DualVideoStageProps {
  activeVideoUrl: string;
  isPlaying: boolean;
  videoOpacity?: number; // 0.0 to 1.0 (default: 0.80)
  children?: React.ReactNode;
}

export const DualVideoStage: React.FC<DualVideoStageProps> = ({
  activeVideoUrl,
  isPlaying,
  videoOpacity = 0.8,
  children,
}) => {
  const videoARef = useRef<HTMLVideoElement | null>(null);
  const videoBRef = useRef<HTMLVideoElement | null>(null);

  const [activeSlot, setActiveSlot] = useState<'A' | 'B'>('A');
  const [slotASrc, setSlotASrc] = useState<string>(activeVideoUrl);
  const [slotBSrc, setSlotBSrc] = useState<string>('');
  const [opacityA, setOpacityA] = useState<number>(1);
  const [opacityB, setOpacityB] = useState<number>(0);

  const lastUrlRef = useRef<string>(activeVideoUrl);

  // Crossfade state transition (1200ms)
  useEffect(() => {
    if (!activeVideoUrl || activeVideoUrl === lastUrlRef.current) return;
    lastUrlRef.current = activeVideoUrl;

    if (activeSlot === 'A') {
      // Preload in Slot B, then crossfade to B
      setSlotBSrc(activeVideoUrl);
      const vidB = videoBRef.current;
      if (vidB) {
        vidB.currentTime = 0;
        vidB.play().catch(() => {});
      }

      setOpacityA(0);
      setOpacityB(1);
      setActiveSlot('B');
    } else {
      // Preload in Slot A, then crossfade to A
      setSlotASrc(activeVideoUrl);
      const vidA = videoARef.current;
      if (vidA) {
        vidA.currentTime = 0;
        vidA.play().catch(() => {});
      }

      setOpacityB(0);
      setOpacityA(1);
      setActiveSlot('A');
    }
  }, [activeVideoUrl, activeSlot]);

  // Keep playback state in sync
  useEffect(() => {
    const vidA = videoARef.current;
    const vidB = videoBRef.current;

    if (isPlaying) {
      if (activeSlot === 'A' && vidA?.paused) vidA.play().catch(() => {});
      if (activeSlot === 'B' && vidB?.paused) vidB.play().catch(() => {});
    } else {
      vidA?.pause();
      vidB?.pause();
    }
  }, [isPlaying, activeSlot]);

  // Audio-reactive video playbackRate modulation (0.85x to 1.25x tracking --bass-energy)
  useEffect(() => {
    let animId: number;
    let lastTime = 0;

    const rateModulationLoop = (time: number) => {
      if (time - lastTime >= 100) {
        // Sample every 100ms
        lastTime = time;
        const rawBass = parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue('--bass-energy') || '0'
        );

        if (!isNaN(rawBass)) {
          // Target rate: 1.0 + (bass - 0.4) * 0.35, clamped between 0.85 and 1.25
          const targetRate = Math.max(0.85, Math.min(1.25, 1.0 + (rawBass - 0.4) * 0.35));
          const activeEl = activeSlot === 'A' ? videoARef.current : videoBRef.current;
          if (activeEl && !activeEl.paused) {
            activeEl.playbackRate = targetRate;
          }
        }
      }
      animId = requestAnimationFrame(rateModulationLoop);
    };

    animId = requestAnimationFrame(rateModulationLoop);
    return () => cancelAnimationFrame(animId);
  }, [activeSlot]);

  return (
    <div className="relative w-full h-full rounded-3xl overflow-hidden bg-[#070709] border border-white/5 shadow-2xl">
      {/* Video Canvas Container with 60fps Bass-Reactive Pulse & Brightness */}
      <div
        className="absolute inset-0 pointer-events-none overflow-hidden transition-transform duration-75"
        style={{
          opacity: videoOpacity,
          transform: 'scale(calc(1.02 + (var(--bass-energy, 0) * 0.045)))',
          filter:
            'brightness(calc(0.55 + (var(--bass-energy, 0) * 0.15))) contrast(1.12) saturate(1.15)',
        }}
      >
        {/* Slot A Video */}
        <video
          ref={videoARef}
          src={slotASrc}
          autoPlay
          muted
          loop
          playsInline
          crossOrigin="anonymous"
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out"
          style={{ opacity: opacityA }}
        />

        {/* Slot B Video */}
        <video
          ref={videoBRef}
          src={slotBSrc}
          autoPlay
          muted
          loop
          playsInline
          crossOrigin="anonymous"
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out"
          style={{ opacity: opacityB }}
        />
      </div>

      {/* Multi-layered Contrast Vignette & Readability Scrim */}
      <div
        className="absolute inset-0 pointer-events-none z-10 transition-all duration-100"
        style={{
          background: `
            radial-gradient(
              ellipse at center,
              rgba(7, 7, 9, 0.42) 0%,
              rgba(7, 7, 9, 0.72) 60%,
              rgba(7, 7, 9, 0.95) 100%
            ),
            linear-gradient(
              180deg,
              rgba(7, 7, 9, 0.78) 0%,
              transparent 25%,
              transparent 75%,
              rgba(7, 7, 9, 0.90) 100%
            )
          `,
        }}
      />

      {/* Overlaid Child Content (Kinetic Lyrics, Controls, etc.) */}
      <div className="relative z-20 w-full h-full flex flex-col">{children}</div>
    </div>
  );
};
