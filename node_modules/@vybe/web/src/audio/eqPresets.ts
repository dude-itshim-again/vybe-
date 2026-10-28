export interface EQPreset {
  id: string;
  name: string;
  description: string;
  subBass: number; // 60Hz LowShelf (-12 to +15 dB)
  punch: number;   // 120Hz Punch Peaking (-12 to +12 dB)
  bands: [number, number, number, number, number]; // 125Hz, 500Hz, 1.5kHz, 4kHz, 10kHz
  accentColor: string;
}

export const FACTORY_EQ_PRESETS: EQPreset[] = [
  {
    id: 'flat',
    name: 'Flat',
    description: 'Studio Reference / Unaltered flat monitoring',
    subBass: 0.0,
    punch: 0.0,
    bands: [0.0, 0.0, 0.0, 0.0, 0.0],
    accentColor: '#94a3b8' // Slate
  },
  {
    id: 'subBassRattler',
    name: 'Sub-Bass Rattler',
    description: 'Heavy 808s, Trap & Dubstep deep foundation',
    subBass: 9.0,
    punch: 4.5,
    bands: [2.0, -1.5, -2.0, 1.0, 1.5],
    accentColor: '#a855f7' // Purple
  },
  {
    id: 'lateNightLoFi',
    name: 'Late Night Lo-Fi',
    description: 'Warm rolled-off highs, vinyl body & chill resonance',
    subBass: 5.0,
    punch: 3.0,
    bands: [2.0, 1.0, -2.5, -4.0, -7.5],
    accentColor: '#f59e0b' // Amber
  },
  {
    id: 'vocalClarity',
    name: 'Vocal Clarity',
    description: 'High-pass warmth, acoustic presence & speech intelligibility',
    subBass: -6.0,
    punch: -3.0,
    bands: [-2.0, -3.5, 3.5, 6.0, 2.5],
    accentColor: '#06b6d4' // Cyan
  },
  {
    id: 'vShapeArena',
    name: 'V-Shape Arena',
    description: 'Scooped mids, thunderous sub & sparkling brilliance',
    subBass: 8.0,
    punch: 4.0,
    bands: [-1.5, -4.0, -2.5, 3.5, 7.0],
    accentColor: '#ec4899' // Pink
  }
];
