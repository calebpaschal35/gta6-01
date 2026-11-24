// Particles: muzzle flash, smoke, sparks, blood, tire smoke, cash sparkle.
export class Particles {
  constructor() { this.list = []; }
  spawn(x, y, opts) {
    const n = opts.n || 8;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (opts.speed || 120) * (0.3 + Math.random() * 0.7);
      this.list.push({
        x, y, vx: Math.cos(a) * sp + (opts.vx || 0), vy: Math.sin(a) * sp + (opts.vy || 0),
        life: opts.life || 0.5, max: opts.life || 0.5,
        size: (opts.size || 3) * (0.6 + Math.random() * 0.8),
        color: opts.color || '#ffcc66', grav: opts.grav || 0, drag: opts.drag || 0.98,
      });
    }
  }
  muzzle(x, y, angle) {
    this.spawn(x + Math.cos(angle) * 22, y + Math.sin(angle) * 22, { n: 5, speed: 260, life: 0.12, size: 3, color: '#ffe9a8', vx: Math.cos(angle) * 200, vy: Math.sin(angle) * 200 });
  }
  smoke(x, y) { this.spawn(x, y, { n: 4, speed: 40, life: 0.9, size: 6, color: '#666666', grav: -30 }); }
  sparks(x, y) { this.spawn(x, y, { n: 10, speed: 220, life: 0.4, size: 2, color: '#ffdd55', grav: 300 }); }
  blood(x, y) { this.spawn(x, y, { n: 8, speed: 140, life: 0.5, size: 3, color: '#b02020', grav: 200 }); }
  cash(x, y) { this.spawn(x, y, { n: 10, speed: 90, life: 0.8, size: 3, color: '#7ee081', grav: -60 }); }
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      if (p.life <= 0) { this.list.splice(i, 1); continue; }
      p.vy += p.grav * dt;
      p.vx *= p.drag; p.vy *= p.drag;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
  }
  draw(ctx, cam) {
    for (const p of this.list) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - cam.x - p.size / 2, p.y - cam.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }
}
