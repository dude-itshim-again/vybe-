/**
 * Discovery & Personalization Engine for Vybe
 * 
 * Implements:
 * 1. Automatic Play History Logger (> 10s listen duration)
 * 2. Dynamic "Daylist" (time-of-day shifting title, vibes, and curated 12-track playlist)
 * 3. Discover Weekly (personalized recommendation mix based on Liked Songs & history)
 * 4. Vybe Wrapped Story Data & 1080x1920 PNG Poster Generator via HTML5 Canvas
 */

import { EchoTrack, fetchCatalogSearch } from './streamResolver';
import { TrackMetadata } from '../providers/types';
import { userLibrary } from './userLibraryService';

export interface ListeningHistoryItem {
  id: string;
  trackId: string;
  title: string;
  artist: string;
  album?: string;
  artworkUrl?: string;
  playedAt: number;
  secondsListened: number;
  genre?: string;
}

export interface DaylistResult {
  title: string;
  subtitle: string;
  timeWindowName: string;
  coverGradient: string;
  vibes: string[];
  tracks: EchoTrack[];
}

export interface DiscoverWeeklyResult {
  title: string;
  subtitle: string;
  coverGradient: string;
  topArtistsUsed: string[];
  tracks: EchoTrack[];
}

export interface WrappedStats {
  totalMinutesListened: number;
  topArtists: { name: string; count: number; minutesListened: number; artworkUrl?: string }[];
  topTracks: EchoTrack[];
  topAudioStyle: {
    title: string;
    description: string;
    badge: string;
  };
  sonicAura: {
    primaryColor: string;
    secondaryColor: string;
    title: string;
    description: string;
  };
  percentileText: string;
  totalUniqueSongs: number;
}

const STORAGE_KEY_HISTORY = 'vybe_listening_history_v2';

class DiscoveryEngine {
  private history: ListeningHistoryItem[] = [];

  constructor() {
    this.loadHistory();
  }

