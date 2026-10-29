/**
 * User Authentication, Profile & Playlist Management Service
 * 
 * Manages user accounts (Sign Up, Login, Google Auth, Profile),
 * custom playlists, Liked Songs, Recently Played, Last Played Track, and Audio Settings.
 * Backed by real Supabase Auth + PostgreSQL public.user_library table,
 * with local IndexedDB/localStorage vault fallback.
 * All user data is strictly namespaced per logged-in user ID.
 */

import { EchoTrack } from './streamResolver';
import { TrackMetadata } from '../providers/types';
import { offlineVault } from './offlineVault';
import {
  supabase,
  fetchUserLibrary,
  syncUserLibrary,
  UserLibraryRow,
} from './supabaseClient';

export interface VybeUser {
  id: string;
  name: string;
  email: string;
  avatarColor: string;
  avatarUrl?: string;
  createdAt: number;
}

export interface VybePlaylist {
  id: string;
  userId: string;
  name: string;
  description: string;
  coverGradient: string;
  tracks: EchoTrack[];
  createdAt: number;
  updatedAt: number;
  isPinned?: boolean;
}

export interface LibraryBackupData {
  version: number;
  exportedAt: number;
  app: 'vybe';
  user: VybeUser;
  playlists: VybePlaylist[];
  likedTracks: EchoTrack[];
}

const STORAGE_KEY_USERS_DB = 'vybe_users_db';
const STORAGE_KEY_ACTIVE_USER = 'vybe_active_user';
const STORAGE_KEY_OFFLINE_MODE = 'vybe_offline_mode_active';

export const LIKED_SONGS_PLAYLIST_ID = 'liked-songs';
export const DOWNLOADED_SONGS_PLAYLIST_ID = 'downloaded-songs';

const GRADIENT_PRESETS = [
  'linear-gradient(135deg, #8B5CF6, #EC4899)',
  'linear-gradient(135deg, #3B82F6, #10B981)',
  'linear-gradient(135deg, #F59E0B, #EF4444)',
  'linear-gradient(135deg, #6366F1, #A855F7)',
  'linear-gradient(135deg, #14B8A6, #06B6D4)',
  'linear-gradient(135deg, #EC4899, #F43F5E)',
];

const AVATAR_COLORS = [
  '#8B5CF6',
  '#EC4899',
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#06B6D4',
];

export const DEFAULT_GUEST_USER: VybeUser = {
  id: 'guest-vyber',
  name: 'Guest Vyber',
  email: 'guest@vybe.local',
  avatarColor: '#8B5CF6',
  avatarUrl: './logo.png',
  createdAt: Date.now(),
};

