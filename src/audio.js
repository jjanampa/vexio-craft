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
    this.master = null;
    this.lastStep = 0;
  }

  resume() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(this.ctx.destination);
      const length = Math.floor(this.ctx.sampleRate * 0.5);
      this.noise = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
  }

  noiseBurst({ dur = 0.12, freq = 1000, q = 1, type = "bandpass", gain = 0.2, sweep = 0, attack = 0.006 }) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const source = this.ctx.createBufferSource();
    source.buffer = this.noise;
    source.playbackRate.value = 0.85 + Math.random() * 0.3;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, now);
    if (sweep) filter.frequency.exponentialRampToValueAtTime(Math.max(40, freq * sweep), now + dur);
    filter.Q.value = q;
    const envelope = this.ctx.createGain();
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.001, gain), now + attack);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(this.master);
    source.start(now);
    source.stop(now + dur + 0.03);
  }

  tone({ type = "square", from = 440, to = 220, dur = 0.15, gain = 0.08, delay = 0, vibrato = 0, vibratoRate = 0 }) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(from, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), now + dur);
    let node = osc;
    if (vibrato > 0) {
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = vibratoRate;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = vibrato;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfo.start(now);
      lfo.stop(now + dur + 0.05);
    }
    const envelope = this.ctx.createGain();
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.001, gain), now + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    node.connect(envelope);
    envelope.connect(this.master);
    osc.start(now);
    osc.stop(now + dur + 0.05);
  }

  play(kind, blockId) {
    if (!this.ctx) return;
    const def = BLOCKS[blockId];
    const profile = PROFILES[def?.sound] || PROFILES.stone;
    const dur = kind === "break" ? 0.16 : kind === "place" ? 0.11 : kind === "splash" ? 0.4 : 0.06;
    const peak = kind === "step" ? profile.gain * 0.38 : kind === "splash" ? 0.32 : profile.gain;
    this.noiseBurst({
      dur,
      freq: kind === "splash" ? 900 : profile.freq,
      q: profile.q,
      type: kind === "splash" ? "lowpass" : "bandpass",
      gain: peak,
    });
  }

  step(blockId) {
    const now = performance.now();
    if (now - this.lastStep < 330) return;
    this.lastStep = now;
    this.play("step", blockId);
  }

  click() {
    this.tone({ type: "square", from: 660, to: 330, dur: 0.1, gain: 0.06 });
  }

  jump() {
    this.noiseBurst({ dur: 0.08, freq: 700, q: 0.8, gain: 0.07 });
  }

  land(force = 1) {
    this.noiseBurst({ dur: 0.14, freq: 260, q: 0.9, type: "lowpass", gain: 0.16 * (0.5 + force * 0.5) });
    this.tone({ type: "triangle", from: 140, to: 60, dur: 0.12, gain: 0.07 * force });
  }

  whoosh() {
    this.noiseBurst({ dur: 0.18, freq: 480, q: 0.9, gain: 0.12, sweep: 3.2, attack: 0.02 });
  }

  hit() {
    this.noiseBurst({ dur: 0.1, freq: 500, q: 0.8, type: "lowpass", gain: 0.22 });
    this.tone({ type: "triangle", from: 180, to: 70, dur: 0.1, gain: 0.1 });
  }

  hurt() {
    this.tone({ type: "sawtooth", from: 340, to: 150, dur: 0.22, gain: 0.09 });
    this.noiseBurst({ dur: 0.18, freq: 800, q: 0.6, gain: 0.08 });
  }

  equip() {
    this.noiseBurst({ dur: 0.07, freq: 1400, q: 1.6, gain: 0.14 });
    this.noiseBurst({ dur: 0.1, freq: 900, q: 1.2, gain: 0.1 });
    this.tone({ type: "triangle", from: 420, to: 300, dur: 0.12, gain: 0.05, delay: 0.04 });
  }

  mob(kind) {
    if (kind === "zombie") {
      this.tone({ type: "sawtooth", from: 110, to: 70, dur: 0.7, gain: 0.1, vibrato: 14, vibratoRate: 5 });
      this.noiseBurst({ dur: 0.6, freq: 380, q: 0.7, type: "lowpass", gain: 0.07 });
    } else if (kind === "pig") {
      this.tone({ type: "sawtooth", from: 460, to: 300, dur: 0.18, gain: 0.07, vibrato: 40, vibratoRate: 22 });
      this.tone({ type: "sawtooth", from: 420, to: 260, dur: 0.14, gain: 0.06, delay: 0.18, vibrato: 40, vibratoRate: 24 });
    } else {
      this.tone({ type: "square", from: 320, to: 280, dur: 0.5, gain: 0.05, vibrato: 55, vibratoRate: 17 });
    }
  }

  mobHurt(kind) {
    this.noiseBurst({ dur: 0.12, freq: 600, q: 0.8, type: "lowpass", gain: 0.2 });
    const from = kind === "zombie" ? 160 : 420;
    this.tone({ type: "sawtooth", from, to: from * 0.6, dur: 0.18, gain: 0.08, vibrato: 25, vibratoRate: 20 });
  }

  mobDeath(kind) {
    this.mobHurt(kind);
    this.tone({ type: "triangle", from: 220, to: 50, dur: 0.45, gain: 0.1, delay: 0.05 });
  }
}
