import { useState, useEffect, useRef, useCallback } from 'react';
import {
  AudioDSPEngine,
  AutoMixProgress,
  TransitionMode,
} from '../audio/AudioDSPEngine';
import { FACTORY_EQ_PRESETS, EQPreset } from '../audio/eqPresets';
import { TrackMetadata } from '../providers/types';
import { extractMetadataFromFile } from '../providers/metadataExtractor';
import { autoFetchLyrics, getCachedLyricTrack, setCachedLyricTrack } from '../services/lrclibClient';
import { LyricTrack } from '../services/lrcParser';
import { TrackAnalyzer, TrackAudioProfile } from '../audio/TrackAnalyzer';
import { echoBrain } from '../services/echoBrainService';
import { mediaSessionService } from '../services/mediaSessionService';
import { resolveStreamUrl, fetchCatalogSearch, fetchTrackStreamOnDemand, resolveFullTrackAudio } from '../services/streamResolver';
import { offlineVault } from '../services/offlineVault';
import { userLibrary } from '../services/userLibraryService';

export const DEFAULT_INITIAL_TRACK: TrackMetadata = {
  id: 'tycho-a-walk-initial',
  title: 'A Walk',
  artist: 'Tycho',
  album: 'Dive',
  duration: 316,
  artworkUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=300&q=80',
  searchQuery: 'Tycho A Walk Dive',
  sourceType: 'stream',
};

export function getSavedLastPlayedTrack(): TrackMetadata {
  if (typeof window !== 'undefined') {
    try {
      const userSaved = userLibrary.getUserLastPlayedTrack();
      if (userSaved && userSaved.title && !userSaved.title.includes('808 Cyberpunk')) {
        return userSaved;
      }
      const raw = localStorage.getItem('vybe_last_played_track');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.title && !parsed.title.includes('808 Cyberpunk')) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
  }
  return DEFAULT_INITIAL_TRACK;
}

/**
 * 3-Tier Seamless Audio Routing:
 * 1. Checks if track is saved in IndexedDB offlineVault (returns 0ms local blob: URL)
 * 2. Tier 1: Verified Direct JioSaavn 320kbps stream (only if title & artist match)
 * 3. Tier 2: Native YouTube Music Audio Resolver (Electron IPC or dev proxy)
 * 4. Tier 3: Public Piped & official iTunes studio audio preview fallback
 */
async function resolvePlayableUrl(track: TrackMetadata): Promise<string> {
  try {
    const offlineUrl = await offlineVault.getOfflinePlayableUrl(track.id);
    if (offlineUrl) return offlineUrl;
  } catch (e) {
    console.warn('[useAudioEngine] Offline vault check fallback:', e);
  }

  try {
    const stream = await resolveFullTrackAudio(track);
    if (stream) {
      track.streamUrl = stream;
      track.audioUrl = stream;
      track.url = stream;
      return stream;
    }
  } catch (err) {
    console.warn('[useAudioEngine] Stream resolution failed:', err);
  }

  return '';
}

export interface QueuedTrack extends TrackMetadata {
  lyricsStatus?: string;
  lyricsTrack?: LyricTrack;
  isPreFetched?: boolean;
  profile?: TrackAudioProfile;
  isAnalyzingAudio?: boolean;
}

export interface AudioEngineState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  trackTitle: string;
  isDemoLoaded: boolean;
  subBass: number;
  punch: number;
  bands: [number, number, number, number, number];
  activePresetId: string;
  isLimiterBypassed: boolean;
  currentTrack: TrackMetadata;
  activeDeckId: 'A' | 'B';
  // Spatial Audio 3D & Apple Music Sing Mode
  spatialMode: 'off' | 'spatial-3d' | 'concert-hall';
  vocalAttenuation: number; // 0.0 to 1.0
  // 3-Tier Apple Transition Architecture
  transitionMode: TransitionMode;
  crossfadeDuration: number; // default 5.0s
  isTransitioning: boolean;
  autoMixProgress: AutoMixProgress | null;
  // Playlist / Queue state
  currentTrackIndex: number;
  playlist: QueuedTrack[];
}

