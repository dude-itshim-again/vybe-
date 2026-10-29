import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAudioEngine } from './hooks/useAudioEngine';
import { useAudioReactiveCSS } from './hooks/useAudioReactiveCSS';
import {
  VybeKineticStage,
  LyricLineItem,
} from './components/KineticLyrics/VybeKineticStage';
import { DualVideoStage } from './components/VideoCanvas/DualVideoStage';
import { LyricsSearchModal } from './components/KineticLyrics/LyricsSearchModal';
import { LyricTrack, LyricLine } from './services/lrcParser';
import { TrackMetadata } from './providers/types';
import {
  autoFetchLyrics,
  LRCLibRecord,
  convertLRCLibToLyricTrack,
} from './services/lrclibClient';
import { fetchCatalogSearch } from './services/streamResolver';
import { VybeStudioDrawer, StudioTab } from './components/Studio/VybeStudioDrawer';
import {
  discoverBackgroundVideos,
  VideoCandidate,
  FALLBACK_VIDEO_CATALOG,
} from './services/videoDiscoveryService';
import {
  Sliders,
  X,
  Mic2,
  ListMusic,
  Trash2,
  Music,
  Disc,
  Disc3,
  Heart,
  Volume2,
  VolumeX,
  FastForward,
  RotateCcw,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Keyboard,
  FolderPlus,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  Dna,
  Plus,
} from 'lucide-react';
import { SearchCatalogView } from './components/Echo/SearchCatalogView';
import { MusicDnaDrawer } from './components/Echo/MusicDnaDrawer';
import { echoBrain } from './services/echoBrainService';
import { offlineVault, StorageStats } from './services/offlineVault';
import {
  userLibrary,
  VybeUser,
  LIKED_SONGS_PLAYLIST_ID,
} from './services/userLibraryService';
import { SidebarLibrary } from './components/Library/SidebarLibrary';
import { PlaylistHeroView } from './components/Library/PlaylistHeroView';
import { TrackActionButtons } from './components/Library/TrackActionButtons';
import { TrackActionPopover } from './components/Library/TrackActionPopover';
import { UserProfileModal } from './components/Auth/UserProfileModal';
import { vybeConnect } from './services/socialEngine';
import { discoveryEngine } from './services/discoveryEngine';
import { VybeConnectModal } from './components/Social/VybeConnectModal';
import { JamSessionModal } from './components/Social/JamSessionModal';
import { TasteBlendModal } from './components/Social/TasteBlendModal';
import { VybeWrappedModal } from './components/Discovery/VybeWrappedModal';
import { AudioQualitySpatialModal } from './components/Player/AudioQualitySpatialModal';
import { RadioEditorialView } from './components/Radio/RadioEditorialView';

// Editorial Components matching reference screenshot
import { EditorialSidebar, EditorialTab } from './components/Editorial/EditorialSidebar';
import { EditorialTopBar } from './components/Editorial/EditorialTopBar';
import { EditorialHomeView } from './components/Editorial/EditorialHomeView';
import { EditorialPlayerDock } from './components/Editorial/EditorialPlayerDock';
import { EditorialRecentlyPlayedView } from './components/Editorial/EditorialRecentlyPlayedView';
import { CreatePlaylistModal } from './components/Library/CreatePlaylistModal';
import { AutoMixTransitionHUD } from './components/Player/AutoMixTransitionHUD';
import { KeyboardShortcutsModal } from './components/Navigation/KeyboardShortcutsModal';
import { SplashScreen } from './components/Auth/SplashScreen';
import { AuthScreen, AuthenticatedUser } from './components/Auth/AuthScreen';
import { WelcomeModal } from './components/WelcomeModal';
import { supabase, syncUserLibrary } from './services/supabaseClient';
import { Session } from '@supabase/supabase-js';

function buildLyricLine(
  id: string,
  startTime: number,
  endTime: number,
  text: string
): LyricLineItem {
  return {
    id,
    startTime,
    endTime,
    text,
    words: [],
  };
}

/**
 * Converts unified parsed LyricLine[] from LRCLIB/lrcParser into exact LyricLineItem[] for VybeKineticStage.
 */
export function convertToVybeLineItems(lines: LyricLine[]): LyricLineItem[] {
  return lines.map((line, idx) => {
    const rawWords = line.words;
    if (rawWords && rawWords.length > 0) {
      return {
        id: line.id || `line-${idx}`,
        startTime: line.startTime,
        endTime: line.endTime,
        text: line.text,
        words: rawWords.map((w) => ({
          text: w.word || (w as unknown as { text?: string }).text || '',
          startTime: w.startTime,
          endTime: w.endTime,
        })),
      };
    }
    return buildLyricLine(
      line.id || `line-${idx}`,
      line.startTime,
      line.endTime,
      line.text
    );
  });
}

const EMPTY_KINETIC_LINES: LyricLineItem[] = [];

