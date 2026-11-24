// Pedestrians and Redline gang members.
import { WORLD } from './config.js';
import { clamp, dist } from './rng.js';

export class Ped {
  constructor(x, y, rng) {
    this.x = x; this.y = y; this.w = 16; this.h = 16;
    this.angle = rng.range(0, Math.PI * 2);
    this.speed = rng.range(40, 80);
    this.color = ['#d8b060', '#7ab0d8', '#d87a7a', '#9ad87a', '#c09ad8'][rng.int(0, 4)];
    this.flee = 0; this.dead = false; this.hp = 30;
    this.walkT = rng.range(0, 4);
  }
  update(dt, city, px, py) {
    if (this.dead) return;
    const d = dist(this.x, this.y, px, py);
    if (d < 180) { this.flee = 1.2; this.angle = Math.atan2(this.y - py, this.x - px); }
    if (this.flee > 0) { this.flee -= dt; this.speed = 150; } else this.speed = 60;
    this.walkT -= dt;
    if (this.walkT <= 0) {
      this.walkT = 2 + Math.random() * 3;
      this.angle += (Math.random() - 0.5) * 1.8;
    }
    const dx = Math.cos(this.angle) * this.speed * dt;
    const dy = Math.sin(this.angle) * this.speed * dt;
    city.resolveMove(this, dx, dy);
  }
  draw(ctx, cam) {
    if (this.dead) return;
    ctx.save();
    ctx.translate(this.x - cam.x, this.y - cam.y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(0, 4, 9, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = this.color;
    ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8c8a0';
    ctx.beginPath(); ctx.arc(Math.cos(this.angle) * 4, Math.sin(this.angle) * 4, 4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

export class GangMember {
  constructor(x, y, rng) {
    this.x = x; this.y = y; this.w = 18; this.h = 18;
    this.angle = rng.range(0, Math.PI * 2);
    this.hp = 60; this.dead = false;
    this.shootCd = rng.range(0.5, 1.5);
    this.speed = 120;
    this.car = null;
  }
  update(dt, city, px, py, fireAt) {
    if (this.dead) return;
    const d = dist(this.x, this.y, px, py);
    this.angle = Math.atan2(py - this.y, px - this.x);
    if (d > 260) {
      const dx = Math.cos(this.angle) * this.speed * dt;
      const dy = Math.sin(this.angle) * this.speed * dt;
      city.resolveMove(this, dx, dy);
    } else if (d < 140) {
      const dx = -Math.cos(this.angle) * this.speed * 0.6 * dt;
      const dy = -Math.sin(this.angle) * this.speed * 0.6 * dt;
      city.resolveMove(this, dx, dy);
    }
    this.shootCd -= dt;
    if (this.shootCd <= 0 && d < 420) {
      this.shootCd = 0.9 + Math.random() * 0.8;
      fireAt(this.x, this.y, this.angle + (Math.random() - 0.5) * 0.22, 10, 'gang');
    }
  }
  draw(ctx, cam) {
    if (this.dead) return;
    ctx.save();
    ctx.translate(this.x - cam.x, this.y - cam.y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(0, 5, 10, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c02020';
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#222';
    ctx.fillRect(Math.cos(this.angle) * 6 - 3, Math.sin(this.angle) * 6 - 3, 12, 5);
    ctx.fillStyle = '#e8c8a0';
    ctx.beginPath(); ctx.arc(Math.cos(this.angle) * 5, Math.sin(this.angle) * 5, 4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

export function spawnPeds(city, rng, n) {
  const list = [];
  for (let i = 0; i < n; i++) {
    const p = city.randomRoadPoint(rng);
    const x = clamp(p.x + rng.range(-140, 140), 40, WORLD - 40);
    const y = clamp(p.y + rng.range(-140, 140), 40, WORLD - 40);
    if (!city.collides(x, y, 16, 16)) list.push(new Ped(x, y, rng));
  }
  return list;
}
