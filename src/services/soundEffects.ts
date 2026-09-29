// Audio Synthesizer for Lampshade Pull-Cord Switch using Web Audio API
// High-fidelity, smooth, beautiful tactile clicks and gentle harmonic chimes.

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Plays a beautiful, satisfying, smooth mechanical-acoustic switch sound when the cord is pulled & dropped.
 * Features a crisp tactile switch click paired with a warm, gentle harmonic chime.
 * @param isTurningLight - true for daylight (bright pleasant chime), false for night view (soft cozy ambient chime)
 */
export function playLampSwitchSound(isTurningLight: boolean = true) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // 1. Crisp, smooth mechanical latch (tactile switch contact)
    playSmoothTactileClick(ctx, now, isTurningLight ? 2400 : 1800, 0.022, 0.28);
    playSmoothTactileClick(ctx, now + 0.024, isTurningLight ? 3200 : 2200, 0.035, 0.35);

    // 2. Warm acoustic harmonic chime (beautiful, gentle, delightful decay)
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.001, now);
    masterGain.gain.linearRampToValueAtTime(0.12, now + 0.03);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, now + (isTurningLight ? 0.48 : 0.55));
    masterGain.connect(ctx.destination);

    // Frequencies: Light mode gets a sparkling warm major chime (E5 & B5 / G#5)
    // Dark/Night mode gets a deep, soothing cozy twilight chord (A4 & E5)
    const chord = isTurningLight ? [659.25, 987.77, 1318.51] : [440.0, 659.25, 880.0];

    chord.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + 0.015);

      // Micro vibrato / natural warm resonance
      const oscVolume = idx === 0 ? 0.6 : idx === 1 ? 0.4 : 0.25;
      oscGain.gain.setValueAtTime(oscVolume, now + 0.015);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + (isTurningLight ? 0.42 : 0.5));

      osc.connect(oscGain);
      oscGain.connect(masterGain);

      osc.start(now + 0.015);
      osc.stop(now + 0.55);
    });

    // 3. Delicate metallic bead clink at the end of the drop
    playDelicateBeadClick(ctx, now + 0.05, 3800, 0.04);

    // Haptic feedback for mobile devices (soft, polite vibration)
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([8, 16, 12]);
      } catch {
        // ignore
      }
    }
  } catch (err) {
    console.warn('Audio playback not supported or blocked:', err);
  }
}

/**
 * Gentle, pleasing tactile tick as the user pulls/drags the chain
 */
export function playChainTensionSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    playDelicateBeadClick(ctx, now, 2200, 0.07);
  } catch {
    // ignore
  }
}

/**
 * Soft spring recoil sound when user releases/drops before reaching the toggle threshold
 */
export function playChainReleaseSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    playDelicateBeadClick(ctx, now, 1900, 0.05);
    playDelicateBeadClick(ctx, now + 0.035, 2400, 0.04);
  } catch {
    // ignore
  }
}

/**
 * Synthesizes a soft, smooth mechanical click using filtered micro-envelope
 */
function playSmoothTactileClick(
  ctx: AudioContext,
  startTime: number,
  freq: number,
  duration: number,
  volume: number
) {
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(freq, startTime);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.35, startTime + duration);

  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(freq, startTime);
  filter.Q.setValueAtTime(2.0, startTime);

  gain.gain.setValueAtTime(0.001, startTime);
  gain.gain.linearRampToValueAtTime(volume, startTime + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  osc.start(startTime);
  osc.stop(startTime + duration);
}

/**
 * Synthesizes a soft, delicate wooden/brass bead tick
 */
function playDelicateBeadClick(
  ctx: AudioContext,
  startTime: number,
  freq: number,
  volume: number
) {
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, startTime);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.6, startTime + 0.018);

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(freq * 1.5, startTime);

  gain.gain.setValueAtTime(volume, startTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.02);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  osc.start(startTime);
  osc.stop(startTime + 0.022);
}
