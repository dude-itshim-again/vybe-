/**
 * Generates an offline synthesized 120BPM electronic beat with heavy 808 sub-bass,
 * punchy kick transients, crisp hi-hats, and warm synth chords.
 * Encoded to a playable audio/wav Blob URL for zero-dependency instant demo playback.
 */

export function generateDemoAudioBlob(): string {
  const sampleRate = 44100;
  const bpm = 120;
  const secondsPerBeat = 60 / bpm;
  const totalBars = 4;
  const totalBeats = totalBars * 4;
  const duration = totalBeats * secondsPerBeat; // 8.0 seconds
  const totalSamples = Math.floor(sampleRate * duration);

  const leftChannel = new Float32Array(totalSamples);
  const rightChannel = new Float32Array(totalSamples);

  // Helper to trigger a Kick / 808 hit
  const triggerKick808 = (startBeat: number, isSubHeavy: boolean) => {
    const startSample = Math.floor(startBeat * secondsPerBeat * sampleRate);
    const hitDuration = isSubHeavy ? 0.75 : 0.35;
    const hitSamples = Math.min(totalSamples - startSample, Math.floor(hitDuration * sampleRate));

    for (let i = 0; i < hitSamples; i++) {
      const t = i / sampleRate;
      // Exponential pitch drop from 160Hz down to 48Hz (deep sub-bass)
      const freq = 48 + 112 * Math.exp(-t * 22);
      const phase = 2 * Math.PI * freq * t;
      const amp = Math.exp(-t * (isSubHeavy ? 3.5 : 8.0));
      const val = Math.sin(phase) * amp * (isSubHeavy ? 0.95 : 0.85);

      leftChannel[startSample + i] += val;
      rightChannel[startSample + i] += val;
    }
  };

  // Helper to trigger a Snare hit
  const triggerSnare = (startBeat: number) => {
    const startSample = Math.floor(startBeat * secondsPerBeat * sampleRate);
    const hitDuration = 0.22;
    const hitSamples = Math.min(totalSamples - startSample, Math.floor(hitDuration * sampleRate));

    for (let i = 0; i < hitSamples; i++) {
      const t = i / sampleRate;
      const noise = (Math.random() * 2 - 1) * Math.exp(-t * 18);
      const tone = Math.sin(2 * Math.PI * 185 * t) * Math.exp(-t * 24) * 0.4;
      const val = (noise * 0.4 + tone) * 0.7;

      leftChannel[startSample + i] += val;
      rightChannel[startSample + i] += val;
    }
  };

  // Helper to trigger Hi-Hat
  const triggerHat = (startBeat: number, open = false) => {
    const startSample = Math.floor(startBeat * secondsPerBeat * sampleRate);
    const hitDuration = open ? 0.15 : 0.04;
    const hitSamples = Math.min(totalSamples - startSample, Math.floor(hitDuration * sampleRate));

    for (let i = 0; i < hitSamples; i++) {
      const t = i / sampleRate;
      const noise = (Math.random() * 2 - 1) * Math.exp(-t * (open ? 25 : 90));
      const val = noise * (open ? 0.25 : 0.16);

      leftChannel[startSample + i] += val * 0.8;
      rightChannel[startSample + i] += val * 1.2;
    }
  };

  // Helper for synth chord stabs
  const triggerSynthChord = (startBeat: number, chordFreqs: number[], durationBeats = 1.0) => {
    const startSample = Math.floor(startBeat * secondsPerBeat * sampleRate);
    const hitDuration = durationBeats * secondsPerBeat;
    const hitSamples = Math.min(totalSamples - startSample, Math.floor(hitDuration * sampleRate));

    for (let i = 0; i < hitSamples; i++) {
      const t = i / sampleRate;
      const env = Math.min(t * 20, 1.0) * Math.exp(-t * 1.8);
      let chordVal = 0;
      for (const f of chordFreqs) {
        chordVal += (Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(4 * Math.PI * f * t)) * 0.15;
      }
      leftChannel[startSample + i] += chordVal * env;
      rightChannel[startSample + i] += chordVal * env;
    }
  };

  // Assemble pattern across 4 bars (16 beats)
  // Chord progressions (F minor vibe: Fm9, Dbmaj7, Bbm7, C7alt)
  const chords = [
    [174.61, 261.63, 311.13, 392.00], // F3, C4, Eb4, G4
    [138.59, 207.65, 261.63, 329.63], // Db3, Ab3, C4, E4
    [116.54, 174.61, 233.08, 277.18], // Bb2, F3, Bb3, Db4
    [130.81, 196.00, 246.94, 311.13], // C3, G3, B3, Eb4
  ];

  for (let bar = 0; bar < totalBars; bar++) {
    const barStart = bar * 4;
    // Chords on beat 1 and beat 3
    triggerSynthChord(barStart, chords[bar], 1.8);
    triggerSynthChord(barStart + 2.5, chords[bar], 1.2);

    // Kicks & 808s
    triggerKick808(barStart + 0.0, true);
    triggerKick808(barStart + 1.5, false);
    triggerKick808(barStart + 2.5, true);
    triggerKick808(barStart + 3.25, false);

    // Snares on beat 2 and 4
    triggerSnare(barStart + 1.0);
    triggerSnare(barStart + 3.0);

    // 8th-note Hi-Hats
    for (let step = 0; step < 8; step++) {
      triggerHat(barStart + step * 0.5, step === 6);
    }
  }

  // Master Soft Limiter / Normalization
  let peak = 0;
  for (let i = 0; i < totalSamples; i++) {
    peak = Math.max(peak, Math.abs(leftChannel[i]), Math.abs(rightChannel[i]));
  }
  const normGain = peak > 0 ? 0.92 / peak : 1.0;

  // Encode 16-bit PCM WAV
  const wavBuffer = new ArrayBuffer(44 + totalSamples * 4);
  const view = new DataView(wavBuffer);

  // RIFF Chunk
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + totalSamples * 4, true);
  writeString(view, 8, 'WAVE');

  // fmt Chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // Linear PCM
  view.setUint16(22, 2, true); // Stereo (2 channels)
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 4, true); // Byte rate
  view.setUint16(32, 4, true); // Block align
  view.setUint16(34, 16, true); // Bits per sample

  // data Chunk
  writeString(view, 36, 'data');
  view.setUint32(40, totalSamples * 4, true);

  let offset = 44;
  for (let i = 0; i < totalSamples; i++) {
    const leftSample = Math.max(-1, Math.min(1, leftChannel[i] * normGain));
    const rightSample = Math.max(-1, Math.min(1, rightChannel[i] * normGain));

    view.setInt16(offset, leftSample < 0 ? leftSample * 0x8000 : leftSample * 0x7fff, true);
    view.setInt16(offset + 2, rightSample < 0 ? rightSample * 0x8000 : rightSample * 0x7fff, true);
    offset += 4;
  }

  const blob = new Blob([wavBuffer], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
}

