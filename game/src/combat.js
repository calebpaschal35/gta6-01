// Combat: fists, pistol and SMG, bullets, muzzle flash and particles.
// Bullets are plain projectiles; the game decides what they hit.
import { clamp } from './rng.js';

export const WEAPONS = {
  fists: { name: 'Fists', range: 42, rate: 0.45, damage: 12, mag: Infinity, auto: false, spread: 0 },
  pistol: { name: 'Pistol', range: 520, rate: 0.28, damage: 34, mag: 12, auto: false, spread: 0.03 },
  smg: { name: 'SMG', range: 460, rate: 0.09, damage: 18, mag: 30, auto: true, spread: 0.09 },
};

export class Arsenal {
  constructor() {
    this.owned = ['fists', 'pistol'];
    this.current = 'pistol';
    this.ammo = { pistol: 12, smg: 30 };
    this.cool = 0;
    this.reloadT = 0;
  }

  weapon() { return WEAPONS[this.current]; }

  switchTo(name) {
    if (this.owned.includes(name)) { this.current = name; this.reloadT = 0; return true; }
    return false;
  }

  // Returns a bullet object when a shot is fired, else null.
  tryFire(x, y, angle, dt, holding) {
    this.cool -= dt;
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) this.ammo[this.current] = WEAPONS[this.current].mag;
      return null;
    }
    const w = this.weapon();
    if (this.current === 'fists') {
      if (holding && this.cool <= 0) {
        this.cool = w.rate;
        return { melee: true, x, y, angle, range: w.range, damage: w.damage };
      }
      return null;
    }
    if (this.ammo[this.current] <= 0) { this.reloadT = 1.1; return null; }
    if (!holding || this.cool > 0) return null;
    this.cool = w.rate;
    this.ammo[this.current] -= 1;
    const spread = (Math.random() - 0.5) * w.spread * 2;
    return {
      x, y, angle: angle + spread, speed: 900, dist: 0, range: w.range,
      damage: w.damage, dead: false,
    };
  }
}

export class Particles {
  constructor() { this.list = []; }

  puff(x, y, n, color, speed, life) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.list.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * (0.5 + Math.random() * 0.7), max: life, color, size: 2 + Math.random() * 4 });
    }
  }

  blood(x, y) { this.puff(x, y, 10, '#a02020', 130, 0.5); }
  muzzle(x, y) { this.puff(x, y, 5, '#ffd76a', 200, 0.12); }
  smoke(x, y) { this.puff(x, y, 3, '#777', 40, 1.2); }
  sparks(x, y) { this.puff(x, y, 8, '#ffd76a', 260, 0.3); }
  explosion(x, y) { this.puff(x, y, 26, '#ff7a2e', 320, 0.7); this.puff(x, y, 14, '#555', 90, 1.4); }

  update(dt) {
    for (const p of this.list) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= (1 - 2.4 * dt); p.vy *= (1 - 2.4 * dt);
      p.life -= dt;
    }
    this.list = this.list.filter((p) => p.life > 0);
  }
}

// Step a bullet; returns what it hit ('ped' | 'car' | 'building' | null).
export function stepBullet(b, dt, city, targets) {
  b.x += Math.cos(b.angle) * b.speed * dt;
  b.y += Math.sin(b.angle) * b.speed * dt;
  b.dist += b.speed * dt;
  if (b.dist > b.range) { b.dead = true; return null; }
  for (const t of targets) {
    if (t.dead) continue;
    const r = t.radius || 26;
    if (Math.hypot(t.x - b.x, t.y - b.y) < r) {
      b.dead = true;
      t.hp -= b.damage;
      if (t.hp <= 0) t.dead = true;
      return { kind: t.kind || 'car', target: t };
    }
  }
  // Buildings stop bullets.
  for (const bd of city.buildings) {
    if (b.x >= bd.x && b.x <= bd.x + bd.w && b.y >= bd.y && b.y <= bd.y + bd.h) {
      b.dead = true;
      return { kind: 'building', x: b.x, y: b.y };
    }
  }
  return null;
}
export { clamp };