export function useAudioEngine(
  onTrackChangeCallback?: (
    incomingTrack: TrackMetadata,
    incomingLyrics?: LyricTrack
  ) => void
) {
  const engineRef = useRef<AudioDSPEngine | null>(null);

  const onTrackChangeRef = useRef(onTrackChangeCallback);
  onTrackChangeRef.current = onTrackChangeCallback;

  // React state for UI rendering
  const [state, setState] = useState<AudioEngineState>(() => {
    const initialTrackMeta = getSavedLastPlayedTrack();
    const fallbackProfile = TrackAnalyzer.generateFallbackProfile(initialTrackMeta.duration || 300);
    const initialTrack: QueuedTrack = {
      ...initialTrackMeta,
      lyricsStatus: 'Ready',
      isPreFetched: false,
      profile: fallbackProfile,
      isAnalyzingAudio: false,
    };
    return {
      isPlaying: false,
      currentTime: 0,
      duration: initialTrackMeta.duration || 300,
      volume: 0.85,
      isMuted: false,
      trackTitle: initialTrackMeta.title,
      isDemoLoaded: false,
      subBass: 0,
      punch: 0,
      bands: [0, 0, 0, 0, 0],
      activePresetId: 'flat',
      isLimiterBypassed: false,
      currentTrack: initialTrack,
      activeDeckId: 'A',
      spatialMode: 'off',
      vocalAttenuation: 0.0,
      transitionMode: 'automix', // Default: Apple Music AutoMix
      crossfadeDuration: 5.0,
      isTransitioning: false,
      autoMixProgress: null,
      currentTrackIndex: 0,
      playlist: [initialTrack],
    };
  });

  const [activeAudioElement, setActiveAudioElement] = useState<HTMLAudioElement | null>(null);
  const isSeekingRef = useRef<boolean>(false);
  const seekingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // References for interval monitoring
  const stateRef = useRef(state);
  stateRef.current = state;

  const triggerNextTransitionRef = useRef<() => Promise<void>>();
  const addTracksToQueueRef = useRef<(tracks: TrackMetadata[], playImmediately?: boolean) => void>();

  // Background Audio Scanner: computes LUFS, Sound Check gain, and cue points
  const analyzeTrackBackground = useCallback(async (track: QueuedTrack, source: File | Blob | string) => {
    if (track.profile && !track.isAnalyzingAudio) return;

    try {
      const profile = await TrackAnalyzer.analyzeTrack(track.id, source, track.duration);

      setState((s) => ({
        ...s,
        playlist: s.playlist.map((item) =>
          item.id === track.id
            ? { ...item, profile, isAnalyzingAudio: false }
            : item
        ),
        currentTrack: s.currentTrack.id === track.id ? { ...s.currentTrack, ...profile } : s.currentTrack,
      }));

      // If this is the currently active track, update sound check gain immediately
      if (engineRef.current && stateRef.current.currentTrack.id === track.id) {
        engineRef.current.setCurrentProfile(profile);
      }
    } catch (err) {
      console.warn(`[useAudioEngine] Audio analysis error for ${track.title}:`, err);
    }
  }, []);

  // Pre-fetch lyrics in background for newly added tracks
  const prefetchTrackLyrics = useCallback(async (track: QueuedTrack) => {
    if (track.isPreFetched || track.lyricsTrack) return;

    try {
      const result = await autoFetchLyrics(
        {
          title: track.title,
          artist: track.artist,
          album: track.album,
          searchQuery: track.searchQuery,
        },
        track.duration
      );
      if (result.track) {
        setCachedLyricTrack(track.id, result.track);
        setCachedLyricTrack(track.title, result.track);
      }

      setState((s) => ({
        ...s,
        playlist: s.playlist.map((item) =>
          item.id === track.id
            ? {
                ...item,
                lyricsTrack: result.track,
                lyricsStatus: result.isFallbackInterpolated
                  ? 'Interpolated Lyrics'
                  : 'Synced Lyrics Ready',
                isPreFetched: true,
              }
            : item
        ),
      }));
    } catch (err) {
      console.warn('[useAudioEngine] Background lyrics pre-fetch error:', err);
    }
  }, []);

  // Initialize engine on mount
  useEffect(() => {
    const engine = new AudioDSPEngine();
    engine.initialize();
    engineRef.current = engine;

    const audioA = engine.deckA;
    const audioB = engine.deckB;
    setActiveAudioElement(audioA);

    // Initialize with saved track or DEFAULT_INITIAL_TRACK
    const initialTrack = getSavedLastPlayedTrack();
    engine.setTrackMetadata('A', initialTrack);

    // Resolve real playable URL in background so Deck A is primed to stream full-length music
    resolvePlayableUrl(initialTrack).then(async (src) => {
      if (src) {
        audioA.src = src;
      } else if (initialTrack.searchQuery || initialTrack.title) {
        try {
          const results = await fetchCatalogSearch(
            initialTrack.searchQuery || `${initialTrack.artist} ${initialTrack.title}`,
            1
          );
          if (results.length > 0 && results[0].streamUrl) {
            const resolved = resolveStreamUrl(results[0].streamUrl);
            audioA.src = resolved;
            setState((s) => ({
              ...s,
              currentTrack: { ...s.currentTrack, ...results[0], streamUrl: resolved },
              playlist: s.playlist.map((p, idx) =>
                idx === 0 ? { ...p, ...results[0], streamUrl: resolved } : p
              ),
            }));
          }
        } catch (err) {
          console.warn('[useAudioEngine] Failed to resolve initial track stream:', err);
        }
      }
    });

    let lastTimeUpdate = 0;
    const onTimeUpdate = () => {
      if (isSeekingRef.current) return;
      const now = performance.now();
      if (now - lastTimeUpdate < 240) return; // Throttled to ~4 updates per second (250ms)
      lastTimeUpdate = now;

      const currentAudio = engine.getActiveAudioElement();
      mediaSessionService.updatePositionState(currentAudio.duration, currentAudio.currentTime);
      setState((s) => ({
        ...s,
        currentTime: currentAudio.currentTime,
        duration: currentAudio.duration || s.duration,
      }));
    };

    const onLoadedMetadata = () => {
      const currentAudio = engine.getActiveAudioElement();
      setState((s) => ({
        ...s,
        duration: currentAudio.duration || s.duration,
        currentTrack: { ...s.currentTrack, duration: currentAudio.duration || s.currentTrack.duration },
      }));
    };

    const onAudioEnded = () => {
      const eng = engineRef.current;
      if (!eng || eng.getIsTransitioning()) return;
      triggerNextTransitionRef.current?.();
    };

    audioA.addEventListener('timeupdate', onTimeUpdate);
    audioA.addEventListener('loadedmetadata', onLoadedMetadata);
    audioA.addEventListener('ended', onAudioEnded);

    audioB.addEventListener('timeupdate', onTimeUpdate);
    audioB.addEventListener('loadedmetadata', onLoadedMetadata);
    audioB.addEventListener('ended', onAudioEnded);

    // AutoMix / Crossfade Progress & Real-time Beat-Drop Swap state
    engine.onTransitionProgress = (prog) => {
      setState((s) => ({
        ...s,
        isTransitioning: prog.isActive,
        autoMixProgress: prog,
      }));
    };

    // Phase 2 (t = 0.50 / -0:12) Midpoint Handover:
    // Flip UI's active Track Title, Artist, and Album Artwork to Incoming Track while keeping "Mixing" badge visible
    engine.onTransitionMidpoint = (incomingTrack) => {
      mediaSessionService.updateMetadata(incomingTrack);
      const incomingLyrics =
        stateRef.current.playlist.find((p) => p.id === incomingTrack.id)?.lyricsTrack ||
        getCachedLyricTrack(incomingTrack.id) ||
        getCachedLyricTrack(incomingTrack.title);
      onTrackChangeRef.current?.(incomingTrack, incomingLyrics);
      setState((s) => ({
        ...s,
        currentTrack: incomingTrack,
        trackTitle: incomingTrack.title,
      }));
    };

    engine.onTransitionComplete = (newActiveDeckId, newTrack) => {
      const activeEl = engine.getActiveAudioElement();
      setActiveAudioElement(activeEl);
      if (newTrack) {
        mediaSessionService.updateMetadata(newTrack);
      }

      setState((s) => ({
        ...s,
        activeDeckId: newActiveDeckId,
        isTransitioning: false,
        autoMixProgress: null,
        currentTrack: newTrack || s.currentTrack,
        trackTitle: (newTrack || s.currentTrack).title,
        currentTime: activeEl.currentTime,
        duration: activeEl.duration || s.duration,
      }));
    };

    return () => {
      engine.pause();
      audioA.removeEventListener('timeupdate', onTimeUpdate);
      audioA.removeEventListener('loadedmetadata', onLoadedMetadata);
      audioA.removeEventListener('ended', onAudioEnded);

      audioB.removeEventListener('timeupdate', onTimeUpdate);
      audioB.removeEventListener('loadedmetadata', onLoadedMetadata);
      audioB.removeEventListener('ended', onAudioEnded);

    };
  }, []);

  // Persist last played track to localStorage & userLibrary
  useEffect(() => {
    if (state.currentTrack && state.currentTrack.title && !state.currentTrack.title.includes('808 Cyberpunk')) {
      try {
        userLibrary.setUserLastPlayedTrack(state.currentTrack);
      } catch (e) {
        console.warn('Failed to save user last played track:', e);
      }
    }
  }, [state.currentTrack]);

  // ---------------------------------------------------------------------------
  // Transition Execution into Track at Index
  // ---------------------------------------------------------------------------
  const playTrackAtIndex = useCallback(
    async (index: number, _isManualSkip = false) => {
      const engine = engineRef.current;
      if (!engine) return;

      const currentPl = stateRef.current.playlist;
      if (index < 0 || index >= currentPl.length) return;

      const targetTrack = currentPl[index];
      const src = await resolvePlayableUrl(targetTrack);
      if (!src) return;

      const incomingProfile = targetTrack.profile;

      // Notify lyrics / visual components and native media keys immediately
      onTrackChangeRef.current?.(targetTrack, targetTrack.lyricsTrack);
      mediaSessionService.updateMetadata(targetTrack);
      mediaSessionService.updatePlaybackState(true);

      setState((s) => ({
        ...s,
        currentTrackIndex: index,
        currentTrack: targetTrack,
        trackTitle: targetTrack.title,
        isPlaying: true,
        isDemoLoaded: false,
        currentTime: 0,
      }));

      // Instant direct playback start on user track click (< 300ms)
      await engine.loadTrack(src, true, incomingProfile);
    },
    []
  );

  // Automated transition into next track at end of song (respects AutoMix / Crossfade)
  const transitionToNextTrack = useCallback(async (isManualSkip = false) => {
    const pl = stateRef.current.playlist;
    if (pl.length === 0) return;
    const nextIdx = (stateRef.current.currentTrackIndex + 1) % pl.length;
    const engine = engineRef.current;
    if (!engine) return;

    const targetTrack = pl[nextIdx];
    const src = await resolvePlayableUrl(targetTrack);
    if (!src) return;

    const outgoingTrack = stateRef.current.currentTrack;
    const outgoingProfile = outgoingTrack.profile;
    const incomingProfile = targetTrack.profile;

    if (stateRef.current.transitionMode !== 'automix') {
      onTrackChangeRef.current?.(targetTrack, targetTrack.lyricsTrack);
      mediaSessionService.updateMetadata(targetTrack);
      mediaSessionService.updatePlaybackState(true);

      setState((s) => ({
        ...s,
        currentTrackIndex: nextIdx,
        currentTrack: targetTrack,
        trackTitle: targetTrack.title,
        isPlaying: true,
        isDemoLoaded: false,
        currentTime: 0,
      }));
    } else {
      // In AutoMix: UI flips at t = 0.50 via onTransitionMidpoint
      setState((s) => ({
        ...s,
        currentTrackIndex: nextIdx,
        isPlaying: true,
        isTransitioning: true,
      }));
    }

    if (stateRef.current.isPlaying && !stateRef.current.isDemoLoaded) {
      await engine.executeTransition({
        incomingSrc: src,
        incomingTrack: targetTrack,
        incomingProfile,
        outgoingTrack,
        outgoingProfile,
        mode: stateRef.current.transitionMode,
        crossfadeDuration: stateRef.current.crossfadeDuration,
        isManualSkip,
      });
    } else {
      await engine.loadTrack(src, true, incomingProfile);
    }
  }, []);
  triggerNextTransitionRef.current = () => transitionToNextTrack(false);

  // Next Track button click:
  // When AutoMix is active, trigger the accelerated 10-second DJ blend on demand!
  const nextTrack = useCallback(async () => {
    const pl = stateRef.current.playlist;
    if (pl.length === 0) return;
    if (stateRef.current.transitionMode === 'automix' && stateRef.current.isPlaying && !stateRef.current.isDemoLoaded) {
      await transitionToNextTrack(true);
    } else {
      const nextIdx = (stateRef.current.currentTrackIndex + 1) % pl.length;
      await playTrackAtIndex(nextIdx, true);
    }
  }, [playTrackAtIndex, transitionToNextTrack]);

  // Previous Track button click
  const prevTrack = useCallback(async () => {
    const pl = stateRef.current.playlist;
    if (pl.length === 0) return;
    const curTime = engineRef.current?.getCurrentTime() || 0;
    if (curTime > 3.0) {
      engineRef.current?.seek(0);
      setState((s) => ({ ...s, currentTime: 0 }));
      return;
    }
    const prevIdx = (stateRef.current.currentTrackIndex - 1 + pl.length) % pl.length;
    await playTrackAtIndex(prevIdx, true);
  }, [playTrackAtIndex]);

  // ---------------------------------------------------------------------------
  // 3-Phase Apple AutoMix End-of-Track Trigger Monitor:
  // - For AutoMix: triggers at duration > 50 && currentTime >= duration - 20 (-0:20 remaining)
  //   Fallback for tracks <= 50s: currentTime >= duration - 5.0
  // - For Crossfade: triggers at currentTime >= duration - 5.0
  // - Minimum playback safety guard: currentTime > 15 (prevents triggering during initial metadata load)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const interval = setInterval(() => {
      const engine = engineRef.current;
      if (!engine || !stateRef.current.isPlaying || engine.getIsTransitioning()) return;

      const activeEl = engine.getActiveAudioElement();
      const curTime = activeEl.currentTime;
      const duration = activeEl.duration;

      const isAutoMix = stateRef.current.transitionMode === 'automix';
      const transitionThreshold = isAutoMix ? 20.0 : 5.0;

      const shouldTrigger =
        Number.isFinite(duration) &&
        ((duration > 50 && curTime >= duration - transitionThreshold) ||
         (duration <= 50 && duration > 20 && curTime >= duration - 5.0)) &&
        curTime > 15;

      if (shouldTrigger) {
        triggerNextTransitionRef.current?.();
      }

      // Echo Brain Auto-Refill Check
      if (echoBrain.getIsEnabled() && stateRef.current.playlist.length > 0 && !stateRef.current.isDemoLoaded) {
        echoBrain.checkAndRefillQueue(
          stateRef.current.currentTrack,
          stateRef.current.playlist,
          stateRef.current.currentTrackIndex,
          (newTracks) => {
            addTracksToQueueRef.current?.(newTracks, false);
          }
        );
      }
    }, 250);

    return () => clearInterval(interval);
  }, []);

  // ---------------------------------------------------------------------------
  // Add Tracks (Streamed or Catalog) & Queue Management
  // ---------------------------------------------------------------------------
  const addTracksToQueue = useCallback(
    async (tracks: TrackMetadata[], playImmediately = false) => {
      if (tracks.length === 0) return;

      const newTracks: QueuedTrack[] = tracks.map((meta) => ({
        ...meta,
        lyricsStatus: 'Syncing LRCLIB...',
        isPreFetched: false,
        isAnalyzingAudio: true,
      }));

      // Background analyze & prefetch lyrics
      for (const qTrack of newTracks) {
        if (qTrack.streamUrl) {
          analyzeTrackBackground(qTrack, qTrack.streamUrl);
        }
        prefetchTrackLyrics(qTrack);
      }

      setState((s) => {
        const isDefaultDemoOnly =
          s.playlist.length === 1 &&
          (s.playlist[0].id === DEFAULT_INITIAL_TRACK.id ||
            s.playlist[0].id === 'demo-808-cyberpunk' ||
            s.isDemoLoaded);

        if (isDefaultDemoOnly || playImmediately) {
          const first = newTracks[0];
          resolvePlayableUrl(first).then((src) => {
            if (src && engineRef.current) {
              first.streamUrl = src;
              first.audioUrl = src;
              first.url = src;
              engineRef.current.loadTrack(src, true, first.profile);
            }
          });
          onTrackChangeRef.current?.(first, first.lyricsTrack);

          const updatedPl = isDefaultDemoOnly ? newTracks : [...s.playlist, ...newTracks];
          const newIdx = isDefaultDemoOnly ? 0 : s.playlist.length;

          return {
            ...s,
            playlist: updatedPl,
            currentTrackIndex: newIdx,
            currentTrack: first,
            trackTitle: first.title,
            isDemoLoaded: false,
            isPlaying: true,
            currentTime: 0,
          };
        }

        return {
          ...s,
          playlist: [...s.playlist, ...newTracks],
        };
      });
    },
    [analyzeTrackBackground, prefetchTrackLyrics]
  );
  addTracksToQueueRef.current = addTracksToQueue;

  const playNextInQueue = useCallback(
    (track: TrackMetadata) => {
      const qTrack: QueuedTrack = {
        ...track,
        lyricsStatus: 'Syncing LRCLIB...',
        isPreFetched: false,
        isAnalyzingAudio: true,
      };

      if (qTrack.streamUrl) {
        analyzeTrackBackground(qTrack, qTrack.streamUrl);
      }
      prefetchTrackLyrics(qTrack);

      setState((s) => {
        const isDefaultDemoOnly =
          s.playlist.length === 1 &&
          (s.playlist[0].id === DEFAULT_INITIAL_TRACK.id ||
            s.playlist[0].id === 'demo-808-cyberpunk' ||
            s.isDemoLoaded);

        if (isDefaultDemoOnly && !s.isPlaying) {
          if (qTrack.streamUrl && engineRef.current) {
            resolvePlayableUrl(qTrack).then((src) => {
              if (src && engineRef.current) {
                engineRef.current.loadTrack(src, true, qTrack.profile);
              }
            });
          }
          onTrackChangeRef.current?.(qTrack, qTrack.lyricsTrack);
          return {
            ...s,
            playlist: [qTrack],
            currentTrackIndex: 0,
            currentTrack: qTrack,
            trackTitle: qTrack.title,
            isDemoLoaded: false,
            isPlaying: true,
            currentTime: 0,
          };
        }

        const newPlaylist = [...s.playlist];
        const insertIndex = Math.min(s.currentTrackIndex + 1, newPlaylist.length);
        newPlaylist.splice(insertIndex, 0, qTrack);

        return {
          ...s,
          playlist: newPlaylist,
        };
      });
    },
    [analyzeTrackBackground, prefetchTrackLyrics]
  );

  const addFilesToQueue = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;

      const newTracks: QueuedTrack[] = [];

      for (const file of files) {
        const meta = await extractMetadataFromFile(file);
        const streamUrl = meta.streamUrl || URL.createObjectURL(file);
        const qTrack: QueuedTrack = {
          ...meta,
          streamUrl,
          lyricsStatus: 'Syncing LRCLIB...',
          isPreFetched: false,
          isAnalyzingAudio: true,
        };
        newTracks.push(qTrack);

        // Run background tasks: LUFS scan + lyrics prefetch
        analyzeTrackBackground(qTrack, file);
        prefetchTrackLyrics(qTrack);
      }

      setState((s) => {
        const isDefaultDemoOnly =
          s.playlist.length === 1 &&
          (s.playlist[0].id === DEFAULT_INITIAL_TRACK.id ||
            s.playlist[0].id === 'demo-808-cyberpunk' ||
            s.isDemoLoaded);

        if (isDefaultDemoOnly) {
          // Replace initial track with uploaded songs and immediately play the first one
          const first = newTracks[0];
          if (first.streamUrl && engineRef.current) {
            engineRef.current.loadTrack(first.streamUrl, true, first.profile);
          }
          onTrackChangeRef.current?.(first, first.lyricsTrack);

          return {
            ...s,
            playlist: newTracks,
            currentTrackIndex: 0,
            currentTrack: first,
            trackTitle: first.title,
            isDemoLoaded: false,
            isPlaying: true,
            currentTime: 0,
          };
        }

        return {
          ...s,
          playlist: [...s.playlist, ...newTracks],
        };
      });
    },
    [analyzeTrackBackground, prefetchTrackLyrics]
  );

  const removeFromQueue = useCallback((index: number) => {
    setState((s) => {
      if (index < 0 || index >= s.playlist.length) return s;
      const newPlaylist = [...s.playlist];
      newPlaylist.splice(index, 1);

      if (newPlaylist.length === 0) {
        const fallbackTrack = getSavedLastPlayedTrack();
        const demoProfile = TrackAnalyzer.generateFallbackProfile(fallbackTrack.duration || 300);
        const fallbackQueued: QueuedTrack = {
          ...fallbackTrack,
          lyricsStatus: 'Ready',
          isPreFetched: false,
          profile: demoProfile,
          isAnalyzingAudio: false,
        };
        return {
          ...s,
          playlist: [fallbackQueued],
          currentTrackIndex: 0,
          currentTrack: fallbackQueued,
          trackTitle: fallbackQueued.title,
          isDemoLoaded: false,
          isPlaying: false,
          currentTime: 0,
        };
      }

      let newIdx = s.currentTrackIndex;
      if (index === s.currentTrackIndex) {
        newIdx = Math.min(index, newPlaylist.length - 1);
        const target = newPlaylist[newIdx];
        if (target.streamUrl && engineRef.current) {
          engineRef.current.loadTrack(target.streamUrl, s.isPlaying, target.profile);
        }
        return {
          ...s,
          playlist: newPlaylist,
          currentTrackIndex: newIdx,
          currentTrack: target,
          trackTitle: target.title,
          currentTime: 0,
        };
      } else if (index < s.currentTrackIndex) {
        newIdx = s.currentTrackIndex - 1;
      }

      return {
        ...s,
        playlist: newPlaylist,
        currentTrackIndex: newIdx,
      };
    });
  }, []);

  const clearQueue = useCallback(() => {
    setState((s) => {
      if (s.playlist.length <= 1) return s;
      const cur = s.playlist[s.currentTrackIndex] || s.currentTrack;
      return {
        ...s,
        playlist: [cur],
        currentTrackIndex: 0,
      };
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Transition Mode Cycling & Settings
  // ---------------------------------------------------------------------------
  const cycleTransitionMode = useCallback(() => {
    setState((s) => {
      const modes: TransitionMode[] = ['automix', 'crossfade', 'gapless'];
      const nextIdx = (modes.indexOf(s.transitionMode) + 1) % modes.length;
      return { ...s, transitionMode: modes[nextIdx] };
    });
  }, []);

  const setTransitionMode = useCallback((mode: TransitionMode) => {
    setState((s) => ({ ...s, transitionMode: mode }));
  }, []);

  const setCrossfadeDuration = useCallback((dur: number) => {
    setState((s) => ({ ...s, crossfadeDuration: Math.max(1, Math.min(12, dur)) }));
  }, []);

  const triggerInstantDJTransition = useCallback(async () => {
    if (stateRef.current.playlist.length <= 1) return;
    await transitionToNextTrack(true);
  }, [transitionToNextTrack]);

  // ---------------------------------------------------------------------------
  // Playback & Volume Controls
  // ---------------------------------------------------------------------------
  const togglePlay = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine) return;

    await engine.resumeContext();
    const audio = engine.getActiveAudioElement();

    // If audio element has no source loaded yet, resolve real stream before playing
    if (!audio.src || audio.src === '' || audio.src === window.location.href) {
      const cur = stateRef.current.currentTrack;
      if (cur) {
        let src = await resolvePlayableUrl(cur);
        if (!src && cur.title) {
          try {
            const results = await fetchCatalogSearch(
              cur.searchQuery || `${cur.artist} ${cur.title}`,
              1
            );
            if (results.length > 0 && results[0].streamUrl) {
              src = resolveStreamUrl(results[0].streamUrl);
              setState((s) => ({
                ...s,
                currentTrack: { ...s.currentTrack, ...results[0], streamUrl: src },
                playlist: s.playlist.map((p, idx) =>
                  idx === s.currentTrackIndex ? { ...p, ...results[0], streamUrl: src } : p
                ),
              }));
            }
          } catch (e) {
            console.warn('[togglePlay] stream resolve error:', e);
          }
        }
        if (src) {
          await engine.loadTrack(src, true, cur.profile);
          mediaSessionService.updatePlaybackState(true);
          setState((s) => ({ ...s, isPlaying: true }));
          return;
        }
      }
    }

    if (audio.paused) {
      try {
        await engine.play();
        mediaSessionService.updatePlaybackState(true);
        setState((s) => ({ ...s, isPlaying: true }));
      } catch (err) {
        console.error('Audio playback failed:', err);
      }
    } else {
      engine.pause();
      mediaSessionService.updatePlaybackState(false);
      setState((s) => ({ ...s, isPlaying: false }));
    }
  }, []);

  const seek = useCallback((timeSeconds: number) => {
    const engine = engineRef.current;
    if (!engine) return;

    isSeekingRef.current = true;
    if (seekingTimeoutRef.current) clearTimeout(seekingTimeoutRef.current);
    seekingTimeoutRef.current = setTimeout(() => {
      isSeekingRef.current = false;
    }, 200);

    engine.seek(timeSeconds);
    setState((s) => ({ ...s, currentTime: timeSeconds }));
  }, []);

  // Register Native Lock-Screen, Bluetooth & Media Keys Handlers
  useEffect(() => {
    mediaSessionService.init({
      onPlay: () => { void togglePlay(); },
      onPause: () => { void togglePlay(); },
      onNextTrack: () => { void nextTrack(); },
      onPreviousTrack: () => { void prevTrack(); },
      onSeekTo: (seekTime: number) => { seek(seekTime); },
      onSeekBackward: (offset = 10) => {
        const cur = engineRef.current ? engineRef.current.getCurrentTime() : stateRef.current.currentTime;
        seek(Math.max(0, cur - offset));
      },
      onSeekForward: (offset = 10) => {
        const cur = engineRef.current ? engineRef.current.getCurrentTime() : stateRef.current.currentTime;
        const dur = engineRef.current ? engineRef.current.getDuration() : stateRef.current.duration;
        seek(Math.min(dur || 300, cur + offset));
      },
      onStop: () => {
        if (stateRef.current.isPlaying) void togglePlay();
      },
    });
  }, [togglePlay, nextTrack, prevTrack, seek]);

  const setVolume = useCallback((newVolume: number) => {
    const engine = engineRef.current;
    if (!engine) return;
    const clamped = Math.max(0, Math.min(1, newVolume));
    engine.setVolume(clamped);
    setState((s) => ({ ...s, volume: clamped, isMuted: clamped === 0 }));
  }, []);

  const toggleMute = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const nextMute = !state.isMuted;
    engine.setVolume(nextMute ? 0 : state.volume || 0.85);
    setState((s) => ({ ...s, isMuted: nextMute }));
  }, [state.isMuted, state.volume]);


  // Load single local file directly
  const loadLocalFile = useCallback(
    async (file: File) => {
      await addFilesToQueue([file]);
      return null;
    },
    [addFilesToQueue]
  );

  // DSP Controls
  const setSubBass = useCallback((val: number) => {
    engineRef.current?.setSubBassGain(val);
    setState((s) => ({ ...s, subBass: val, activePresetId: 'custom' }));
  }, []);

  const setPunch = useCallback((val: number) => {
    engineRef.current?.setPunchGain(val);
    setState((s) => ({ ...s, punch: val, activePresetId: 'custom' }));
  }, []);

  const setBand = useCallback((index: number, val: number) => {
    engineRef.current?.setBandGain(index, val);
    setState((s) => {
      const newBands = [...s.bands] as [number, number, number, number, number];
      newBands[index] = val;
      return { ...s, bands: newBands, activePresetId: 'custom' };
    });
  }, []);

  const applyPreset = useCallback((preset: EQPreset) => {
    engineRef.current?.setAllGains(preset.subBass, preset.punch, preset.bands);
    setState((s) => ({
      ...s,
      subBass: preset.subBass,
      punch: preset.punch,
      bands: [...preset.bands] as [number, number, number, number, number],
      activePresetId: preset.id,
    }));
  }, []);

  const toggleLimiterBypass = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;

    const nextState = !engine.getIsLimiterBypassed();
    engine.bypassLimiter(nextState);
    setState((s) => ({ ...s, isLimiterBypassed: nextState }));
  }, []);

  const setSpatialMode = useCallback((mode: 'off' | 'spatial-3d' | 'concert-hall') => {
    engineRef.current?.setSpatialMode(mode);
    setState((s) => ({ ...s, spatialMode: mode }));
  }, []);

  const setVocalAttenuation = useCallback((level: number) => {
    engineRef.current?.setVocalAttenuation(level);
    setState((s) => ({ ...s, vocalAttenuation: level }));
  }, []);

  const getSignalPathInfo = useCallback(() => {
    if (engineRef.current) {
      return engineRef.current.getSignalPathInfo();
    }
    return {
      format: '24-bit / 48kHz ALAC Lossless',
      sampleRate: 48000,
      bitDepth: '24-bit Integer / 32-bit Float DSP',
      spatialMode: state.spatialMode,
      spatialLabel: state.spatialMode === 'off' ? 'Stereo Lossless' : state.spatialMode === 'concert-hall' ? 'Concert Hall' : 'Spatial 3D',
      isSpatialActive: state.spatialMode !== 'off',
      lufs: -16.0,
      vocalReductionPct: Math.round(state.vocalAttenuation * 100),
      displayBadge: `24-bit / 48kHz ALAC Lossless • ${state.spatialMode === 'off' ? 'Stereo Lossless' : 'Spatial 3D'} • -16 LUFS`,
    };
  }, [state.spatialMode, state.vocalAttenuation]);

  return {
    state,
    engine: engineRef.current,
    audioElement: activeAudioElement,
    togglePlay,
    seek,
    setVolume,
    toggleMute,
    loadLocalFile,
    playTrackAtIndex,
    nextTrack,
    prevTrack,
    addFilesToQueue,
    addTracksToQueue,
    playNextInQueue,
    removeFromQueue,
    clearQueue,
    cycleTransitionMode,
    setTransitionMode,
    setCrossfadeDuration,
    triggerInstantDJTransition,
    setSubBass,
    setPunch,
    setBand,
    applyPreset,
    toggleLimiterBypass,
    setSpatialMode,
    setVocalAttenuation,
    getSignalPathInfo,
    presets: FACTORY_EQ_PRESETS,
  };
}
