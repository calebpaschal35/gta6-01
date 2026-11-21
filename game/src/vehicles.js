// Cars: arcade driving physics, traffic AI that follows the road grid,
// parked cars the player can steal, and collisions.
import { clamp, angleDiff, makeRng, pick, range } from './rng.js';
import { nearestRoadPoint, collideBuildings, WORLD, ROAD_HALF } from './city.js';

export const CAR_MODELS = [
  { name: 'Coupe', color: '#c94f4f', len: 52, top: 300, accel: 340 },
  { name: 'Sedan', color: '#4f7dc9', len: 54, top: 270, accel: 300 },
  { name: 'Taxi', color: '#d9a521', len: 54, top: 260, accel: 290 },
  { name: 'Pickup', color: '#5a8a4f', len: 58, top: 250, accel: 280 },
  { name: 'Sports', color: '#b04fc9', len: 50, top: 380, accel: 420 },
  { name: 'Van', color: '#8a8a8a', len: 62, top: 220, accel: 240 },
  { name: 'Muscle', color: '#c97a2e', len: 56, top: 320, accel: 360 },
];

export function makeCar(x, y, angle, modelIdx, opts) {
  const m = CAR_MODELS[modelIdx % CAR_MODELS.length];
  return {
    x, y, angle, speed: 0, model: m,
    color: (opts && opts.color) || m.color,
    traffic: !!(opts && opts.traffic),
    parked: !!(opts && opts.parked),
    police: !!(opts && opts.police),
    rival: !!(opts && opts.rival),
    hp: 100, dead: false, smoke: 0,
    turnTarget: angle, wait: 0, honked: 0,
  };
}

// One physics step for a driven car. steer -1..1, throttle -1..1.
export function driveCar(car, steer, throttle, handbrake, dt) {
  const m = car.model;
  if (throttle > 0) car.speed += m.accel * throttle * dt;
  else if (throttle < 0) car.speed += (car.speed > 8 ? -560 : -260) * dt;
  else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 140 * dt);
  if (handbrake) {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 500 * dt);
    car.angle += steer * clamp(Math.abs(car.speed) / 120, 0, 1) * 2.6 * dt * Math.sign(car.speed || 1);
  } else {
    car.angle += steer * clamp(Math.abs(car.speed) / 140, 0, 1) * 2.1 * dt * Math.sign(car.speed || 1);
  }
  car.speed = clamp(car.speed, -120, m.top);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.x = clamp(car.x, 40, WORLD - 40);
  car.y = clamp(car.y, 40, WORLD - 40);
  if (car.hp < 35) car.smoke += dt;
  return car;
}

export function collideCarBuildings(city, car) {
  const p = { x: car.x, y: car.y };
  if (collideBuildings(city, p, 24)) {
    car.x = p.x; car.y = p.y;
    if (Math.abs(car.speed) > 120) { car.hp -= 8; car.speed *= 0.4; return true; }
    car.speed *= 0.6;
  }
  return false;
}

export function carsCollide(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y;
  const d2 = dx * dx + dy * dy;
  const min = 44;
  if (d2 >= min * min || d2 < 0.01) return false;
  const d = Math.sqrt(d2);
  const push = (min - d) / 2;
  const nx = dx / d, ny = dy / d;
  a.x += nx * push; a.y += ny * push;
  b.x -= nx * push; b.y -= ny * push;
  const av = a.speed, bv = b.speed;
  a.speed = av * 0.55 + bv * 0.2;
  b.speed = bv * 0.55 + av * 0.2;
  if (Math.abs(av) + Math.abs(bv) > 220) { a.hp -= 6; b.hp -= 6; }
  return true;
}

// Traffic manager: keeps a handful of cars driving the grid near the player.
export class Traffic {
  constructor(seed) {
    this.rng = makeRng(seed ^ 0x9e3779b9);
    this.cars = [];
  }

  update(dt, px, py, city, playerCar, policeCars, rivals) {
    const rng = this.rng;
    // Spawn until the streets near the player are busy.
    if (this.cars.length < 10) {
      const a = rng() * Math.PI * 2;
      const r = 500 + rng() * 500;
      let x = px + Math.cos(a) * r, y = py + Math.sin(a) * r;
      x = clamp(x, 120, WORLD - 120); y = clamp(y, 120, WORLD - 120);
      const p = nearestRoadPoint(x, y);
      const alongX = Math.abs(p.x - x) < Math.abs(p.y - y);
      const angle = alongX ? (rng() < 0.5 ? 0 : Math.PI) : (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
      const car = makeCar(p.x, p.y, angle, Math.floor(rng() * CAR_MODELS.length), { traffic: true });
      car.speed = 90 + rng() * 60;
      this.cars.push(car);
    }
    const all = [playerCar, ...policeCars, ...rivals].filter(Boolean);
    for (const car of this.cars) {
      if (car.dead) continue;
      if (!car.parked) {
        // Drive along the current heading; at intersections, sometimes turn.
        const onV = Math.abs(Math.sin(car.angle)) < 0.35; // heading east/west
        const snapped = nearestRoadPoint(car.x, car.y);
        const distToLine = onV ? Math.abs(car.y - snapped.y) : Math.abs(car.x - snapped.x);
        if (distToLine < 26 && rng() < dt * 0.55) {
          car.angle += pick(rng, [-Math.PI / 2, Math.PI / 2]);
        }
        // Gentle steering back onto the road line.
        const target = onV ? snapped.y : snapped.x;
        const off = onV ? car.y - target : car.x - target;
        car.angle += clamp(-off * 0.002, -0.5, 0.5) * dt * 10;
        car.speed += (120 - car.speed) * dt * 0.5;
        car.x += Math.cos(car.angle) * car.speed * dt;
        car.y += Math.sin(car.angle) * car.speed * dt;
        car.x = clamp(car.x, 60, WORLD - 60);
        car.y = clamp(car.y, 60, WORLD - 60);
        collideCarBuildings(city, car);
      }
      for (const o of all) if (o && o !== car) carsCollide(car, o);
      for (const o of this.cars) if (o !== car && !o.dead) carsCollide(car, o);
      if (car.hp <= 0) car.dead = true;
    }
    // Despawn far away, dead, or off the map.
    this.cars = this.cars.filter((c) => {
      const d = Math.hypot(c.x - px, c.y - py);
      return !c.dead && d < 1400;
    });
    // Parked cars the player can steal: keep a few near the player.
    return this.cars;
  }

  // A parked car near a point, or null.
  parkedNear(x, y, maxD) {
    let best = null, bd = maxD;
    for (const c of this.cars) {
      if (!c.parked) continue;
      const d = Math.hypot(c.x - x, c.y - y);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  spawnParked(x, y, modelIdx) {
    const p = nearestRoadPoint(x, y);
    const car = makeCar(p.x, p.y, pick(this.rng, [0, Math.PI / 2, Math.PI, -Math.PI / 2]), modelIdx, { parked: true });
    this.cars.push(car);
    return car;
  }
}

// Explosion: a dead car bursts into smoke and stops being drivable.
export function explodeCar(car) {
  car.dead = true;
  car.hp = 0;
  return { x: car.x, y: car.y, big: true };
}
export { range };
