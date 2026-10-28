import React, { useState } from 'react';
import {
  Radio,
  Play,
  Sparkles,
  Award,
} from 'lucide-react';
import { fetchCatalogSearch } from '../../services/streamResolver';
import { TrackMetadata } from '../../providers/types';

interface RadioEditorialViewProps {
  onPlayStation: (stationName: string, tracks: TrackMetadata[]) => void;
  onPlayPlaylist: (playlistName: string, tracks: TrackMetadata[]) => void;
}

interface RadioStation {
  id: string;
  name: string;
  frequency: string;
  tagline: string;
  host: string;
  liveNow: string;
  gradient: string;
  searchQueries: string[];
}

interface EditorialPlaylist {
  id: string;
  title: string;
  curator: string;
  badge: string;
  coverGradient: string;
  description: string;
  curatorNotes: string;
  searchQueries: string[];
}

const LIVE_STATIONS: RadioStation[] = [
  {
    id: 'vybe-1-global',
    name: 'Vybe 1 Global',
    frequency: '98.5 FM • WORLDWIDE',
    tagline: "The world's biggest new music & world-first exclusives",
    host: 'Hosted by Zane & Tara',
    liveNow: 'Global Pop & Electric Pulse',
    gradient: 'from-rose-600 via-pink-600 to-indigo-900',
    searchQueries: ['Top Hits Worldwide', 'Starboy', 'Blinding Lights', 'As It Was', 'Levitating'],
  },
  {
    id: 'sub-bass-underground',
    name: 'Sub-Bass Underground',
    frequency: '104.2 FM • LONDON / TOKYO',
    tagline: '60Hz sub-bass, drift phonk, UK garage & dark synthwave',
    host: 'Hosted by DJ SubAtomic',
    liveNow: 'Heavy Basslines & Night Drift',
    gradient: 'from-purple-900 via-violet-800 to-black',
    searchQueries: ['Drift Phonk Kordhell', 'UK Garage Bop', 'Fred Again', 'Overmono', 'Skrillex'],
  },
  {
    id: 'after-hours-rnb',
    name: 'After-Hours R&B',
    frequency: '107.9 FM • ATLANTA / PARIS',
    tagline: 'Velvet slow jams, soulful Rhode chords & nocturnal romance',
    host: 'Hosted by Maya Rivers',
    liveNow: 'Midnight Candlelight Sessions',
    gradient: 'from-amber-700 via-rose-900 to-black',
    searchQueries: ['Frank Ocean', 'SZA Snooze', 'Daniel Caesar', 'Giveon', 'Summer Walker'],
  },
];

const EDITORIAL_PLAYLISTS: EditorialPlaylist[] = [
  {
    id: 'today-hits-apple',
    title: "Today's Hits Mastered",
    curator: 'Apple Music Editorial Desk',
    badge: 'Apple Digital Master • 24-bit/48kHz',
    coverGradient: 'from-red-600 to-rose-900',
    description: 'The defining songs of right now, freshly sequenced and calibrated for Apple AutoMix.',
    curatorNotes:
      'We curate the tracks breaking charts across 45 countries, ensuring seamless beat-matching and pristine vocal clarity.',
    searchQueries: ['Espresso Sabrina', 'Die With A Smile', 'Birds of a Feather', 'Taste Sabrina'],
  },
  {
    id: 'spatial-audio-immersion',
    title: 'Spatial Audio: The 3D Experience',
    curator: 'Acoustic Sound Labs',
    badge: 'Binaural 3D Widened • -16 LUFS',
    coverGradient: 'from-cyan-600 via-blue-800 to-indigo-950',
    description: 'Tracks engineered to stretch beyond stereo into expansive, room-filling 3D space.',
    curatorNotes:
      'Listen with headphones to experience our 12ms Haas micro-delay matrix and pinna cross-feed filters in full effect.',
    searchQueries: ['Travis Scott FEIN', 'Billie Eilish What Was I Made For', 'Daft Punk Get Lucky'],
  },
  {
    id: 'pure-focus-coding',
    title: 'Deep Focus & Zero CPU Flow',
    curator: 'Minimal Ambient Collective',
    badge: 'Lo-Fi Chill • Instrumental Only',
    coverGradient: 'from-emerald-700 via-teal-900 to-black',
    description: 'Hypnotic downtempo rhythms designed to keep your mind locked in the zone without distraction.',
    curatorNotes:
      'Zero jarring vocals, constant 110-125 BPM grooves, and warm sub-bass designed for late-night developers and creators.',
    searchQueries: ['Lofi Beats to Study', 'ChilledCow Instrumental', 'Tycho Awake', 'Bonobo Cirrus'],
  },
  {
    id: 'bollywood-sublime',
    title: 'Bollywood Sublime: Acoustic Sessions',
    curator: 'South Asian Editorial',
    badge: 'Mastered in Dolby Atmos',
    coverGradient: 'from-amber-600 via-orange-800 to-rose-950',
    description: 'Soul-stirring melodies, acoustic guitars, and legendary Hindi vocals.',
    curatorNotes:
      'Handpicked soulful masterpieces featuring Arijit Singh, Prateek Kuhad, and Jasleen Royal with ultra-warm tape saturation.',
    searchQueries: ['Kesariya Arijit', 'Kasoor Prateek Kuhad', 'Heeriye Jasleen', 'Kabira Arijit'],
  },
];

