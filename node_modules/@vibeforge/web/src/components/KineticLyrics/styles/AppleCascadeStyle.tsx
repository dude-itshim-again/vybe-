import React, { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { LyricTrack } from '../../../services/lrcParser';

interface AppleCascadeStyleProps {
  track: LyricTrack | null;
  activeLineIndex: number;
  currentTime: number;
  onSeekToLine?: (index: number) => void;
}

export const AppleCascadeStyle: React.FC<AppleCascadeStyleProps> = ({
  track,
  activeLineIndex,
  currentTime,
  onSeekToLine,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lineRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [targetY, setTargetY] = useState<number>(0);

  const lines = track?.lines || [];

  // Smooth vertical centering on active line
  useEffect(() => {
    if (!containerRef.current || lines.length === 0) return;

    const activeEl = lineRefs.current.get(activeLineIndex);
    if (activeEl) {
      const containerHeight = containerRef.current.clientHeight;
      const lineTop = activeEl.offsetTop;
      const lineHeight = activeEl.clientHeight;
      // Center around 42% height
      const idealY = lineTop + lineHeight / 2 - containerHeight * 0.42;
      setTargetY(idealY);
    }
  }, [activeLineIndex, lines]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden flex flex-col justify-start select-none px-6 sm:px-12 md:px-20"
    >
      {/* Top & Bottom Soft Gradient Vignettes */}
      <div className="absolute top-0 left-0 right-0 h-28 bg-gradient-to-b from-[#070709] via-[#070709]/60 to-transparent pointer-events-none z-20" />
      <div className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-[#070709] via-[#070709]/60 to-transparent pointer-events-none z-20" />

      {/* Main 5-Line Left-Aligned Cascade */}
      <motion.div
        animate={{ y: -targetY }}
        transition={{
          type: 'spring',
          stiffness: 120,
          damping: 24,
          mass: 0.8,
        }}
        className="w-full max-w-4xl py-[45vh] space-y-6 sm:space-y-8"
      >
        {lines.map((line, idx) => {
          const distance = Math.abs(idx - activeLineIndex);
          const isActive = distance === 0;

          // Progressive Depth-of-Field: blur(0px) for active, blur(3px) & opacity: 0.22 for inactive
          const blurPx = isActive ? 0 : Math.min(3.5, 2.5 + (distance - 1) * 1.0);
          const lineOpacity = isActive ? 1.0 : Math.max(0.12, 0.22 - (distance - 1) * 0.05);

          return (
            <div
              key={line.id}
              ref={(el) => {
                if (el) lineRefs.current.set(idx, el);
                else lineRefs.current.delete(idx);
              }}
              onClick={() => onSeekToLine?.(idx)}
              className="cursor-pointer transition-all duration-300"
              style={{
                filter: `blur(${blurPx}px)`,
                opacity: lineOpacity,
                transform: isActive ? 'scale(1)' : 'scale(0.97)',
                transformOrigin: 'left center',
                willChange: 'transform, filter, opacity',
              }}
            >
              <div className="flex flex-wrap items-center justify-start text-left font-syne font-extrabold tracking-tight">
                {line.isInstrumentalBreak ? (
                  <span className="text-purple-400/60 italic text-xl sm:text-2xl font-medium tracking-widest flex items-center gap-2">
                    <span className="inline-block animate-pulse">♪</span>
                    <span>{line.text}</span>
                    <span className="inline-block animate-pulse">♪</span>
                  </span>
                ) : line.words.length > 0 ? (
                  line.words.map((w) => {
                    const isSung = currentTime >= w.startTime;
                    const isCurrentlySinging =
                      currentTime >= w.startTime && currentTime <= w.endTime;

                    return (
                      <span
                        key={w.id}
                        className="kinetic-descender-safe transition-all duration-200"
                        style={{
                          fontFamily: "'Syne', sans-serif",
                          fontSize: 'clamp(2rem, 4.8vw, 3.8rem)',
                          color: '#FFFFFF',
                          opacity: isSung ? 1.0 : 0.22,
                          transform: isCurrentlySinging
                            ? 'translateY(-3px)'
                            : isSung
                            ? 'translateY(0)'
                            : 'translateY(0)',
                          filter: isCurrentlySinging
                            ? 'drop-shadow(0 0 16px rgba(255,255,255,0.85))'
                            : 'none',
                          willChange: 'transform, opacity, filter',
                        }}
                      >
                        {w.word}
                      </span>
                    );
                  })
                ) : (
                  <span
                    className="kinetic-descender-safe"
                    style={{
                      fontFamily: "'Syne', sans-serif",
                      fontSize: 'clamp(2rem, 4.8vw, 3.8rem)',
                      color: '#FFFFFF',
                      opacity: isActive ? 1.0 : 0.22,
                    }}
                  >
                    {line.text}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </motion.div>
    </div>
  );
};
