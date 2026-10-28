/**
 * Social Listening & Cross-Device Engine for Vybe
 * 
 * Implements:
 * 1. Vybe Connect (Cross-Device playback handoff & remote control via /api/echo/connect + BroadcastChannel)
 * 2. Live Jam Sessions (Real-time shared queue, sync playback, and voter ranking via /api/echo/jam)
 * 3. Taste Blend Generator (Interleaved 16-track playlist with Taste Match Score & dual avatar contributions)
 */

import { EchoTrack, fetchCatalogSearch } from './streamResolver';
import { TrackMetadata } from '../providers/types';
import { userLibrary, VybeUser } from './userLibraryService';

// =============================================================================
// 1. VYBE CONNECT TYPES & CLIENT
// =============================================================================

export interface ConnectDevice {
  deviceId: string;
  deviceName: string;
  deviceType: 'laptop' | 'phone' | 'desktop';
  currentTrack: TrackMetadata | null;
  currentTime: number;
  isPlaying: boolean;
  volume: number;
  queue?: TrackMetadata[];
  userId?: string;
  lastSeen: number;
  isSelf?: boolean;
}

export type ConnectCommandType =
  | 'TRANSFER_PLAYBACK'
  | 'PLAY'
  | 'PAUSE'
  | 'SEEK'
  | 'NEXT'
  | 'PREV'
  | 'SET_VOLUME';

export interface ConnectCommand {
  id: string;
  fromDeviceId: string;
  targetDeviceId: string;
  command: ConnectCommandType;
  payload?: any;
  timestamp: number;
}

const STORAGE_KEY_DEVICE_ID = 'vybe_device_unique_id';

class VybeConnectService {
  private deviceId: string;
  private deviceName: string;
  private deviceType: 'laptop' | 'phone' | 'desktop';
  private broadcastChannel: BroadcastChannel | null = null;
  private pollIntervalId: any = null;
  private commandListeners: ((cmd: ConnectCommand) => void)[] = [];
  private devicesListeners: ((devices: ConnectDevice[]) => void)[] = [];
  private lastKnownDevices: ConnectDevice[] = [];

  constructor() {
    this.deviceId = this.getOrCreateDeviceId();
    this.deviceType = this.detectDeviceType();
    this.deviceName = this.detectDeviceName();
    this.setupBroadcastChannel();
  }

  private getOrCreateDeviceId(): string {
    if (typeof window === 'undefined' || !window.localStorage) return 'dev-' + Math.random().toString(36).substring(2, 9);
    let id = localStorage.getItem(STORAGE_KEY_DEVICE_ID);
    if (!id) {
      id = 'dev-' + Math.random().toString(36).substring(2, 10);
      localStorage.setItem(STORAGE_KEY_DEVICE_ID, id);
    }
    return id;
  }

  private detectDeviceType(): 'laptop' | 'phone' | 'desktop' {
    if (typeof navigator === 'undefined') return 'laptop';
    const ua = navigator.userAgent.toLowerCase();
    if (/android|iphone|ipad|ipod|mobile/.test(ua)) return 'phone';
    return 'laptop';
  }

  private detectDeviceName(): string {
    if (typeof navigator === 'undefined') return 'Laptop Studio';
    const isMobile = this.deviceType === 'phone';
    const ua = navigator.userAgent;
    if (isMobile) {
      if (/android/i.test(ua)) return 'Android Phone';
      if (/iphone/i.test(ua)) return 'iPhone';
      return 'Mobile Device';
    }
    if (/mac/i.test(ua)) return 'MacBook Pro';
    if (/win/i.test(ua)) return 'Windows Studio';
    return 'Laptop Web';
  }

