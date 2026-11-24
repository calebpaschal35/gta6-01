// Vehicles: player cars, traffic AI, parked cars. Arcade physics.
import { CAR_MODELS, POLICE_MODEL, WORLD } from './config.js';
import { clamp, angleDiff, normAngle } from './rng.js';

export class Vehicle {
  constructor(model, x, y, angle, color) {
    this.model = model; this.x = x; this.y = y; this.angle = angle;
    this.color = color || model.color;
    this.w = model.w; this.h = model.h;
    this.speed = 0; this.hp = 100; this.dead = false;
    this.isPolice = model === POLICE_MODEL;
    this.isTraffic = false; this.isParked = false;
    this.ai = null; // traffic brain
    this.steerVis = 0;
  }
  updateDrive(dt, input, city) {
    const m = this.model;
    const fwd = input.y < 0 ? 1 : input.y > 0 ? -0.55 : 0;
    if (fwd > 0) this.speed += m.accel * dt;
    else if (fwd < 0) this.speed -= m.accel * 0.7 * dt;
    else this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 240 * dt);
    const hb = input.hb ? 0.35 : 1;
    this.speed = clamp(this.speed, -m.top * 0.35, m.top);
    const steer = input.x * (this.speed >= 0 ? 1 : -1);
    this.angle += steer * m.turn * hb * dt * clamp(Math.abs(this.speed) / 160, 0.25, 1);
    const dx = Math.cos(this.angle) * this.speed * dt;
    const dy = Math.sin(this.angle) * this.speed * dt;
    const ox = this.x, oy = this.y;
    city.resolveMove(this, dx, dy);
    if ((this.x === ox && Math.abs(dx) > 0.5) || (this.y === oy && Math.abs(dy) > 0.5)) {
      this.speed *= 0.55; // bumped a wall
    }
    if (input.hb && Math.abs(this.speed) > 120) this.drifting = true; else this.drifting = false;
  }
  updateTraffic(dt, city, rng) {
    if (!this.ai) return;
    const a = this.ai;
    this.speed += (a.targetSpeed - this.speed) * Math.min(1, dt * 1.2);
    const want = Math.atan2(a.ty - this.y, a.tx - this.x);
    const d = angleDiff(this.angle, want);
    this.angle += clamp(d, -1.8 * dt, 1.8 * dt);
    const dx = Math.cos(this.angle) * this.speed * dt;
    const dy = Math.sin(this.angle) * this.speed * dt;
    const ox = this.x, oy = this.y;
    city.resolveMove(this, dx, dy);
    if (this.x === ox && this.y === oy) { this.angle += Math.PI / 2; }
    if (Math.hypot(a.tx - this.x, a.ty - this.y) < 60 || rng.chance(dt * 0.02)) {
      const p = city.randomRoadPoint(rng);
      a.tx = p.x; a.ty = p.y;
      a.targetSpeed = rng.range(120, 220);
    }
  }
  draw(ctx, cam) {
    ctx.save();
    ctx.translate(this.x - cam.x, this.y - cam.y);
    ctx.rotate(this.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(-this.w / 2 + 2, -this.h / 2 + 3, this.w, this.h);
    ctx.fillStyle = this.color;
    ctx.fillRect(-this.w / 2, -this.h / 2, this.w, this.h);
    ctx.fillStyle = 'rgba(180,220,255,0.85)';
    ctx.fillRect(this.w / 2 - 14, -this.h / 2 + 3, 10, this.h - 6);
    ctx.fillStyle = this.isPolice ? '#ffffff' : 'rgba(0,0,0,0.45)';
    ctx.fillRect(-this.w / 2 + 4, -this.h / 2 + 2, 8, this.h - 4);
    if (this.isPolice) {
      ctx.fillStyle = '#d02020'; ctx.fillRect(-4, -this.h / 2 - 1, 8, 4);
      ctx.fillStyle = '#2050d0'; ctx.fillRect(-4, this.h / 2 - 3, 8, 4);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('HPD', 0, 3);
      ctx.textAlign = 'left';
    }
    if (this.hp < 100 && this.hp > 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(-this.w / 2, -this.h / 2 - 8, this.w, 4);
      ctx.fillStyle = this.hp > 50 ? '#7ee081' : '#e05a5a';
      ctx.fillRect(-this.w / 2, -this.h / 2 - 8, this.w * (this.hp / 100), 4);
    }
    ctx.restore();
  }
}

export function makeTrafficCar(city, rng, models) {
  const p = city.randomRoadPoint(rng);
  const model = rng.pick(models);
  const angle = p.horiz ? (rng.chance(0.5) ? 0 : Math.PI) : (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2);
  const v = new Vehicle(model, p.x, p.y, angle);
  v.isTraffic = true;
  const t = city.randomRoadPoint(rng);
  v.ai = { tx: t.x, ty: t.y, targetSpeed: rng.range(120, 220) };
  return v;
}

export function makeParkedCar(city, rng, models, x, y, angle, modelIdx) {
  const model = modelIdx != null ? models[modelIdx] : rng.pick(models);
  const v = new Vehicle(model, x, y, angle);
  v.isParked = true;
  return v;
}

export function carsCollide(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y;
  const r = (Math.max(a.w, a.h) + Math.max(b.w, b.h)) / 2.4;
  return dx * dx + dy * dy < r * r;
}
export function separateCars(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y;
  const d = Math.hypot(dx, dy) || 1;
  const r = (Math.max(a.w, a.h) + Math.max(b.w, b.h)) / 2.4;
  const push = (r - d) / 2;
  if (push <= 0) return;
  const nx = dx / d, ny = dy / d;
  a.x += nx * push; a.y += ny * push;
  b.x -= nx * push; b.y -= ny * push;
}