/**
 * Generates a secondary 120BPM track (Neon Sunset Arp in D minor)
 * for testing instant Dual-Deck AutoMix transitions without needing to drop local files.
 */
export function generateDemoAudioBlob2(): string {
  const sampleRate = 44100;
  const bpm = 120;
  const secondsPerBeat = 60 / bpm;
  const totalBars = 4;
  const totalBeats = totalBars * 4;
  const duration = totalBeats * secondsPerBeat;
  const totalSamples = Math.floor(sampleRate * duration);

  const leftChannel = new Float32Array(totalSamples);
  const rightChannel = new Float32Array(totalSamples);

  // Arpeggiator notes (Dm, F, Bb, C)
  const arpNotes = [
    [293.66, 349.23, 440.0, 587.33], // D4, F4, A4, D5
    [349.23, 440.0, 523.25, 698.46], // F4, A4, C5, F5
    [233.08, 293.66, 349.23, 466.16], // Bb3, D4, F4, Bb4
    [261.63, 329.63, 392.0, 523.25], // C4, E4, G4, C5
  ];

  for (let bar = 0; bar < totalBars; bar++) {
    const barStart = bar * 4;
    const notes = arpNotes[bar];

    // 16th-note fast synth arp
    for (let step = 0; step < 16; step++) {
      const beat = barStart + step * 0.25;
      const startSample = Math.floor(beat * secondsPerBeat * sampleRate);
      const hitDuration = 0.18;
      const hitSamples = Math.min(totalSamples - startSample, Math.floor(hitDuration * sampleRate));
      const noteFreq = notes[step % notes.length];

      for (let i = 0; i < hitSamples; i++) {
        const t = i / sampleRate;
        const env = Math.exp(-t * 14);
        const saw = (2 * ((t * noteFreq) % 1) - 1) * 0.22;
        const sub = Math.sin(2 * Math.PI * (noteFreq / 2) * t) * 0.15;
        const val = (saw + sub) * env;

        leftChannel[startSample + i] += val * (step % 2 === 0 ? 0.7 : 1.1);
        rightChannel[startSample + i] += val * (step % 2 === 0 ? 1.1 : 0.7);
      }
    }

    // Heavy four-on-the-floor kick
    for (let beat = 0; beat < 4; beat++) {
      const startSample = Math.floor((barStart + beat) * secondsPerBeat * sampleRate);
      const hitDuration = 0.4;
      const hitSamples = Math.min(totalSamples - startSample, Math.floor(hitDuration * sampleRate));

      for (let i = 0; i < hitSamples; i++) {
        const t = i / sampleRate;
        const freq = 55 + 130 * Math.exp(-t * 26);
        const phase = 2 * Math.PI * freq * t;
        const amp = Math.exp(-t * 5.5);
        const val = Math.sin(phase) * amp * 0.95;

        leftChannel[startSample + i] += val;
        rightChannel[startSample + i] += val;
      }
    }
  }

  // Master Normalize
  let peak = 0;
  for (let i = 0; i < totalSamples; i++) {
    peak = Math.max(peak, Math.abs(leftChannel[i]), Math.abs(rightChannel[i]));
  }
  const normGain = peak > 0 ? 0.92 / peak : 1.0;

  const wavBuffer = new ArrayBuffer(44 + totalSamples * 4);
  const view = new DataView(wavBuffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + totalSamples * 4, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 2, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 4, true);
  view.setUint16(32, 4, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, totalSamples * 4, true);

  let offset = 44;
  for (let i = 0; i < totalSamples; i++) {
    const leftSample = Math.max(-1, Math.min(1, leftChannel[i] * normGain));
    const rightSample = Math.max(-1, Math.min(1, rightChannel[i] * normGain));
    view.setInt16(offset, leftSample < 0 ? leftSample * 0x8000 : leftSample * 0x7fff, true);
    view.setInt16(offset + 2, rightSample < 0 ? rightSample * 0x8000 : rightSample * 0x7fff, true);
    offset += 4;
  }

  const blob = new Blob([wavBuffer], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
}

function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

