import { useEffect, useRef } from 'react';
import { AudioDSPEngine } from '../audio/AudioDSPEngine';

/**
 * High-frequency 60fps rAF animation hook.
 * Strictly adheres to .antigravity/rules.md:
 * Never stores high-frequency audio metrics in React useState.
 * Mutates CSS Custom Property `--bass-energy` directly on document.documentElement.style.
 */
export function useAudioReactiveCSS(
  engine: AudioDSPEngine | null,
  isPlaying: boolean,
  onFrame?: (bassEnergy: number, reductionDb: number) => void
) {
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;

  useEffect(() => {
    let animationFrameId: number | null = null;
    const rootStyle = document.documentElement.style;

    if (!isPlaying || !engine) {
      rootStyle.setProperty('--bass-energy', '0');
      return;
    }

    const renderLoop = () => {
      // If Low-Spec / Performance mode is active, skip expensive 60fps analysis
      if (document.documentElement.classList.contains('perf-mode-low')) {
        rootStyle.setProperty('--bass-energy', '0');
        return;
      }

      if (engine && isPlayingRef.current) {
        const bass = engine.getSubBassEnergy();
        const reduction = engine.getReduction();

        // Direct DOM CSS Custom Property injection
        rootStyle.setProperty('--bass-energy', bass.toFixed(4));

        if (onFrameRef.current) {
          onFrameRef.current(bass, reduction);
        }

        animationFrameId = requestAnimationFrame(renderLoop);
      } else {
        rootStyle.setProperty('--bass-energy', '0');
      }
    };

    animationFrameId = requestAnimationFrame(renderLoop);

    return () => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
      rootStyle.setProperty('--bass-energy', '0');
    };
  }, [engine, isPlaying]);
}
