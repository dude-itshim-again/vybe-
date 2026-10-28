/**
 * Music DNA Track Backstory & Acoustic Profiler
 * 
 * Replicates Echo-Music's signature "Music DNA" feature:
 * Queries the Wikipedia REST API and public song annotations to assemble
 * a rich backstory, artist biography, release context, and acoustic metrics.
 */

import { TrackMetadata } from '../providers/types';
import { TrackAudioProfile } from '../audio/TrackAnalyzer';

export interface MusicDnaProfile {
  trackId: string;
  title: string;
  artist: string;
  album?: string;
  year?: string;
  genre?: string;
  artworkUrl?: string;
  // Story & Artist Biographies
  songBackstory?: string;
  songDescription?: string;
  artistBio?: string;
  artistImage?: string;
  artistDescription?: string;
  wikiUrl?: string;
  // Acoustic & DSP Attributes
  profile?: TrackAudioProfile;
}

const dnaCache = new Map<string, MusicDnaProfile>();

async function fetchWikiSummary(query: string): Promise<{
  extract?: string;
  description?: string;
  thumbnailUrl?: string;
  wikiUrl?: string;
} | null> {
  if (!query) return null;
  const cleanTitle = query.trim().replace(/\s+/g, '_');

  try {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(cleanTitle)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Vybe-Music-DNA/1.0 (https://github.com/vybe; music-dna@vybe.app)',
      },
    });

    if (!res.ok) return null;

    const data = (await res.json()) as {
      type?: string;
      extract?: string;
      description?: string;
      thumbnail?: { source: string };
      content_urls?: { desktop?: { page?: string } };
    };

    if (data.type === 'disambiguation') return null;

    return {
      extract: data.extract,
      description: data.description,
      thumbnailUrl: data.thumbnail?.source,
      wikiUrl: data.content_urls?.desktop?.page,
    };
  } catch (err) {
    console.warn('[MusicDNA] Wiki fetch error:', err);
    return null;
  }
}

/**
 * Loads Music DNA for the specified track.
 */
export async function getTrackMusicDna(
  track: TrackMetadata,
  profile?: TrackAudioProfile
): Promise<MusicDnaProfile> {
  const cacheKey = `${track.id || track.title}_${track.artist}`;
  if (dnaCache.has(cacheKey)) {
    const cached = dnaCache.get(cacheKey)!;
    if (profile && !cached.profile) cached.profile = profile;
    return cached;
  }

  // 1. Fetch song backstory
  let songWiki = await fetchWikiSummary(`${track.title} (song)`);
  if (!songWiki) {
    songWiki = await fetchWikiSummary(track.title);
  }

  // 2. Fetch artist biography
  let artistWiki = null;
  if (track.artist && track.artist !== 'Unknown Artist') {
    artistWiki = await fetchWikiSummary(track.artist);
  }

  const result: MusicDnaProfile = {
    trackId: track.id,
    title: track.title,
    artist: track.artist,
    album: track.album,
    year: track.year,
    genre: track.genre,
    artworkUrl: track.artworkUrl,
    songBackstory: songWiki?.extract,
    songDescription: songWiki?.description,
    artistBio: artistWiki?.extract,
    artistDescription: artistWiki?.description,
    artistImage: artistWiki?.thumbnailUrl,
    wikiUrl: songWiki?.wikiUrl || artistWiki?.wikiUrl,
    profile: profile || track.profile,
  };

  dnaCache.set(cacheKey, result);
  return result;
}
