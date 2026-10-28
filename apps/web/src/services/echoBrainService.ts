/**
 * Echo Brain Auto-Queue Momentum Engine
 * 
 * Replicates Echo-Music's signature "Echo Brain" dynamic auto-queue:
 * When the queue drops below 2 remaining songs, Echo Brain automatically analyzes
 * the currently playing track's artist/vibe, discovers 3 acoustically matching songs
 * from the catalog, filters out played tracks, and appends them to Up Next so our
 * 3-Tier Apple AutoMix Engine can transition endlessly without silence.
 */

import { TrackMetadata } from '../providers/types';
import { fetchCatalogSearch } from './streamResolver';

const STORAGE_KEY = 'vybe_echo_brain_enabled';

class EchoBrainService {
  private isEnabled: boolean = true;
  private playedTrackIds: Set<string> = new Set();
  private isFetching: boolean = false;
  private lastQueriedSeed: string = '';

  constructor() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved !== null) {
          this.isEnabled = saved === 'true';
        }
      }
    } catch (e) {
      console.warn('[EchoBrain] LocalStorage read failed:', e);
    }
  }

  public getIsEnabled(): boolean {
    return this.isEnabled;
  }

  public setIsEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(STORAGE_KEY, String(enabled));
      }
    } catch (e) {
      console.warn('[EchoBrain] LocalStorage write failed:', e);
    }
  }

  public toggle(): boolean {
    this.setIsEnabled(!this.isEnabled);
    return this.isEnabled;
  }

  public recordPlayedTrack(trackId: string): void {
    if (trackId) {
      this.playedTrackIds.add(trackId);
    }
  }

  /**
   * Checks queue length and refills with 3 acoustically matching songs if < 2 songs remain.
   */
  public async checkAndRefillQueue(
    currentTrack: TrackMetadata,
    queue: TrackMetadata[],
    activeIndex: number,
    onAppendTracks: (newTracks: TrackMetadata[]) => void
  ): Promise<void> {
    if (!this.isEnabled || this.isFetching) return;
    if (!currentTrack || !currentTrack.id) return;

    // Record active track as played
    this.recordPlayedTrack(currentTrack.id);

    // Calculate how many tracks remain after current song
    const remainingCount = queue.length - 1 - activeIndex;
    if (remainingCount >= 2) return;

    this.isFetching = true;

    try {
      // Formulate recommendation seed query
      let seed = '';
      if (currentTrack.artist && currentTrack.artist !== 'Unknown Artist' && currentTrack.artist !== 'Vybe Synthesizer') {
        seed = currentTrack.artist;
      } else if (currentTrack.genre) {
        seed = currentTrack.genre;
      } else {
        seed = currentTrack.title || 'trending hits';
      }

      // Avoid repeating the exact same search query in quick succession
      if (seed === this.lastQueriedSeed && remainingCount >= 1) {
        this.isFetching = false;
        return;
      }
      this.lastQueriedSeed = seed;

      console.log(`[EchoBrain] Auto-Refill triggered • Searching momentum seed: "${seed}"...`);
      const rawCandidates = await fetchCatalogSearch(seed, 15);
      if (!rawCandidates || rawCandidates.length === 0) {
        this.isFetching = false;
        return;
      }


      // Filter out songs already played or already in the current queue
      const existingIds = new Set([
        ...this.playedTrackIds,
        ...queue.map((t) => t.id),
      ]);

      const freshCandidates = rawCandidates.filter((t) => !existingIds.has(t.id));

      if (freshCandidates.length > 0) {
        const toAppend = freshCandidates.slice(0, 3);
        console.log(`[EchoBrain] Appending ${toAppend.length} matching songs to queue:`, toAppend.map(t => t.title));
        
        for (const track of toAppend) {
          this.playedTrackIds.add(track.id);
        }

        onAppendTracks(toAppend);
      }
    } catch (err) {
      console.warn('[EchoBrain] Auto-refill failed:', err);
    } finally {
      this.isFetching = false;
    }
  }
}

export const echoBrain = new EchoBrainService();