  private setupBroadcastChannel(): void {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel('vybe_connect_bus');
        this.broadcastChannel.onmessage = (event) => {
          const msg = event.data;
          if (msg?.type === 'COMMAND' && msg.command?.targetDeviceId === this.deviceId) {
            this.notifyCommandListeners(msg.command);
          } else if (msg?.type === 'HEARTBEAT') {
            this.handlePeerHeartbeat(msg.device);
          }
        };
      } catch (e) {
        console.warn('[VybeConnect] BroadcastChannel fallback:', e);
      }
    }
  }

  public getDeviceId(): string {
    return this.deviceId;
  }

  public getDeviceName(): string {
    return this.deviceName;
  }

  public getDeviceType(): 'laptop' | 'phone' | 'desktop' {
    return this.deviceType;
  }

  /**
   * Starts periodic heartbeat and polling (every 1500ms)
   */
  public start(
    getCurrentState: () => {
      currentTrack: TrackMetadata | null;
      currentTime: number;
      isPlaying: boolean;
      volume: number;
      queue: TrackMetadata[];
    }
  ): void {
    if (this.pollIntervalId) return;

    const tick = async () => {
      try {
        const state = getCurrentState();
        await this.sendHeartbeat(
          state.currentTrack,
          state.currentTime,
          state.isPlaying,
          state.volume,
          state.queue
        );
        await this.pollState();
      } catch (err) {
        // Silent fail for network drop
      }
    };

    tick();
    this.pollIntervalId = setInterval(tick, 1800);
  }

  public stop(): void {
    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
      this.pollIntervalId = null;
    }
  }

  /**
   * Sends heartbeat to backend server and local BroadcastChannel
   */
  public async sendHeartbeat(
    currentTrack: TrackMetadata | null,
    currentTime: number,
    isPlaying: boolean,
    volume: number,
    queue: TrackMetadata[]
  ): Promise<void> {
    const dev: ConnectDevice = {
      deviceId: this.deviceId,
      deviceName: this.deviceName,
      deviceType: this.deviceType,
      currentTrack,
      currentTime: Math.round(currentTime * 10) / 10,
      isPlaying,
      volume,
      queue: (queue || []).slice(0, 15),
      lastSeen: Date.now(),
      isSelf: true,
    };

    // Broadcast locally across browser tabs
    try {
      this.broadcastChannel?.postMessage({ type: 'HEARTBEAT', device: dev });
    } catch (_) {}

    // Send HTTP heartbeat to Gateway
    try {
      await fetch('/api/echo/connect/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dev),
      });
    } catch (_) {}
  }

  /**
   * Polls gateway for active devices and executes pending commands
   */
  public async pollState(): Promise<ConnectDevice[]> {
    try {
      const res = await fetch(`/api/echo/connect/state?deviceId=${encodeURIComponent(this.deviceId)}`);
      if (!res.ok) return this.lastKnownDevices;
      const data = await res.json();
      if (data.success && Array.isArray(data.activeDevices)) {
        const devices: ConnectDevice[] = data.activeDevices.map((d: ConnectDevice) => ({
          ...d,
          isSelf: d.deviceId === this.deviceId,
        }));

        this.lastKnownDevices = devices;
        this.notifyDevicesListeners(devices);

        // Execute any incoming pending commands
        if (Array.isArray(data.pendingCommands)) {
          for (const cmd of data.pendingCommands) {
            this.notifyCommandListeners(cmd);
          }
        }
        return devices;
      }
    } catch (_) {}
    return this.lastKnownDevices;
  }

  private handlePeerHeartbeat(peer: ConnectDevice): void {
    if (!peer || peer.deviceId === this.deviceId) return;
    const existingIdx = this.lastKnownDevices.findIndex((d) => d.deviceId === peer.deviceId);
    if (existingIdx >= 0) {
      this.lastKnownDevices[existingIdx] = { ...peer, isSelf: false };
    } else {
      this.lastKnownDevices.push({ ...peer, isSelf: false });
    }
    this.notifyDevicesListeners([...this.lastKnownDevices]);
  }

  /**
   * Sends a remote control command to another device
   */
  public async sendCommand(
    targetDeviceId: string,
    command: ConnectCommandType,
    payload?: any
  ): Promise<boolean> {
    const cmd: ConnectCommand = {
      id: 'cmd-' + Math.random().toString(36).substring(2, 9),
      fromDeviceId: this.deviceId,
      targetDeviceId,
      command,
      payload,
      timestamp: Date.now(),
    };

    // Broadcast locally
    try {
      this.broadcastChannel?.postMessage({ type: 'COMMAND', command: cmd });
    } catch (_) {}

    // Send via Gateway
    try {
      const res = await fetch('/api/echo/connect/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cmd),
      });
      return res.ok;
    } catch (e) {
      console.warn('[VybeConnect] Send command failed:', e);
      return false;
    }
  }

  public onCommand(callback: (cmd: ConnectCommand) => void): () => void {
    this.commandListeners.push(callback);
    return () => {
      this.commandListeners = this.commandListeners.filter((c) => c !== callback);
    };
  }

  public onDevicesChange(callback: (devices: ConnectDevice[]) => void): () => void {
    this.devicesListeners.push(callback);
    callback(this.lastKnownDevices);
    return () => {
      this.devicesListeners = this.devicesListeners.filter((d) => d !== callback);
    };
  }

  private notifyCommandListeners(cmd: ConnectCommand): void {
    for (const listener of this.commandListeners) {
      try {
        listener(cmd);
      } catch (e) {
        console.error('[VybeConnect] Command listener error:', e);
      }
    }
  }

  private notifyDevicesListeners(devices: ConnectDevice[]): void {
    for (const listener of this.devicesListeners) {
      try {
        listener(devices);
      } catch (e) {
        console.error('[VybeConnect] Devices listener error:', e);
      }
    }
  }
}

