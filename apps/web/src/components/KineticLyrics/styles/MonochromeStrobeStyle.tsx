import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LyricLine } from '../../../services/lrcParser';

interface MonochromeStrobeStyleProps {
  currentLine: LyricLine | null;
  currentTime: number;
}

type ImpactFontType = 'calligraphy' | 'hollow' | 'brutalist';

export const MonochromeStrobeStyle: React.FC<MonochromeStrobeStyleProps> = ({
  currentLine,
  currentTime,
}) => {
  const words = currentLine?.words || [];
  const buildupWords = words.length > 1 ? words.slice(0, words.length - 1) : [];
  const finalWord = words.length > 0 ? words[words.length - 1] : null;

  // Strobe active when currently singing the final impact word
  const isFinalWordActive =
    !!finalWord &&
    currentTime >= finalWord.startTime &&
    currentTime <= (finalWord.endTime + 0.15);

  // Rotate impact font based on line index:
  // 0 -> Luxury Calligraphy ('Great Vibes')
  // 1 -> Hollow Editorial Outline ('Fraunces')
  // 2 -> Brutalist Impact ('Anton')
  const impactFont: ImpactFontType = useMemo(() => {
    const idx = (currentLine?.lineIndex ?? 0) % 3;
    if (idx === 0) return 'calligraphy';
    if (idx === 1) return 'hollow';
    return 'brutalist';
  }, [currentLine?.lineIndex]);

  const stageBg = isFinalWordActive ? '#F5F5F7' : '#050507';
  const textColor = isFinalWordActive ? '#050507' : '#FFFFFF';

  return (
    <div
      className="relative w-full h-full flex items-center justify-center transition-colors duration-75 select-none"
      style={{ backgroundColor: stageBg }}
    >
      {/* 16:9 Cinema Letterbox Bars */}
      <div className="absolute top-0 left-0 right-0 h-10 sm:h-14 bg-black z-30 pointer-events-none border-b border-white/5" />
      <div className="absolute bottom-0 left-0 right-0 h-10 sm:h-14 bg-black z-30 pointer-events-none border-t border-white/5" />

      {/* Floating Ambient Spotlight */}
      <div
        className="absolute inset-0 pointer-events-none z-0 transition-opacity duration-200"
        style={{
          opacity: isFinalWordActive ? 0.05 : 0.45,
          background:
            'radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.18) 0%, rgba(0, 0, 0, 0.95) 70%)',
        }}
      />

      {/* Camera Shake Punch on Final Impact Word */}
      <motion.div
        animate={
          isFinalWordActive && impactFont === 'brutalist'
            ? {
                x: [0, -4, 4, -3, 3, 0],
                y: [0, 3, -3, 2, -2, 0],
              }
            : { x: 0, y: 0 }
        }
        transition={{ duration: 0.18 }}
        className="relative z-10 w-full max-w-5xl px-6 flex flex-col items-center justify-center text-center my-auto min-h-[320px]"
      >
        {/* Top Buildup Words in 'Syne' */}
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 mb-4 sm:mb-6">
          {buildupWords.map((w) => {
            const isRevealed = currentTime >= w.startTime;
            return (
              <span
                key={w.id}
                className="kinetic-descender-safe transition-all duration-150 font-syne font-bold uppercase tracking-wider"
                style={{
                  fontFamily: "'Syne', sans-serif",
                  fontSize: 'clamp(1.4rem, 3.2vw, 2.4rem)',
                  color: textColor,
                  opacity: isRevealed ? (isFinalWordActive ? 0.35 : 1) : 0,
                  transform: isRevealed ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.9)',
                  filter: isRevealed && !isFinalWordActive
                    ? 'drop-shadow(0 0 12px rgba(255,255,255,0.75))'
                    : 'none',
                  willChange: 'transform, opacity, filter',
                }}
              >
                {w.word}
              </span>
            );
          })}
        </div>

        {/* Slam-in Final Impact Rhyme Word */}
        {finalWord && (
          <div className="relative flex items-center justify-center min-h-[120px] sm:min-h-[170px] w-full">
            <AnimatePresence mode="wait">
              {currentTime >= finalWord.startTime && (
                <motion.div
                  key={`impact-${finalWord.id}-${impactFont}`}
                  initial={{ scale: 2.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  transition={{
                    type: 'spring',
                    stiffness: 380,
                    damping: 24,
                    mass: 0.7,
                  }}
                  className="flex items-center justify-center"
                >
                  {impactFont === 'calligraphy' && (
                    <span
                      className="kinetic-descender-safe font-vibes font-normal text-center"
                      style={{
                        fontFamily: "'Great Vibes', cursive",
                        fontSize: 'clamp(3.8rem, 10vw, 7.2rem)',
                        color: textColor,
                        transform: 'rotate(-4deg)',
                        filter: isFinalWordActive
                          ? 'drop-shadow(0 0 24px rgba(0,0,0,0.5))'
                          : 'drop-shadow(0 0 22px rgba(255,255,255,0.95))',
                      }}
                    >
                      {finalWord.word}
                    </span>
                  )}

                  {impactFont === 'hollow' && (
                    <span
                      className="kinetic-descender-safe font-fraunces font-black uppercase tracking-tight"
                      style={{
                        fontFamily: "'Fraunces', serif",
                        fontSize: 'clamp(3.2rem, 9vw, 6.4rem)',
                        color: 'transparent',
                        WebkitTextStroke: `2.5px ${textColor}`,
                        filter: isFinalWordActive
                          ? 'none'
                          : 'drop-shadow(0 0 16px rgba(255,255,255,0.7))',
                      }}
                    >
                      {finalWord.word}
                    </span>
                  )}

                  {impactFont === 'brutalist' && (
                    <span
                      className="kinetic-descender-safe font-anton uppercase italic tracking-tight"
                      style={{
                        fontFamily: "'Anton', sans-serif",
                        fontSize: 'clamp(3.8rem, 11vw, 7.5rem)',
                        color: textColor,
                        filter: isFinalWordActive
                          ? 'none'
                          : 'drop-shadow(0 0 26px rgba(255,255,255,0.85))',
                      }}
                    >
                      {finalWord.word}
                    </span>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </motion.div>
    </div>
  );
};
