// Harborlight — synthesized WebAudio sound. No audio files; everything is
// oscillators + filtered noise. M toggles mute.
const AudioSys = {
  ctx: null, muted: false, _engine: null, _engineGain: null, _siren: null,
  init() {
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { this.ctx = null; }
  },
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
  toggleMute() { this.muted = !this.muted; if (this._engineGain) this._engineGain.gain.value = this.muted ? 0 : 0.05; return this.muted; },
  _tone(freq, dur, type, vol, slideTo) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol || 0.15, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.ctx.destination);
    o.start(t); o.stop(t + dur);
  },
  _noise(dur, vol, freq) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq || 1200;
    const g = this.ctx.createGain(); g.gain.value = vol || 0.2;
    src.connect(f).connect(g).connect(this.ctx.destination);
    src.start(t);
  },
  shot() { this._noise(0.12, 0.35, 900); this._tone(160, 0.08, 'square', 0.12, 60); },
  shotgun() { this._noise(0.2, 0.4, 600); },
  chime() { this._tone(880, 0.12, 'sine', 0.15); setTimeout(() => this._tone(1318, 0.18, 'sine', 0.15), 90); },
  cash() { this._tone(1046, 0.1, 'triangle', 0.18); setTimeout(() => this._tone(1568, 0.16, 'triangle', 0.18), 80); },
  hurt() { this._tone(220, 0.15, 'sawtooth', 0.15, 110); },
  click() { this._tone(660, 0.05, 'square', 0.08); },
  busted() { this._tone(392, 0.3, 'sawtooth', 0.15, 196); setTimeout(() => this._tone(311, 0.5, 'sawtooth', 0.15, 155), 280); },
  explosion() { this._noise(0.6, 0.5, 400); this._tone(90, 0.5, 'sine', 0.3, 40); },
  engineStart(speedNorm) {
    if (!this.ctx || this.muted) return;
    if (!this._engine) {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = 'sawtooth'; o.frequency.value = 60;
      g.gain.value = 0.0; o.connect(g).connect(this.ctx.destination); o.start();
      this._engine = o; this._engineGain = g;
    }
    this._engine.frequency.value = 55 + speedNorm * 140;
    this._engineGain.gain.value = this.muted ? 0 : 0.03 + speedNorm * 0.04;
  },
  engineStop() { if (this._engineGain) this._engineGain.gain.value = 0; },
  siren(on) {
    if (!this.ctx) return;
    if (on && !this._siren) {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain(), lfo = this.ctx.createOscillator(), lg = this.ctx.createGain();
      o.type = 'triangle'; o.frequency.value = 800;
      lfo.type = 'square'; lfo.frequency.value = 0.8;
      lg.gain.value = 250; lfo.connect(lg); lg.connect(o.frequency);
      g.gain.value = this.muted ? 0 : 0.03;
      o.connect(g).connect(this.ctx.destination);
      o.start(); lfo.start();
      this._siren = { o, lfo, g };
    } else if (!on && this._siren) {
      try { this._siren.o.stop(); this._siren.lfo.stop(); } catch (e) {}
      this._siren = null;
    }
  },
};
