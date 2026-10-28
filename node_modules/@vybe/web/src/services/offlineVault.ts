/**
 * Offline Binary Vault (IndexedDB Engine)
 * Database: vybe_offline_db (Version 1)
 * Object Store: offline_tracks (keyPath: 'id')
 * 
 * High-performance binary storage for full-fidelity audio files,
 * offline cached cover artwork (Data URLs), and synced lyrics (LyricLineItem[]).
 * 
 * Works seamlessly across Laptop (Web/Electron) and Android (Capacitor WebView).
 */

import { LyricLineItem } from '../components/KineticLyrics/VybeKineticStage';
import { convertToVybeLineItems } from '../App';
import { autoFetchLyrics } from './lrclibClient';
import { resolveStreamUrl, EchoTrack } from './streamResolver';
import { TrackMetadata } from '../providers/types';

export interface OfflineTrackRecord {
  id: string;
  userId: string;
  title: string;
  artist: string;
  album?: string;
  duration: number;
  audioBlob: Blob;            // Full binary audio file stored on disk
  artworkDataUrl?: string;    // Base64 / cached cover art for offline display
  lyrics: LyricLineItem[];    // Pre-fetched synced lyrics so Kinetic Stage works 100% offline!
  sizeBytes: number;
  downloadedAt: number;
}

export interface StorageStats {
  count: number;
  totalBytes: number;
  totalMB: string;
}

const DB_NAME = 'vybe_offline_db';
const DB_VERSION = 1;
const STORE_NAME = 'offline_tracks';

class OfflineVault {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private blobUrlCache = new Map<string, string>();
  private activeDownloads = new Map<string, Promise<OfflineTrackRecord>>();
  private listeners = new Set<() => void>();
  private progressListeners = new Map<string, Set<(pct: number) => void>>();
  private cachedDownloadedIds = new Set<string>();
  private isIdsInitialized = false;

  constructor() {
    if (typeof window !== 'undefined' && 'indexedDB' in window) {
      this.initCache();
    }
  }

  private async initCache(): Promise<void> {
    try {
      const records = await this.getAllOfflineTracks();
      this.cachedDownloadedIds.clear();
      for (const r of records) {
        this.cachedDownloadedIds.add(r.id);
      }
      this.isIdsInitialized = true;
      this.notifyListeners();
    } catch (e) {
      console.warn('[OfflineVault] Initial cache read error:', e);
    }
  }

