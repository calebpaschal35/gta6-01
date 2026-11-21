// Pedestrians: walk the sidewalks, chat in place, flee gunfire and
// reckless drivers. Hitting one is a crime; killing one is a bigger one.
import { makeRng, range, pick, clamp } from './rng.js';
import { nearestRoadPoint, WORLD } from './city.js';

export class Crowd {
  constructor(seed) {
    this.rng = makeRng(seed ^ 0x51ed);
    this.peds = [];
  }

  update(dt, px, py, danger, city) {
    const rng = this.rng;
    if (this.peds.length < 14) {
      const a = rng() * Math.PI * 2;
      const r = 300 + rng() * 600;
      let x = clamp(px + Math.cos(a) * r, 100, WORLD - 100);
      let y = clamp(py + Math.sin(a) * r, 100, WORLD - 100);
      const p = nearestRoadPoint(x, y);
      // Stand on the sidewalk: offset from the road line.
      const side = rng() < 0.5 ? -1 : 1;
      x = p.x + (Math.abs(p.x - x) < Math.abs(p.y - y) ? 0 : side * 52);
      y = p.y + (Math.abs(p.x - x) < Math.abs(p.y - y) ? side * 52 : 0);
      this.peds.push({
        x, y, angle: rng() * Math.PI * 2, speed: 26 + rng() * 22,
        color: pick(rng, ['#e8c39e', '#c98d64', '#8a5a3b', '#f0d0b0', '#6b4a2f']),
        shirt: pick(rng, ['#c94f4f', '#4f7dc9', '#5a8a4f', '#d9a521', '#8a5a9e', '#e8e8e8', '#3a3a3a']),
        fleeing: false, dead: false, changeT: rng() * 4,
      });
    }
    for (const p of this.peds) {
      if (p.dead) continue;
      const dd = Math.hypot(p.x - danger.x, p.y - danger.y);
      if (danger.on && dd < 420) p.fleeing = true;
      if (p.fleeing) {
        p.angle = Math.atan2(p.y - danger.y, p.x - danger.x);
        p.speed = 95;
        if (dd > 650) p.fleeing = false;
      } else {
        p.changeT -= dt;
        if (p.changeT <= 0) { p.angle += (rng() - 0.5) * 2.4; p.changeT = 2 + rng() * 4; }
        p.speed = 26 + rng() * 4;
      }
      p.x += Math.cos(p.angle) * p.speed * dt;
      p.y += Math.sin(p.angle) * p.speed * dt;
      p.x = clamp(p.x, 60, WORLD - 60);
      p.y = clamp(p.y, 60, WORLD - 60);
    }
    this.peds = this.peds.filter((p) => !p.dead && Math.hypot(p.x - px, p.y - py) < 1500);
    return this.peds;
  }
}

export function pedHitByCar(ped, car) {
  const d = Math.hypot(ped.x - car.x, ped.y - car.y);
  return !ped.dead && Math.abs(car.speed) > 40 && d < 30;
}
export { range };
