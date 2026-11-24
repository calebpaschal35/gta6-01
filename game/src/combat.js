// Combat: fists, pistol, SMG. Bullets, damage, lastHurtAt.
import { WEAPONS } from './config.js';
import { dist } from './rng.js';

export class Combat {
  constructor() {
    this.bullets = [];
    this.cool = 0;
    this.reloadT = 0;
  }
  weaponOf(player) { return WEAPONS[player.weapon] || WEAPONS.pistol; }
  fire(world, fromX, fromY, angle, owner) {
    const player = world.player;
    if (owner === 'player') {
      const w = this.weaponOf(player);
      if (this.cool > 0 || this.reloadT > 0) return;
      if (player.weapon === 'fists') {
        this.cool = 1 / w.rate;
        world.audio.punch();
        // melee arc
        const hx = fromX + Math.cos(angle) * 34, hy = fromY + Math.sin(angle) * 34;
        for (const g of world.gang) if (!g.dead && dist(hx, hy, g.x, g.y) < 30) this.damageGang(world, g, w.damage);
        for (const p of world.peds) if (!p.dead && dist(hx, hy, p.x, p.y) < 30) this.damagePed(world, p, w.damage);
        world.particles.sparks(hx, hy);
        return;
      }
      if (player.ammo <= 0) { this.reload(world); return; }
      player.ammo -= 1;
      this.cool = 1 / w.rate;
      this.bullets.push({ x: fromX + Math.cos(angle) * 24, y: fromY + Math.sin(angle) * 24, vx: Math.cos(angle) * 900, vy: Math.sin(angle) * 900, life: w.range / 900, damage: w.damage, owner: 'player' });
      world.audio.shot();
      world.particles.muzzle(fromX, fromY, angle);
      if (player.ammo === 0) this.reload(world);
    }
  }
  fireBullet(world, x, y, angle, damage, owner) {
    this.bullets.push({ x: x + Math.cos(angle) * 24, y: y + Math.sin(angle) * 24, vx: Math.cos(angle) * 850, vy: Math.sin(angle) * 850, life: 0.5, damage, owner });
    if (owner !== 'player') world.audio.shot();
  }
  reload(world) {
    const player = world.player;
    const w = this.weaponOf(player);
    if (player.weapon === 'fists' || !isFinite(w.mag)) return;
    if (this.reloadT > 0) return;
    this.reloadT = 0.9;
    world._reloadPending = true;
  }
  finishReload(world) {
    const player = world.player;
    const w = this.weaponOf(player);
    player.ammo = w.mag;
    world._reloadPending = false;
  }
  damageGang(world, g, dmg) {
    g.hp -= dmg;
    world.particles.blood(g.x, g.y);
    if (g.hp <= 0 && !g.dead) { g.dead = true; world.onGangKilled(g); }
  }
  damagePed(world, p, dmg) {
    p.hp -= dmg;
    world.particles.blood(p.x, p.y);
    if (p.hp <= 0 && !p.dead) {
      p.dead = true;
      world.addWanted(2, 'killed a pedestrian');
    }
  }
  hurtPlayer(world, dmg, src) {
    const player = world.player;
    if (player.hp <= 0) return;
    player.hp -= dmg;
    player.lastHurtAt = world.time; // used for regen + wanted decay timing
    if (player.hp <= 0) {
      player.hp = 0;
      world.onPlayerDown(src);
    }
  }
  update(dt, world) {
    this.cool = Math.max(0, this.cool - dt);
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) this.finishReload(world);
    }
    const { city, player } = world;
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.life -= dt;
      b.x += b.vx * dt; b.y += b.vy * dt;
      let dead = b.life <= 0;
      if (!dead && city.collides(b.x, b.y, 4, 4)) { world.particles.sparks(b.x, b.y); dead = true; }
      if (!dead && b.owner !== 'player') {
        const tx = player.inCar ? player.car.x : player.x;
        const ty = player.inCar ? player.car.y : player.y;
        const rr = player.inCar ? 30 : 16;
        if (dist(b.x, b.y, tx, ty) < rr) {
          if (player.inCar) { player.car.hp -= b.damage; if (player.car.hp <= 0) world.wreckPlayerCar(); }
          else this.hurtPlayer(world, b.damage, b.owner);
          dead = true;
        }
      }
      if (!dead && b.owner === 'player') {
        for (const g of world.gang) {
          if (!g.dead && dist(b.x, b.y, g.x, g.y) < 16) { this.damageGang(world, g, b.damage); dead = true; break; }
        }
        if (!dead) for (const p of world.peds) {
          if (!p.dead && dist(b.x, b.y, p.x, p.y) < 14) { this.damagePed(world, p, b.damage); dead = true; break; }
        }
        if (!dead) for (const c of world.police.cars) {
          if (!c.dead && dist(b.x, b.y, c.x, c.y) < 26) {
            c.hp -= b.damage;
            world.particles.sparks(b.x, b.y);
            if (c.hp <= 0) { c.dead = true; world.addWanted(2, 'destroyed a police car'); }
            dead = true; break;
          }
        }
        if (!dead) for (const c of world.cars) {
          if (!c.dead && c !== player.car && dist(b.x, b.y, c.x, c.y) < 26) {
            c.hp -= b.damage;
            world.particles.sparks(b.x, b.y);
            if (c.hp <= 0 && c.isTraffic) { c.dead = true; world.addWanted(1, 'destroyed a car'); }
            dead = true; break;
          }
        }
      }
      if (dead) this.bullets.splice(i, 1);
    }
  }
  draw(ctx, cam) {
    ctx.fillStyle = '#ffe9a8';
    for (const b of this.bullets) {
      ctx.fillRect(b.x - cam.x - 3, b.y - cam.y - 1, 6, 2);
    }
  }
}