export const App: React.FC = () => {
  // Navigation View: 'home' (Discover) | 'search' | 'radio' | 'queue' | 'playlist' | 'library' | 'favorites' | 'recent'
  const [activeTab, setActiveTab] = useState<EditorialTab>('home');
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>(LIKED_SONGS_PLAYLIST_ID);
  const [topSearchQuery, setTopSearchQuery] = useState<string>('');
  const [isCreatePlaylistModalOpen, setIsCreatePlaylistModalOpen] = useState<boolean>(false);
  const [createPlaylistInitialTrack, setCreatePlaylistInitialTrack] = useState<TrackMetadata | null>(null);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState<boolean>(false);
  const [isShuffleOn, setIsShuffleOn] = useState<boolean>(false);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off');
  const prevVolumeRef = useRef<number>(0.85);
  const topSearchInputRef = useRef<HTMLInputElement | null>(null);

  // Floating Track Action Popover Menu State
  const [trackPopover, setTrackPopover] = useState<{
    isOpen: boolean;
    track: TrackMetadata | null;
    anchorRect: DOMRect | null;
  }>({
    isOpen: false,
    track: null,
    anchorRect: null,
  });

  // Floating Glass Toast Feedback State
  const [toast, setToast] = useState<{
    id: string;
    text: string;
    icon?: React.ReactNode;
  } | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((text: string, icon?: React.ReactNode) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToast({ id: `${Date.now()}`, text, icon });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 2200);
  }, []);

  const handleOpenTrackMenu = useCallback((track: TrackMetadata, anchorRect?: DOMRect) => {
    setTrackPopover({
      isOpen: true,
      track,
      anchorRect: anchorRect || null,
    });
  }, []);

  const handleToggleLikeWithToast = useCallback((track: TrackMetadata, isLiked: boolean) => {
    setLikedTracks(userLibrary.getLikedTracks() as unknown as TrackMetadata[]);
    showToast(
      isLiked ? 'Added to Favorites ♥' : 'Removed from Favorites',
      <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-[#E86538] text-[#E86538]' : 'text-white/60'}`} />
    );
  }, [showToast]);

  // Splash Screen Guard (plays once on load, never loops)
  const splashFinishedRef = useRef<boolean>(false);
  const [splashDone, setSplashDone] = useState<boolean>(false);

  const handleSplashComplete = useCallback(() => {
    if (!splashFinishedRef.current) {
      splashFinishedRef.current = true;
      setSplashDone(true);
    }
  }, []);

  // Dual-Locked Persistent Auth State across page reloads
  const [authUser, setAuthUser] = useState<AuthenticatedUser | null>(() => {
    try {
      const saved = localStorage.getItem('vybe_authenticated_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [, setSession] = useState<Session | null>(null);

  // Frictionless Local-Only Storage (likedTracks, playlists, recentlyPlayed, lastPlayedTrack)
  const [likedTracks, setLikedTracks] = useState<TrackMetadata[]>(() => {
    try {
      const saved = localStorage.getItem('vybe_liked_tracks');
      if (saved) return JSON.parse(saved);
      return (userLibrary.getLikedTracks() as unknown as TrackMetadata[]) || [];
    } catch {
      return [];
    }
  });

  const [playlists, setPlaylists] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('vybe_playlists');
      if (saved) return JSON.parse(saved);
      return userLibrary.getUserPlaylists() || [];
    } catch {
      return [];
    }
  });

  const [recentlyPlayed, setRecentlyPlayed] = useState<TrackMetadata[]>(() => {
    try {
      const saved = localStorage.getItem('vybe_recently_played');
      if (saved) return JSON.parse(saved);
      return userLibrary.getUserRecentlyPlayed() || [];
    } catch {
      return [];
    }
  });

  const [lastPlayedTrack, setLastPlayedTrack] = useState<TrackMetadata | null>(() => {
    try {
      const saved = localStorage.getItem('vybe_last_played_track');
      if (saved) return JSON.parse(saved);
      return (userLibrary.getUserLastPlayedTrack() as unknown as TrackMetadata) || null;
    } catch {
      return null;
    }
  });

  // Keep localStorage synced whenever state changes
  useEffect(() => {
    try {
      localStorage.setItem('vybe_liked_tracks', JSON.stringify(likedTracks));
    } catch (e) {
      console.warn('Failed to save liked tracks to localStorage', e);
    }
  }, [likedTracks]);

  useEffect(() => {
    try {
      localStorage.setItem('vybe_playlists', JSON.stringify(playlists));
    } catch (e) {
      console.warn('Failed to save playlists to localStorage', e);
    }
  }, [playlists]);

  useEffect(() => {
    try {
      localStorage.setItem('vybe_recently_played', JSON.stringify(recentlyPlayed));
    } catch (e) {
      console.warn('Failed to save recently played to localStorage', e);
    }
  }, [recentlyPlayed]);

  useEffect(() => {
    try {
      if (lastPlayedTrack) {
        localStorage.setItem('vybe_last_played_track', JSON.stringify(lastPlayedTrack));
      }
    } catch (e) {
      console.warn('Failed to save last played track to localStorage', e);
    }
  }, [lastPlayedTrack]);

  const [mouseOffset, setMouseOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const w = window.innerWidth || 1920;
    const h = window.innerHeight || 1080;
    const x = (e.clientX - w / 2) / (w / 2);
    const y = (e.clientY - h / 2) / (h / 2);
    setMouseOffset({ x, y });
  }, []);

  const recordRecentlyPlayed = useCallback((track: TrackMetadata) => {
    if (!track || !track.title) return;
    setRecentlyPlayed((prev) => {
      const filtered = prev.filter((t) => t.id !== track.id && t.title !== track.title);
      const updated = [track, ...filtered].slice(0, 50);
      userLibrary.setUserRecentlyPlayed(updated);
      return updated;
    });
  }, []);

  // Dynamic Aurora Palette: Deep Indigo (#312E81), Electric Ocean Blue (#2563EB), Rich Twilight Violet (#6D28D9)
  const [auroraColors, setAuroraColors] = useState<{
    orb1: string;
    orb2: string;
    orb3: string;
  }>({
    orb1: '#312E81',
    orb2: '#2563EB',
    orb3: '#6D28D9',
  });



  // Full-screen Kinetic Lyrics view mode (only when clicked!)
  const [showLyricsStage, setShowLyricsStage] = useState<boolean>(false);

  const handleOpenLyrics = useCallback(() => {
    setShowLyricsStage(true);
    if (typeof document !== 'undefined' && !document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    }
  }, []);

  const handleCloseLyrics = useCallback(() => {
    setShowLyricsStage(false);
    if (typeof document !== 'undefined' && document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }
  }, []);

  const handleToggleLyrics = useCallback(() => {
    if (showLyricsStage) {
      handleCloseLyrics();
    } else {
      handleOpenLyrics();
    }
  }, [showLyricsStage, handleCloseLyrics, handleOpenLyrics]);

  // Synchronize browser fullscreen when Lyrics stage is opened
  useEffect(() => {
    if (showLyricsStage && typeof document !== 'undefined' && !document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    }
  }, [showLyricsStage]);

  // Echo Music DNA Drawer State
  const [isMusicDnaDrawerOpen, setIsMusicDnaDrawerOpen] = useState<boolean>(false);

  // Modals
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);

  // Flagship Feature Modals: Connect, Jam, Blend, Wrapped, Spatial DSP
  const [isWrappedOpen, setIsWrappedOpen] = useState<boolean>(false);
  const [isConnectOpen, setIsConnectOpen] = useState<boolean>(false);
  const [isJamOpen, setIsJamOpen] = useState<boolean>(false);
  const [isBlendOpen, setIsBlendOpen] = useState<boolean>(false);
  const [isAudioQualityOpen, setIsAudioQualityOpen] = useState<boolean>(false);

  // User & Storage state
  const [currentUser, setCurrentUser] = useState<VybeUser>(() => {
    const active = userLibrary.getCurrentUser();
    if (authUser && active.id === 'guest-vyber') {
      return {
        id: authUser.id,
        name: authUser.displayName,
        email: authUser.email,
        avatarColor: '#2563EB',
        avatarUrl: './logo.png',
        createdAt: Date.now(),
      };
    }
    return active;
  });
  const [storageStats, setStorageStats] = useState<StorageStats>({ count: 0, totalBytes: 0, totalMB: '0.0' });

  // Echo Brain Auto-Queue Momentum State
  const [isEchoBrainOn, setIsEchoBrainOn] = useState<boolean>(() => echoBrain.getIsEnabled());

  const handleToggleEchoBrain = useCallback(() => {
    const next = echoBrain.toggle();
    setIsEchoBrainOn(next);
  }, []);

  // Lyrics AST & Candidate States (supports 0ms offline lyrics)
  const [lyricsTrack, setLyricsTrack] = useState<LyricTrack | null>(null);
  const [offlineLyricsLines, setOfflineLyricsLines] = useState<LyricLineItem[] | null>(null);
  const [, setLyricsCandidates] = useState<LRCLibRecord[]>([]);
  const [, setActiveRecordId] = useState<number | undefined>();
  const [isSearchModalOpen, setIsSearchModalOpen] = useState<boolean>(false);

  // Post-Processing / Canvas States
  const [isVideoBgOn] = useState<boolean>(false);

  // Drawers State
  const [isStudioDrawerOpen, setIsStudioDrawerOpen] = useState<boolean>(false);
  const [studioDrawerTab, setStudioDrawerTab] = useState<StudioTab>('queue');

  // Video Background Canvas States
  const [, setVibeProfile] = useState<unknown | null>(null);
  const [videoCandidates, setVideoCandidates] = useState<VideoCandidate[]>(() => [
    ...FALLBACK_VIDEO_CATALOG['Cosmic & Cyberpunk Abstract'],
  ]);
  const [activeVideo, setActiveVideo] = useState<VideoCandidate | null>(() => videoCandidates[0]);
  const [videoOpacity] = useState<number>(0.65);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Synchronize User & Storage Stats
  useEffect(() => {
    const updateStats = () => {
      offlineVault.getStorageStats().then(setStorageStats);
      setCurrentUser(userLibrary.getCurrentUser());
      setLikedTracks(userLibrary.getLikedTracks() as unknown as TrackMetadata[]);
      setPlaylists(userLibrary.getUserPlaylists());
    };
    updateStats();

    const unsubVault = offlineVault.subscribe(updateStats);
    const unsubUser = userLibrary.subscribe(updateStats);

    return () => {
      unsubVault();
      unsubUser();
    };
  }, []);

  // Supabase Auth & Cloud Library Session State & Magic Link Auto-Login
  useEffect(() => {
    const handleAuthUserSession = async (user: any) => {
      if (!user) return;
      const cleanEmail = user.email || '';
      const cleanName =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        cleanEmail.split('@')[0] ||
        'Vybe Member';

      const profile: AuthenticatedUser = {
        id: user.id,
        email: cleanEmail,
        displayName: cleanName,
      };

      // 1. Save authenticated user to localStorage
      localStorage.setItem('vybe_authenticated_user', JSON.stringify(profile));

      // 2. Update authUser state
      setAuthUser(profile);

      // 3. Call syncUserLibrary to create/update row in Supabase PostgreSQL
      await syncUserLibrary(user.id, {
        email: cleanEmail,
        display_name: cleanName,
      });

      // 4. Synchronize user library service state
      await userLibrary.syncFromSupabaseUser(user);
      setCurrentUser(userLibrary.getCurrentUser());
      setLikedTracks(userLibrary.getLikedTracks() as unknown as TrackMetadata[]);
      setPlaylists(userLibrary.getUserPlaylists());
      setRecentlyPlayed(userLibrary.getUserRecentlyPlayed());

      showToast(`Welcome back, ${cleanName}!`, <Sparkles className="w-3.5 h-3.5 text-[#E86538]" />);
    };

    // 1. Check existing session on load
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        await handleAuthUserSession(session.user);
      }
    });

    // 2. Listen for auth changes (Magic Link clicked in email triggers this!)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      if (session?.user) {
        await handleAuthUserSession(session.user);
      } else if (event === 'SIGNED_OUT') {
        localStorage.removeItem('vybe_authenticated_user');
        setAuthUser(null);
        setCurrentUser(userLibrary.getCurrentUser());
        setLikedTracks([]);
        setPlaylists([]);
        setRecentlyPlayed([]);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [showToast]);

  // Handle track handover / lyrics change with 0ms Offline Lyrics routing
  const handleTrackChange = useCallback(
    async (incomingTrack: TrackMetadata, incomingLyrics?: LyricTrack) => {
      // 1. Check Offline Vault first for instant zero-latency lyrics
      const cachedLyrics = await offlineVault.getOfflineLyrics(incomingTrack.id);
      if (cachedLyrics && cachedLyrics.length > 0) {
        setOfflineLyricsLines(cachedLyrics);
        setLyricsTrack({
          trackId: incomingTrack.id,
          title: incomingTrack.title,
          artist: incomingTrack.artist,
          duration: incomingTrack.duration || 180,
          precision: 'word',
          source: 'lrclib_synced',
          lines: cachedLyrics.map((l) => ({
            id: l.id,
            lineIndex: 0,
            text: l.text,
            startTime: l.startTime,
            endTime: l.endTime,
            duration: l.endTime - l.startTime,
            words: (l.words || []).map((w, wIdx) => ({
              id: `${l.id}-w${wIdx}`,
              word: w.text,
              startTime: w.startTime,
              endTime: w.endTime,
              duration: w.endTime - w.startTime,
            })),
          })),
          offsetMs: 0,
        });
      } else if (incomingLyrics) {
        setOfflineLyricsLines(null);
        setLyricsTrack(incomingLyrics);
      } else {
        setOfflineLyricsLines(null);
        autoFetchLyrics(
          {
            title: incomingTrack.title,
            artist: incomingTrack.artist,
            album: incomingTrack.album,
            searchQuery: incomingTrack.searchQuery,
            songId: incomingTrack.id,
          },
          incomingTrack.duration
        ).then((result) => {
          setLyricsTrack(result.track);
          setLyricsCandidates(result.candidates);
          setActiveRecordId(result.record.id);
        });
      }

      // Discover vibe videos
      discoverBackgroundVideos(incomingTrack.title, incomingTrack.artist, '').then(
        ({ profile, videos }) => {
          setVibeProfile(profile);
          if (videos.length > 0) {
            setVideoCandidates(videos);
            setActiveVideo(videos[0]);
          }
        }
      );
    },
    []
  );

  const {
    state,
    engine,
    togglePlay,
    seek,
    setVolume,
    toggleMute,
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
    presets,
  } = useAudioEngine(handleTrackChange);

  const handleLogout = useCallback(async () => {
    if (state.isPlaying) {
      togglePlay();
    }
    localStorage.removeItem('vybe_authenticated_user');
    setAuthUser(null);
    await userLibrary.logout();
    setCurrentUser(userLibrary.getCurrentUser());
    setRecentlyPlayed([]);
    setLikedTracks([]);
    setPlaylists([]);
    showToast('Signed out of Vybe', <ShieldAlert className="w-3.5 h-3.5 text-white/50" />);
  }, [state.isPlaying, togglePlay, showToast]);

  // Studio Drawer Trigger Handlers
  const handleOpenAutoMixDrawer = useCallback(() => {
    setStudioDrawerTab('automix');
    setIsStudioDrawerOpen(true);
  }, []);

  const handleOpenStudioDrawer = useCallback(() => {
    setStudioDrawerTab('dsp');
    setIsStudioDrawerOpen(true);
  }, []);

  const handleOpenSidebarStudio = useCallback(() => {
    setStudioDrawerTab('queue');
    setIsStudioDrawerOpen(true);
  }, []);

  const handleToggleAutoMix = useCallback(() => {
    cycleTransitionMode();
    const willBeAutoMix = state.transitionMode !== 'automix';
    if (willBeAutoMix) {
      showToast(`AutoMix Crossfade Active (${state.crossfadeDuration || 8}s)`, <Disc3 className="w-3.5 h-3.5 text-[#E86538] animate-spin" />);
    } else {
      showToast('AutoMix Disabled', <Disc className="w-3.5 h-3.5 text-white/50" />);
    }
  }, [cycleTransitionMode, state.transitionMode, state.crossfadeDuration, showToast]);

  const handleToggleShuffle = useCallback(() => {
    setIsShuffleOn((prev) => {
      const next = !prev;
      showToast(
        next ? 'Shuffle On 🔀' : 'Shuffle Off',
        <Shuffle className={`w-3.5 h-3.5 ${next ? 'text-[#E86538]' : 'text-white/60'}`} />
      );
      return next;
    });
  }, [showToast]);

  const handleToggleRepeat = useCallback(() => {
    setRepeatMode((prev) => {
      const next = prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off';
      const msg = next === 'all' ? 'Repeat: All 🔁' : next === 'one' ? 'Repeat: One 🔂' : 'Repeat: Off';
      showToast(
        msg,
        <Repeat className={`w-3.5 h-3.5 ${next !== 'off' ? 'text-[#E86538]' : 'text-white/60'}`} />
      );
      return next;
    });
  }, [showToast]);

  // Focus single top search bar
  const handleFocusSearch = useCallback(() => {
    setActiveTab('search');
    setTimeout(() => {
      const el = document.getElementById('unified-search-input') as HTMLInputElement | null;
      el?.focus();
      el?.select();
    }, 60);
  }, []);

  // Silent background fetch on startup to populate rotation and queue with real 320kbps music
  useEffect(() => {
    fetchCatalogSearch('Tycho Bonobo Maribou State', 10)
      .then((tracks) => {
        if (tracks && tracks.length > 0) {
          const savedTrack = localStorage.getItem('vybe_last_played_track');
          if (!savedTrack && state.playlist.length <= 1 && !state.isPlaying) {
            addTracksToQueue(tracks, false);
          }
        }
      })
      .catch((err) => {
        console.warn('Initial background music fetch:', err);
      });
  }, []);

  // Record playback into persistent recently played
  useEffect(() => {
    if (state.currentTrack && state.currentTrack.title) {
      recordRecentlyPlayed(state.currentTrack);
    }
  }, [state.currentTrack, recordRecentlyPlayed]);

  // Automatically guarantee lyrics are loaded whenever active track changes
  useEffect(() => {
    const cur = state.currentTrack;
    if (!cur || !cur.title) return;

    offlineVault.getOfflineLyrics(cur.id).then((cached) => {
      if (cached && cached.length > 0) {
        setOfflineLyricsLines(cached);
        return;
      }

      if (!lyricsTrack || (lyricsTrack.title !== cur.title && lyricsTrack.trackId !== cur.id)) {
        autoFetchLyrics(
          {
            title: cur.title,
            artist: cur.artist,
            album: cur.album,
            searchQuery: cur.searchQuery,
            songId: cur.id,
          },
          cur.duration || (engine ? engine.getDuration() : 0)
        )
          .then((result) => {
            setLyricsTrack(result.track);
            setLyricsCandidates(result.candidates);
            setActiveRecordId(result.record.id);
          })
          .catch((err) => {
            console.warn('Auto fetch lyrics failed:', err);
          });
      }
    });
  }, [state.currentTrack, lyricsTrack, engine]);

  // Auto-Reverify Duration Once Audio Metadata Loads (when duration > 0 and mismatch > 6s)
  const realAudioDurationSec = Math.round(state.duration || (engine ? engine.getDuration() : 0));
  const lastReverifiedAudioDurationRef = useRef<number>(0);

  useEffect(() => {
    const cur = state.currentTrack;
    if (!cur || !cur.title || realAudioDurationSec <= 0) return;
    if (lastReverifiedAudioDurationRef.current === realAudioDurationSec) return;

    const loadedDur = lyricsTrack?.duration || (lyricsTrack?.lines?.length ? lyricsTrack.lines[lyricsTrack.lines.length - 1].endTime : 0);
    if (loadedDur > 0 && Math.abs(loadedDur - realAudioDurationSec) > 6) {
      lastReverifiedAudioDurationRef.current = realAudioDurationSec;
      autoFetchLyrics(
        {
          title: cur.title,
          artist: cur.artist,
          album: cur.album,
          searchQuery: cur.searchQuery,
          songId: cur.id,
        },
        realAudioDurationSec
      )
        .then((result) => {
          setLyricsTrack(result.track);
          setLyricsCandidates(result.candidates);
          setActiveRecordId(result.record.id);
        })
        .catch((err) => {
          console.warn('[AutoReverify] Failed to re-fetch lyrics with exact duration:', err);
        });
    }
  }, [state.currentTrack, realAudioDurationSec, lyricsTrack, engine]);

  // Extract / adapt ambient aurora mesh colors based on active track artwork
  useEffect(() => {
    const artwork = state?.currentTrack?.artworkUrl;
    if (!artwork) {
      setAuroraColors({
        orb1: '#2563EB',
        orb2: '#1E1B4B',
        orb3: '#581C87',
      });
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = artwork;
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 16;
        canvas.height = 16;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, 16, 16);
        const data = ctx.getImageData(0, 0, 16, 16).data;
        const r1 = data[0], g1 = data[1], b1 = data[2];
        const r2 = data[128 * 4], g2 = data[128 * 4 + 1], b2 = data[128 * 4 + 2];
        const r3 = data[250 * 4], g3 = data[250 * 4 + 1], b3 = data[250 * 4 + 2];

        setAuroraColors({
          orb1: `rgb(${Math.min(255, r1 + 30)}, ${Math.min(255, g1 + 40)}, ${Math.max(140, b1)})`,
          orb2: `rgb(${Math.max(15, Math.floor(r2 * 0.35))}, ${Math.max(20, Math.floor(g2 * 0.35))}, ${Math.max(75, Math.floor(b2 * 0.75))})`,
          orb3: `rgb(${Math.max(60, Math.floor(r3 * 0.7))}, ${Math.max(15, Math.floor(g3 * 0.3))}, ${Math.max(110, Math.floor(b3 * 0.85))})`,
        });
      } catch {
        setAuroraColors({
          orb1: '#2563EB',
          orb2: '#1E1B4B',
          orb3: '#581C87',
        });
      }
    };
    img.onerror = () => {
      setAuroraColors({
        orb1: '#2563EB',
        orb2: '#1E1B4B',
        orb3: '#581C87',
      });
    };
  }, [state?.currentTrack?.artworkUrl, state?.currentTrack?.id]);

  // Catalog / Playlist playback handlers
  const handlePlayCatalogTrack = useCallback(
    (track: TrackMetadata) => {
      addTracksToQueue([track], true);
    },
    [addTracksToQueue]
  );

  const handlePlayAllTracks = useCallback(
    (tracks: TrackMetadata[], startWithShuffle = false) => {
      if (tracks.length === 0) return;
      const queueTracks = startWithShuffle
        ? [...tracks].sort(() => Math.random() - 0.5)
        : [...tracks];
      addTracksToQueue(queueTracks, true);
    },
    [addTracksToQueue]
  );

  const handleAddToQueue = useCallback(
    (track: TrackMetadata) => {
      addTracksToQueue([track], false);
      showToast(`Added '${track.title}' to Up Next`, <ListMusic className="w-3.5 h-3.5 text-cyan-400" />);
    },
    [addTracksToQueue, showToast]
  );

  const handleSelectPlaylist = useCallback((playlistId: string) => {
    setSelectedPlaylistId(playlistId);
    setActiveTab('playlist');
  }, []);

  const handlePlayTrackBatch = useCallback(
    (tracks: TrackMetadata[], _mixTitle?: string) => {
      if (!tracks || tracks.length === 0) return;
      addTracksToQueue(tracks.slice(1), false);
      handlePlayCatalogTrack(tracks[0]);
    },
    [addTracksToQueue, handlePlayCatalogTrack]
  );

  const handlePlayBlendWithAutoMix = useCallback(
    (tracks: TrackMetadata[], mixTitle = 'Familiar, but new.') => {
      if (!tracks || tracks.length === 0) return;
      setTransitionMode('automix');
      handlePlayTrackBatch(tracks, mixTitle);
    },
    [setTransitionMode, handlePlayTrackBatch]
  );

  // 1. Automatic Play History Logger (> 10 seconds of playback)
  useEffect(() => {
    if (state.isPlaying && state.currentTime > 10 && state.currentTrack?.title) {
      discoveryEngine.recordListeningHistory(state.currentTrack, Math.floor(state.currentTime));
    }
  }, [state.isPlaying, Math.floor(state.currentTime / 10), state.currentTrack]);

  // 2. Vybe Connect Background Heartbeat & Sync Engine
  useEffect(() => {
    vybeConnect.start(() => ({
      currentTrack: state.currentTrack,
      currentTime: state.currentTime,
      isPlaying: state.isPlaying,
      volume: state.volume,
      queue: state.playlist,
    }));
    return () => vybeConnect.stop();
  }, [state.currentTrack, state.currentTime, state.isPlaying, state.volume, state.playlist]);

  // 60fps zero-reconciliation rAF hook setting --bass-energy on :root
  useAudioReactiveCSS(engine, state.isPlaying);

  // ───────────────────────────────────────────────────────────────────────────
  // 3. PRO GLOBAL KEYBOARD SHORTCUTS (DESKTOP APP FEEL)
  // ───────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Guard all keyboard shortcuts unless user is in main app
      if (!splashDone || !authUser) return;

      const target = e.target as HTMLElement | null;
      const activeEl = document.activeElement as HTMLElement | null;
      const isInput =
        (target &&
          (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable)) ||
        (activeEl &&
          (activeEl.tagName === 'INPUT' ||
            activeEl.tagName === 'TEXTAREA' ||
            activeEl.isContentEditable));

      const isCmdK = (e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K');
      const isSlash = e.key === '/' && !isInput;

      // ⌘K / Ctrl+K or /: Focus and select all text in the top unified Search Bar
      if (isCmdK || isSlash) {
        e.preventDefault();
        const searchInput = document.getElementById('unified-search-input') as HTMLInputElement | null;
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        } else {
          setActiveTab('search');
          setTimeout(() => {
            const el = document.getElementById('unified-search-input') as HTMLInputElement | null;
            el?.focus();
            el?.select();
          }, 60);
        }
        return;
      }

      // Escape: Close any open modal, drawer, popover, or exit lyrics stage
      if (e.key === 'Escape') {
        if (isShortcutsModalOpen) {
          setIsShortcutsModalOpen(false);
          return;
        }
        if (trackPopover.isOpen) {
          setTrackPopover({ isOpen: false, track: null, anchorRect: null });
          return;
        }
        if (isStudioDrawerOpen) {
          setIsStudioDrawerOpen(false);
          return;
        }
        if (showLyricsStage) {
          handleCloseLyrics();
          return;
        }
        if (isCreatePlaylistModalOpen) {
          setIsCreatePlaylistModalOpen(false);
          setCreatePlaylistInitialTrack(null);
          return;
        }
        if (isProfileModalOpen) {
          setIsProfileModalOpen(false);
          return;
        }
        if (isConnectOpen) {
          setIsConnectOpen(false);
          return;
        }
        if (isJamOpen) {
          setIsJamOpen(false);
          return;
        }
        if (isBlendOpen) {
          setIsBlendOpen(false);
          return;
        }
        if (isWrappedOpen) {
          setIsWrappedOpen(false);
          return;
        }
        if (isAudioQualityOpen) {
          setIsAudioQualityOpen(false);
          return;
        }
        if (isSearchModalOpen) {
          setIsSearchModalOpen(false);
          return;
        }
        if (isMusicDnaDrawerOpen) {
          setIsMusicDnaDrawerOpen(false);
          return;
        }
        if (isInput) {
          activeEl?.blur();
          target?.blur();
        }
        return;
      }

      // SMART INPUT GUARD: Ignore all other playback / navigation shortcuts while typing
      if (isInput) return;

      // ? or Shift + /: Toggle Keyboard Shortcuts Liquid Glass Modal
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setIsShortcutsModalOpen((prev) => !prev);
        return;
      }

      // Space or K: Toggle Play / Pause
      if (e.code === 'Space' || ((e.key === 'k' || e.key === 'K') && !e.metaKey && !e.ctrlKey)) {
        e.preventDefault();
        togglePlay();
        return;
      }

      // Shift + ArrowRight: Seek forward +10s
      if (e.shiftKey && e.key === 'ArrowRight') {
        e.preventDefault();
        const cur = engine ? engine.getCurrentTime() : state.currentTime;
        const dur = engine ? engine.getDuration() : state.duration;
        const nextTime = Math.min(dur || 300, cur + 10);
        seek(nextTime);
        showToast('+10s Seek Forward', <FastForward className="w-3.5 h-3.5 text-cyan-400" />);
        return;
      }

      // Shift + ArrowLeft or J: Seek backward -10s
      if ((e.shiftKey && e.key === 'ArrowLeft') || ((e.key === 'j' || e.key === 'J') && !e.metaKey && !e.ctrlKey)) {
        e.preventDefault();
        const cur = engine ? engine.getCurrentTime() : state.currentTime;
        const prevTime = Math.max(0, cur - 10);
        seek(prevTime);
        showToast('-10s Seek Backward', <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />);
        return;
      }

      // ArrowRight: Seek forward +5s
      if (e.key === 'ArrowRight' && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        const cur = engine ? engine.getCurrentTime() : state.currentTime;
        const dur = engine ? engine.getDuration() : state.duration;
        const nextTime = Math.min(dur || 300, cur + 5);
        seek(nextTime);
        return;
      }

      // ArrowLeft: Seek backward -5s
      if (e.key === 'ArrowLeft' && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        const cur = engine ? engine.getCurrentTime() : state.currentTime;
        const prevTime = Math.max(0, cur - 5);
        seek(prevTime);
        return;
      }

      // Home: Seek to beginning of track (0:00)
      if (e.key === 'Home') {
        e.preventDefault();
        seek(0);
        showToast('Restarted Track (0:00)', <RotateCcw className="w-3.5 h-3.5 text-white/70" />);
        return;
      }

      // Numbers 0 through 9: Percentage jump (YouTube Music standard)
      if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && /^[0-9]$/.test(e.key)) {
        e.preventDefault();
        const pct = parseInt(e.key, 10) * 10;
        const dur = engine ? engine.getDuration() : state.duration;
        const targetTime = (pct / 100) * (dur || 300);
        seek(targetTime);
        showToast(`Jumped to ${pct}%`, <FastForward className="w-3.5 h-3.5 text-cyan-400" />);
        return;
      }

      // Shift + N or ⌘/Ctrl + ArrowRight or N: Skip to Next Track
      if (
        (e.shiftKey && (e.key === 'n' || e.key === 'N')) ||
        ((e.metaKey || e.ctrlKey) && e.key === 'ArrowRight') ||
        ((e.key === 'n' || e.key === 'N') && !e.metaKey && !e.ctrlKey && !e.altKey)
      ) {
        e.preventDefault();
        nextTrack();
        showToast('Next Track', <SkipForward className="w-3.5 h-3.5 text-white/70" />);
        return;
      }

      // Shift + P or ⌘/Ctrl + ArrowLeft or P: Skip to Previous Track (or restart if currentTime > 3s)
      if (
        (e.shiftKey && (e.key === 'p' || e.key === 'P')) ||
        ((e.metaKey || e.ctrlKey) && e.key === 'ArrowLeft') ||
        ((e.key === 'p' || e.key === 'P') && !e.metaKey && !e.ctrlKey && !e.altKey)
      ) {
        e.preventDefault();
        const cur = engine ? engine.getCurrentTime() : state.currentTime;
        if (cur > 3) {
          seek(0);
          showToast('Restarted Track', <RotateCcw className="w-3.5 h-3.5 text-white/70" />);
        } else {
          prevTrack();
          showToast('Previous Track', <SkipBack className="w-3.5 h-3.5 text-white/70" />);
        }
        return;
      }

      // Shift + ArrowUp: Jump volume to 100%
      if (e.shiftKey && e.key === 'ArrowUp') {
        e.preventDefault();
        setVolume(1.0);
        showToast('Volume: 100%', <Volume2 className="w-3.5 h-3.5 text-emerald-400" />);
        return;
      }

      // Shift + ArrowDown: Jump volume to 10%
      if (e.shiftKey && e.key === 'ArrowDown') {
        e.preventDefault();
        setVolume(0.1);
        showToast('Volume: 10%', <Volume2 className="w-3.5 h-3.5 text-white/70" />);
        return;
      }

      // ArrowUp: Increase volume by 5%
      if (e.key === 'ArrowUp' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        const nextVol = Math.min(1, Math.round((state.volume + 0.05) * 100) / 100);
        setVolume(nextVol);
        showToast(`Volume: ${Math.round(nextVol * 100)}%`, <Volume2 className="w-3.5 h-3.5 text-white/70" />);
        return;
      }

      // ArrowDown: Decrease volume by 5%
      if (e.key === 'ArrowDown' && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        const nextVol = Math.max(0, Math.round((state.volume - 0.05) * 100) / 100);
        setVolume(nextVol);
        showToast(
          `Volume: ${Math.round(nextVol * 100)}%`,
          nextVol === 0 ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Volume2 className="w-3.5 h-3.5 text-white/70" />
        );
        return;
      }

      // M: Toggle Mute / Unmute (remembering pre-mute volume level)
      if ((e.key === 'm' || e.key === 'M') && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        if (state.volume > 0 && !state.isMuted) {
          prevVolumeRef.current = state.volume;
          setVolume(0);
          toggleMute();
          showToast('Muted 🔇', <VolumeX className="w-3.5 h-3.5 text-red-400" />);
        } else {
          const restore = prevVolumeRef.current || 0.85;
          setVolume(restore);
          if (state.isMuted) toggleMute();
          showToast(`Unmuted 🔊 (${Math.round(restore * 100)}%)`, <Volume2 className="w-3.5 h-3.5 text-emerald-400" />);
        }
        return;
      }

      // S: Toggle Shuffle
      if ((e.key === 's' || e.key === 'S') && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setIsShuffleOn((prev) => {
          const next = !prev;
          showToast(
            next ? 'Shuffle On 🔀' : 'Shuffle Off',
            <Shuffle className={`w-3.5 h-3.5 ${next ? 'text-[#E86538]' : 'text-white/60'}`} />
          );
          return next;
        });
        return;
      }

      // R: Cycle Repeat mode (Off -> Repeat All -> Repeat One)
      if ((e.key === 'r' || e.key === 'R') && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setRepeatMode((prev) => {
          const next = prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off';
          const msg = next === 'all' ? 'Repeat: All 🔁' : next === 'one' ? 'Repeat: One 🔂' : 'Repeat: Off';
          showToast(
            msg,
            <Repeat className={`w-3.5 h-3.5 ${next !== 'off' ? 'text-[#E86538]' : 'text-white/60'}`} />
          );
          return next;
        });
        return;
      }

      // X: Trigger / Toggle AutoMix DJ instant crossfade transition
      if ((e.key === 'x' || e.key === 'X') && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        triggerInstantDJTransition();
        showToast('⚡ AutoMix DJ Active', <Disc3 className="w-3.5 h-3.5 text-[#E86538] animate-spin" />);
        return;
      }

      // V: Toggle Vocal Cut (Karaoke Mode) between 0% and 85% attenuation
      if ((e.key === 'v' || e.key === 'V') && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        const currentAtt = state.vocalAttenuation || 0;
        const nextAtt = currentAtt > 0.4 ? 0 : 0.85;
        setVocalAttenuation(nextAtt);
        showToast(
          nextAtt > 0 ? '🎤 Vocal Cut: ON' : '🎤 Vocal Cut: OFF',
          <Mic2 className="w-3.5 h-3.5 text-purple-400" />
        );
        return;
      }

      // F or L: Toggle Fullscreen Lyrics Stage
      if (
        ((e.key === 'l' || e.key === 'L' || e.key === 'f' || e.key === 'F') && !e.metaKey && !e.ctrlKey && !e.altKey)
      ) {
        e.preventDefault();
        handleToggleLyrics();
        return;
      }

      // Q: Toggle Right-Side Studio Drawer
      if ((e.key === 'q' || e.key === 'Q') && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setIsStudioDrawerOpen((prev) => !prev);
        return;
      }

      // H (or Alt + Shift + B): Like / Unlike (♥) the currently playing track
      const isAltShiftB = e.altKey && e.shiftKey && (e.key === 'b' || e.key === 'B');
      const isH = (e.key === 'h' || e.key === 'H') && !e.metaKey && !e.ctrlKey && !e.altKey;
      if (isH || isAltShiftB) {
        e.preventDefault();
        if (state.currentTrack && state.currentTrack.id) {
          const isNowLiked = userLibrary.toggleLike(state.currentTrack);
          handleToggleLikeWithToast(state.currentTrack, isNowLiked);
        }
        return;
      }

      // C: Open New Playlist Liquid Glass Modal
      if ((e.key === 'c' || e.key === 'C') && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setCreatePlaylistInitialTrack(null);
        setIsCreatePlaylistModalOpen(true);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    splashDone,
    authUser,
    isShortcutsModalOpen,
    trackPopover.isOpen,
    isStudioDrawerOpen,
    showLyricsStage,
    isCreatePlaylistModalOpen,
    isProfileModalOpen,
    isConnectOpen,
    isJamOpen,
    isBlendOpen,
    isWrappedOpen,
    isAudioQualityOpen,
    isSearchModalOpen,
    isMusicDnaDrawerOpen,
    togglePlay,
    seek,
    state.currentTime,
    state.duration,
    state.volume,
    state.isMuted,
    state.vocalAttenuation,
    state.currentTrack,
    engine,
    nextTrack,
    prevTrack,
    setVolume,
    toggleMute,
    triggerInstantDJTransition,
    setVocalAttenuation,
    handleToggleLyrics,
    handleCloseLyrics,
    showToast,
    handleToggleLikeWithToast,
  ]);

  // Convert parsed LRCLIB / offline lines into LyricLineItem[] for VybeKineticStage
  const kineticLines: LyricLineItem[] = useMemo(() => {
    if (offlineLyricsLines && offlineLyricsLines.length > 0) {
      return offlineLyricsLines;
    }
    if (!lyricsTrack || !lyricsTrack.lines || lyricsTrack.lines.length === 0) {
      return EMPTY_KINETIC_LINES;
    }
    return convertToVybeLineItems(lyricsTrack.lines);
  }, [lyricsTrack, offlineLyricsLines]);

  // Stable refs & memoized callbacks for VybeKineticStage
  const engineRef = useRef(engine);
  engineRef.current = engine;
  const currentTimeRef = useRef(state.currentTime);
  currentTimeRef.current = state.currentTime;

  const getCurrentTime = useCallback(() => {
    return engineRef.current ? engineRef.current.getCurrentTime() : currentTimeRef.current;
  }, []);

  const getBassEnergy = useCallback(() => {
    return engineRef.current ? engineRef.current.getSubBassEnergy() : 0;
  }, []);

  const handleLyricsSeek = useCallback(
    (time: number) => {
      seek(time);
    },
    [seek]
  );

  const handleTogglePlay = useCallback(() => {
    togglePlay();
  }, [togglePlay]);

  const handleVocalAttenuationChange = useCallback(
    (level: number) => {
      setVocalAttenuation(level);
    },
    [setVocalAttenuation]
  );

  // Global Drag and Drop Handler for audio files
  const handleGlobalDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const audioFiles = Array.from(files).filter(
        (f) => f.type.startsWith('audio/') || f.name.match(/\.(mp3|wav|flac|m4a|aac|ogg)$/i)
      );
      if (audioFiles.length > 0) {
        addFilesToQueue(audioFiles);
      }
    }
  };

  const handleSelectCandidate = useCallback(
    (record: LRCLibRecord) => {
      const track = convertLRCLibToLyricTrack(record, state.duration);
      setLyricsTrack(track);
      setActiveRecordId(record.id);
    },
    [state.duration]
  );

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // 1. Play the Splash Screen video once.
  if (!splashDone) {
    return (
      <SplashScreen
        onComplete={handleSplashComplete}
        onDone={handleSplashComplete}
      />
    );
  }

  // 2. Once the video ends, immediately render the Main Vybe Player.
  return (
    <div
      onMouseMove={handleMouseMove}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleGlobalDrop}
      className="relative w-screen h-screen overflow-hidden bg-[#07080C] text-white font-sans select-none flex flex-col selection:bg-[#E86538]/30"
    >
      {/* ─────────────────────────────────────────────────────────────────────────
          SILKY CONTINUOUSLY MOVING MULTI-COLOR AURORA MESH BACKGROUND
          Deep Indigo (#312E81), Vibrant Electric Ocean Blue (#2563EB), Rich Twilight Violet (#6D28D9)
          ───────────────────────────────────────────────────────────────────────── */}
      <div
        className="aurora-orb-1 fixed top-[-100px] right-[5%] w-[850px] h-[850px] rounded-full pointer-events-none transition-all duration-700 ease-out"
        style={{
          background: `radial-gradient(circle, ${auroraColors.orb1} 0%, ${auroraColors.orb2} 70%, transparent 100%)`,
          filter: 'blur(125px)',
          opacity: 0.55,
          mixBlendMode: 'screen',
          transform: `translate3d(${mouseOffset.x * -35}px, ${mouseOffset.y * -35}px, 0) scale(calc(1 + var(--bass-energy, 0) * 0.4))`,
        }}
      />
      <div
        className="aurora-orb-2 fixed top-[25%] left-[-100px] w-[900px] h-[900px] rounded-full pointer-events-none transition-all duration-700 ease-out"
        style={{
          background: `radial-gradient(circle, ${auroraColors.orb2} 0%, ${auroraColors.orb3} 65%, transparent 100%)`,
          filter: 'blur(125px)',
          opacity: 0.5,
          mixBlendMode: 'screen',
          transform: `translate3d(${mouseOffset.x * 45}px, ${mouseOffset.y * 45}px, 0) scale(calc(1 + var(--bass-energy, 0) * 0.35))`,
        }}
      />
      <div
        className="aurora-orb-3 fixed bottom-[-140px] right-[25%] w-[800px] h-[750px] rounded-full pointer-events-none transition-all duration-700 ease-out"
        style={{
          background: `radial-gradient(circle, ${auroraColors.orb3} 0%, ${auroraColors.orb1} 60%, transparent 100%)`,
          filter: 'blur(125px)',
          opacity: 0.52,
          mixBlendMode: 'screen',
          transform: `translate3d(${mouseOffset.x * -20}px, ${mouseOffset.y * 30}px, 0) scale(calc(1 + var(--bass-energy, 0) * 0.45))`,
        }}
      />

      {/* 2. Apple Dark Liquid Glass Auth Screen (once splashDone && !authUser) */}
      {!authUser ? (
        <AuthScreen
          onLoginSuccess={(user) => {
            setAuthUser(user);
            setCurrentUser(userLibrary.getCurrentUser());
            setLikedTracks(userLibrary.getLikedTracks() as unknown as TrackMetadata[]);
            setPlaylists(userLibrary.getUserPlaylists());
            setRecentlyPlayed(userLibrary.getUserRecentlyPlayed());
          }}
          onSuccess={(user) => {
            setAuthUser(user as any);
            setCurrentUser(userLibrary.getCurrentUser());
            setLikedTracks(userLibrary.getLikedTracks() as unknown as TrackMetadata[]);
            setPlaylists(userLibrary.getUserPlaylists());
            setRecentlyPlayed(userLibrary.getUserRecentlyPlayed());
          }}
        />
      ) : (
        <>
          <WelcomeModal userId={authUser.id} />
          {/* Hidden File Input for Audio Files */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="audio/*,.mp3,.wav,.flac,.m4a,.aac,.ogg"
        onChange={(e) => {
          const files = e.target.files;
          if (files && files.length > 0) {
            addFilesToQueue(Array.from(files));
            e.target.value = '';
          }
        }}
        className="hidden"
      />

      {/* ─────────────────────────────────────────────────────────────────────────
          FULL-SCREEN KINETIC LYRICS STAGE (PORTALED TO DOCUMENT.BODY)
          ───────────────────────────────────────────────────────────────────────── */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {showLyricsStage && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.28, ease: 'easeOut' }}
                style={{
                  position: 'fixed',
                  inset: 0,
                  width: '100vw',
                  height: '100vh',
                  zIndex: 99999,
                  background: '#000',
                  overflow: 'hidden',
                }}
              >
                <div className="w-full h-full">
                  {isVideoBgOn ? (
                    <DualVideoStage
                      activeVideoUrl={activeVideo?.url || ''}
                      isPlaying={state.isPlaying}
                      videoOpacity={videoOpacity}
                    >
                      <VybeKineticStage
                        getCurrentTime={getCurrentTime}
                        getBassEnergy={getBassEnergy}
                        lines={kineticLines}
                        artworkUrl={state.currentTrack?.artworkUrl}
                        trackTitle={state.currentTrack?.title}
                        trackArtist={state.currentTrack?.artist}
                        trackAlbum={state.currentTrack?.album}
                        trackDuration={state.duration || state.currentTrack?.duration || (engine ? engine.getDuration() : 0)}
                        isPlaying={state.isPlaying}
                        onTogglePlay={handleTogglePlay}
                        onClose={handleCloseLyrics}
                        onSeek={handleLyricsSeek}
                        onVocalAttenuationChange={handleVocalAttenuationChange}
                      />
                    </DualVideoStage>
                  ) : (
                    <VybeKineticStage
                      getCurrentTime={getCurrentTime}
                      getBassEnergy={getBassEnergy}
                      lines={kineticLines}
                      artworkUrl={state.currentTrack?.artworkUrl}
                      trackTitle={state.currentTrack?.title}
                      trackArtist={state.currentTrack?.artist}
                      trackAlbum={state.currentTrack?.album}
                      trackDuration={state.duration || state.currentTrack?.duration || (engine ? engine.getDuration() : 0)}
                      isPlaying={state.isPlaying}
                      onTogglePlay={handleTogglePlay}
                      onClose={handleCloseLyrics}
                      onSeek={handleLyricsSeek}
                      onVocalAttenuationChange={handleVocalAttenuationChange}
                    />
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}

      {/* ─────────────────────────────────────────────────────────────────────────
          MAIN 3-PART EDITORIAL SHELL
          A. Left Sidebar (240px)
          B. Center Stage with Top Utility Bar + Scrollable Editorial View
          C. Bottom Player Bar (82px)
          ───────────────────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* A. LEFT FLOATING LIQUID-GLASS SIDEBAR (240px) */}
        <EditorialSidebar
          activeTab={activeTab}
          onSelectTab={(tab) => {
            if (tab === 'favorites') {
              setSelectedPlaylistId(LIKED_SONGS_PLAYLIST_ID);
              setActiveTab('favorites');
            } else {
              setActiveTab(tab);
            }
          }}
          selectedPlaylistId={selectedPlaylistId}
          onSelectPlaylist={(plId) => {
            setSelectedPlaylistId(plId);
            setActiveTab('playlist');
          }}
          onOpenStudioDrawer={handleOpenSidebarStudio}
          onOpenCreatePlaylistModal={() => setIsCreatePlaylistModalOpen(true)}
          onFocusSearch={handleFocusSearch}
          likedTracksCount={userLibrary.getLikedTracks().length}
          className="hidden md:flex"
        />

        {/* B. CENTER MAIN STAGE (FLUID WIDTH) */}
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {/* Top Utility Bar with Single Unified Search Input & AutoMix DJ */}
          <EditorialTopBar
            searchQuery={topSearchQuery}
            onSearchChange={(val) => {
              setTopSearchQuery(val);
              setActiveTab('search');
            }}
            onSearchSubmit={(q) => {
              setTopSearchQuery(q);
              setActiveTab('search');
            }}
            onNavigateTab={setActiveTab}
            currentUser={currentUser}
            storageStats={storageStats}
            likedCount={likedTracks.length}
            playlistCount={playlists.length}
            recentlyPlayedCount={recentlyPlayed.length}
            onOpenProfile={() => setIsProfileModalOpen(true)}
            onOpenJam={() => setIsJamOpen(true)}
            onOpenWrapped={() => setIsWrappedOpen(true)}
            isAutoMixActive={state.transitionMode === 'automix' || state.isTransitioning}
            onToggleAutoMix={handleOpenAutoMixDrawer}
            onOpenShortcuts={() => setIsShortcutsModalOpen(true)}
            searchInputRef={topSearchInputRef}
            onLogout={handleLogout}
          />

          {/* Smooth Vertical Scroll Container for Main Stage */}
          <main className="flex-1 h-[calc(100vh-146px)] overflow-y-auto overflow-x-hidden px-5 sm:px-8 custom-scrollbar">
            {/* VIEW 1: Editorial Discover View (Form / Apple visionOS Dark Liquid Glass) */}
            {activeTab === 'home' && (
              <EditorialHomeView
                onPlayTrack={handlePlayCatalogTrack}
                onPlayBatch={handlePlayTrackBatch}
                onPlayBlendWithAutoMix={handlePlayBlendWithAutoMix}
                onAddToQueue={handleAddToQueue}
                onOpenAddToPlaylist={handleOpenTrackMenu}
                onToggleLike={handleToggleLikeWithToast}
                currentTrack={state.currentTrack}
                isPlaying={state.isPlaying}
                onTogglePlay={handleTogglePlay}
                onNavigateTab={setActiveTab}
                onOpenLyrics={handleOpenLyrics}
                recentlyPlayed={recentlyPlayed}
              />
            )}

            {/* VIEW 2: Search Catalog View */}
            {activeTab === 'search' && (
              <div className="max-w-[1480px] mx-auto py-4 pb-28">
                <SearchCatalogView
                  onPlayTrack={handlePlayCatalogTrack}
                  onAddToQueue={handleAddToQueue}
                  onOpenAddToPlaylist={handleOpenTrackMenu}
                  onToggleLike={handleToggleLikeWithToast}
                  currentTrackId={state.currentTrack.id}
                  searchQuery={topSearchQuery}
                  onSearchChange={setTopSearchQuery}
                />
              </div>
            )}

            {/* VIEW 3: Radio Editorial View */}
            {activeTab === 'radio' && (
              <div className="max-w-[1480px] mx-auto py-4 pb-28">
                <RadioEditorialView
                  onPlayStation={(_stationName, tracks) => handlePlayTrackBatch(tracks)}
                  onPlayPlaylist={(_plName, tracks) => handlePlayTrackBatch(tracks)}
                />
              </div>
            )}

            {/* VIEW 4: Custom Playlist View */}
            {activeTab === 'playlist' && (
              <div className="max-w-[1480px] mx-auto py-4 pb-28">
                <PlaylistHeroView
                  playlistId={selectedPlaylistId}
                  onPlayTrack={handlePlayCatalogTrack}
                  onPlayAll={handlePlayAllTracks}
                  onOpenAddToPlaylist={handleOpenTrackMenu}
                  onToggleLike={handleToggleLikeWithToast}
                  onDeletePlaylist={() => {
                    showToast('Playlist deleted', <Trash2 className="w-3.5 h-3.5 text-rose-400" />);
                    setActiveTab('home');
                  }}
                  onNavigateTab={(tab) => setActiveTab(tab as EditorialTab)}
                  currentTrackId={state.currentTrack.id}
                  isPlaying={state.isPlaying}
                />
              </div>
            )}

            {/* VIEW 5: Favorites View (Bound to liked songs) */}
            {activeTab === 'favorites' && (
              <div className="max-w-[1480px] mx-auto py-4 pb-28">
                <PlaylistHeroView
                  playlistId={LIKED_SONGS_PLAYLIST_ID}
                  onPlayTrack={handlePlayCatalogTrack}
                  onPlayAll={handlePlayAllTracks}
                  onOpenAddToPlaylist={handleOpenTrackMenu}
                  onToggleLike={handleToggleLikeWithToast}
                  onNavigateTab={(tab) => setActiveTab(tab as EditorialTab)}
                  currentTrackId={state.currentTrack.id}
                  isPlaying={state.isPlaying}
                />
              </div>
            )}

            {/* VIEW 6: Dedicated Recently Played View */}
            {activeTab === 'recent' && (
              <EditorialRecentlyPlayedView
                recentlyPlayed={recentlyPlayed}
                onPlayTrack={handlePlayCatalogTrack}
                onPlayBatch={handlePlayTrackBatch}
                onAddToQueue={handleAddToQueue}
                onOpenAddToPlaylist={handleOpenTrackMenu}
                onToggleLike={handleToggleLikeWithToast}
                onClearHistory={() => {
                  setRecentlyPlayed([]);
                  userLibrary.setUserRecentlyPlayed([]);
                  try {
                    localStorage.removeItem('vybe_recently_played');
                  } catch {
                    /* ignore */
                  }
                  showToast('Listening history cleared', <Trash2 className="w-3.5 h-3.5 text-white/50" />);
                }}
                currentTrackId={state.currentTrack.id}
              />
            )}

            {/* VIEW 9: Mobile Library (< 768px) */}
            {activeTab === 'library' && (
              <div className="md:hidden py-4 pb-28">
                <SidebarLibrary
                  activePlaylistId={selectedPlaylistId}
                  onSelectPlaylist={handleSelectPlaylist}
                  onUploadLocalFiles={() => fileInputRef.current?.click()}
                  className="w-full border-none p-0 bg-transparent"
                />
              </div>
            )}

            {/* VIEW 6: Up Next Queue */}
            {activeTab === 'queue' && (
              <div className="max-w-[1480px] mx-auto py-4 pb-28 flex flex-col gap-6">
                {/* Now Playing Card */}
                <section className="relative rounded-[24px] p-6 sm:p-8 glass-panel border border-white/12 shadow-2xl flex flex-col md:flex-row items-center gap-6 justify-between">
                  <div className="flex items-center gap-6 w-full md:w-auto">
                    <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-[18px] bg-white/5 border border-white/15 flex items-center justify-center shrink-0 shadow-xl overflow-hidden">
                      {state.currentTrack.artworkUrl ? (
                        <img
                          src={state.currentTrack.artworkUrl}
                          alt={state.currentTrack.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Disc className={`w-12 h-12 text-[#E86538] ${state.isPlaying ? 'animate-spin' : ''}`} />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono tracking-wider uppercase bg-[#E86538]/20 text-[#E86538] border border-[#E86538]/30">
                          {state.isPlaying ? 'Now Playing' : 'Paused'}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono tracking-wider uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                          {state.currentTrack.sourceType === 'local' ? 'LOCAL' : 'LOSSLESS'}
                        </span>
                      </div>
                      <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight truncate leading-tight font-sans">
                        {state.currentTrack.title}
                      </h1>
                      <p className="text-sm text-white/55 truncate mt-0.5 font-sans">
                        {state.currentTrack.artist || 'Unknown Artist'}{' '}
                        {state.currentTrack.album ? `• ${state.currentTrack.album}` : ''}
                      </p>
                      <div className="text-xs text-white/40 font-mono mt-2 flex items-center gap-3">
                        <span>
                          {formatTime(state.currentTime)} / {formatTime(state.duration)}
                        </span>
                        <TrackActionButtons
                          track={state.currentTrack}
                          onOpenAddToPlaylist={handleOpenTrackMenu}
                          onToggleLike={handleToggleLikeWithToast}
                          size="sm"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                    <button
                      onClick={() => setIsMusicDnaDrawerOpen(true)}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-full glass-card border border-white/15 text-white font-mono font-semibold text-xs transition-all cursor-pointer"
                    >
                      <Dna className="w-3.5 h-3.5 text-[#E86538]" />
                      <span>Music DNA</span>
                    </button>

                    <button
                      onClick={handleOpenLyrics}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-black font-semibold text-xs shadow-lg transition-all cursor-pointer hover:bg-white/90"
                    >
                      <Mic2 className="w-3.5 h-3.5 text-[#E86538]" />
                      <span>Kinetic Lyrics</span>
                    </button>
                  </div>
                </section>

                {/* Queue Controls & List */}
                <section className="flex flex-col gap-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-[20px] glass-panel border border-white/10">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-[#E86538]/15 border border-[#E86538]/30 flex items-center justify-center text-[#E86538]">
                        <ListMusic className="w-4 h-4" />
                      </div>
                      <div>
                        <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                          Up Next Queue
                        </h2>
                        <p className="text-[11px] text-white/40 font-mono">
                          Managed by Apple AutoMix & Echo Momentum
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                      <button
                        onClick={handleToggleEchoBrain}
                        className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-mono font-bold transition-all cursor-pointer ${
                          isEchoBrainOn
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            : 'bg-white/5 text-white/40 border-white/10'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${isEchoBrainOn ? 'bg-emerald-400 animate-pulse' : 'bg-gray-600'}`} />
                        <span>Echo Momentum: {isEchoBrainOn ? 'ON' : 'OFF'}</span>
                      </button>

                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full glass-card border border-white/15 text-white text-xs font-mono font-semibold transition-all cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Upload Local</span>
                      </button>
                    </div>
                  </div>

                  {/* Table Container */}
                  <div className="rounded-[20px] border border-white/10 glass-panel overflow-hidden">
                    <div className="grid grid-cols-12 gap-3 px-5 py-3 text-[11px] font-bold text-white/40 font-mono uppercase tracking-wider border-b border-white/10">
                      <div className="col-span-1 text-center">#</div>
                      <div className="col-span-5 sm:col-span-4">Title</div>
                      <div className="col-span-3 sm:col-span-3">Artist</div>
                      <div className="col-span-2 hidden sm:block">DSP</div>
                      <div className="col-span-3 sm:col-span-2 text-right">Actions</div>
                    </div>

                    <div className="divide-y divide-white/5">
                      {state.playlist.map((track, idx) => {
                        const isCurrent = idx === state.currentTrackIndex;
                        return (
                          <div
                            key={track.id || `${track.title}-${idx}`}
                            onClick={() => playTrackAtIndex(idx, true)}
                            className={`grid grid-cols-12 gap-3 px-5 py-3.5 items-center text-sm cursor-pointer transition-colors group ${
                              isCurrent
                                ? 'bg-white/[0.08] text-[#E86538] font-medium'
                                : 'hover:bg-white/[0.04] text-white/70 hover:text-white'
                            }`}
                          >
                            <div className="col-span-1 text-center font-mono text-xs text-white/40 group-hover:text-white">
                              {isCurrent && state.isPlaying ? (
                                <div className="flex items-center justify-center gap-0.5 h-3.5">
                                  <span className="w-1 h-3.5 bg-[#E86538] rounded-full animate-bounce" />
                                  <span className="w-1 h-3.5 bg-white rounded-full animate-bounce delay-100" />
                                  <span className="w-1 h-3.5 bg-[#E86538] rounded-full animate-bounce delay-200" />
                                </div>
                              ) : (
                                <span>{idx + 1}</span>
                              )}
                            </div>

                            <div className="col-span-5 sm:col-span-4 flex items-center gap-2.5 truncate">
                              {track.artworkUrl ? (
                                <img src={track.artworkUrl} alt={track.title} className="w-7 h-7 rounded-md object-cover border border-white/10 shrink-0" />
                              ) : (
                                <Music className={`w-4 h-4 shrink-0 ${isCurrent ? 'text-[#E86538]' : 'text-white/40'}`} />
                              )}
                              <span className={`truncate ${isCurrent ? 'font-bold text-white' : ''}`}>
                                {track.title}
                              </span>
                            </div>

                            <div className="col-span-3 sm:col-span-3 truncate text-xs text-white/50">
                              {track.artist || 'Unknown Artist'}
                            </div>

                            <div className="col-span-2 hidden sm:flex items-center gap-1.5 truncate">
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono tracking-tight bg-white/5 border border-white/10 text-white/50">
                                -16 LUFS • Lossless
                              </span>
                            </div>

                            <div className="col-span-3 sm:col-span-2 flex items-center justify-end gap-1.5">
                              <span className="font-mono text-xs text-white/40 mr-1 hidden sm:inline">
                                {formatTime(track.duration || 0)}
                              </span>

                              <TrackActionButtons
                                track={track}
                                onOpenAddToPlaylist={handleOpenTrackMenu}
                                onToggleLike={handleToggleLikeWithToast}
                                size="sm"
                              />

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeFromQueue(idx);
                                }}
                                className="p-1 rounded-md text-white/30 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                title="Remove track"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────
          C. BOTTOM LIQUID-GLASS PLAYER BAR (82px DOCK)
          ───────────────────────────────────────────────────────────────────────── */}
      <EditorialPlayerDock
        track={state.currentTrack}
        isPlaying={state.isPlaying}
        onTogglePlay={handleTogglePlay}
        onNext={nextTrack}
        onPrev={prevTrack}
        currentTime={state.currentTime}
        duration={state.duration}
        onSeek={seek}
        volume={state.volume}
        isMuted={state.isMuted}
        onVolumeChange={setVolume}
        onToggleMute={toggleMute}
        onOpenLyrics={handleOpenLyrics}
        onOpenQualityModal={() => setIsAudioQualityOpen(true)}
        onOpenStudioDrawer={handleOpenStudioDrawer}
        onOpenQueueTab={() => setActiveTab('queue')}
        isQueueActive={activeTab === 'queue'}
        spatialMode={state.spatialMode}
        isAutoMixActive={state.transitionMode === 'automix' || state.isTransitioning}
        onToggleAutoMix={handleToggleAutoMix}
        isShuffleOn={isShuffleOn}
        onToggleShuffle={handleToggleShuffle}
        repeatMode={repeatMode}
        onToggleRepeat={handleToggleRepeat}
      />

      {/* AutoMix DJ Transition Live HUD */}
      <AutoMixTransitionHUD progress={state.autoMixProgress} />

      {/* ─────────────────────────────────────────────────────────────────────────
          LIQUID GLASS "VYBE STUDIO" DRAWER (QUEUE + AUTOMIX DJ + AUDIO DSP)
          ───────────────────────────────────────────────────────────────────────── */}
      <VybeStudioDrawer
        isOpen={isStudioDrawerOpen}
        onClose={() => setIsStudioDrawerOpen(false)}
        initialTab={studioDrawerTab}
        currentTrack={state.currentTrack}
        isPlaying={state.isPlaying}
        currentTime={state.currentTime}
        duration={state.duration}
        onTogglePlay={handleTogglePlay}
        queue={state.playlist}
        currentTrackIndex={state.currentTrackIndex}
        onPlayTrackAtIndex={(idx) => playTrackAtIndex(idx, true)}
        onRemoveFromQueue={removeFromQueue}
        onClearQueue={clearQueue}
        transitionMode={state.transitionMode}
        onSetTransitionMode={setTransitionMode}
        crossfadeDuration={state.crossfadeDuration}
        onSetCrossfadeDuration={setCrossfadeDuration}
        onTriggerInstantDJTransition={triggerInstantDJTransition}
        isTransitioning={state.isTransitioning}
        activeDeckId={state.activeDeckId}
        vocalAttenuation={state.vocalAttenuation}
        onSetVocalAttenuation={setVocalAttenuation}
        subBass={state.subBass}
        onSetSubBass={setSubBass}
        punch={state.punch}
        onSetPunch={setPunch}
        spatialMode={state.spatialMode}
        onSetSpatialMode={setSpatialMode}
        activePresetId={state.activePresetId}
        onApplyPreset={applyPreset}
        presets={presets}
      />

      {/* Echo Music DNA Slide-Over Drawer */}
      <MusicDnaDrawer
        isOpen={isMusicDnaDrawerOpen}
        onClose={() => setIsMusicDnaDrawerOpen(false)}
        track={state.currentTrack}
        profile={state.currentTrack.profile}
      />

      {/* User Account / Profile Modal */}
      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />


      {/* Manual Lyrics Search Modal */}
      <LyricsSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        currentTrackTitle={state.currentTrack.title}
        currentArtist={state.currentTrack.artist}
        syncOffsetMs={lyricsTrack?.offsetMs || 0}
        onAdjustSyncOffset={(delta) => {
          if (lyricsTrack) {
            setLyricsTrack({ ...lyricsTrack, offsetMs: lyricsTrack.offsetMs + delta });
          }
        }}
        onSetSyncOffset={(val) => {
          if (lyricsTrack) {
            setLyricsTrack({ ...lyricsTrack, offsetMs: val });
          }
        }}
        onSelectLRCLibRecord={handleSelectCandidate}
        onImportCustomLyrics={setLyricsTrack}
      />

      {/* Flagship Feature Modal: Vybe Connect Device Switcher */}
      {isConnectOpen && (
        <VybeConnectModal
          isOpen={isConnectOpen}
          onClose={() => setIsConnectOpen(false)}
          currentTrack={state.currentTrack}
          currentTime={state.currentTime}
          isPlaying={state.isPlaying}
          volume={state.volume}
          onTransferPlayback={(track, timestamp) => {
            handlePlayCatalogTrack(track);
            setTimeout(() => seek(timestamp), 300);
          }}
          onRemotePlayPause={togglePlay}
          onRemoteSeek={seek}
        />
      )}

      {/* Flagship Feature Modal: Live Jam Session */}
      {isJamOpen && (
        <JamSessionModal
          isOpen={isJamOpen}
          onClose={() => setIsJamOpen(false)}
          currentTrack={state.currentTrack}
          currentTime={state.currentTime}
          isPlaying={state.isPlaying}
          onPlaySong={(track) => handlePlayCatalogTrack(track)}
        />
      )}

      {/* Flagship Feature Modal: Taste Blend Dual-Avatar Generator */}
      {isBlendOpen && (
        <TasteBlendModal
          isOpen={isBlendOpen}
          onClose={() => setIsBlendOpen(false)}
          onPlayBlendTracks={(tracks) => handlePlayTrackBatch(tracks)}
        />
      )}

      {/* Flagship Feature Modal: Vybe Wrapped 2026 Interactive Story */}
      {isWrappedOpen && (
        <VybeWrappedModal
          isOpen={isWrappedOpen}
          onClose={() => setIsWrappedOpen(false)}
          onPlaySong={(track) => handlePlayCatalogTrack(track)}
        />
      )}

      {/* Flagship Feature Modal: Apple Music Lossless Signal Path & Spatial 3D Audio */}
      {isAudioQualityOpen && (
        <AudioQualitySpatialModal
          isOpen={isAudioQualityOpen}
          onClose={() => setIsAudioQualityOpen(false)}
          spatialMode={state.spatialMode}
          onSetSpatialMode={setSpatialMode}
          signalPathInfo={getSignalPathInfo()}
        />
      )}

      {/* Apple Dark Liquid Glass New Playlist Modal */}
      <CreatePlaylistModal
        isOpen={isCreatePlaylistModalOpen}
        onClose={() => {
          setIsCreatePlaylistModalOpen(false);
          setCreatePlaylistInitialTrack(null);
        }}
        onCreated={(pl) => {
          setSelectedPlaylistId(pl.id);
          setActiveTab('playlist');
          showToast(`Saved to '${pl.name}'`, <FolderPlus className="w-3.5 h-3.5 text-emerald-400" />);
        }}
        initialTrack={createPlaylistInitialTrack}
      />

      {/* Floating Apple Liquid Glass Track Action Popover Menu */}
      <TrackActionPopover
        isOpen={trackPopover.isOpen}
        onClose={() => setTrackPopover({ isOpen: false, track: null, anchorRect: null })}
        track={trackPopover.track}
        anchorRect={trackPopover.anchorRect}
        onPlayNext={(track) => {
          playNextInQueue(track);
        }}
        onAddToQueue={(track) => {
          handleAddToQueue(track);
        }}
        onCreatePlaylistWithTrack={(track) => {
          setCreatePlaylistInitialTrack(track);
          setIsCreatePlaylistModalOpen(true);
        }}
        onShowToast={showToast}
      />

      {/* Sleek Liquid Glass Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsModalOpen}
        onClose={() => setIsShortcutsModalOpen(false)}
      />
    </>
  )}

      {/* Subtle Liquid Glass Toast Notification Pill (bottom: 104px, blur(30px), rounded-full) */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 14, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.94 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            style={{
              position: 'fixed',
              bottom: '104px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 9999,
              backdropFilter: 'blur(30px) saturate(180%)',
              WebkitBackdropFilter: 'blur(30px) saturate(180%)',
              background: 'rgba(16, 18, 28, 0.90)',
              border: '1px solid rgba(255, 255, 255, 0.18)',
              borderRadius: '999px',
              boxShadow: '0 16px 40px rgba(0, 0, 0, 0.55), 0 0 1px rgba(255, 255, 255, 0.4) inset',
            }}
            className="px-4 py-2 flex items-center gap-2 pointer-events-none select-none text-xs font-semibold text-white tracking-wide shadow-2xl"
          >
            {toast.icon}
            <span>{toast.text}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
