import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LyricLine } from '../../../services/lrcParser';

interface EditorialFlipStyleProps {
  currentLine: LyricLine | null;
  currentTime: number;
  paletteIndex?: number;
  isAutoInverted?: boolean;
}

export const EDITORIAL_PALETTES = [
  { bg: '#F4EFE6', ink: '#4A0E17', name: 'Cream & Burgundy' },
  { bg: '#4A0E17', ink: '#F4EFE6', name: 'Burgundy & Cream' },
  { bg: '#1A2F23', ink: '#EFECE6', name: 'Forest & Bone' },
  { bg: '#EFECE6', ink: '#1A2F23', name: 'Bone & Forest' },
  { bg: '#0F2042', ink: '#F0F4F8', name: 'Cobalt & Chalk' },
  { bg: '#F0F4F8', ink: '#0F2042', name: 'Chalk & Cobalt' },
];

export const EditorialFlipStyle: React.FC<EditorialFlipStyleProps> = ({
  currentLine,
  currentTime,
  paletteIndex = 0,
  isAutoInverted = false,
}) => {
  // Determine color scheme based on palette index and inversion
  const palette = useMemo(() => {
    const baseIdx = (paletteIndex * 2 + (isAutoInverted ? 1 : 0)) % EDITORIAL_PALETTES.length;
    return EDITORIAL_PALETTES[baseIdx];
  }, [paletteIndex, isAutoInverted]);

  const words = currentLine?.words || [];

  // Group 4-7 words into 2-3 compact centered rows
  const wordRows = useMemo(() => {
    if (words.length <= 3) {
      return [words];
    }
    if (words.length <= 6) {
      const mid = Math.ceil(words.length / 2);
      return [words.slice(0, mid), words.slice(mid)];
    }
    // 7+ words: split into 3 rows
    const chunkSize = Math.ceil(words.length / 3);
    return [
      words.slice(0, chunkSize),
      words.slice(chunkSize, chunkSize * 2),
      words.slice(chunkSize * 2),
    ];
  }, [words]);

  // Identify longest word in the line for stylistic emphasis (italic 1.12x)
  const longestWordId = useMemo(() => {
    if (words.length === 0) return null;
    let maxLen = 0;
    let targetId = words[words.length - 1].id;
    for (const w of words) {
      if (w.word.length > maxLen) {
        maxLen = w.word.length;
        targetId = w.id;
      }
    }
    return targetId;
  }, [words]);

  return (
    <div className="relative w-full h-full flex items-center justify-center p-4 sm:p-8">
      {/* Expanding 4-Point Star Wipe on Bar Transitions */}
      <AnimatePresence mode="popLayout">
        <motion.div
          key={`star-${currentLine?.id || 'idle'}`}
          initial={{ scale: 0, opacity: 0.8, rotate: 0 }}
          animate={{ scale: 4.5, opacity: 0, rotate: 45 }}
          transition={{ duration: 0.65, ease: 'easeOut' }}
          className="absolute pointer-events-none z-10 flex items-center justify-center"
        >
          <svg
            viewBox="0 0 100 100"
            className="w-48 h-48 sm:w-72 sm:h-72"
            style={{ fill: palette.ink, opacity: 0.35 }}
          >
            <path d="M50 0 C50 35 35 50 0 50 C35 50 50 65 50 100 C50 65 65 50 100 50 C65 50 50 35 50 0 Z" />
          </svg>
        </motion.div>
      </AnimatePresence>

      {/* Framed Rounded Editorial Card */}
      <motion.div
        animate={{
          backgroundColor: palette.bg,
          color: palette.ink,
        }}
        transition={{ duration: 0.18, ease: 'easeInOut' }}
        className="relative w-full max-w-2xl sm:max-w-3xl rounded-[28px] p-6 sm:p-12 md:p-14 shadow-2xl flex flex-col items-center justify-center select-none"
        style={{
          border: `1.5px solid ${palette.ink}25`,
          boxShadow: `0 24px 60px -12px ${palette.ink}30`,
          minHeight: '340px',
        }}
      >
        {/* Top Mini Brand / Bar Header */}
        <div
          className="absolute top-5 flex items-center space-x-2 text-[10px] font-mono tracking-widest uppercase opacity-45"
          style={{ color: palette.ink }}
        >
          <span>VYBE EDITORIAL</span>
          <span>✦</span>
          <span>BAR #{((currentLine?.lineIndex ?? 0) + 1).toString().padStart(2, '0')}</span>
        </div>

        {/* Word-by-Word Phrase Rows */}
        <div className="flex flex-col items-center justify-center w-full my-auto space-y-1 sm:space-y-2">
          {wordRows.map((row, rowIdx) => (
            <div
              key={`row-${rowIdx}-${currentLine?.id}`}
              className="flex flex-wrap items-center justify-center kinetic-tight-stack"
            >
              {row.map((w) => {
                const isRevealed = currentTime >= w.startTime;
                const isLongest = w.id === longestWordId;

                return (
                  <span
                    key={w.id}
                    className="kinetic-descender-safe transition-transform duration-100 font-fraunces font-black lowercase"
                    style={{
                      fontFamily: "'Fraunces', serif",
                      letterSpacing: '-0.04em',
                      fontSize: 'clamp(2.2rem, 5.5vw, 4.4rem)',
                      color: palette.ink,
                      fontStyle: isLongest ? 'italic' : 'normal',
                      transform: isRevealed
                        ? isLongest
                          ? 'scale(1.12)'
                          : 'scale(1.0)'
                        : 'translateY(22px) scale(0.82) rotate(-2deg)',
                      opacity: isRevealed ? 1 : 0,
                      transition:
                        'transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease-out',
                      willChange: 'transform, opacity',
                    }}
                  >
                    {w.word}
                  </span>
                );
              })}
            </div>
          ))}
        </div>

        {/* Centered ★ Badge at the Bottom */}
        <div
          className="absolute bottom-4 flex items-center justify-center w-7 h-7 rounded-full border transition-colors duration-200 text-xs font-bold"
          style={{
            borderColor: `${palette.ink}30`,
            color: palette.ink,
            backgroundColor: `${palette.ink}08`,
          }}
        >
          ★
        </div>
      </motion.div>
    </div>
  );
};
