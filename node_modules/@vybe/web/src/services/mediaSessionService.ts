/**
 * Native Lock-Screen, Bluetooth & Media Keys Service
 * 
 * Interfaces with the W3C Media Session API:
 * - Syncs track metadata (title, artist, album, artwork) to OS notification centers,
 *   Android lock-screen player widgets, and Bluetooth head-units.
 * - Routes hardware media keys (Play, Pause, Skip Next, Skip Prev, Seek)
 *   directly into AudioDSPEngine.
 */

import { TrackMetadata } from '../providers/types';

export interface MediaSessionHandlers {
  onPlay?: () => void;
  onPause?: () => void;
  onNextTrack?: () => void;
  onPreviousTrack?: () => void;
  onSeekTo?: (seekTime: number) => void;
  onSeekBackward?: (seekOffset: number) => void;
  onSeekForward?: (seekOffset: number) => void;
  onStop?: () => void;
}

class MediaSessionService {
  private handlers: MediaSessionHandlers = {};
  private isInitialized = false;

  public init(handlers: MediaSessionHandlers): void {
    this.handlers = handlers;

    if (typeof window === 'undefined' || !('mediaSession' in navigator)) {
      return;
    }

    if (this.isInitialized) return;
    this.isInitialized = true;

    try {
      navigator.mediaSession.setActionHandler('play', () => {
        this.handlers.onPlay?.();
      });
    } catch (e) {
      console.warn('[MediaSession] "play" handler failed:', e);
    }

    try {
      navigator.mediaSession.setActionHandler('pause', () => {
        this.handlers.onPause?.();
      });
    } catch (e) {
      console.warn('[MediaSession] "pause" handler failed:', e);
    }

    try {
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        this.handlers.onPreviousTrack?.();
      });
    } catch (e) {
      console.warn('[MediaSession] "previoustrack" handler failed:', e);
    }

    try {
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        this.handlers.onNextTrack?.();
      });
    } catch (e) {
      console.warn('[MediaSession] "nexttrack" handler failed:', e);
    }

    try {
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined) {
          this.handlers.onSeekTo?.(details.seekTime);
        }
      });
    } catch (e) {
      console.warn('[MediaSession] "seekto" handler failed:', e);
    }

    try {
      navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        const offset = details.seekOffset || 10;
        this.handlers.onSeekBackward?.(offset);
      });
    } catch (e) {
      console.warn('[MediaSession] "seekbackward" handler failed:', e);
    }

    try {
      navigator.mediaSession.setActionHandler('seekforward', (details) => {
        const offset = details.seekOffset || 10;
        this.handlers.onSeekForward?.(offset);
      });
    } catch (e) {
      console.warn('[MediaSession] "seekforward" handler failed:', e);
    }

    try {
      navigator.mediaSession.setActionHandler('stop', () => {
        this.handlers.onStop?.();
      });
    } catch (e) {
      console.warn('[MediaSession] "stop" handler failed:', e);
    }
  }

  /**
   * Updates OS media metadata when the active track changes or at the 50% midpoint
   * of an AutoMix transition.
   */
  public updateMetadata(track?: TrackMetadata | null): void {
    if (typeof window === 'undefined' || !('mediaSession' in navigator) || !track) {
      return;
    }

    try {
      const artworkList: MediaImage[] = [];

      if (track.artworkUrl) {
        artworkList.push(
          { src: track.artworkUrl, sizes: '96x96', type: 'image/jpeg' },
          { src: track.artworkUrl, sizes: '128x128', type: 'image/jpeg' },
          { src: track.artworkUrl, sizes: '256x256', type: 'image/jpeg' },
          { src: track.artworkUrl, sizes: '512x512', type: 'image/jpeg' }
        );
      }

      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title || 'Vybe Music',
        artist: track.artist || 'Vybe AutoMix',
        album: track.album || 'Echo Catalog',
        artwork: artworkList,
      });
    } catch (err) {
      console.warn('[MediaSession] Failed to set metadata:', err);
    }
  }

  /**
   * Updates system playback state (e.g. shows play/pause icon in lock screen).
   */
  public updatePlaybackState(isPlaying: boolean): void {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) {
      return;
    }

    try {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    } catch {
      // Ignored
    }
  }

  /**
   * Updates the scrub bar position in notification / lock-screen players.
   */
  public updatePositionState(duration: number, currentTime: number, playbackRate = 1.0): void {
    if (
      typeof window === 'undefined' ||
      !('mediaSession' in navigator) ||
      typeof navigator.mediaSession.setPositionState !== 'function'
    ) {
      return;
    }

    if (!duration || duration <= 0 || isNaN(currentTime) || currentTime < 0) {
      return;
    }

    try {
      navigator.mediaSession.setPositionState({
        duration: Math.max(1, duration),
        position: Math.min(Math.max(0, currentTime), Math.max(1, duration)),
        playbackRate: Math.max(0.5, Math.min(2.0, playbackRate)),
      });
    } catch {
      // Ignored
    }
  }
}

export const mediaSessionService = new MediaSessionService();
