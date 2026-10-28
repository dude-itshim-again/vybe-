import { LyricTrack, parseLrc } from './lrcParser';

export const HIGH_ENERGY_DEMO_LRC = `[ti:Vybe Kinetic Resonance]
[ar:Vybe Audio System]
[al:Kinetic Motion Vol. 1]
[00:00.50] <00:00.50> Deep <00:00.85> sub-bass <00:01.20> drops <00:01.55> through <00:01.80> the <00:02.05> neon <00:02.35> grid
[00:03.00] <00:03.00> Sixty <00:03.35> frames <00:03.70> kinetic <00:04.05> energy <00:04.45> in <00:04.70> your <00:05.00> veins
[00:06.00] <00:06.00> Neon <00:06.35> shadows <00:06.70> moving <00:07.05> across <00:07.35> the <00:07.65> midnight <00:08.00> floor
[00:09.00] <00:09.00> Feel <00:09.30> the <00:09.55> resonance <00:10.00> take <00:10.35> absolute <00:10.80> control
[00:12.00] <00:12.00> Fast <00:12.20> cadence <00:12.45> rapid <00:12.70> fire <00:12.95> words <00:13.20> slamming <00:13.45> on <00:13.70> the <00:14.00> beat
[00:15.00] <00:15.00> Glowing <00:15.30> ambient <00:15.55> edges <00:15.90> pulsing <00:16.25> vibrant <00:16.70> colors <00:17.15> bright
[00:18.00] <00:18.00> Crystal <00:18.35> words <00:18.65> rising <00:19.00> gold <00:19.30> through <00:19.55> the <00:19.85> dark <00:20.30> night
[00:21.50] <00:21.50> When <00:21.80> the <00:22.05> bass <00:22.40> kicks <00:22.75> everything <00:23.20> starts <00:23.60> to <00:24.00> ignite
[00:25.50] <00:25.50> Strobe <00:25.80> flashes <00:26.15> black <00:26.45> and <00:26.70> white <00:27.05> letters <00:27.40> break <00:27.80> through
[00:29.00] <00:29.00> Editorial <00:29.40> spring <00:29.75> pop <00:30.10> stars <00:30.40> flipping <00:30.80> on <00:31.10> cue
[00:32.50] <00:32.50> Never <00:32.80> stop <00:33.10> moving <00:33.50> till <00:33.80> the <00:34.10> morning <00:34.50> comes <00:35.00> alive
`;

/**
 * Returns the default 808 Cyberpunk demo lyrics track
 */
export function getDemoLyricsTrack(): LyricTrack {
  return parseLrc(HIGH_ENERGY_DEMO_LRC, {
    trackId: 'demo-vybe-kinetic',
    title: '808 Cyberpunk Groove',
    artist: 'Vybe Synthesizer',
    duration: 36.0,
    source: 'lrclib_synced',
  });
}