export const vybeConnect = new VybeConnectService();

// =============================================================================
// 2. LIVE JAM SESSION CLIENT
// =============================================================================

export interface JamParticipant {
  id: string;
  name: string;
  avatarColor: string;
  joinedAt: number;
  isHost?: boolean;
}

export interface JamSong {
  track: TrackMetadata;
  addedBy: {
    id: string;
    name: string;
    avatarColor: string;
  };
  votes: number;
  addedAt: number;
}

export interface JamRoom {
  roomCode: string;
  hostUser: {
    id: string;
    name: string;
    avatarColor: string;
  };
  participants: JamParticipant[];
  currentTrack: TrackMetadata | null;
  currentTime: number;
  isPlaying: boolean;
  queue: JamSong[];
  updatedAt: number;
}

class LiveJamService {
  private currentRoomCode: string | null = null;
  private pollIntervalId: any = null;
  private roomListeners: ((room: JamRoom | null) => void)[] = [];
  private lastKnownRoom: JamRoom | null = null;

  public getActiveRoom(): JamRoom | null {
    return this.lastKnownRoom;
  }

  public getRoomCode(): string | null {
    return this.currentRoomCode;
  }

  /**
   * Creates a new Live Jam Room with a 6-digit code
   */
  public async createJam(
    hostUser: { id: string; name: string; avatarColor: string },
    initialTrack?: TrackMetadata | null,
    currentTime = 0,
    isPlaying = false
  ): Promise<JamRoom | null> {
    try {
      const res = await fetch('/api/echo/jam/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hostUser,
          track: initialTrack,
          currentTime,
          isPlaying,
          queue: [],
        }),
      });
      const data = await res.json();
      if (data.success && data.room) {
        this.currentRoomCode = data.roomCode;
        this.lastKnownRoom = data.room;
        this.startPolling(data.roomCode);
        this.notifyListeners(data.room);
        return data.room;
      }
    } catch (e) {
      console.error('[LiveJam] Create room failed:', e);
    }
    return null;
  }

  /**
   * Joins an existing Jam Room by 6-digit code
   */
  public async joinJam(
    roomCode: string,
    user: { id: string; name: string; avatarColor: string }
  ): Promise<{ success: boolean; room?: JamRoom; error?: string }> {
    try {
      const res = await fetch('/api/echo/jam/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomCode: roomCode.trim().toUpperCase(),
          user,
        }),
      });
      const data = await res.json();
      if (data.success && data.room) {
        this.currentRoomCode = data.room.roomCode;
        this.lastKnownRoom = data.room;
        this.startPolling(data.room.roomCode);
        this.notifyListeners(data.room);
        return { success: true, room: data.room };
      }
      return { success: false, error: data.error || 'Failed to join jam room' };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Network error' };
    }
  }

  /**
   * Adds a song to the shared queue
   */
  public async addSongToQueue(
    track: TrackMetadata,
    user: { id: string; name: string; avatarColor: string }
  ): Promise<boolean> {
    if (!this.currentRoomCode) return false;
    try {
      const res = await fetch('/api/echo/jam/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomCode: this.currentRoomCode,
          action: 'ADD_SONG',
          payload: { track },
          user,
        }),
      });
      const data = await res.json();
      if (data.success && data.room) {
        this.lastKnownRoom = data.room;
        this.notifyListeners(data.room);
        return true;
      }
    } catch (e) {
      console.warn('[LiveJam] Add song failed:', e);
    }
    return false;
  }

  /**
   * Host syncs playback position to all listeners
   */
  public async syncPlayback(
    currentTrack: TrackMetadata | null,
    currentTime: number,
    isPlaying: boolean
  ): Promise<void> {
    if (!this.currentRoomCode) return;
    try {
      await fetch('/api/echo/jam/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomCode: this.currentRoomCode,
          action: 'SYNC_PLAYBACK',
          payload: {
            currentTrack,
            currentTime,
            isPlaying,
          },
        }),
      });
    } catch (_) {}
  }

  /**
   * Upvotes a song in the queue
   */
  public async voteTrack(trackId: string): Promise<void> {
    if (!this.currentRoomCode) return;
    try {
      const res = await fetch('/api/echo/jam/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomCode: this.currentRoomCode,
          action: 'VOTE_TRACK',
          payload: { trackId },
        }),
      });
      const data = await res.json();
      if (data.success && data.room) {
        this.lastKnownRoom = data.room;
        this.notifyListeners(data.room);
      }
    } catch (_) {}
  }

  /**
   * Leaves the jam room
   */
  public async leaveJam(user?: { id: string; name: string; avatarColor: string }): Promise<void> {
    if (this.currentRoomCode && user) {
      try {
        await fetch('/api/echo/jam/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomCode: this.currentRoomCode,
            action: 'LEAVE',
            user,
          }),
        });
      } catch (_) {}
    }
    this.stopPolling();
    this.currentRoomCode = null;
    this.lastKnownRoom = null;
    this.notifyListeners(null);
  }

  private startPolling(roomCode: string): void {
    this.stopPolling();
    this.pollIntervalId = setInterval(async () => {
      try {
        const res = await fetch(`/api/echo/jam/state?roomCode=${encodeURIComponent(roomCode)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.room) {
            this.lastKnownRoom = data.room;
            this.notifyListeners(data.room);
          }
        }
      } catch (_) {}
    }, 1500);
  }

  private stopPolling(): void {
    if (this.pollIntervalId) {
      clearInterval(this.pollIntervalId);
      this.pollIntervalId = null;
    }
  }

  public onRoomUpdate(callback: (room: JamRoom | null) => void): () => void {
    this.roomListeners.push(callback);
    callback(this.lastKnownRoom);
    return () => {
      this.roomListeners = this.roomListeners.filter((l) => l !== callback);
    };
  }

  private notifyListeners(room: JamRoom | null): void {
    for (const listener of this.roomListeners) {
      try {
        listener(room);
      } catch (e) {
        console.error('[LiveJam] Listener error:', e);
      }
    }
  }
}

export const liveJam = new LiveJamService();

// =============================================================================
// 3. TASTE BLEND ENGINE
// =============================================================================

export interface BlendPersona {
  id: string;
  name: string;
  avatarColor: string;
  avatarEmoji: string;
  bio: string;
  topGenres: string[];
  sampleTracks: { title: string; artist: string; searchPrompt: string }[];
}

export const PRESET_BLEND_PERSONAS: BlendPersona[] = [
  {
    id: 'blend-aarav',
    name: 'Aarav • Late Night Trap',
    avatarColor: '#8B5CF6',
    avatarEmoji: '⚡',
    bio: 'Heavy 808s, midnight Tokyo drift, synthwave trap, and dark basslines.',
    topGenres: ['Trap', 'Hip-Hop', 'Dark Synth'],
    sampleTracks: [
      { title: 'FE!N', artist: 'Travis Scott', searchPrompt: 'Travis Scott FEIN' },
      { title: 'Starboy', artist: 'The Weeknd', searchPrompt: 'The Weeknd Starboy' },
      { title: 'Creepin', artist: 'Metro Boomin', searchPrompt: 'Metro Boomin Creepin' },
      { title: 'Superhero', artist: 'Metro Boomin', searchPrompt: 'Metro Boomin Superhero' },
    ],
  },
  {
    id: 'blend-maya',
    name: 'Maya • Indie & R&B',
    avatarColor: '#EC4899',
    avatarEmoji: '🌸',
    bio: 'Dreamy vocals, soulful Rhodes chords, Frank Ocean, and rainy Sunday warmth.',
    topGenres: ['Neo-Soul', 'Indie Pop', 'R&B'],
    sampleTracks: [
      { title: 'Snooze', artist: 'SZA', searchPrompt: 'SZA Snooze' },
      { title: 'Pink + White', artist: 'Frank Ocean', searchPrompt: 'Frank Ocean Pink White' },
      { title: 'Redbone', artist: 'Childish Gambino', searchPrompt: 'Childish Gambino Redbone' },
      { title: 'Golden', artist: 'Harry Styles', searchPrompt: 'Harry Styles Golden' },
    ],
  },
  {
    id: 'blend-kabir',
    name: 'Kabir • Gym Phonk',
    avatarColor: '#EF4444',
    avatarEmoji: '🔥',
    bio: 'Raw distorted cowbells, drift bass, high adrenaline PR energy.',
    topGenres: ['Drift Phonk', 'Hardstyle', 'Electronic'],
    sampleTracks: [
      { title: 'Murder In My Mind', artist: 'Kordhell', searchPrompt: 'Kordhell Murder In My Mind' },
      { title: 'Metamorphosis', artist: 'INTERWORLD', searchPrompt: 'INTERWORLD Metamorphosis' },
      { title: 'RAVE', artist: 'Dxrk', searchPrompt: 'Dxrk RAVE' },
      { title: 'Warning', artist: 'MC Orsen', searchPrompt: 'MC Orsen Warning' },
    ],
  },
  {
    id: 'blend-zoya',
    name: 'Zoya • Bollywood & Lo-Fi',
    avatarColor: '#F59E0B',
    avatarEmoji: '✨',
    bio: 'Acoustic Bollywood melodies, tape flutter, nostalgic rain, and warm vocals.',
    topGenres: ['Bollywood Lo-Fi', 'Acoustic', 'Chilled Hindi'],
    sampleTracks: [
      { title: 'Kesariya', artist: 'Arijit Singh', searchPrompt: 'Arijit Singh Kesariya' },
      { title: 'Apna Bana Le', artist: 'Arijit Singh', searchPrompt: 'Apna Bana Le Arijit' },
      { title: 'Kasoor', artist: 'Prateek Kuhad', searchPrompt: 'Prateek Kuhad Kasoor' },
      { title: 'Pasoori', artist: 'Ali Sethi', searchPrompt: 'Ali Sethi Pasoori' },
    ],
  },
];

export interface BlendResult {
  id: string;
  title: string;
  subtitle: string;
  matchScore: number; // e.g. 94%
  userA: { name: string; avatarColor: string };
  userB: { name: string; avatarColor: string };
  tracks: (EchoTrack & { contributedBy: { name: string; avatarColor: string } })[];
}

class TasteBlendService {
  /**
   * Generates a 16-track interleaved Blend with Taste Match score
   */
  public async createBlendWithPersona(
    persona: BlendPersona,
    currentUser: VybeUser | null
  ): Promise<BlendResult> {
    const userA = {
      name: currentUser?.name || 'You',
      avatarColor: currentUser?.avatarColor || '#1DB954',
    };
    const userB = {
      name: persona.name.split('•')[0].trim(),
      avatarColor: persona.avatarColor,
    };

    // Calculate a dynamic high taste match score between 89% and 97%
    const seed = (currentUser?.id || 'guest').length + persona.name.length;
    const matchScore = 88 + (seed % 10);

    // Fetch tracks for persona
    const friendTracks: EchoTrack[] = [];
    for (const sample of persona.sampleTracks) {
      try {
        const results = await fetchCatalogSearch(sample.searchPrompt);
        if (results && results.length > 0) {
          friendTracks.push(results[0]);
        }
      } catch (_) {}
    }

    // Complement with curated genre searches if fewer than 8
    if (friendTracks.length < 8) {
      try {
        const extra = await fetchCatalogSearch(persona.topGenres[0] + ' hits');
        for (const t of extra.slice(0, 8 - friendTracks.length)) {
          if (!friendTracks.some((ft) => ft.id === t.id)) {
            friendTracks.push(t);
          }
        }
      } catch (_) {}
    }

    // Get user's liked or library songs
    const userLikedSongs = userLibrary.getLikedTracks();
    const userContributionTracks: EchoTrack[] = [];

    if (userLikedSongs.length > 0) {
      for (const t of userLikedSongs.slice(0, 8)) {
        userContributionTracks.push({
          id: t.id,
          title: t.title,
          artist: t.artist,
          album: t.album,
          duration: t.duration,
          artworkUrl: t.artworkUrl,
          streamUrl: t.streamUrl || '',
          quality: '320kbps',
          source: 'saavn',
          sourceType: 'stream',
        });
      }
    }

    // Fallback if user doesn't have 8 liked songs: search trending hits
    if (userContributionTracks.length < 8) {
      try {
        const trending = await fetchCatalogSearch('Top Hits 2026');
        for (const t of trending.slice(0, 8 - userContributionTracks.length)) {
          userContributionTracks.push(t);
        }
      } catch (_) {}
    }

    // Interleave tracks: A, B, A, B...
    const blendedTracks: (EchoTrack & { contributedBy: { name: string; avatarColor: string } })[] = [];
    const maxCount = Math.max(userContributionTracks.length, friendTracks.length);

    for (let i = 0; i < maxCount && blendedTracks.length < 16; i++) {
      if (userContributionTracks[i]) {
        blendedTracks.push({
          ...userContributionTracks[i],
          contributedBy: userA,
        });
      }
      if (friendTracks[i]) {
        blendedTracks.push({
          ...friendTracks[i],
          contributedBy: userB,
        });
      }
    }

    const blendResult: BlendResult = {
      id: `blend-${persona.id}-${Date.now()}`,
      title: `${userA.name} + ${userB.name}`,
      subtitle: `${matchScore}% Taste Match • Updated Daily`,
      matchScore,
      userA,
      userB,
      tracks: blendedTracks,
    };

    // Save to user library as a playlist so it persists!
    const pl = userLibrary.createPlaylist(
      `Blend: ${userA.name} + ${userB.name}`,
      `${matchScore}% Taste Match playlist blending ${userA.name}'s library with ${persona.name}.`
    );
    for (const t of blendedTracks) {
      userLibrary.addTrackToPlaylist(pl.id, t);
    }

    return blendResult;
  }
}

export const tasteBlend = new TasteBlendService();
