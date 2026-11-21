// The wanted system: heat 0-100, stars from heat, Harborlight PD cars
// that spawn, chase, ram and (at 3+ stars) shoot, and the busted arrest.
import { makeRng, clamp, angleDiff, pick } from './rng.js';
import { nearestRoadPoint, WORLD } from './city.js';
import { makeCar, driveCar, carsCollide, collideCarBuildings } from './vehicles.js';

export function starsFromHeat(heat) {
  if (heat < 5) return 0;
  if (heat < 25) return 1;
  if (heat < 45) return 2;
  if (heat < 65) return 3;
  if (heat < 85) return 4;
  return 5;
}

export function copsForStars(stars) {
  return [0, 2, 3, 4, 6, 8][stars] || 0;
}

export class Police {
  constructor(seed) {
    this.rng = makeRng(seed ^ 0xbad5);
    this.heat = 0;
    this.stars = 0;
    this.cars = [];
    this.sirenPhase = false;
    this.sirenT = 0;
    this.bustT = 0;      // seconds a cop has stood on the player on foot
    this.lastShotT = 0;
  }

  addHeat(n) { this.heat = clamp(this.heat + n, 0, 100); this.stars = starsFromHeat(this.heat); }

  setHeat(n) { this.heat = clamp(n, 0, 100); this.stars = starsFromHeat(this.heat); }

  update(dt, px, py, playerSpeed, onFoot, playerCar, city, trafficCars, time) {
    const rng = this.rng;
    // Heat fades when the law cannot see the player.
    let nearest = 1e9;
    for (const c of this.cars) nearest = Math.min(nearest, Math.hypot(c.x - px, c.y - py));
    if (nearest > 520) this.heat = Math.max(0, this.heat - 2.2 * dt);
    this.stars = starsFromHeat(this.heat);

    // Siren wail flips twice a second while wanted.
    this.sirenT += dt;
    if (this.sirenT > 0.5) { this.sirenT = 0; this.sirenPhase = !this.sirenPhase; }

    // Spawn cops up to the star count, on roads near the player.
    const want = copsForStars(this.stars);
    if (this.cars.length < want) {
      const a = rng() * Math.PI * 2;
      const r = 420 + rng() * 260;
      const p = nearestRoadPoint(
        clamp(px + Math.cos(a) * r, 120, WORLD - 120),
        clamp(py + Math.sin(a) * r, 120, WORLD - 120));
      const car = makeCar(p.x, p.y, Math.atan2(py - p.y, px - p.x), 1, { police: true, color: '#20242c' });
      car.speed = 140;
      this.cars.push(car);
    }
    // Chase: steer at the player, ram, and shoot at 3+ stars.
    let shootAt = null;
    for (const car of this.cars) {
      const wantAngle = Math.atan2(py - car.y, px - car.x);
      const diff = angleDiff(car.angle, wantAngle);
      const steer = clamp(diff * 2.2, -1, 1);
      const d = Math.hypot(px - car.x, py - car.y);
      const throttle = d > 90 ? 1 : 0.4;
      driveCar(car, steer, throttle, false, dt);
      collideCarBuildings(city, car);
      for (const o of trafficCars) if (!o.dead) carsCollide(car, o);
      if (playerCar && !playerCar.dead) carsCollide(car, playerCar);
      if (this.stars >= 3 && d < 380 && time - this.lastShotT > 0.9) {
        this.lastShotT = time;
        shootAt = { x: car.x, y: car.y, tx: px, ty: py };
      }
    }
    this.cars = this.cars.filter((c) => !c.dead && Math.hypot(c.x - px, c.y - py) < 1600);

    // Busted: a cop standing on the player while on foot.
    if (onFoot && this.stars > 0 && nearest < 46 && playerSpeed < 12) {
      this.bustT += dt;
    } else this.bustT = 0;
    return { busted: this.bustT > 1.4, shootAt };
  }

  clear() {
    this.heat = 0; this.stars = 0; this.cars = []; this.bustT = 0;
  }
}
export { pick };
