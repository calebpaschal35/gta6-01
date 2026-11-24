// Five story jobs for Marta Solis. Timer only counts while a job is running
// and only after its missionStarted flag is set — never from 0 after job 1.
import { MISSIONS } from './config.js';
import { dist } from './rng.js';

export class Missions {
  constructor() {
    this.index = 0; // next mission to start (0-based)
    this.active = null; // { def, step, timeLeft, missionStarted, ... }
    this.completed = 0;
  }
  currentDef() { return MISSIONS[this.index] || null; }
  start(world) {
    const def = this.currentDef();
    if (!def || this.active) return false;
    this.active = { def, step: 0, timeLeft: def.time != null ? def.time : null, missionStarted: true, data: {} };
    world.addObjective(def.brief);
    world.audio.pickup();
    return true;
  }
  abort() { this.active = null; }
  stepText() {
    if (!this.active) return '';
    if (this.active.def.id === 4) {
      const n = this.active.data.wrecked || 0;
      return `Wreck Redline cars (${n}/3)`;
    }
    return this.active.def.steps[Math.min(this.active.step, this.active.def.steps.length - 1)];
  }
  // Returns the current waypoint {x,y,label} or null.
  waypoint(world) {
    if (!this.active) return null;
    const L = world.city.landmarks;
    const d = this.active.def;
    switch (d.id) {
      case 1: return this.active.step === 0 ? { ...L.garage, label: 'Garage' } : this.active.step === 1 ? { ...L.garage, label: 'The Coupe' } : { ...L.marta, label: "Marta's Corner" };
      case 2: return this.active.step === 0 ? { ...L.garage, label: 'Package' } : { ...L.docksWarehouse, label: 'Docks Warehouse' };
      case 3: return null;
      case 4: return { x: 1600, y: 500, label: 'Old Town' };
      case 5: return this.active.step === 0 ? { ...L.bank, label: 'Bank' } : this.active.step === 1 ? { ...L.bank, label: 'Bank' } : { ...L.boat, label: 'Marina Boat' };
      default: return null;
    }
  }
  update(dt, world) {
    if (!this.active) return;
    const a = this.active;
    // Timer is gated: only while the mission is running and started.
    // Mission 3 (Shake the Tail) is a survival timer: hitting 0 means success.
    if (a.timeLeft != null && a.missionStarted) {
      a.timeLeft -= dt;
      if (a.timeLeft <= 0) {
        if (a.def.id === 3) { this.complete(world); return; }
        this.fail(world, 'Out of time'); return;
      }
    }
    const p = world.player;
    const px = p.inCar ? p.car.x : p.x, py = p.inCar ? p.car.y : p.y;
    const wp = this.waypoint(world);
    const d = a.def;
    if (d.id === 1) {
      if (a.step === 0 && wp && dist(px, py, wp.x, wp.y) < 90) { a.step = 1; world.addObjective('Steal the red Riverside Coupe'); }
      else if (a.step === 1 && p.inCar && p.car && p.car.model.name === 'Riverside Coupe') { a.step = 2; world.addObjective('Deliver the coupe to Marta'); }
      else if (a.step === 2 && wp && dist(px, py, wp.x, wp.y) < 90) this.complete(world);
    } else if (d.id === 2) {
      if (a.step === 0 && wp && dist(px, py, wp.x, wp.y) < 90) { a.step = 1; world.addObjective('Drive to the Docks warehouse'); }
      else if (a.step === 1 && wp && dist(px, py, wp.x, wp.y) < 90) this.complete(world);
    } else if (d.id === 3) {
      // Survive: timer handles it; if wanted drops to 0 early, still counts down.
      if (a.timeLeft != null && a.timeLeft <= 0) this.complete(world);
    } else if (d.id === 4) {
      const n = a.data.wrecked || 0;
      a.data.wrecked = n;
      if (n >= 3) this.complete(world);
    } else if (d.id === 5) {
      if (a.step === 0 && wp && dist(px, py, wp.x, wp.y) < 90) { a.step = 1; world.addObjective('Grab the cash inside'); world.audio.cash(); }
      else if (a.step === 1 && wp && dist(px, py, wp.x, wp.y) < 60) { a.step = 2; world.addObjective('Reach the boat at Palm Beach'); }
      else if (a.step === 2 && wp && dist(px, py, wp.x, wp.y) < 110) this.complete(world);
    }
  }
  onGangCarWrecked(world) {
    if (!this.active || this.active.def.id !== 4) return;
    this.active.data.wrecked = (this.active.data.wrecked || 0) + 1;
    world.addObjective(`Wreck Redline cars (${this.active.data.wrecked}/3)`);
  }
  complete(world) {
    const a = this.active;
    if (!a) return;
    world.player.cash += a.def.payout;
    world.audio.cash();
    world.particles.cash(world.player.x, world.player.y);
    world.addObjective(`Job complete: ${a.def.name} — $${a.def.payout}`);
    this.completed += 1;
    this.index += 1;
    this.active = null;
    world.saveGame();
  }
  fail(world, why) {
    if (!this.active) return;
    world.addObjective(`Job failed: ${why}`);
    world.audio.busted();
    this.active = null;
  }
}
