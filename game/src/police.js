// Harborlight PD: spawn, chase, ram, shoot, busted. Spawn far out; ram is gentle.
import { POLICE_MODEL, WANTED, WORLD } from './config.js';
import { Vehicle } from './vehicles.js';
import { dist, clamp, angleDiff } from './rng.js';

export class Police {
  constructor() { this.cars = []; this.shootCd = 0; }
  wantedCount(wanted) { return WANTED.maxPolice[Math.min(5, Math.max(0, wanted))] || 0; }
  update(dt, world) {
    const { player, city, rng } = world;
    const want = this.wantedCount(player.wanted);
    // spawn further out so police never appear on top of the player
    while (this.cars.length < want) {
      const a = rng.range(0, Math.PI * 2);
      const r = rng.range(900, 1250);
      let x = player.x + Math.cos(a) * r, y = player.y + Math.sin(a) * r;
      x = clamp(x, 60, WORLD - 60); y = clamp(y, 60, WORLD - 60);
      const p = city.randomRoadPoint(rng);
      const car = new Vehicle(POLICE_MODEL, p.x, p.y, 0);
      car.isPolice = true;
      this.cars.push(car);
    }
    while (this.cars.length > want) this.cars.pop();
    this.shootCd -= dt;
    for (const car of this.cars) {
      if (car.dead) continue;
      const tx = player.inCar ? player.car.x : player.x;
      const ty = player.inCar ? player.car.y : player.y;
      const d = dist(car.x, car.y, tx, ty);
      const wantAngle = Math.atan2(ty - car.y, tx - car.x);
      const diff = angleDiff(car.angle, wantAngle);
      const steer = clamp(diff * 2, -1, 1);
      const targetSpeed = Math.min(POLICE_MODEL.top * 0.96, player.inCar ? player.car.model.top * 0.94 + 40 : 420);
      car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 0.9);
      car.angle += steer * POLICE_MODEL.turn * dt * clamp(Math.abs(car.speed) / 160, 0.3, 1);
      const dx = Math.cos(car.angle) * car.speed * dt;
      const dy = Math.sin(car.angle) * car.speed * dt;
      const ox = car.x, oy = car.y;
      city.resolveMove(car, dx, dy);
      if (car.x === ox && car.y === oy) car.angle += Math.PI * 0.5;
      // ram: gentle, 25 HP/s, only when really touching
      if (player.inCar && d < 62) {
        player.car.hp -= WANTED.ramDamage * dt;
        if (player.car.hp <= 0) world.wreckPlayerCar();
      }
      // shoot at 3+ stars when close enough
      if (player.wanted >= 3 && this.shootCd <= 0 && d < 380) {
        this.shootCd = 0.8 + Math.random() * 0.7;
        world.fireBullet(car.x, car.y, wantAngle + (Math.random() - 0.5) * 0.3, 5, 'police');
      }
    }
    // siren while any police active
    world.audio.setSiren(this.cars.length > 0 && player.wanted > 0);
  }
  nearestDist(player) {
    let best = 1e9;
    for (const car of this.cars) {
      const tx = player.inCar ? player.car.x : player.x;
      const ty = player.inCar ? player.car.y : player.y;
      best = Math.min(best, dist(car.x, car.y, tx, ty));
    }
    return best;
  }
  draw(ctx, cam) { for (const car of this.cars) car.draw(ctx, cam); }
}