class UserLibraryService {
  private users: Map<string, VybeUser> = new Map();
  private currentUser: VybeUser = DEFAULT_GUEST_USER;
  private playlists: VybePlaylist[] = [];
  private likedTrackMap: Map<string, EchoTrack> = new Map();
  private isOfflineMode: boolean = false;
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.loadFromStorage();
    this.initSupabaseListener();
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const l of this.listeners) {
      try {
        l();
      } catch (err) {
        console.error('[UserLibraryService] Listener error:', err);
      }
    }
  }

  private initSupabaseListener(): void {
    if (typeof window === 'undefined') return;

    // 1. Initial check for Supabase session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        this.syncFromSupabaseUser(session.user);
      }
    });

    // 2. Real-time auth changes
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        await this.syncFromSupabaseUser(session.user);
      } else if (event === 'SIGNED_OUT') {
        this.handleSignedOut();
      }
    });
  }

  public async syncFromSupabaseUser(user: any): Promise<VybeUser> {
    const cleanName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split('@')[0] ||
      'Vybe Member';

    const vybeUser: VybeUser = {
      id: user.id,
      name: cleanName,
      email: user.email || '',
      avatarColor: AVATAR_COLORS[Math.abs(user.id.charCodeAt(0) || 0) % AVATAR_COLORS.length],
      avatarUrl: user.user_metadata?.avatar_url || './logo.png',
      createdAt: user.created_at ? new Date(user.created_at).getTime() : Date.now(),
    };

    this.currentUser = vybeUser;
    this.users.set(vybeUser.id, vybeUser);
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(STORAGE_KEY_ACTIVE_USER, JSON.stringify(vybeUser));
    }

    // Fetch and hydrate real PostgreSQL user_library data
    const row = await fetchUserLibrary(user.id);
    if (row) {
      if (row.display_name) {
        this.currentUser.name = row.display_name;
      }
      if (Array.isArray(row.playlists)) {
        this.playlists = row.playlists;
      }
      if (Array.isArray(row.liked_tracks)) {
        this.likedTrackMap.clear();
        row.liked_tracks.forEach((t) => this.likedTrackMap.set(t.id, t));
      }
      if (Array.isArray(row.recently_played)) {
        this.setUserRecentlyPlayed(row.recently_played, false);
      }
      if (row.last_played_track) {
        this.setUserLastPlayedTrack(row.last_played_track, false);
      }
    } else {
      // Fallback: load local namespaced storage
      this.loadUserPlaylists();
      this.reloadUserLikedTracks();
    }

    this.savePlaylistsLocal();
    this.saveLikedTracksLocal();
    this.notify();
    return this.currentUser;
  }

  private handleSignedOut(): void {
    this.currentUser = DEFAULT_GUEST_USER;
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(STORAGE_KEY_ACTIVE_USER);
    }
    this.playlists = [];
    this.likedTrackMap.clear();
    this.notify();
  }

  private loadFromStorage(): void {
    if (typeof window === 'undefined' || !window.localStorage) {
      this.users.set(DEFAULT_GUEST_USER.id, DEFAULT_GUEST_USER);
      this.currentUser = DEFAULT_GUEST_USER;
      return;
    }

    try {
      // 1. Load users database
      const rawUsers = localStorage.getItem(STORAGE_KEY_USERS_DB) || localStorage.getItem('vybe_users_v2');
      if (rawUsers) {
        const parsed = JSON.parse(rawUsers) as VybeUser[];
        parsed.forEach((u) => this.users.set(u.id, u));
      }

      // 2. Load active user session (prioritize 'vybe_authenticated_user')
      const rawAuth = localStorage.getItem('vybe_authenticated_user');
      if (rawAuth) {
        try {
          const authUser = JSON.parse(rawAuth);
          if (authUser && authUser.id) {
            this.currentUser = {
              id: authUser.id,
              name: authUser.displayName || 'Vybe Member',
              email: authUser.email || '',
              avatarColor: AVATAR_COLORS[Math.abs(authUser.id.charCodeAt(0) || 0) % AVATAR_COLORS.length],
              avatarUrl: './logo.png',
              createdAt: Date.now(),
            };
            this.users.set(authUser.id, this.currentUser);
          }
        } catch {}
      } else {
        const rawActive = localStorage.getItem(STORAGE_KEY_ACTIVE_USER);
        if (rawActive) {
          try {
            const parsedActive = JSON.parse(rawActive) as VybeUser;
            if (parsedActive && parsedActive.id) {
              this.currentUser = parsedActive;
              this.users.set(parsedActive.id, parsedActive);
            }
          } catch {
            const userById = this.users.get(rawActive);
            if (userById) {
              this.currentUser = userById;
            }
          }
        }
      }

      // 3. Load user-namespaced library from 'vybe_library_' + userId
      this.loadUserLibrarySnapshot(this.currentUser.id);

      // 4. Load offline mode setting
      const rawOffline = localStorage.getItem(STORAGE_KEY_OFFLINE_MODE);
      this.isOfflineMode = rawOffline === 'true';
    } catch (e) {
      console.warn('[UserLibraryService] Storage parse fallback:', e);
      this.currentUser = DEFAULT_GUEST_USER;
    }
  }

  private saveUsers(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const arr = Array.from(this.users.values()).filter((u) => u.id !== DEFAULT_GUEST_USER.id);
      localStorage.setItem(STORAGE_KEY_USERS_DB, JSON.stringify(arr));
      if (this.hasActiveSession()) {
        localStorage.setItem(STORAGE_KEY_ACTIVE_USER, JSON.stringify(this.currentUser));
      } else {
        localStorage.removeItem(STORAGE_KEY_ACTIVE_USER);
      }
    } catch (e) {
      console.warn('[UserLibraryService] Failed to save users:', e);
    }
  }

  private loadUserPlaylists(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const userKey = `vybe_playlists_${this.currentUser.id}`;
      let raw = localStorage.getItem('vybe_playlists') || localStorage.getItem(userKey);
      if (!raw && this.currentUser.id === DEFAULT_GUEST_USER.id) {
        raw = localStorage.getItem('vybe_playlists_v2');
      }
      if (raw) {
        const parsed = JSON.parse(raw) as VybePlaylist[];
        this.playlists = parsed.filter(
          (p) =>
            p.name !== 'Slow mornings' &&
            p.name !== 'After hours' &&
            p.name !== 'A place to focus' &&
            p.name !== 'On the road' &&
            p.name !== 'Late Night Chill & Lo-Fi'
        );
      } else {
        this.playlists = [];
      }
    } catch (e) {
      console.warn('[UserLibraryService] Failed to load playlists:', e);
      this.playlists = [];
    }
  }

  private savePlaylistsLocal(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const userKey = `vybe_playlists_${this.currentUser.id}`;
      localStorage.setItem(userKey, JSON.stringify(this.playlists));
      localStorage.setItem('vybe_playlists', JSON.stringify(this.playlists));
    } catch (e) {
      console.warn('[UserLibraryService] Failed to save playlists:', e);
    }
  }

  private savePlaylists(): void {
    this.savePlaylistsLocal();
    this.saveUserLibrarySnapshot(this.currentUser.id);
  }

  private reloadUserLikedTracks(): void {
    this.likedTrackMap.clear();
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const userKey = `vybe_liked_${this.currentUser.id}`;
      let raw = localStorage.getItem('vybe_liked_tracks') || localStorage.getItem(userKey);
      if (!raw) {
        const legacy = localStorage.getItem('vybe_liked_tracks_v2');
        if (legacy) {
          const parsedLegacy = JSON.parse(legacy) as Record<string, EchoTrack[]>;
          const userLiked = parsedLegacy[this.currentUser.id] || [];
          userLiked.forEach((t) => this.likedTrackMap.set(t.id, t));
          return;
        }
      }
      if (raw) {
        const parsed = JSON.parse(raw) as EchoTrack[];
        parsed.forEach((t) => this.likedTrackMap.set(t.id, t));
      }
    } catch (e) {
      console.warn('[UserLibraryService] Error reloading liked tracks:', e);
    }
  }

  private saveLikedTracksLocal(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const userKey = `vybe_liked_${this.currentUser.id}`;
      const arr = Array.from(this.likedTrackMap.values());
      localStorage.setItem(userKey, JSON.stringify(arr));
      localStorage.setItem('vybe_liked_tracks', JSON.stringify(arr));
    } catch (e) {
      console.warn('[UserLibraryService] Failed to save liked tracks:', e);
    }
  }

  private saveLikedTracks(): void {
    this.saveLikedTracksLocal();
    this.saveUserLibrarySnapshot(this.currentUser.id);
  }

  // ---------------------------------------------------------------------------
  // Synchronous Local Mirror & Cloud Sync for 'vybe_library_' + userId
  // ---------------------------------------------------------------------------
  public loadUserLibrarySnapshot(userId: string): boolean {
    if (typeof window === 'undefined' || !window.localStorage || !userId) return false;
    try {
      const raw = localStorage.getItem(`vybe_library_${userId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.playlists)) {
          this.playlists = parsed.playlists;
          this.savePlaylistsLocal();
        }
        if (Array.isArray(parsed.likedTracks)) {
          this.likedTrackMap.clear();
          parsed.likedTracks.forEach((t: EchoTrack) => this.likedTrackMap.set(t.id, t));
          this.saveLikedTracksLocal();
        }
        if (Array.isArray(parsed.recentlyPlayed)) {
          this.setUserRecentlyPlayed(parsed.recentlyPlayed, false);
        }
        if (parsed.lastPlayedTrack) {
          this.setUserLastPlayedTrack(parsed.lastPlayedTrack, false);
        }
        this.notify();
        return true;
      }
    } catch (e) {
      console.warn('[UserLibraryService] Snapshot load fallback:', e);
    }
    // Fallback to legacy individual keys if no snapshot exists yet
    this.loadUserPlaylists();
    this.reloadUserLikedTracks();
    return false;
  }

  public saveUserLibrarySnapshot(userId: string): void {
    if (typeof window === 'undefined' || !window.localStorage || !userId || userId === DEFAULT_GUEST_USER.id) return;
    try {
      const snapshot = {
        likedTracks: Array.from(this.likedTrackMap.values()),
        playlists: this.playlists,
        recentlyPlayed: this.getUserRecentlyPlayed(),
        lastPlayedTrack: this.getUserLastPlayedTrack(),
      };
      localStorage.setItem(`vybe_library_${userId}`, JSON.stringify(snapshot));
    } catch (e) {
      console.warn('[UserLibraryService] Failed to save snapshot:', e);
    }
  }

  public mergeCloudLibraryRow(userId: string, row: any): void {
    if (!userId || !row) return;
    if (row.display_name && this.currentUser.id === userId) {
      this.currentUser.name = row.display_name;
    }
    if (Array.isArray(row.playlists)) {
      this.playlists = row.playlists;
      this.savePlaylistsLocal();
    }
    if (Array.isArray(row.liked_tracks)) {
      this.likedTrackMap.clear();
      row.liked_tracks.forEach((t: EchoTrack) => this.likedTrackMap.set(t.id, t));
      this.saveLikedTracksLocal();
    }
    if (Array.isArray(row.recently_played)) {
      this.setUserRecentlyPlayed(row.recently_played, false);
    }
    if (row.last_played_track) {
      this.setUserLastPlayedTrack(row.last_played_track, false);
    }
    this.saveUserLibrarySnapshot(userId);
    this.notify();
  }

  // ---------------------------------------------------------------------------
  // Authentication & Session
  // ---------------------------------------------------------------------------
  public hasActiveSession(): boolean {
    return (
      !!this.currentUser &&
      this.currentUser.id !== DEFAULT_GUEST_USER.id &&
      typeof window !== 'undefined' &&
      (!!localStorage.getItem('vybe_authenticated_user') || !!localStorage.getItem(STORAGE_KEY_ACTIVE_USER))
    );
  }

  public getCurrentUser(): VybeUser {
    return this.currentUser;
  }

  public isGuest(): boolean {
    return this.currentUser.id === DEFAULT_GUEST_USER.id;
  }

  public listUsers(): VybeUser[] {
    return Array.from(this.users.values()).filter((u) => u.id !== DEFAULT_GUEST_USER.id);
  }

  /**
   * Real Supabase Auth Sign Up
   */
  public async signUp(
    name: string,
    email: string,
    password?: string,
    avatarColor?: string
  ): Promise<VybeUser> {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim() || 'Vybe Music Fan';

    if (!password) {
      throw new Error('Password is required to create an account.');
    }

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password: password,
      options: {
        data: {
          full_name: cleanName,
          name: cleanName,
        },
      },
    });

    if (error) {
      throw new Error(error.message);
    }

    if (!data.user) {
      throw new Error('Failed to create account. Please check your credentials.');
    }

    const newUser: VybeUser = {
      id: data.user.id,
      name: cleanName,
      email: cleanEmail,
      avatarColor: avatarColor || AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
      avatarUrl: './logo.png',
      createdAt: Date.now(),
    };

    // Ensure PostgreSQL user_library row is initialized
    await syncUserLibrary(data.user.id, {
      display_name: cleanName,
      liked_tracks: [],
      playlists: [],
      recently_played: [],
      last_played_track: null,
    });

    return this.applyActiveUser(newUser);
  }

  /**
   * Real Supabase Auth Login
   */
  public async login(email: string, password?: string): Promise<VybeUser> {
    const cleanEmail = email.trim().toLowerCase();

    if (!password) {
      throw new Error('Password is required.');
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: password,
    });

    if (error) {
      throw new Error(error.message);
    }

    if (!data.user) {
      throw new Error('Sign in failed. No user record returned.');
    }

    return await this.syncFromSupabaseUser(data.user);
  }

  /**
   * Continue with Google (OAuth)
   */
  public async loginWithGoogle(): Promise<VybeUser> {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });

    if (error) {
      throw new Error(error.message);
    }

    return this.currentUser;
  }

  private applyActiveUser(user: VybeUser): VybeUser {
    this.users.set(user.id, user);
    this.currentUser = user;
    this.saveUsers();
    this.loadUserPlaylists();
    this.reloadUserLikedTracks();
    this.notify();
    return user;
  }

  public async logout(): Promise<void> {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('[UserLibraryService] Supabase signOut error:', err);
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem('vybe_authenticated_user');
      localStorage.removeItem(STORAGE_KEY_ACTIVE_USER);
    }
    this.handleSignedOut();
  }

  public switchToGuest(): VybeUser {
    this.handleSignedOut();
    return DEFAULT_GUEST_USER;
  }

  public switchUser(userId: string): VybeUser {
    const target = this.users.get(userId) || DEFAULT_GUEST_USER;
    return this.applyActiveUser(target);
  }

  public updateProfile(updates: Partial<VybeUser>): VybeUser {
    const updated: VybeUser = {
      ...this.currentUser,
      ...updates,
      id: this.currentUser.id,
    };
    this.users.set(updated.id, updated);
    this.currentUser = updated;
    this.saveUsers();
    this.notify();

    if (updates.name && this.currentUser.id !== DEFAULT_GUEST_USER.id) {
      syncUserLibrary(this.currentUser.id, { display_name: updates.name });
    }
    return updated;
  }

  // ---------------------------------------------------------------------------
  // Per-User Namespaced History & Settings
  // ---------------------------------------------------------------------------
  public getUserRecentlyPlayed(): TrackMetadata[] {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    try {
      const raw = localStorage.getItem(`vybe_recently_played_${this.currentUser.id}`);
      if (raw) return JSON.parse(raw);
      const globalRaw = localStorage.getItem('vybe_recently_played');
      return globalRaw ? JSON.parse(globalRaw) : [];
    } catch {
      return [];
    }
  }

  public setUserRecentlyPlayed(tracks: TrackMetadata[], shouldSyncCloud = true): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      localStorage.setItem(`vybe_recently_played_${this.currentUser.id}`, JSON.stringify(tracks));
      localStorage.setItem('vybe_recently_played', JSON.stringify(tracks));
      this.saveUserLibrarySnapshot(this.currentUser.id);
      if (shouldSyncCloud && this.currentUser.id !== DEFAULT_GUEST_USER.id) {
        syncUserLibrary(this.currentUser.id, { recently_played: tracks });
      }
    } catch (e) {
      console.warn('Failed to save recently played:', e);
    }
  }

  public getUserLastPlayedTrack(): TrackMetadata | null {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    try {
      const raw = localStorage.getItem(`vybe_last_played_track_${this.currentUser.id}`);
      if (raw) return JSON.parse(raw);
      const globalRaw = localStorage.getItem('vybe_last_played_track');
      return globalRaw ? JSON.parse(globalRaw) : null;
    } catch {
      return null;
    }
  }

  public setUserLastPlayedTrack(track: TrackMetadata | null, shouldSyncCloud = true): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      if (track) {
        localStorage.setItem(`vybe_last_played_track_${this.currentUser.id}`, JSON.stringify(track));
        localStorage.setItem('vybe_last_played_track', JSON.stringify(track));
      } else {
        localStorage.removeItem(`vybe_last_played_track_${this.currentUser.id}`);
        localStorage.removeItem('vybe_last_played_track');
      }
      this.saveUserLibrarySnapshot(this.currentUser.id);
      if (shouldSyncCloud && this.currentUser.id !== DEFAULT_GUEST_USER.id) {
        syncUserLibrary(this.currentUser.id, { last_played_track: track });
      }
    } catch (e) {
      console.warn('Failed to save last played track:', e);
    }
  }

  public getUserAudioSettings(): any {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    try {
      const raw = localStorage.getItem(`vybe_audio_settings_${this.currentUser.id}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  public setUserAudioSettings(settings: any): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      localStorage.setItem(`vybe_audio_settings_${this.currentUser.id}`, JSON.stringify(settings));
    } catch (e) {
      console.warn('Failed to save audio settings:', e);
    }
  }

  // ---------------------------------------------------------------------------
  // Offline Mode Switcher
  // ---------------------------------------------------------------------------
  public getOfflineMode(): boolean {
    return this.isOfflineMode;
  }

  public setOfflineMode(enabled: boolean): void {
    this.isOfflineMode = enabled;
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(STORAGE_KEY_OFFLINE_MODE, enabled ? 'true' : 'false');
    }
    this.notify();
  }

  public toggleOfflineMode(): boolean {
    const next = !this.isOfflineMode;
    this.setOfflineMode(next);
    return next;
  }

  // ---------------------------------------------------------------------------
  // Liked Songs Management
  // ---------------------------------------------------------------------------
  public isLiked(trackId: string): boolean {
    return this.likedTrackMap.has(trackId);
  }

  public toggleLike(rawTrack: EchoTrack | TrackMetadata): boolean {
    const track = this.normalizeTrack(rawTrack);
    const wasLiked = this.likedTrackMap.has(track.id);

    if (wasLiked) {
      this.likedTrackMap.delete(track.id);
    } else {
      this.likedTrackMap.set(track.id, track);
    }

    this.saveLikedTracks();
    this.notify();
    return !wasLiked;
  }

  public getLikedTracks(): EchoTrack[] {
    return Array.from(this.likedTrackMap.values()).reverse();
  }

  // ---------------------------------------------------------------------------
  // Playlists Management
  // ---------------------------------------------------------------------------
  public getUserPlaylists(): VybePlaylist[] {
    return this.playlists.filter(
      (p) => p.userId === this.currentUser.id || p.userId === DEFAULT_GUEST_USER.id
    );
  }

  public async getPinnedLikedPlaylist(): Promise<VybePlaylist> {
    return {
      id: LIKED_SONGS_PLAYLIST_ID,
      userId: this.currentUser.id,
      name: 'Liked Songs',
      description: 'Your favorite tracks, saved directly in your personal library.',
      coverGradient: 'linear-gradient(135deg, #4F46E5, #EC4899)',
      tracks: this.getLikedTracks(),
      createdAt: 0,
      updatedAt: Date.now(),
      isPinned: true,
    };
  }

  public async getPinnedDownloadedPlaylist(): Promise<VybePlaylist> {
    const offlineTracks = await offlineVault.getOfflineAsEchoTracks();
    return {
      id: DOWNLOADED_SONGS_PLAYLIST_ID,
      userId: this.currentUser.id,
      name: 'Downloaded Music',
      description: 'Zero-latency local audio & synced kinetic lyrics stored directly on device disk.',
      coverGradient: 'linear-gradient(135deg, #059669, #10B981)',
      tracks: offlineTracks,
      createdAt: 0,
      updatedAt: Date.now(),
      isPinned: true,
    };
  }

  public async getPlaylistById(id: string): Promise<VybePlaylist | null> {
    if (id === LIKED_SONGS_PLAYLIST_ID) {
      return this.getPinnedLikedPlaylist();
    }
    if (id === DOWNLOADED_SONGS_PLAYLIST_ID) {
      return this.getPinnedDownloadedPlaylist();
    }
    return this.playlists.find((p) => p.id === id) || null;
  }

  public createPlaylist(name: string, description?: string, coverGradient?: string): VybePlaylist {
    const randomGradient =
      GRADIENT_PRESETS[Math.floor(Math.random() * GRADIENT_PRESETS.length)];

    const newPlaylist: VybePlaylist = {
      id: `pl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      userId: this.currentUser.id,
      name: name.trim() || 'My Vybe Playlist',
      description: description?.trim() || 'Custom curated music collection on Vybe.',
      coverGradient: coverGradient || randomGradient,
      tracks: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.playlists.unshift(newPlaylist);
    this.savePlaylists();
    this.notify();
    return newPlaylist;
  }

  public updatePlaylist(id: string, updates: Partial<VybePlaylist>): VybePlaylist | null {
    const index = this.playlists.findIndex((p) => p.id === id);
    if (index === -1) return null;

    const current = this.playlists[index];
    const updated: VybePlaylist = {
      ...current,
      ...updates,
      id: current.id,
      userId: current.userId,
      updatedAt: Date.now(),
    };

    this.playlists[index] = updated;
    this.savePlaylists();
    this.notify();
    return updated;
  }

  public deletePlaylist(id: string): boolean {
    const initialLen = this.playlists.length;
    this.playlists = this.playlists.filter((p) => p.id !== id);
    if (this.playlists.length !== initialLen) {
      this.savePlaylists();
      this.notify();
      return true;
    }
    return false;
  }

  public addTrackToPlaylist(playlistId: string, rawTrack: EchoTrack | TrackMetadata): boolean {
    if (playlistId === LIKED_SONGS_PLAYLIST_ID) {
      this.toggleLike(rawTrack);
      return true;
    }

    const playlist = this.playlists.find((p) => p.id === playlistId);
    if (!playlist) return false;

    const track = this.normalizeTrack(rawTrack);
    if (playlist.tracks.some((t) => t.id === track.id)) {
      return false;
    }

    playlist.tracks.push(track);
    playlist.updatedAt = Date.now();
    this.savePlaylists();
    this.notify();
    return true;
  }

  public removeTrackFromPlaylist(playlistId: string, trackId: string): boolean {
    if (playlistId === LIKED_SONGS_PLAYLIST_ID) {
      const removed = this.likedTrackMap.delete(trackId);
      if (removed) {
        this.saveLikedTracks();
        this.notify();
      }
      return removed;
    }

    const playlist = this.playlists.find((p) => p.id === playlistId);
    if (!playlist) return false;

    const initialLen = playlist.tracks.length;
    playlist.tracks = playlist.tracks.filter((t) => t.id !== trackId);
    if (playlist.tracks.length !== initialLen) {
      playlist.updatedAt = Date.now();
      this.savePlaylists();
      this.notify();
      return true;
    }
    return false;
  }

  private normalizeTrack(raw: EchoTrack | TrackMetadata): EchoTrack {
    return {
      id: raw.id,
      title: raw.title,
      artist: raw.artist || 'Unknown Artist',
      album: raw.album,
      duration: raw.duration,
      artworkUrl: raw.artworkUrl,
      streamUrl: raw.streamUrl || '',
      quality: '320kbps',
      source: (raw as EchoTrack).source || 'saavn',
      sourceType: 'stream',
      year: raw.year,
      genre: raw.genre,
    };
  }

  // ---------------------------------------------------------------------------
  // Backup & Restore (.vybe.json)
  // ---------------------------------------------------------------------------
  public exportLibraryBackup(): string {
    const backup: LibraryBackupData = {
      version: 1,
      exportedAt: Date.now(),
      app: 'vybe',
      user: this.getCurrentUser(),
      playlists: this.getUserPlaylists(),
      likedTracks: this.getLikedTracks(),
    };
    return JSON.stringify(backup, null, 2);
  }

  public importLibraryBackup(jsonContent: string): boolean {
    try {
      const data = JSON.parse(jsonContent) as LibraryBackupData;
      if (!data || !data.user || !Array.isArray(data.playlists)) {
        throw new Error('Invalid .vybe.json format');
      }

      if (data.user.id && data.user.id !== DEFAULT_GUEST_USER.id) {
        this.applyActiveUser(data.user);
      }

      for (const importedPl of data.playlists) {
        const existingIdx = this.playlists.findIndex((p) => p.id === importedPl.id);
        if (existingIdx !== -1) {
          this.playlists[existingIdx] = importedPl;
        } else {
          this.playlists.push(importedPl);
        }
      }

      if (Array.isArray(data.likedTracks)) {
        for (const t of data.likedTracks) {
          this.likedTrackMap.set(t.id, t);
        }
      }

      this.savePlaylists();
      this.saveLikedTracks();
      this.notify();
      return true;
    } catch (e) {
      console.error('[UserLibraryService] Import error:', e);
      return false;
    }
  }
}

export const userLibrary = new UserLibraryService();
