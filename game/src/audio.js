// All sound is synthesized with WebAudio: no audio files, no network.
// Everything guards on the context existing, so the game runs silent
// (and screenshotted) before the player's first gesture.
export class SoundBank {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.musicTimer = 0;
    this.musicStep = 0;
    this.engineOsc = null;
    this.engineGain = null;
  }

  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      const g = this.ctx.createGain();
      g.gain.value = 0.5;
      g.connect(this.ctx.destination);
      this.master = g;
      // Engine hum: a low sawtooth whose pitch follows speed.
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 50;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 320;
      this.engineOsc.connect(lp); lp.connect(this.engineGain); this.engineGain.connect(g);
      this.engineOsc.start();
    } catch (e) { this.ctx = null; }
  }

  toggleMute() { this.muted = !this.muted; if (this.master) this.master.gain.value = this.muted ? 0 : 0.5; return this.muted; }

  setEngine(speed01, on) {
    if (!this.ctx || !this.engineOsc) return;
    const t = this.ctx.currentTime;
    this.engineOsc.frequency.setTargetAtTime(46 + speed01 * 130, t, 0.08);
    this.engineGain.gain.setTargetAtTime(on ? 0.05 + speed01 * 0.05 : 0, t, 0.1);
  }

  blip(freq, dur, type, vol) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = type || 'square';
    o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol || 0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  noise(dur, vol, lowpass) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = vol || 0.2;
    if (lowpass) {
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = lowpass;
      src.connect(f); f.connect(g); g.connect(this.master);
    } else { src.connect(g); g.connect(this.master); }
    src.start(t);
  }

  shot() { this.noise(0.12, 0.25, 1800); this.blip(160, 0.08, 'square', 0.1); }
  punch() { this.noise(0.08, 0.18, 900); }
  pickup() { this.blip(660, 0.09, 'sine', 0.14); setTimeout(() => this.blip(990, 0.12, 'sine', 0.14), 80); }
  crash() { this.noise(0.3, 0.3, 700); }
  sirenTick(on) { if (on) this.blip(880, 0.18, 'sine', 0.045); else this.blip(659, 0.18, 'sine', 0.045); }
  denied() { this.blip(180, 0.15, 'square', 0.12); }
  // Mission-complete jingle: four rising notes.
  jingle() {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.blip(f, 0.16, 'triangle', 0.16), i * 110));
  }
  // Tiny bass-and-hats loop, stepped from the game update.
  music(dt) {
    if (!this.ctx || this.muted) return;
    this.musicTimer += dt;
    if (this.musicTimer < 0.21) return;
    this.musicTimer -= 0.21;
    this.musicStep = (this.musicStep + 1) % 16;
    const bass = [55, 0, 55, 0, 65.4, 0, 49, 0, 55, 0, 55, 0, 73.4, 0, 65.4, 0];
    const n = bass[this.musicStep];
    if (n) this.blip(n, 0.18, 'triangle', 0.09);
    if (this.musicStep % 2 === 0) this.noise(0.03, 0.03, 6000);
  }
}
