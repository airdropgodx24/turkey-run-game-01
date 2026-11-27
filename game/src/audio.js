// All sound is synthesised with WebAudio: no audio files, nothing to load. The context is
// created on the first user gesture (browsers refuse earlier), and every effect is a small
// oscillator or noise burst shaped by an envelope. Mute is one gain node.

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
  }

  /** Create the audio context. Safe to call repeatedly; only the first call builds it. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;
    this.ctx = new AudioCtor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(this.ctx.destination);
  }

  /** Flip the mute switch and return the new state. */
  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }

  /** One oscillator note with a pitch glide and a soft attack/decay envelope. */
  tone({ type = 'sine', from = 440, to = null, seconds = 0.15, volume = 0.3, delay = 0 }) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t0);
    if (to !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + seconds);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(volume, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + seconds);
    osc.connect(gain).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + seconds + 0.05);
  }

  /** One burst of filtered noise (thuds, rustles, whooshes). */
  noise({ seconds = 0.15, volume = 0.3, delay = 0, lowpass = 1200 }) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const frames = Math.max(1, Math.floor(this.ctx.sampleRate * seconds));
    const buffer = this.ctx.createBuffer(1, frames, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i += 1) data[i] = Math.random() * 2 - 1;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + seconds);
    source.connect(filter).connect(gain).connect(this.master);
    source.start(t0);
  }

  /** The turkey's signature: two quick descending chirps. */
  gobble() {
    this.tone({ type: 'square', from: 620, to: 380, seconds: 0.07, volume: 0.12 });
    this.tone({ type: 'square', from: 560, to: 340, seconds: 0.08, volume: 0.12, delay: 0.07 });
  }

  /** A springy hop. */
  jump() {
    this.tone({ type: 'sine', from: 300, to: 640, seconds: 0.14, volume: 0.18 });
  }

  /** Soft landing. */
  land() {
    this.noise({ seconds: 0.06, volume: 0.12, lowpass: 700 });
  }

  /** Corn pickup chime. */
  corn() {
    this.tone({ type: 'triangle', from: 880, seconds: 0.09, volume: 0.2 });
    this.tone({ type: 'triangle', from: 1320, seconds: 0.12, volume: 0.16, delay: 0.06 });
  }

  /** Hitting a hazard. */
  thud() {
    this.noise({ seconds: 0.18, volume: 0.35, lowpass: 500 });
    this.tone({ type: 'sine', from: 160, to: 60, seconds: 0.2, volume: 0.3 });
  }

  /** The dog announces itself. */
  bark() {
    this.tone({ type: 'sawtooth', from: 420, to: 240, seconds: 0.08, volume: 0.16 });
    this.tone({ type: 'sawtooth', from: 460, to: 260, seconds: 0.08, volume: 0.16, delay: 0.11 });
  }

  /** A carving knife slicing down. */
  knifeWhoosh() {
    this.noise({ seconds: 0.16, volume: 0.2, lowpass: 3200 });
  }

  /** Diving into a hay bale. */
  rustle() {
    this.noise({ seconds: 0.22, volume: 0.22, lowpass: 900 });
  }

  /** The farmer shouts when he nearly has you. */
  farmerShout() {
    this.tone({ type: 'sawtooth', from: 240, to: 180, seconds: 0.16, volume: 0.18 });
    this.tone({ type: 'sawtooth', from: 300, to: 210, seconds: 0.14, volume: 0.16, delay: 0.17 });
  }

  /** A little fanfare on entering a new stage. */
  stageFanfare() {
    const notes = [523, 659, 784];
    notes.forEach((freq, i) => this.tone({ type: 'triangle', from: freq, seconds: 0.14, volume: 0.2, delay: i * 0.09 }));
  }

  /** Freedom! A rising run of notes. */
  escapedJingle() {
    const notes = [523, 659, 784, 1047, 784, 1047, 1319];
    notes.forEach((freq, i) => this.tone({ type: 'triangle', from: freq, seconds: 0.16, volume: 0.22, delay: i * 0.11 }));
  }

  /** Caught: a sad descending slide. */
  caughtSting() {
    this.tone({ type: 'sawtooth', from: 392, to: 392, seconds: 0.14, volume: 0.18 });
    this.tone({ type: 'sawtooth', from: 330, to: 330, seconds: 0.14, volume: 0.18, delay: 0.15 });
    this.tone({ type: 'sawtooth', from: 262, to: 196, seconds: 0.34, volume: 0.2, delay: 0.3 });
  }

  /** Menu click. */
  click() {
    this.tone({ type: 'triangle', from: 700, to: 900, seconds: 0.06, volume: 0.15 });
  }
}