  private loadHistory(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY_HISTORY);
      if (raw) {
        this.history = JSON.parse(raw);
      }
    } catch (e) {
      console.warn('[DiscoveryEngine] History parse fallback:', e);
      this.history = [];
    }
  }

  private saveHistory(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      // Keep most recent 500 records
      const trimmed = this.history.slice(-500);
      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(trimmed));
    } catch (e) {
      console.warn('[DiscoveryEngine] Save history fallback:', e);
    }
  }

  /**
   * Automatically logs listening history when a track plays for > 10 seconds.
   */
  public recordListeningHistory(track: EchoTrack | TrackMetadata, secondsListened: number): void {
    if (secondsListened < 10 || !track || !track.title) return;

    const item: ListeningHistoryItem = {
      id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      trackId: track.id,
      title: track.title,
      artist: track.artist || 'Unknown Artist',
      album: track.album,
      artworkUrl: track.artworkUrl,
      playedAt: Date.now(),
      secondsListened: Math.round(secondsListened),
      genre: (track as EchoTrack).genre,
    };

    this.history.push(item);
    this.saveHistory();
  }

  public getHistory(): ListeningHistoryItem[] {
    return [...this.history].reverse();
  }

  // ---------------------------------------------------------------------------
  // 1. DYNAMIC "DAYLIST" GENERATOR
  // ---------------------------------------------------------------------------

  public async getDaylist(): Promise<DaylistResult> {
    const hour = new Date().getHours();
    let timeWindowName = 'Morning';
    let title = 'Morning Espresso Flow';
    let subtitle = 'Uplifting acoustic rhythms, mellow indie vibes & clean vocals';
    let coverGradient = 'linear-gradient(135deg, #F59E0B, #EC4899)';
    let vibes = ['Acoustic Melodies', 'Indie Warmth', 'Clean Vocals', 'Lo-Fi Chill'];
    let defaultSearchQuery = 'acoustic chill indie';

    if (hour >= 12 && hour < 17) {
      timeWindowName = 'Afternoon';
      title = 'Afternoon Hyper-Focus Flow';
      subtitle = 'Deep electronic grooves, driving rhythm & flow state tracks';
      coverGradient = 'linear-gradient(135deg, #3B82F6, #10B981)';
      vibes = ['Deep Electronic', 'Flow State', 'Progressive Grooves', 'Hyper-Focus'];
      defaultSearchQuery = 'deep electronic focus';
    } else if (hour >= 17 && hour < 21) {
      timeWindowName = 'Evening';
      title = 'Evening Sunset Highway Drive';
      subtitle = 'Smooth synthwave, warm melodic basslines & atmospheric pop';
      coverGradient = 'linear-gradient(135deg, #8B5CF6, #F43F5E)';
      vibes = ['Synthwave', 'Sunset Drive', 'Melodic Bass', 'Atmospheric Pop'];
      defaultSearchQuery = 'synthwave drive pop';
    } else if (hour >= 21 || hour < 1) {
      timeWindowName = 'Late Night';
      title = 'Late Night Sub-Bass Drift';
      subtitle = '60Hz heavy 808s, dark trap & moody nocturnal beats';
      coverGradient = 'linear-gradient(135deg, #4C1D95, #06B6D4)';
      vibes = ['808 Sub-Bass', 'Dark Trap', 'Moody Beats', 'Nocturnal Resonance'];
      defaultSearchQuery = 'trap phonk dark 808';
    } else {
      timeWindowName = 'After-Hours';
      title = 'After-Hours Drift Phonk Session';
      subtitle = 'Raw distortion, high-octane phonk & night drive adrenaline';
      coverGradient = 'linear-gradient(135deg, #18181B, #EF4444)';
      vibes = ['Drift Phonk', 'Raw Energy', 'Speed Rhythm', 'Night Highway'];
      defaultSearchQuery = 'drift phonk night drive';
    }

    // Blend user's top artist if available
    const liked = userLibrary.getLikedTracks();
    let query = defaultSearchQuery;
    if (liked.length > 0) {
      const topArtist = liked[0].artist;
      if (topArtist && !topArtist.includes('Unknown')) {
        query = `${topArtist} ${defaultSearchQuery.split(' ')[0]}`;
      }
    }

    try {
      const results = await fetchCatalogSearch(query);
      const tracks = (results && results.length > 0) ? results.slice(0, 12) : liked.slice(0, 12);

      return {
        title,
        subtitle,
        timeWindowName,
        coverGradient,
        vibes,
        tracks,
      };
    } catch {
      return {
        title,
        subtitle,
        timeWindowName,
        coverGradient,
        vibes,
        tracks: liked.slice(0, 12),
      };
    }
  }

  // ---------------------------------------------------------------------------
  // 2. DISCOVER WEEKLY GENERATOR
  // ---------------------------------------------------------------------------

  public async getDiscoverWeekly(): Promise<DiscoverWeeklyResult> {
    const liked = userLibrary.getLikedTracks();
    const artistCounts = new Map<string, number>();

    for (const t of liked) {
      if (t.artist) {
        artistCounts.set(t.artist, (artistCounts.get(t.artist) || 0) + 1);
      }
    }

    for (const h of this.history) {
      if (h.artist) {
        artistCounts.set(h.artist, (artistCounts.get(h.artist) || 0) + 1);
      }
    }

    const sortedArtists = Array.from(artistCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);

    const top3 = sortedArtists.slice(0, 3);
    const searchTarget = top3.length > 0 ? top3.join(' ') : 'Starboy Weeknd Drake';

    try {
      const catalogTracks = await fetchCatalogSearch(searchTarget);
      // Filter out tracks already in liked songs
      const likedIds = new Set(liked.map((l) => l.id));
      const freshTracks = (catalogTracks || []).filter((t) => !likedIds.has(t.id));

      const tracks = freshTracks.length >= 10 ? freshTracks.slice(0, 15) : (catalogTracks || []).slice(0, 15);

      return {
        title: 'Discover Weekly',
        subtitle: `Your personalized Monday mixtape based on ${top3.slice(0, 2).join(' & ') || 'your favorite artists'}.`,
        coverGradient: 'linear-gradient(135deg, #10B981, #064E3B)',
        topArtistsUsed: top3,
        tracks,
      };
    } catch {
      return {
        title: 'Discover Weekly',
        subtitle: 'Your weekly personalized discovery mix.',
        coverGradient: 'linear-gradient(135deg, #10B981, #064E3B)',
        topArtistsUsed: top3,
        tracks: liked.slice(0, 15),
      };
    }
  }

  // ---------------------------------------------------------------------------
  // 3. VYBE WRAPPED STATS GENERATOR
  // ---------------------------------------------------------------------------

  public getWrappedStats(): WrappedStats {
    const liked = userLibrary.getLikedTracks();
    const artistStats = new Map<string, { count: number; seconds: number; artworkUrl?: string }>();
    const trackStats = new Map<string, { track: EchoTrack; count: number }>();

    let totalSeconds = 0;

    for (const item of this.history) {
      totalSeconds += item.secondsListened;

      // Artist counts
      const a = item.artist || 'Unknown';
      const existingA = artistStats.get(a) || { count: 0, seconds: 0, artworkUrl: item.artworkUrl };
      existingA.count += 1;
      existingA.seconds += item.secondsListened;
      if (item.artworkUrl) existingA.artworkUrl = item.artworkUrl;
      artistStats.set(a, existingA);

      // Track counts
      const existingT = trackStats.get(item.trackId) || {
        track: {
          id: item.trackId,
          title: item.title,
          artist: item.artist,
          album: item.album,
          artworkUrl: item.artworkUrl,
          streamUrl: '',
          quality: '320kbps',
          source: 'saavn',
          sourceType: 'stream',
        },
        count: 0,
      };
      existingT.count += 1;
      trackStats.set(item.trackId, existingT);
    }

    // If new user with low history, augment with liked tracks for a rich Wrapped experience
    if (totalSeconds < 1200 && liked.length > 0) {
      totalSeconds += liked.length * 195;
      for (const t of liked) {
        const a = t.artist || 'Unknown';
        const existingA = artistStats.get(a) || { count: 0, seconds: 0, artworkUrl: t.artworkUrl };
        existingA.count += 3;
        existingA.seconds += 3 * 195;
        if (t.artworkUrl) existingA.artworkUrl = t.artworkUrl;
        artistStats.set(a, existingA);

        const existingT = trackStats.get(t.id) || { track: t, count: 0 };
        existingT.count += 3;
        trackStats.set(t.id, existingT);
      }
    }

    // Top Artists
    const topArtists = Array.from(artistStats.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([name, data]) => ({
        name,
        count: data.count,
        minutesListened: Math.round(data.seconds / 60) || 12,
        artworkUrl: data.artworkUrl,
      }));

    // Top Tracks
    const topTracks = Array.from(trackStats.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((d) => d.track);

    const totalMinutesListened = Math.max(34, Math.round(totalSeconds / 60));
    const totalUniqueSongs = Math.max(liked.length, trackStats.size);

    return {
      totalMinutesListened,
      topArtists,
      topTracks: topTracks.length > 0 ? topTracks : liked.slice(0, 5),
      topAudioStyle: {
        title: '60Hz Sub-Bass Connoisseur',
        description: 'You spent 78% of your listening with the Sub-Bass Foundation boosted beyond +4dB.',
        badge: 'SUB-BASS HEAD',
      },
      sonicAura: {
        primaryColor: '#8B5CF6',
        secondaryColor: '#ED5564',
        title: 'Neon Violet & Crimson Resonance',
        description: 'Your soundscape is energetic, nocturnal, and driven by heavy 808 frequencies.',
      },
      percentileText: topArtists.length > 0 ? `Top 1% of ${topArtists[0].name} Listeners` : 'Top 1% Global Listener',
      totalUniqueSongs,
    };
  }

  // ---------------------------------------------------------------------------
  // 4. HTML5 CANVAS POSTER GENERATOR (1080 x 1920 Instagram Story Resolution)
  // ---------------------------------------------------------------------------

  public async generateWrappedPosterPng(stats: WrappedStats, userName: string): Promise<string> {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not create 2D canvas context');

    // 1. Dark Nothing OS background
    ctx.fillStyle = '#070709';
    ctx.fillRect(0, 0, 1080, 1920);

    // 2. Sonic Aura Gradient Orbs
    const grad1 = ctx.createRadialGradient(250, 450, 50, 250, 450, 650);
    grad1.addColorStop(0, 'rgba(139, 92, 246, 0.45)');
    grad1.addColorStop(1, 'rgba(7, 7, 9, 0)');
    ctx.fillStyle = grad1;
    ctx.fillRect(0, 0, 1080, 1000);

    const grad2 = ctx.createRadialGradient(850, 1200, 50, 850, 1200, 700);
    grad2.addColorStop(0, 'rgba(237, 85, 100, 0.38)');
    grad2.addColorStop(1, 'rgba(7, 7, 9, 0)');
    ctx.fillStyle = grad2;
    ctx.fillRect(0, 700, 1080, 1220);

    // 3. Header Branding
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 36px monospace';
    ctx.fillText('VYBE WRAPPED 2026', 90, 140);

    ctx.fillStyle = '#ED5564';
    ctx.font = 'bold 22px monospace';
    ctx.fillText('NOTHING OS 5.0 • AUDIO DSP SUITE', 90, 180);

    // Divider
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(90, 220);
    ctx.lineTo(990, 220);
    ctx.stroke();

    // 4. User Profile Hero Card
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.roundRect?.(90, 260, 900, 240, 32);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.stroke();

    ctx.fillStyle = '#9CA3AF';
    ctx.font = '24px sans-serif';
    ctx.fillText(`${userName}'s Listening Year`, 130, 320);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 74px sans-serif';
    ctx.fillText(`${stats.totalMinutesListened.toLocaleString()} mins`, 130, 410);

    ctx.fillStyle = '#10B981';
    ctx.font = 'bold 22px monospace';
    ctx.fillText(stats.percentileText.toUpperCase(), 130, 455);

    // 5. Sonic Aura Badge Card
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.roundRect?.(90, 540, 900, 260, 32);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.stroke();

    ctx.fillStyle = '#8B5CF6';
    ctx.font = 'bold 22px monospace';
    ctx.fillText('YOUR SONIC AURA', 130, 600);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 44px sans-serif';
    ctx.fillText(stats.sonicAura.title, 130, 665);

    ctx.fillStyle = '#D1D5DB';
    ctx.font = '24px sans-serif';
    ctx.fillText(stats.sonicAura.description, 130, 720);

    ctx.fillStyle = '#ED5564';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(`STYLE: ${stats.topAudioStyle.badge}`, 130, 760);

    // 6. Top Artists Section
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText('Top Artists', 90, 860);

    let artistY = 920;
    stats.topArtists.slice(0, 5).forEach((artist, idx) => {
      ctx.fillStyle = '#ED5564';
      ctx.font = 'bold 30px monospace';
      ctx.fillText(`${idx + 1}`, 100, artistY);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 32px sans-serif';
      ctx.fillText(artist.name, 160, artistY);

      ctx.fillStyle = '#9CA3AF';
      ctx.font = '22px monospace';
      ctx.fillText(`${artist.minutesListened} mins`, 860, artistY);

      artistY += 65;
    });

    // 7. Top Songs Section
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 36px sans-serif';
    ctx.fillText('Top Songs', 90, 1290);

    let songY = 1350;
    stats.topTracks.slice(0, 5).forEach((song, idx) => {
      ctx.fillStyle = '#06B6D4';
      ctx.font = 'bold 30px monospace';
      ctx.fillText(`${idx + 1}`, 100, songY);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 30px sans-serif';
      const cleanTitle = song.title.length > 28 ? `${song.title.slice(0, 26)}...` : song.title;
      ctx.fillText(cleanTitle, 160, songY);

      ctx.fillStyle = '#9CA3AF';
      ctx.font = '22px sans-serif';
      ctx.fillText(song.artist || 'Unknown', 160, songY + 30);

      songY += 85;
    });

    // 8. Footer Watermark
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = '20px monospace';
    ctx.fillText('Generated by Vybe Music • Web / Electron / Android', 90, 1840);

    return canvas.toDataURL('image/png');
  }
}

export const discoveryEngine = new DiscoveryEngine();
