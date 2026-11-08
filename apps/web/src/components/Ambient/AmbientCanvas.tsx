import React, { useEffect, useRef } from 'react';

interface AmbientCanvasProps {
  artworkUrl?: string;
  colors?: {
    orb1: string;
    orb2: string;
    orb3: string;
  };
  className?: string;
}

/**
 * High-performance low-res ambient canvas background (64x64).
 * Eliminates GPU overheating by replacing 3 giant 125px-blurred CSS divs
 * with a single tiny canvas that paints once on track change.
 */
export const AmbientCanvas: React.FC<AmbientCanvasProps> = ({
  artworkUrl,
  colors = {
    orb1: '#312E81',
    orb2: '#2563EB',
    orb3: '#6D28D9',
  },
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isCancelled = false;

    const paintFallbackGradient = () => {
      if (isCancelled) return;
      ctx.clearRect(0, 0, 64, 64);

      // Deep base
      ctx.fillStyle = '#07080C';
      ctx.fillRect(0, 0, 64, 64);

      // Orb 1: top right
      const g1 = ctx.createRadialGradient(50, 14, 0, 50, 14, 38);
      g1.addColorStop(0, colors.orb1);
      g1.addColorStop(1, 'transparent');
      ctx.fillStyle = g1;
      ctx.fillRect(0, 0, 64, 64);

      // Orb 2: bottom left
      const g2 = ctx.createRadialGradient(14, 48, 0, 14, 48, 40);
      g2.addColorStop(0, colors.orb2);
      g2.addColorStop(1, 'transparent');
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, 64, 64);

      // Orb 3: center right
      const g3 = ctx.createRadialGradient(38, 32, 0, 38, 32, 34);
      g3.addColorStop(0, colors.orb3);
      g3.addColorStop(1, 'transparent');
      ctx.fillStyle = g3;
      ctx.fillRect(0, 0, 64, 64);

      // Subtle dark vignette overlay
      ctx.fillStyle = 'rgba(7, 8, 12, 0.45)';
      ctx.fillRect(0, 0, 64, 64);
    };

    if (artworkUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        if (isCancelled) return;
        ctx.clearRect(0, 0, 64, 64);
        ctx.drawImage(img, 0, 0, 64, 64);
        // Blend with subtle obsidian overlay to keep contrast high
        ctx.fillStyle = 'rgba(7, 8, 12, 0.55)';
        ctx.fillRect(0, 0, 64, 64);
      };
      img.onerror = () => {
        paintFallbackGradient();
      };
      img.src = artworkUrl;
    } else {
      paintFallbackGradient();
    }

    return () => {
      isCancelled = true;
    };
  }, [artworkUrl, colors.orb1, colors.orb2, colors.orb3]);

  return (
    <canvas
      ref={canvasRef}
      width={64}
      height={64}
      className={`fixed inset-0 w-full h-full pointer-events-none transition-opacity duration-1000 ease-in-out ${className}`}
      style={{
        filter: 'blur(36px)',
        opacity: 0.45,
        transform: 'scale(1.15)',
        willChange: 'opacity',
      }}
      aria-hidden="true"
    />
  );
};

