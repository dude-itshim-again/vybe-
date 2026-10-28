import { useState, useEffect, useRef, useCallback } from 'react';
import { LyricTrack, LyricLine } from '../services/lrcParser';

interface UseKineticLyricsOptions {
  audioElement: HTMLAudioElement | null;
  track: LyricTrack | null;
  isPlaying: boolean;
  initialOffsetMs?: number;
}

export function findActiveLineIndex(lines: LyricLine[], currentTime: number): number {
  if (lines.length === 0) return 0;
  if (currentTime < lines[0].startTime) return 0;

  let low = 0;
  let high = lines.length - 1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    const line = lines[mid];

    if (currentTime < line.startTime) {
      high = mid - 1;
    } else if (currentTime > line.endTime) {
      low = mid + 1;
    } else {
      return mid; // Exact match inside [startTime, endTime]
    }
  }

  // Return closest preceding line if inside instrumental break or gap
  return Math.max(0, Math.min(high, lines.length - 1));
}

export function useKineticLyrics({
  audioElement,
  track,
  isPlaying,
  initialOffsetMs = 0,
}: UseKineticLyricsOptions) {
  const [activeLineIndex, setActiveLineIndex] = useState<number>(0);
  const [syncOffsetMs, setSyncOffsetMs] = useState<number>(initialOffsetMs);

  const activeLineIndexRef = useRef<number>(0);
  const wordElementsRef = useRef<Map<string, HTMLElement>>(new Map());
  const lastActiveWordIdRef = useRef<string | null>(null);
  const isPlayingRef = useRef<boolean>(isPlaying);
  isPlayingRef.current = isPlaying;

  const lines = track?.lines || [];
  const linesRef = useRef<LyricLine[]>(lines);
  linesRef.current = lines;

  const syncOffsetRef = useRef<number>(syncOffsetMs);
  syncOffsetRef.current = syncOffsetMs;

  // Word DOM element registration hook for direct style mutations
  const registerWordRef = useCallback((wordId: string, el: HTMLElement | null) => {
    if (el) {
      wordElementsRef.current.set(wordId, el);
    } else {
      wordElementsRef.current.delete(wordId);
    }
  }, []);

  // Seek audio directly to a line's start time
  const seekToLine = useCallback(
    (lineIdx: number) => {
      if (!audioElement || !linesRef.current[lineIdx]) return;
      const targetTime = Math.max(
        0,
        linesRef.current[lineIdx].startTime - syncOffsetRef.current / 1000
      );
      audioElement.currentTime = targetTime;
    },
    [audioElement]
  );

  // Offset adjustment helpers (+/- 100ms)
  const adjustSyncOffset = useCallback((deltaMs: number) => {
    setSyncOffsetMs(prev => Math.max(-5000, Math.min(5000, prev + deltaMs)));
  }, []);

  const resetSyncOffset = useCallback(() => {
    setSyncOffsetMs(0);
  }, []);

  // Reset indices when track changes
  useEffect(() => {
    setActiveLineIndex(0);
    activeLineIndexRef.current = 0;
    lastActiveWordIdRef.current = null;
    if (track?.offsetMs) {
      setSyncOffsetMs(track.offsetMs);
    }
  }, [track?.trackId, track?.offsetMs]);

  // Strict 60fps requestAnimationFrame loop
  // Adheres strictly to .antigravity/rules.md:
  // ZERO React re-renders during active line playback; mutates CSS custom properties directly.
  useEffect(() => {
    let animId: number;

    const tick = () => {
      const currentLines = linesRef.current;
      if (audioElement && currentLines.length > 0) {
        const rawTime = audioElement.currentTime;
        const calibratedTime = rawTime + syncOffsetRef.current / 1000;

        const nextLineIdx = findActiveLineIndex(currentLines, calibratedTime);

        // Line transition: Trigger React state update ONLY when the line index genuinely changes
        if (nextLineIdx !== activeLineIndexRef.current) {
          const prevIdx = activeLineIndexRef.current;
          activeLineIndexRef.current = nextLineIdx;
          setActiveLineIndex(nextLineIdx);

          // Clean up words in previous lines:
          // If moving forward, set previous line's words to 1.0 (completed)
          // If seeking backward, set subsequent line's words to 0.0
          const prevLine = currentLines[prevIdx];
          if (prevLine) {
            const isForward = nextLineIdx > prevIdx;
            for (const word of prevLine.words) {
              const node = wordElementsRef.current.get(word.id);
              if (node) {
                node.style.setProperty('--word-progress', isForward ? '1' : '0');
                node.classList.remove('is-active');
              }
            }
          }
        }

        // 60fps Direct DOM CSS Custom Property Injection for the Active Line
        const activeLine = currentLines[activeLineIndexRef.current];
        if (activeLine && activeLine.words.length > 0) {
          let currentActiveWordFound = false;

          for (let i = 0; i < activeLine.words.length; i++) {
            const word = activeLine.words[i];
            const node = wordElementsRef.current.get(word.id);
            if (!node) continue;

            if (calibratedTime < word.startTime) {
              // Word is upcoming
              node.style.setProperty('--word-progress', '0');
              node.classList.remove('is-active');
            } else if (calibratedTime >= word.endTime) {
              // Word is already completed
              node.style.setProperty('--word-progress', '1');
              node.classList.remove('is-active');
            } else {
              // Word is CURRENTLY being sung
              const wordDuration = Math.max(0.001, word.endTime - word.startTime);
              const rawProgress = (calibratedTime - word.startTime) / wordDuration;
              const clampedProgress = Math.max(0, Math.min(1, rawProgress));

              node.style.setProperty('--word-progress', clampedProgress.toFixed(3));
              node.classList.add('is-active');
              currentActiveWordFound = true;
              lastActiveWordIdRef.current = word.id;
            }
          }

          if (!currentActiveWordFound && lastActiveWordIdRef.current) {
            const lastNode = wordElementsRef.current.get(lastActiveWordIdRef.current);
            if (lastNode) lastNode.classList.remove('is-active');
          }
        }
      }

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [audioElement]);

  return {
    activeLineIndex,
    syncOffsetMs,
    setSyncOffsetMs,
    adjustSyncOffset,
    resetSyncOffset,
    registerWordRef,
    seekToLine,
  };
}