  private openDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof window === 'undefined' || !('indexedDB' in window)) {
        reject(new Error('IndexedDB is not supported in this environment'));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('userId', 'userId', { unique: false });
          store.createIndex('downloadedAt', 'downloadedAt', { unique: false });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error || new Error('Failed to open vybe_offline_db'));
      };
    });

    return this.dbPromise;
  }

  /**
   * Subscribes to offline database changes (tracks added or removed).
   */
  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Subscribes to active download progress updates for a specific track.
   */
  public subscribeToProgress(trackId: string, listener: (pct: number) => void): () => void {
    if (!this.progressListeners.has(trackId)) {
      this.progressListeners.set(trackId, new Set());
    }
    this.progressListeners.get(trackId)!.add(listener);
    return () => {
      const set = this.progressListeners.get(trackId);
      if (set) {
        set.delete(listener);
        if (set.size === 0) this.progressListeners.delete(trackId);
      }
    };
  }

  private notifyListeners(): void {
    for (const l of this.listeners) {
      try {
        l();
      } catch (err) {
        console.error('[OfflineVault] Listener error:', err);
      }
    }
  }

  private notifyProgress(trackId: string, pct: number): void {
    const set = this.progressListeners.get(trackId);
    if (set) {
      for (const listener of set) {
        try {
          listener(pct);
        } catch (err) {
          console.error('[OfflineVault] Progress listener error:', err);
        }
      }
    }
  }

  /**
   * Fast synchronous check if trackId is downloaded (powered by memory set).
   */
  public isDownloadedSync(trackId: string): boolean {
    return this.cachedDownloadedIds.has(trackId);
  }

  /**
   * Checks if a trackId is downloaded into IndexedDB.
   */
  public async isTrackDownloaded(trackId: string): Promise<boolean> {
    if (this.isIdsInitialized) {
      return this.cachedDownloadedIds.has(trackId);
    }
    const record = await this.getOfflineRecord(trackId);
    const exists = record !== null;
    if (exists) this.cachedDownloadedIds.add(trackId);
    return exists;
  }

  /**
   * Streams the audio via direct CDN / proxy using fetch() + ReadableStream reader
   * so onProgress(0..100) updates smoothly as bytes arrive.
   * Simultaneously fetches & parses synced lyrics and caches the cover artwork into a Data URL.
   */
  public async downloadTrackForOffline(
    track: EchoTrack | TrackMetadata,
    onProgress?: (pct: number) => void,
    userId: string = 'guest-vyber'
  ): Promise<OfflineTrackRecord> {
    const trackId = track.id;

    // Check if already downloaded
    const existing = await this.getOfflineRecord(trackId);
    if (existing) {
      onProgress?.(100);
      this.notifyProgress(trackId, 100);
      return existing;
    }

    // Check if currently downloading
    if (this.activeDownloads.has(trackId)) {
      if (onProgress) {
        this.subscribeToProgress(trackId, onProgress);
      }
      return this.activeDownloads.get(trackId)!;
    }

    const downloadPromise = (async () => {
      try {
        onProgress?.(2);
        this.notifyProgress(trackId, 2);

        // 1. Resolve Stream URL
        const rawStreamUrl = track.streamUrl || '';
        const resolvedUrl = resolveStreamUrl(rawStreamUrl) || rawStreamUrl;

        if (!resolvedUrl && !(track as TrackMetadata).rawFile) {
          throw new Error(`Track ${track.title} has no playable stream URL or file.`);
        }

        // 2. Start Lyrics Fetch & Artwork Cache in Parallel
        const lyricsPromise = (async (): Promise<LyricLineItem[]> => {
          try {
            const res = await autoFetchLyrics(
              {
                title: track.title,
                artist: track.artist,
                album: track.album,
                searchQuery: (track as TrackMetadata).searchQuery,
                songId: track.id,
              },
              track.duration
            );
            if (res?.track?.lines && res.track.lines.length > 0) {
              return convertToVybeLineItems(res.track.lines);
            }
          } catch (e) {
            console.warn('[OfflineVault] Lyrics auto-fetch fallback:', e);
          }
          return [];
        })();

        const artworkPromise = (async (): Promise<string | undefined> => {
          if (!track.artworkUrl) return undefined;
          try {
            const res = await fetch(track.artworkUrl);
            if (res.ok) {
              const blob = await res.blob();
              return await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = () => resolve(track.artworkUrl || '');
                reader.readAsDataURL(blob);
              });
            }
          } catch (e) {
            console.warn('[OfflineVault] Artwork data URL conversion fallback:', e);
          }
          return track.artworkUrl;
        })();

        // 3. Download Audio Binary with ReadableStream progress
        let audioBlob: Blob;

        if ((track as TrackMetadata).rawFile) {
          audioBlob = (track as TrackMetadata).rawFile as Blob;
          onProgress?.(50);
          this.notifyProgress(trackId, 50);
        } else {
          const response = await fetch(resolvedUrl);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status} failed while fetching audio stream.`);
          }

          const contentLengthHeader = response.headers.get('content-length');
          const totalBytes = contentLengthHeader ? parseInt(contentLengthHeader, 10) : 0;
          // Approximate 320kbps size (~40,000 bytes/sec) if header is missing
          const estimatedBytes = totalBytes > 0 ? totalBytes : (track.duration ? Math.round(track.duration * 40000) : 4 * 1024 * 1024);

          const contentType = response.headers.get('content-type') || 'audio/mp4';

          if (response.body && typeof response.body.getReader === 'function') {
            const reader = response.body.getReader();
            const chunks: BlobPart[] = [];
            let receivedBytes = 0;

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              if (value) {
                chunks.push(value);
                receivedBytes += value.length;
                const ratio = Math.min(0.95, receivedBytes / estimatedBytes);
                const pct = Math.max(5, Math.min(95, Math.round(ratio * 90) + 5));
                onProgress?.(pct);
                this.notifyProgress(trackId, pct);
              }
            }

            audioBlob = new Blob(chunks, { type: contentType });
          } else {
            audioBlob = await response.blob();
            onProgress?.(90);
            this.notifyProgress(trackId, 90);
          }
        }

        // Wait for lyrics and artwork
        const [lyrics, artworkDataUrl] = await Promise.all([lyricsPromise, artworkPromise]);

        const record: OfflineTrackRecord = {
          id: track.id,
          userId,
          title: track.title,
          artist: track.artist || 'Unknown Artist',
          album: track.album,
          duration: track.duration || 0,
          audioBlob,
          artworkDataUrl,
          lyrics,
          sizeBytes: audioBlob.size,
          downloadedAt: Date.now(),
        };

        // 4. Save to IndexedDB
        const db = await this.openDB();
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          const req = store.put(record);

          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error || new Error('Failed to save track to IndexedDB'));
        });

        // 5. Update cached state
        this.cachedDownloadedIds.add(track.id);
        const playableUrl = URL.createObjectURL(record.audioBlob);
        this.blobUrlCache.set(track.id, playableUrl);

        onProgress?.(100);
        this.notifyProgress(trackId, 100);
        this.notifyListeners();

        return record;
      } finally {
        this.activeDownloads.delete(trackId);
      }
    })();

    this.activeDownloads.set(trackId, downloadPromise);
    return downloadPromise;
  }

  /**
   * Returns a cached URL.createObjectURL(record.audioBlob) so AudioDSPEngine
   * plays directly from local disk in 0ms with zero network required!
   */
  public async getOfflinePlayableUrl(trackId: string): Promise<string | null> {
    if (this.blobUrlCache.has(trackId)) {
      return this.blobUrlCache.get(trackId)!;
    }

    const record = await this.getOfflineRecord(trackId);
    if (!record || !record.audioBlob) return null;

    const playableUrl = URL.createObjectURL(record.audioBlob);
    this.blobUrlCache.set(trackId, playableUrl);
    return playableUrl;
  }

  /**
   * Returns pre-fetched cached offline lyrics immediately when playing a downloaded song.
   */
  public async getOfflineLyrics(trackId: string): Promise<LyricLineItem[] | null> {
    const record = await this.getOfflineRecord(trackId);
    if (record && record.lyrics && record.lyrics.length > 0) {
      return record.lyrics;
    }
    return null;
  }

  /**
   * Retrieves full offline record from IndexedDB.
   */
  public async getOfflineRecord(trackId: string): Promise<OfflineTrackRecord | null> {
    try {
      const db = await this.openDB();
      return new Promise<OfflineTrackRecord | null>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(trackId);

        req.onsuccess = () => {
          resolve((req.result as OfflineTrackRecord) || null);
        };
        req.onerror = () => {
          reject(req.error);
        };
      });
    } catch (e) {
      console.warn('[OfflineVault] getOfflineRecord error:', e);
      return null;
    }
  }

  /**
   * Returns all downloaded tracks from IndexedDB.
   */
  public async getAllOfflineTracks(): Promise<OfflineTrackRecord[]> {
    try {
      const db = await this.openDB();
      return new Promise<OfflineTrackRecord[]>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();

        req.onsuccess = () => {
          resolve((req.result as OfflineTrackRecord[]) || []);
        };
        req.onerror = () => {
          reject(req.error);
        };
      });
    } catch (e) {
      console.warn('[OfflineVault] getAllOfflineTracks error:', e);
      return [];
    }
  }

  /**
   * Returns all offline tracks formatted as EchoTrack items for direct UI display.
   */
  public async getOfflineAsEchoTracks(): Promise<EchoTrack[]> {
    const records = await this.getAllOfflineTracks();
    return records.map((r) => {
      let streamUrl = this.blobUrlCache.get(r.id);
      if (!streamUrl && r.audioBlob) {
        streamUrl = URL.createObjectURL(r.audioBlob);
        this.blobUrlCache.set(r.id, streamUrl);
      }
      return {
        id: r.id,
        title: r.title,
        artist: r.artist,
        album: r.album,
        duration: r.duration,
        artworkUrl: r.artworkDataUrl,
        streamUrl: streamUrl || '',
        quality: '320kbps',
        source: 'local',
        sourceType: 'stream',
      };
    });
  }

  /**
   * Removes a downloaded track from the offline vault and revokes memory URLs.
   */
  public async removeOfflineTrack(trackId: string): Promise<void> {
    try {
      if (this.blobUrlCache.has(trackId)) {
        URL.revokeObjectURL(this.blobUrlCache.get(trackId)!);
        this.blobUrlCache.delete(trackId);
      }
      this.cachedDownloadedIds.delete(trackId);

      const db = await this.openDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(trackId);

        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });

      this.notifyListeners();
    } catch (e) {
      console.warn('[OfflineVault] removeOfflineTrack error:', e);
    }
  }

  /**
   * Returns total downloaded song count and total MB used on device.
   */
  public async getStorageStats(): Promise<StorageStats> {
    const tracks = await this.getAllOfflineTracks();
    let totalBytes = 0;
    for (const t of tracks) {
      totalBytes += t.sizeBytes || t.audioBlob?.size || 0;
    }
    const totalMB = (totalBytes / (1024 * 1024)).toFixed(1);
    return {
      count: tracks.length,
      totalBytes,
      totalMB,
    };
  }

  /**
   * 1-Click button to export/save the cached audioBlob directly to the user's
   * Laptop/Phone Downloads folder as "Artist - Title.m4a".
   */
  public async saveTrackToDeviceDisk(trackId: string): Promise<void> {
    const record = await this.getOfflineRecord(trackId);
    if (!record || !record.audioBlob) {
      throw new Error('Track is not available in local offline vault.');
    }

    const cleanTitle = (record.title || 'Track').replace(/[/\\?%*:|"<>]/g, '_');
    const cleanArtist = (record.artist || 'Artist').replace(/[/\\?%*:|"<>]/g, '_');
    const fileName = `${cleanArtist} - ${cleanTitle}.m4a`;

    const blobUrl = URL.createObjectURL(record.audioBlob);
    const anchor = document.createElement('a');
    anchor.href = blobUrl;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);

    setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
    }, 45000);
  }
}

export const offlineVault = new OfflineVault();
