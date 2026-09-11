import { BLOCKS } from "./blocks.js";

const PROFILES = {
  stone: { freq: 1150, q: 1.2, gain: 0.3 },
  dirt: { freq: 640, q: 0.9, gain: 0.26 },
  grass: { freq: 880, q: 0.8, gain: 0.24 },
  wood: { freq: 980, q: 1.1, gain: 0.28 },
  sand: { freq: 760, q: 0.7, gain: 0.24 },
  glass: { freq: 2400, q: 2.2, gain: 0.24 },
  snow: { freq: 700, q: 0.8, gain: 0.22 },
  water: { freq: 560, q: 0.7, gain: 0.3 },
};

export class Sfx {
  constructor() {
    this.ctx = null;
    this.noise = null;
    this.lastStep = 0;
  }

  resume() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      const length = Math.floor(this.ctx.sampleRate * 0.5);
      this.noise = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
  }

  play(kind, blockId) {
    if (!this.ctx) return;
    const def = BLOCKS[blockId];
    const profile = PROFILES[def?.sound] || PROFILES.stone;
    const now = this.ctx.currentTime;
    const source = this.ctx.createBufferSource();
    source.buffer = this.noise;
    source.playbackRate.value = 0.85 + Math.random() * 0.3;
    const filter = this.ctx.createBiquadFilter();
    filter.type = kind === "splash" ? "lowpass" : "bandpass";
    filter.frequency.value = kind === "splash" ? 900 : profile.freq;
    filter.Q.value = profile.q;
    const gain = this.ctx.createGain();
    const dur = kind === "break" ? 0.16 : kind === "place" ? 0.11 : kind === "splash" ? 0.4 : 0.06;
    const peak =
      kind === "step" ? profile.gain * 0.38 : kind === "splash" ? 0.32 : profile.gain;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peak, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    source.start(now);
    source.stop(now + dur + 0.02);
  }

  step(blockId) {
    const now = performance.now();
    if (now - this.lastStep < 330) return;
    this.lastStep = now;
    this.play("step", blockId);
  }

  click() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = "square";
    osc.frequency.setValueAtTime(660, now);
    osc.frequency.exponentialRampToValueAtTime(330, now + 0.08);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  }
}