export const RadioEditorialView: React.FC<RadioEditorialViewProps> = ({
  onPlayStation,
  onPlayPlaylist,
}) => {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleStartStation = async (station: RadioStation) => {
    setLoadingId(station.id);
    const stationTracks: TrackMetadata[] = [];
    for (const query of station.searchQueries) {
      try {
        const results = await fetchCatalogSearch(query);
        if (results && results.length > 0) {
          stationTracks.push({
            id: results[0].id,
            title: results[0].title,
            artist: results[0].artist,
            album: results[0].album,
            duration: results[0].duration,
            artworkUrl: results[0].artworkUrl,
            streamUrl: results[0].streamUrl,
            sourceType: 'stream',
          });
        }
      } catch (_) {}
    }
    setLoadingId(null);
    if (stationTracks.length > 0) {
      onPlayStation(station.name, stationTracks);
    }
  };

  const handleStartEditorial = async (pl: EditorialPlaylist) => {
    setLoadingId(pl.id);
    const playlistTracks: TrackMetadata[] = [];
    for (const query of pl.searchQueries) {
      try {
        const results = await fetchCatalogSearch(query);
        if (results && results.length > 0) {
          playlistTracks.push({
            id: results[0].id,
            title: results[0].title,
            artist: results[0].artist,
            album: results[0].album,
            duration: results[0].duration,
            artworkUrl: results[0].artworkUrl,
            streamUrl: results[0].streamUrl,
            sourceType: 'stream',
          });
        }
      } catch (_) {}
    }
    setLoadingId(null);
    if (playlistTracks.length > 0) {
      onPlayPlaylist(pl.title, playlistTracks);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 space-y-10 animate-fade-in pb-32">
      {/* Hero Header */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-red-950/40 via-purple-950/30 to-black p-6 sm:p-10 border border-white/10 shadow-2xl">
        <div className="max-w-xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white font-mono text-xs uppercase tracking-widest backdrop-blur-md">
            <Radio className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
            24/7 Live Broadcast & Apple Editorial
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            Radio & Curated Sound
          </h1>
          <p className="text-sm text-zinc-300 leading-relaxed">
            Tune in to live stations hosted worldwide with seamless continuous AutoMix, or dive into deep human-curated editorial playlists mastered for lossless playback.
          </p>
        </div>
      </div>

      {/* 1. Live 24/7 Radio Stations */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              Live 24/7 Radio Stations
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping inline-block" />
            </h2>
            <p className="text-xs text-zinc-400">Streamed continuously with Apple DJ AutoMix</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {LIVE_STATIONS.map((station) => (
            <div
              key={station.id}
              className="group relative rounded-2xl overflow-hidden border border-white/10 bg-[#121217] shadow-xl hover:border-white/20 transition-all flex flex-col justify-between"
            >
              {/* Station Cover Banner */}
              <div
                className={`h-40 p-5 bg-gradient-to-br ${station.gradient} flex flex-col justify-between relative overflow-hidden`}
              >
                <div className="flex items-center justify-between z-10">
                  <span className="text-[10px] font-mono tracking-widest font-black uppercase px-2 py-0.5 rounded-full bg-black/40 text-white backdrop-blur-md border border-white/10">
                    {station.frequency}
                  </span>
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black uppercase tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    LIVE
                  </div>
                </div>

                <div className="z-10">
                  <h3 className="text-2xl font-black text-white leading-tight drop-shadow-md">
                    {station.name}
                  </h3>
                  <p className="text-xs text-white/90 font-medium drop-shadow-sm mt-0.5">
                    {station.host}
                  </p>
                </div>
              </div>

              {/* Station Details & Play */}
              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <div>
                  <div className="text-[11px] font-mono text-rose-400 uppercase tracking-wider font-bold mb-1">
                    On Air Now: {station.liveNow}
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">{station.tagline}</p>
                </div>

                <button
                  onClick={() => handleStartStation(station)}
                  disabled={loadingId === station.id}
                  className="w-full py-3 px-4 rounded-xl bg-white text-black hover:bg-zinc-200 font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg"
                >
                  {loadingId === station.id ? (
                    <>
                      <Sparkles className="w-4 h-4 animate-spin" />
                      Tuning In...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      Listen Live Station
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Apple Music Human-Curated Editorial Playlists */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            Apple Music Editorial Spotlights
            <Award className="w-4 h-4 text-amber-400" />
          </h2>
          <p className="text-xs text-zinc-400">Deep curator notes and certified lossless mastering badges</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {EDITORIAL_PLAYLISTS.map((pl) => (
            <div
              key={pl.id}
              className="p-6 rounded-2xl bg-[#121217] border border-white/10 hover:border-white/20 transition-all flex flex-col justify-between space-y-4 group"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      {pl.badge}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-white tracking-tight">{pl.title}</h3>
                  <p className="text-xs text-zinc-400">{pl.curator}</p>
                </div>

                <button
                  onClick={() => handleStartEditorial(pl)}
                  disabled={loadingId === pl.id}
                  className="w-12 h-12 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-950 transition-transform hover:scale-105 flex-shrink-0"
                >
                  <Play className="w-5 h-5 fill-current ml-0.5" />
                </button>
              </div>

              <p className="text-xs text-zinc-300 leading-relaxed">{pl.description}</p>

              {/* Curator Notes Box */}
              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-bold block">
                  Curator Note:
                </span>
                <p className="text-xs text-zinc-400 italic">“{pl.curatorNotes}”</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
