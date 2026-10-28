import React from 'react';
import { Music, Heart, Download } from 'lucide-react';
import { EchoTrack } from '../../services/streamResolver';

interface MosaicArtworkProps {
  tracks: EchoTrack[];
  coverGradient?: string;
  size?: number | string;
  className?: string;
  isLikedCollection?: boolean;
  isDownloadedCollection?: boolean;
}

export const MosaicArtwork: React.FC<MosaicArtworkProps> = ({
  tracks,
  coverGradient = 'linear-gradient(135deg, #8B5CF6, #EC4899)',
  size = 180,
  className = '',
  isLikedCollection = false,
  isDownloadedCollection = false,
}) => {
  // Pinned Liked Songs Collection Art
  if (isLikedCollection) {
    return (
      <div
        className={`relative rounded-2xl flex items-center justify-center shadow-2xl overflow-hidden shrink-0 ${className}`}
        style={{
          width: size,
          height: size,
          background: 'linear-gradient(135deg, #450af5 0%, #8E2DE2 50%, #FF416C 100%)',
        }}
      >
        <div className="absolute inset-0 bg-black/10" />
        <Heart className="w-1/3 h-1/3 text-white fill-current drop-shadow-lg" />
      </div>
    );
  }

  // Pinned Downloaded Music Collection Art
  if (isDownloadedCollection) {
    return (
      <div
        className={`relative rounded-2xl flex items-center justify-center shadow-2xl overflow-hidden shrink-0 ${className}`}
        style={{
          width: size,
          height: size,
          background: 'linear-gradient(135deg, #065f46 0%, #059669 50%, #10b981 100%)',
        }}
      >
        <div className="absolute inset-0 bg-black/10" />
        <Download className="w-1/3 h-1/3 text-white stroke-[2.5] drop-shadow-lg" />
      </div>
    );
  }

  // Extract up to 4 distinct artworks
  const artworks: string[] = [];
  for (const t of tracks) {
    if (t.artworkUrl && !artworks.includes(t.artworkUrl)) {
      artworks.push(t.artworkUrl);
      if (artworks.length === 4) break;
    }
  }

  // If 4 artworks are available: Spotify 2x2 Mosaic
  if (artworks.length === 4) {
    return (
      <div
        className={`relative rounded-2xl grid grid-cols-2 grid-rows-2 shadow-2xl overflow-hidden shrink-0 border border-white/10 ${className}`}
        style={{ width: size, height: size }}
      >
        {artworks.map((url, i) => (
          <img
            key={i}
            src={url}
            alt="Album Mosaic"
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ))}
      </div>
    );
  }

  // If 1-3 artworks available: display first prominent artwork
  if (artworks.length > 0) {
    return (
      <div
        className={`relative rounded-2xl shadow-2xl overflow-hidden shrink-0 border border-white/10 ${className}`}
        style={{ width: size, height: size }}
      >
        <img
          src={artworks[0]}
          alt="Album Art"
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>
    );
  }

  // Default: Gradient Cover Card with Music Icon
  return (
    <div
      className={`relative rounded-2xl flex items-center justify-center shadow-2xl overflow-hidden shrink-0 border border-white/10 ${className}`}
      style={{
        width: size,
        height: size,
        background: coverGradient,
      }}
    >
      <div className="absolute inset-0 bg-black/20" />
      <Music className="w-1/3 h-1/3 text-white/90 drop-shadow-md" />
    </div>
  );
};
