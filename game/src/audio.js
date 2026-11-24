// WebAudio synthesized sound — no audio files. Engine hum, shots, sirens, chimes.
export class AudioSys {
  constructor() {
    this.ctx = null; this.muted = false;
    this.engineOsc = null; this.engineGain = null; this.engineFilter = null;
    this.sirenOsc = null; this.sirenGain = null; this.sirenOn = false;
  }
  ensure() {
    if (!this.ctx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC();
        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc.type = 'sawtooth';
        this.engineOsc.frequency.value = 50;
        this.engineFilter = this.ctx.createBiquadFilter();
        this.engineFilter.type = 'lowpass';
        this.engineFilter.frequency.value = 320;
        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0;
        this.engineOsc.connect(this.engineFilter).connect(this.engineGain).connect(this.ctx.destination);
        this.engineOsc.start();
        this.sirenOsc = this.ctx.createOscillator();
        this.sirenOsc.type = 'sine';
        this.sirenOsc.frequency.value = 750;
        this.sirenGain = this.ctx.createGain();
        this.sirenGain.gain.value = 0;
        this.sirenOsc.connect(this.sirenGain).connect(this.ctx.destination);
        this.sirenOsc.start();
        this._sirenT = 0;
      } catch (e) { this.ctx = null; }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }
  setMuted(m) {
    this.muted = m;
    if (this.ctx) {
      if (this.engineGain) this.engineGain.gain.value = m ? 0 : this._engineLevel;
      if (this.sirenGain) this.sirenGain.gain.value = m || !this.sirenOn ? 0 : 0.05;
    }
  }
  setEngine(speed01, on) {
    if (!this.ctx || !this.engineOsc) return;
    this._engineLevel = on ? 0.03 + speed01 * 0.05 : 0;
    if (!this.muted) this.engineGain.gain.value = this._engineLevel;
    this.engineOsc.frequency.value = 46 + speed01 * 130;
  }
  setSiren(on) {
    this.sirenOn = on;
    if (!this.ctx || !this.sirenGain) return;
    this.sirenGain.gain.value = (on && !this.muted) ? 0.05 : 0;
  }
  update(dt) {
    if (!this.ctx || !this.sirenOsc) return;
    if (this.sirenOn) {
      this._sirenT += dt;
      this.sirenOsc.frequency.value = 700 + Math.sin(this._sirenT * 5) * 220;
    }
  }
  _burst(dur, freq, type, vol) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.ctx.destination);
    o.start(t); o.stop(t + dur);
  }
  shot() { this._burst(0.09, 180, 'square', 0.16); }
  punch() { this._burst(0.07, 120, 'triangle', 0.14); }
  crash() { this._burst(0.25, 70, 'sawtooth', 0.2); }
  pickup() { this._burst(0.12, 880, 'sine', 0.12); this._burst(0.18, 1320, 'sine', 0.08); }
  cash() { this._burst(0.1, 660, 'sine', 0.12); this._burst(0.14, 990, 'sine', 0.1); }
  busted() { this._burst(0.5, 220, 'sawtooth', 0.16); }
}
