/**
 * Unified Open-Source Music Provider & Track Metadata Interfaces
 * Designed to decouple track metadata and audio streams behind a clean provider interface.
 */

export type TrackSourceType = 'local' | 'remote' | 'stream';

export interface TrackMetadata {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration?: number; // In seconds
  artworkUrl?: string;
  streamUrl?: string;
  sourceType: TrackSourceType;
  year?: string;
  genre?: string;
  format?: string;
  fileSize?: number;
  rawFile?: File;
  searchQuery?: string;
  trackNumber?: number;
  profile?: import('../audio/TrackAnalyzer').TrackAudioProfile;
  // Universal track properties so all components and views always find valid values
  coverUrl?: string;
  image?: string;
  artwork?: string;
  audioUrl?: string;
  url?: string;
  previewUrl?: string;
}

export interface MusicProvider {
  id: string;
  name: string;
  description?: string;
  searchTracks(query: string, limit?: number): Promise<TrackMetadata[]>;
  getTrack(id: string): Promise<TrackMetadata | null>;
  getStreamUrl?(track: TrackMetadata): Promise<string>;
}
