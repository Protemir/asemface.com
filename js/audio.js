import { store } from './util.js';

export const sound = { on: store.get('asem.sound', true), ctx: null, gain: null, o1: null, o2: null, filter: null };

export function audioInit() {
  if (sound.ctx) {
    if (sound.ctx.state === 'suspended') sound.ctx.resume();
    return;
  }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    const c = new AC();
    const o1 = c.createOscillator();
    const o2 = c.createOscillator();
    o1.type = 'sawtooth';
    o2.type = 'square';
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 520;
    const gain = c.createGain();
    gain.gain.value = 0;
    o1.connect(filter);
    o2.connect(filter);
    filter.connect(gain).connect(c.destination);
    o1.start();
    o2.start();
    Object.assign(sound, { ctx: c, gain, o1, o2, filter });
  } catch {
    sound.ctx = null;
  }
}

export function setSound(on) {
  sound.on = on;
  store.set('asem.sound', on);
  if (on) audioInit();
}

// pct: 0..1 of top speed, boost: nitro on
export function engine(pct, audible, boost, electric) {
  if (!sound.ctx) return;
  const now = sound.ctx.currentTime;
  const type = electric ? 'sine' : 'sawtooth';
  if (sound.o1.type !== type) {
    sound.o1.type = type;
    sound.o2.type = electric ? 'sine' : 'square';
  }
  if (electric) {
    // an electric motor whines instead of roaring
    const f = 160 + pct * 620 + (boost ? 120 : 0);
    sound.o1.frequency.setTargetAtTime(f, now, 0.05);
    sound.o2.frequency.setTargetAtTime(f * 1.5, now, 0.05);
    sound.filter.frequency.setTargetAtTime(2400, now, 0.1);
    sound.gain.gain.setTargetAtTime(sound.on && audible ? 0.012 + pct * 0.018 : 0, now, 0.1);
    return;
  }
  const gear = (pct * 4) % 1;
  const f = 42 + pct * 70 + gear * 38 + (boost ? 25 : 0);
  sound.o1.frequency.setTargetAtTime(f, now, 0.05);
  sound.o2.frequency.setTargetAtTime(f / 2, now, 0.05);
  sound.filter.frequency.setTargetAtTime(boost ? 900 : 520, now, 0.1);
  sound.gain.gain.setTargetAtTime(sound.on && audible ? 0.03 + pct * 0.035 : 0, now, 0.1);
}

export function beep(freq, dur, type = 'triangle', vol = 0.12) {
  if (!sound.on || !sound.ctx) return;
  const c = sound.ctx;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, c.currentTime);
  g.gain.exponentialRampToValueAtTime(vol, c.currentTime + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
  o.connect(g).connect(c.destination);
  o.start();
  o.stop(c.currentTime + dur + 0.02);
}

export function noise(dur, vol = 0.25, cutoff = 900) {
  if (!sound.on || !sound.ctx) return;
  const c = sound.ctx;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let n = 0; n < len; n++) data[n] = (Math.random() * 2 - 1) * (1 - n / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = cutoff;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(c.destination);
  src.start();
}

export function fanfare() {
  [523, 659, 784, 1047].forEach((f, k) => setTimeout(() => beep(f, 0.22), k * 120));
}

// a cartoon "a-a-a!": a wobbling voice that slides down
export function scream() {
  if (!sound.on || !sound.ctx) return;
  const c = sound.ctx;
  const t = c.currentTime;
  const o = c.createOscillator();
  o.type = 'sawtooth';
  const base = 520 + Math.random() * 380;
  o.frequency.setValueAtTime(base, t);
  o.frequency.exponentialRampToValueAtTime(base * 0.55, t + 0.6);
  const lfo = c.createOscillator();
  lfo.frequency.value = 9;
  const lfoGain = c.createGain();
  lfoGain.gain.value = 30;
  lfo.connect(lfoGain).connect(o.frequency);
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 1100;
  f.Q.value = 1.2;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.09, t + 0.04);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.65);
  o.connect(f).connect(g).connect(c.destination);
  o.start(t);
  lfo.start(t);
  o.stop(t + 0.7);
  lfo.stop(t + 0.7);
}

export function bonk(kind) {
  if (!sound.on || !sound.ctx) return;
  const c = sound.ctx;
  const t = c.currentTime;
  const glide = (type, f0, f1, dur, vol) => {
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  };
  if (kind === 'boing') {
    glide('sine', 220, 880, 0.35, 0.16);
    glide('square', 1300, 1700, 0.12, 0.03);
  } else if (kind === 'splat') {
    noise(0.25, 0.3, 700);
    glide('sine', 140, 60, 0.2, 0.25);
  } else if (kind === 'thud') {
    noise(0.18, 0.2, 500);
    glide('sine', 120, 50, 0.18, 0.2);
  } else {
    glide('square', 700, 350, 0.08, 0.06);
    noise(0.06, 0.12, 3000);
  }
}
