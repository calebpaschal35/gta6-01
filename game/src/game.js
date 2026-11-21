// Harborlight: the game itself. A top-down open world — on-foot and
// driving, traffic and pedestrians, wanted level and police, five story
// jobs, combat, HUD with minimap, menus and a save. One fixed-step
// simulation so a seeded run replays exactly (the ?shot= modes use it
// to stage deterministic screenshots).
import { makeRng, clamp, angleDiff } from './rng.js';
import { buildCity, WORLD, nearestRoadPoint, collideBuildings, pointInBuilding } from './city.js';
import { Input } from './input.js';
import { SoundBank } from './audio.js';
import { makeCar, driveCar, carsCollide, collideCarBuildings, explodeCar, CAR_MODELS } from './vehicles.js';
import { Traffic } from './vehicles.js';
import { Crowd, pedHitByCar } from './people.js';
import { Police } from './police.js';
import { Arsenal, Particles, stepBullet } from './combat.js';
import { Story, JOBS } from './missions.js';
import { Hud } from './hud.js';

const SAVE_KEY = 'harborlight-save-v1';
const GARAGE = { x: 480, y: 2720 };
const SHOP = { x: 800, y: 480 };

export class Game {
  constructor(canvas, opts) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.opts = opts || {};
    this.seed = this.opts.seed || 7;
    this.rng = makeRng(this.seed);
    this.city = buildCity(this.seed);
    this.input = new Input(canvas);
    this.sound = new SoundBank();
    this.hud = new Hud();
    this.story = new Story();
    this.traffic = new Traffic(this.seed);
    this.crowd = new Crowd(this.seed);
    this.police = new Police(this.seed);
    this.arsenal = new Arsenal();
    this.particles = new Particles();
    this.bullets = [];
    this.enemyBullets = [];
    this.rivals = [];
    this.rivalsWrecked = 0;
    this.jobCar = null;

    this.mode = 'menu'; // menu | playing | paused | busted | wasted
    this.menuSel = 0;
    this.time = 0;      // sim seconds
    this.clockMin = 8 * 60; // game clock starts 08:00
    this.player = { x: 480, y: 2560, angle: -Math.PI / 2, health: 100, speed: 0, onFoot: true, car: null, aim: -Math.PI / 2 };
    this.camera = { x: 480, y: 2560 };
    this.cash = 500;
    this.freeRoam = false;
    this.replayIdx = 0;
    this.sirenFlip = false;
    this.lastTs = 0;
    this.ready = false;

    this.shot = new URLSearchParams(window.location.search).get('shot');
    if (this.shot) this.setupShot(this.shot);
  }

  // ---- save / load -------------------------------------------------------
  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        cash: this.cash, done: this.story.done, owned: this.arsenal.owned,
        px: this.player.x, py: this.player.y, health: this.player.health,
      }));
    } catch (e) { /* private mode: saving is best-effort */ }
  }

  load() {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      if (!s) return false;
      this.cash = s.cash; this.story.done = s.done || 0;
      this.arsenal.owned = s.owned || ['fists', 'pistol'];
      this.player.x = s.px; this.player.y = s.py; this.player.health = s.health || 100;
      return true;
    } catch (e) { return false; }
  }

  static hasSave() {
    try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
  }

  // ---- deterministic screenshot staging ----------------------------------
  setupShot(shot) {
    const P = this.player;
    if (shot === 'menu') {
      this.mode = 'menu';
      this.camera = { x: 1600, y: 1600 };
      return;
    }
    this.mode = 'playing';
    if (shot === 'chase') {
      // Three-star pursuit on a Downtown road: player in a Sports car,
      // two PD units closing in, smoke trailing.
      const car = makeCar(1600, 1440, 0, 4, {});
      car.speed = 230;
      P.car = car; P.onFoot = false; P.x = car.x; P.y = car.y;
      this.police.setHeat(50);
      this.police.cars.push(makeCar(1360, 1440, 0, 1, { police: true, color: '#20242c' }));
      this.police.cars.push(makeCar(1240, 1500, 0, 1, { police: true, color: '#20242c' }));
      this.police.cars[0].speed = 260; this.police.cars[1].speed = 250;
      this.story.active = { job: JOBS[2], step: 0, holdT: 0, timer: 88, count: 0 };
      this.cash = 1240;
      this.stepFixed(45);
      // Stage the chase at speed: the fixed steps coast the car down with
      // no input, so put the pursuit back at pace for the frame.
      car.speed = 250;
      this.police.cars[0].speed = 270; this.police.cars[1].speed = 260;
    } else if (shot === 'foot') {
      P.x = 800; P.y = 800; P.onFoot = true; P.aim = Math.PI / 4;
      this.arsenal.current = 'pistol';
      this.police.setHeat(12);
      this.police.cars.push(makeCar(1060, 800, Math.PI, 1, { police: true, color: '#20242c' }));
      this.police.cars[0].speed = 150;
      this.stepFixed(25);
    } else if (shot === 'mission') {
      P.x = 480; P.y = 2620; P.onFoot = true;
      this.story.briefing = JOBS[0];
      this.stepFixed(5);
    }
    this.render();
    window.__ready = true;
    this.ready = true;
  }

  stepFixed(n) {
    for (let i = 0; i < n; i++) this.update(1 / 60, true);
  }

  // ---- menu actions ------------------------------------------------------
  startStory() {
    this.freeRoam = false;
    this.mode = 'playing';
    this.sound.ensure();
    this.hud.toast('Welcome to Harborlight. Go to Marta\'s Garage for work.');
  }

  startContinue() {
    if (this.load()) { this.freeRoam = false; this.mode = 'playing'; this.sound.ensure(); this.hud.toast('Welcome back, Jesse.'); }
    else this.startStory();
  }

  startFreeRoam() {
    this.freeRoam = true;
    this.mode = 'playing';
    this.sound.ensure();
    this.hud.toast('Free roam — the city is yours.');
  }

  // ---- jobs ---------------------------------------------------------------
  offerJob() {
    if (this.freeRoam) return;
    if (this.story.active || this.story.briefing) return;
    if (this.story.complete) {
      const job = JOBS[this.replayIdx % JOBS.length];
      this.story.briefing = job;
      return;
    }
    this.story.offerNext();
  }

  acceptJob() {
    const job = this.story.accept();
    if (!job) return;
    this.hud.toast(`Job ${job.id} — ${job.name}: ${job.steps[0].text}`);
    this.sound.pickup();
    if (job.id === 1) {
      this.jobCar = this.traffic.spawnParked(1120, 2720, 0);
      this.jobCar.color = '#c94f4f';
    }
    if (job.id === 3) this.police.setHeat(50);
    if (job.id === 4) this.spawnRivals();
  }

  spawnRivals() {
    this.rivals = [];
    const spots = [[1120, 1120], [1440, 1760], [2080, 800]];
    spots.forEach(([x, y], i) => {
      const c = makeCar(x, y, i * 1.1, 6, { rival: true, color: '#a02020' });
      c.hp = 100;
      this.rivals.push(c);
    });
    this.rivalsWrecked = 0;
  }

  // ---- main loop -----------------------------------------------------------
  frame(ts) {
    const dt = Math.min(0.05, this.lastTs ? (ts - this.lastTs) / 1000 : 1 / 60);
    this.lastTs = ts;
    if (!this.shot) this.update(dt, false);
    this.render();
    this.input.endFrame();
    if (!this.ready) { window.__ready = true; this.ready = true; }
    requestAnimationFrame((t) => this.frame(t));
  }

  start() {
    requestAnimationFrame((t) => this.frame(t));
  }

  update(dt, fixed) {
    this.time += dt;
    this.clockMin += dt / 2; // a game hour every two real minutes
    this.hud.update(dt);
    this.particles.update(dt);
    this.sound.music(dt);
    if (this.mode === 'menu') {
      // Slow pan over the city behind the title.
      this.camera.x = 1600 + Math.sin(this.time * 0.05) * 500;
      this.camera.y = 1600 + Math.cos(this.time * 0.04) * 400;
      if (!fixed) this.menuKeys();
      return;
    }
    if (this.mode === 'paused' || this.mode === 'busted' || this.mode === 'wasted') {
      if (!fixed) this.endScreenKeys();
      return;
    }
    // ---- playing ----
    const inp = this.input;
    const P = this.player;
    if (inp.hit('KeyP') || inp.hit('Escape')) {
      if (this.story.briefing) { this.story.decline(); this.hud.toast('Job declined.'); }
      else { this.mode = 'paused'; this.save(); }
      return;
    }
    if (inp.hit('KeyM')) { const m = this.sound.toggleMute(); this.hud.toast(m ? 'Muted.' : 'Sound on.'); }

    // Menu of jobs / shop prompts. One E press does one thing: the flag
    // stops an accept or a purchase from also opening a car door.
    const nearGarage = Math.hypot(P.x - GARAGE.x, P.y - GARAGE.y) < 140;
    const nearShop = Math.hypot(P.x - SHOP.x, P.y - SHOP.y) < 140;
    let eUsed = false;
    if (this.story.briefing) {
      if (inp.hit('KeyE')) { this.acceptJob(); eUsed = true; }
    } else if (nearGarage && !this.story.active && !this.freeRoam) {
      if (inp.hit('KeyE')) { this.offerJob(); eUsed = true; }
    } else if (nearShop && !this.arsenal.owned.includes('smg')) {
      if (inp.hit('KeyE')) {
        eUsed = true;
        if (this.cash >= 800) { this.cash -= 800; this.arsenal.owned.push('smg'); this.arsenal.switchTo('smg'); this.hud.toast('Bought the SMG.'); this.sound.pickup(); }
        else { this.hud.toast('SMG costs $800 — you are short.'); this.sound.denied(); }
      }
    }

    // Weapon switching.
    if (inp.hit('Digit1')) this.arsenal.switchTo('fists');
    if (inp.hit('Digit2')) this.arsenal.switchTo('pistol');
    if (inp.hit('Digit3')) this.arsenal.switchTo('smg');

    // Aim: the mouse in world space.
    const aimX = this.camera.x - 640 + inp.mouseX;
    const aimY = this.camera.y - 360 + inp.mouseY;
    P.aim = Math.atan2(aimY - P.y, aimX - P.x);

    if (P.onFoot) this.updateOnFoot(dt, inp, aimX, aimY);
    else this.updateDriving(dt, inp);

    // Enter / exit cars.
    if (inp.hit('KeyE') && !eUsed && !this.story.briefing) {
      if (P.onFoot) this.tryEnterCar();
      else this.exitCar();
    }

    // Combat.
    this.updateCombat(dt, inp, aimX, aimY);

    // World life.
    const danger = { x: P.x, y: P.y, on: this.bullets.length > 0 || this.police.stars > 0 };
    this.traffic.update(dt, P.x, P.y, this.city, P.car, this.police.cars, this.rivals);
    this.crowd.update(dt, P.x, P.y, danger, this.city);
    this.updateRivals(dt);
    const pol = this.police.update(dt, P.x, P.y, P.onFoot ? P.speed : Math.abs(P.car ? P.car.speed : 0), P.onFoot, P.car, this.city, this.traffic.cars, this.time);
    if (pol.busted) { this.mode = 'busted'; this.sound.denied(); return; }
    if (pol.shootAt) this.enemyShoot(pol.shootAt);
    if (this.police.sirenPhase !== this.sirenFlip) { this.sirenFlip = this.police.sirenPhase; if (this.police.stars > 0) this.sound.sirenTick(this.sirenFlip); }

    // Peds hit by the player's car.
    if (P.car) {
      for (const ped of this.crowd.peds) {
        if (pedHitByCar(ped, P.car)) {
          ped.dead = true;
          this.particles.blood(ped.x, ped.y);
          this.police.addHeat(15);
          this.hud.toast('You hit a pedestrian — the law noticed.');
        }
      }
    }

    // Missions.
    const mres = this.story.update(dt, {
      x: P.x, y: P.y, inCar: !P.onFoot, carIsJobCar: P.car === this.jobCar,
      wanted: this.police.stars, wrecked: this.rivalsWrecked,
    });
    if (mres === 'failed') { this.hud.toast('Job failed — the moment passed.'); this.sound.denied(); }
    else if (mres && mres.done) {
      this.cash += mres.reward;
      this.hud.toast(`Job complete — $${mres.reward.toLocaleString('en-US')}.`);
      this.sound.jingle();
      this.save();
      if (this.story.complete) { this.hud.toast('Story complete. Harborlight is yours, Jesse.'); this.replayIdx = 0; }
    }

    // Player health.
    if (P.health <= 0) { this.mode = 'wasted'; return; }

    // Camera follows the player.
    const tx = clamp(P.x, 640, WORLD - 640);
    const ty = clamp(P.y, 360, WORLD - 360);
    this.camera.x += (tx - this.camera.x) * Math.min(1, dt * 5);
    this.camera.y += (ty - this.camera.y) * Math.min(1, dt * 5);

    // Engine hum follows the car.
    this.sound.setEngine(P.car ? Math.abs(P.car.speed) / 380 : 0, !!P.car);
  }

  menuKeys() {
    const inp = this.input;
    if (inp.hit('ArrowUp') || inp.hit('KeyW')) this.menuSel = (this.menuSel + 2) % 3;
    if (inp.hit('ArrowDown') || inp.hit('KeyS')) this.menuSel = (this.menuSel + 1) % 3;
    if (inp.hit('Enter') || inp.hit('Space')) {
      if (this.menuSel === 0) this.startStory();
      else if (this.menuSel === 1) this.startContinue();
      else this.startFreeRoam();
    }
  }

  endScreenKeys() {
    const inp = this.input;
    if (this.mode === 'paused' && inp.hit('KeyP')) { this.mode = 'playing'; return; }
    if (inp.hit('Enter') || inp.hit('Space')) {
      const P = this.player;
      if (this.mode === 'busted') {
        this.cash = Math.max(0, this.cash - 100);
        this.police.clear();
        P.x = GARAGE.x; P.y = GARAGE.y - 120; P.health = 100; P.onFoot = true; P.car = null;
        this.hud.toast('Released with a $100 fine. Stay out of trouble.');
      } else {
        P.x = 480; P.y = 2560; P.health = 100; P.onFoot = true; P.car = null;
        this.police.clear();
        this.hud.toast('Patched up at the clinic. Back on your feet.');
      }
      this.mode = 'playing';
    }
    if (inp.hit('Escape')) { this.mode = 'menu'; this.menuSel = 0; }
  }

  updateOnFoot(dt, inp, aimX, aimY) {
    const P = this.player;
    const v = inp.driveVector();
    const run = inp.down('ShiftLeft') || inp.down('ShiftRight');
    const speed = run ? 250 : 150;
    P.speed = (v.x || v.y) ? speed : 0;
    P.x += v.x * speed * dt;
    P.y += v.y * speed * dt;
    P.x = clamp(P.x, 40, WORLD - 40);
    P.y = clamp(P.y, 40, WORLD - 40);
    collideBuildings(this.city, P, 14);
    if (v.x || v.y) P.angle = Math.atan2(v.y, v.x);
    else P.angle = P.aim;
    // Walking into the bay: wade back out.
    if (P.y > 2960) P.y = 2960;
  }

  updateDriving(dt, inp) {
    const P = this.player;
    const car = P.car;
    if (!car || car.dead) { P.onFoot = true; P.car = null; return; }
    const v = inp.driveVector();
    const steer = v.x;
    const throttle = -v.y; // W is forward
    const handbrake = inp.down('Space');
    const wasSpeed = Math.abs(car.speed);
    driveCar(car, steer, throttle, handbrake, dt);
    if (collideCarBuildings(this.city, car)) {
      if (wasSpeed > 200) { this.sound.crash(); this.particles.sparks(car.x, car.y); }
      if (car.hp <= 0) this.carExplodes(car);
    }
    for (const o of this.traffic.cars) {
      if (o !== car && !o.dead && carsCollide(car, o)) {
        if (wasSpeed > 200) { this.sound.crash(); this.police.addHeat(3); }
        if (o.hp <= 0) this.carExplodes(o);
      }
    }
    for (const r of this.rivals) {
      if (!r.dead && carsCollide(car, r) && r.hp <= 0) { this.rivalsWrecked += 1; this.carExplodes(r); this.hud.toast(`Redline car wrecked (${this.rivalsWrecked}/3).`); }
    }
    for (const pc of this.police.cars) {
      if (!pc.dead && carsCollide(car, pc) && pc.hp <= 0) { this.carExplodes(pc); this.police.addHeat(25); }
    }
    if (car.hp <= 0) this.carExplodes(car);
    P.x = car.x; P.y = car.y; P.angle = car.angle;
    P.speed = Math.abs(car.speed);
    if (car.smoke > 0.2) { this.particles.smoke(car.x - Math.cos(car.angle) * 20, car.y - Math.sin(car.angle) * 20); car.smoke = 0; }
  }

  carExplodes(car) {
    if (car.dead) return;
    const boom = explodeCar(car);
    this.particles.explosion(boom.x, boom.y);
    this.sound.crash();
    if (this.player.car === car) {
      this.player.onFoot = true;
      this.player.car = null;
      this.player.health = Math.max(10, this.player.health - 25);
      this.hud.toast('Your car is wrecked.');
    }
  }

  tryEnterCar() {
    const P = this.player;
    const near = [];
    for (const c of this.traffic.cars) {
      if (!c.dead && Math.hypot(c.x - P.x, c.y - P.y) < 70) near.push(c);
    }
    for (const c of this.police.cars) {
      if (!c.dead && Math.hypot(c.x - P.x, c.y - P.y) < 70) near.push(c);
    }
    for (const c of this.rivals) {
      if (!c.dead && Math.hypot(c.x - P.x, c.y - P.y) < 70) near.push(c);
    }
    if (!near.length) return;
    const car = near[0];
    P.car = car; P.onFoot = false;
    car.parked = false; car.traffic = false;
    P.x = car.x; P.y = car.y;
    if (car.police) { this.police.addHeat(20); this.hud.toast('You stole a police car — bold.'); }
    else if (car === this.jobCar) { this.hud.toast('Got the coupe. Now drive it to the garage.'); }
    else { this.police.addHeat(12); this.hud.toast(`Stole a ${car.model.name}.`); }
    this.sound.pickup();
  }

  exitCar() {
    const P = this.player;
    if (!P.car) return;
    const car = P.car;
    P.x = car.x - Math.cos(car.angle) * 40;
    P.y = car.y - Math.sin(car.angle) * 40;
    P.onFoot = true;
    P.car = null;
    P.speed = 0;
  }

  updateCombat(dt, inp, aimX, aimY) {
    const P = this.player;
    const firing = inp.mouseDown || inp.mousePressed;
    if (this.arsenal.current === 'fists' && (inp.hit('KeyF') || inp.mousePressed)) {
      this.sound.punch();
      const targets = [...this.crowd.peds, ...this.police.cars];
      for (const t of targets) {
        if (t.dead) continue;
        if (Math.hypot(t.x - P.x, t.y - P.y) < 46) {
          t.hp = (t.hp || 50) - 12;
          this.particles.blood(t.x, t.y);
          if (t.hp <= 0) { t.dead = true; if (t.kind === undefined && this.crowd.peds.includes(t)) this.police.addHeat(20); }
        }
      }
      return;
    }
    const b = this.arsenal.tryFire(P.x + Math.cos(P.aim) * 22, P.y + Math.sin(P.aim) * 22, P.aim, dt, firing);
    if (b) {
      this.bullets.push(b);
      this.particles.muzzle(b.x, b.y);
      this.sound.shot();
      if (this.police.stars < 1) this.police.addHeat(6);
      else this.police.addHeat(3);
    }
    // Step bullets.
    const targets = [];
    for (const ped of this.crowd.peds) targets.push({ x: ped.x, y: ped.y, hp: 40, dead: ped.dead, kind: 'ped', ref: ped, radius: 14 });
    for (const c of [...this.traffic.cars, ...this.police.cars, ...this.rivals]) {
      if (c === P.car) continue;
      targets.push({ x: c.x, y: c.y, hp: c.hp, dead: c.dead, kind: 'car', ref: c, radius: 26 });
    }
    for (const b2 of this.bullets) {
      if (b2.dead) continue;
      const hit = stepBullet(b2, dt, this.city, targets);
      if (hit && hit.kind === 'ped') {
        const ped = hit.target.ref;
        ped.dead = true;
        this.particles.blood(ped.x, ped.y);
        this.police.addHeat(20);
      } else if (hit && hit.kind === 'car') {
        const car = hit.target.ref;
        car.hp = hit.target.hp;
        this.particles.sparks(b2.x, b2.y);
        if (hit.target.hp <= 0 && !car.dead) {
          this.carExplodes(car);
          if (car.police) this.police.addHeat(25);
          if (car.rival) { this.rivalsWrecked += 1; this.hud.toast(`Redline car wrecked (${this.rivalsWrecked}/3).`); }
        }
      } else if (hit && hit.kind === 'building') {
        this.particles.sparks(b2.x, b2.y);
      }
    }
    this.bullets = this.bullets.filter((b2) => !b2.dead);
    // Enemy bullets (police fire) fly at the player.
    for (const eb of this.enemyBullets) {
      eb.x += Math.cos(eb.angle) * 700 * dt;
      eb.y += Math.sin(eb.angle) * 700 * dt;
      eb.dist += 700 * dt;
      if (Math.hypot(eb.x - P.x, eb.y - P.y) < 18) {
        eb.dead = true;
        P.health -= 6;
        this.particles.blood(P.x, P.y);
        if (P.car) { P.car.hp -= 6; if (P.car.hp <= 0) this.carExplodes(P.car); }
      }
      if (eb.dist > 480) eb.dead = true;
    }
    this.enemyBullets = this.enemyBullets.filter((b2) => !b2.dead);
  }

  enemyShoot(from) {
    const P = this.player;
    const spread = (Math.random() - 0.5) * 0.35;
    const a = Math.atan2(P.y - from.y, P.x - from.x) + spread;
    this.enemyBullets.push({ x: from.x, y: from.y, angle: a, dist: 0, dead: false });
    this.sound.shot();
  }

  updateRivals(dt) {
    const P = this.player;
    for (const r of this.rivals) {
      if (r.dead) continue;
      const want = Math.atan2(P.y - r.y, P.x - r.x);
      const diff = angleDiff(r.angle, want);
      driveCar(r, clamp(diff * 2, -1, 1), 1, false, dt);
      collideCarBuildings(this.city, r);
      if (r.hp <= 0 && !r.dead) { this.carExplodes(r); this.rivalsWrecked += 1; this.hud.toast(`Redline car wrecked (${this.rivalsWrecked}/3).`); }
    }
  }

  // ---- rendering -----------------------------------------------------------
  render() {
    const ctx = this.ctx;
    const W = 1280, H = 720;
    ctx.fillStyle = '#0b1520';
    ctx.fillRect(0, 0, W, H);
    const camX = this.camera.x - W / 2;
    const camY = this.camera.y - H / 2;
    ctx.save();
    ctx.translate(-camX, -camY);
    this.drawWorld(ctx, camX, camY);
    ctx.restore();
    if (this.mode === 'menu') this.drawMenu(ctx);
    else {
      this.drawHudState(ctx);
      if (this.story.briefing) this.drawBriefing(ctx, this.story.briefing);
      if (this.mode === 'paused') this.drawPanel(ctx, 'PAUSED', 'Progress saved. Press P to keep playing, Enter to continue, Esc for the menu.');
      if (this.mode === 'busted') this.drawPanel(ctx, 'BUSTED', 'The Harborlight PD took you in. $100 fine. Press Enter to walk free.');
      if (this.mode === 'wasted') this.drawPanel(ctx, 'WASTED', 'You are down. Press Enter to get patched up and back on the streets.');
    }
  }

  drawWorld(ctx, camX, camY) {
    const city = this.city;
    const x0 = Math.max(0, camX - 80), y0 = Math.max(0, camY - 80);
    const x1 = Math.min(WORLD, camX + 1360), y1 = Math.min(WORLD, camY + 800);
    // Ground: grass.
    ctx.fillStyle = '#5d7a43';
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    // Bay: water along the south edge, sand above it.
    ctx.fillStyle = '#e0c98f';
    ctx.fillRect(x0, 2880, x1 - x0, 80);
    ctx.fillStyle = '#22608a';
    ctx.fillRect(x0, 2960, x1 - x0, y1 - 2960);
    // Parks.
    for (const p of city.parks) {
      if (p.x > x1 || p.x + p.w < x0 || p.y > y1 || p.y + p.h < y0) continue;
      ctx.fillStyle = '#4a6e38';
      ctx.fillRect(p.x, p.y, p.w, p.h);
    }
    // Trees.
    ctx.fillStyle = '#2f5226';
    for (const t of city.trees) {
      if (t.x < x0 || t.x > x1 || t.y < y0 || t.y > y1) continue;
      ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
    }
    // Roads.
    ctx.fillStyle = '#2e3138';
    for (let p = 160; p < WORLD; p += 320) {
      ctx.fillRect(x0, p - 34, x1 - x0, 68);
      ctx.fillRect(p - 34, y0, 68, y1 - y0);
    }
    // Road center dashes.
    ctx.strokeStyle = '#c9a94a';
    ctx.lineWidth = 3;
    ctx.setLineDash([22, 26]);
    for (let p = 160; p < WORLD; p += 320) {
      ctx.beginPath(); ctx.moveTo(x0, p); ctx.lineTo(x1, p); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(p, y0); ctx.lineTo(p, y1); ctx.stroke();
    }
    ctx.setLineDash([]);
    // Buildings.
    for (const b of city.buildings) {
      if (b.x > x1 || b.x + b.w < x0 || b.y > y1 || b.y + b.h < y0) continue;
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
      ctx.fillStyle = 'rgba(255,220,120,0.5)';
      const cols = Math.floor(b.w / 46), rows = Math.floor(b.h / 46);
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        ctx.fillRect(b.x + 12 + i * 46, b.y + 12 + j * 46, 14, 10);
      }
    }
    // Landmark labels.
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (const l of city.landmarks) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      const w = ctx.measureText(l.name).width + 12;
      ctx.fillRect(l.x - w / 2, l.y - 22, w, 18);
      ctx.fillStyle = '#ffe9a8';
      ctx.fillText(l.name, l.x, l.y - 9);
    }
    ctx.textAlign = 'left';
    // Mission marker: pulsing ring + beacon.
    const marker = this.story.marker();
    if (marker && this.mode === 'playing') {
      const pulse = 26 + Math.sin(this.time * 5) * 6;
      ctx.strokeStyle = '#ffd21f';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(marker.x, marker.y, pulse, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(255,210,31,0.25)';
      ctx.beginPath(); ctx.arc(marker.x, marker.y, pulse - 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffd21f';
      ctx.beginPath(); ctx.arc(marker.x, marker.y, 6, 0, Math.PI * 2); ctx.fill();
    }
    // Garage / shop markers when no job is active.
    if (this.mode === 'playing' && !this.story.active && !this.story.briefing) {
      ctx.fillStyle = '#ffd21f';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.fillText('E — work', GARAGE.x - 24, GARAGE.y - 30);
      ctx.fillText('E — Lock & Load ($800 SMG)', SHOP.x - 70, SHOP.y - 30);
    }
    // Cars.
    const drawCar = (c) => {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.angle);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(-c.model.len / 2 + 3, -13 + 3, c.model.len, 26);
      ctx.fillStyle = c.color;
      ctx.fillRect(-c.model.len / 2, -13, c.model.len, 26);
      ctx.fillStyle = 'rgba(180,220,255,0.85)';
      ctx.fillRect(-c.model.len / 2 + 10, -11, 14, 22);
      ctx.fillStyle = '#20242c';
      ctx.fillRect(c.model.len / 2 - 14, -11, 8, 22);
      if (c.police) {
        ctx.fillStyle = '#fff';
        ctx.fillRect(-6, -13, 14, 26);
        ctx.fillStyle = '#20242c';
        ctx.font = 'bold 9px system-ui, sans-serif';
        ctx.fillText('PD', -4, 3);
      }
      if (c.rival) {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 9px system-ui, sans-serif';
        ctx.fillText('REDLINE', -c.model.len / 2 + 4, 3);
      }
      ctx.restore();
      if (c.hp < 35 && !c.dead) {
        ctx.fillStyle = 'rgba(120,120,120,0.7)';
        ctx.beginPath(); ctx.arc(c.x - Math.cos(c.angle) * 20, c.y - Math.sin(c.angle) * 20, 8, 0, Math.PI * 2); ctx.fill();
      }
      if (c.dead) {
        ctx.fillStyle = 'rgba(20,20,20,0.85)';
        ctx.beginPath(); ctx.arc(c.x, c.y, 22, 0, Math.PI * 2); ctx.fill();
      }
    };
    for (const c of this.traffic.cars) drawCar(c);
    for (const c of this.rivals) drawCar(c);
    for (const c of this.police.cars) drawCar(c);
    if (this.player.car) drawCar(this.player.car);
    // Pedestrians.
    for (const p of this.crowd.peds) {
      if (p.dead) continue;
      ctx.fillStyle = p.shirt;
      ctx.beginPath(); ctx.arc(p.x, p.y, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y - 4, 5, 0, Math.PI * 2); ctx.fill();
    }
    // Player on foot.
    const P = this.player;
    if (P.onFoot && this.mode !== 'menu') {
      ctx.save();
      ctx.translate(P.x, P.y);
      ctx.rotate(P.aim);
      ctx.fillStyle = '#e8b13c';
      ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#20242c';
      ctx.fillRect(7, -3, 14, 6);
      if (this.arsenal.current !== 'fists') {
        ctx.fillStyle = '#222';
        ctx.fillRect(12, -2, 16, 4);
      }
      ctx.restore();
      // Aim line, short and subtle.
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(P.x + Math.cos(P.aim) * 20, P.y + Math.sin(P.aim) * 20);
      ctx.lineTo(P.x + Math.cos(P.aim) * 54, P.y + Math.sin(P.aim) * 54);
      ctx.stroke();
    }
    // Bullets and particles.
    ctx.fillStyle = '#ffd76a';
    for (const b of this.bullets) ctx.fillRect(b.x - 2, b.y - 2, 5, 5);
    ctx.fillStyle = '#ff8a4d';
    for (const b of this.enemyBullets) ctx.fillRect(b.x - 2, b.y - 2, 5, 5);
    for (const p of this.particles.list) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  drawHudState(ctx) {
    const P = this.player;
    const h = Math.floor(this.clockMin / 60) % 24;
    const m = Math.floor(this.clockMin % 60);
    const clock = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
    this.hud.draw(ctx, {
      health: P.health, cash: this.cash, stars: this.police.stars, clock,
      px: P.x, py: P.y, time: this.time,
      objective: this.mode === 'playing' ? this.story.objectiveText() : '',
      weaponName: this.arsenal.weapon().name,
      ammo: this.arsenal.weapon().mag === Infinity ? Infinity : this.arsenal.ammo[this.arsenal.current],
      speedMph: P.car ? Math.round(Math.abs(P.car.speed) * 0.25) : null,
      marker: this.story.marker(),
      police: this.police.cars,
    });
  }

  drawMenu(ctx) {
    ctx.fillStyle = 'rgba(6,12,20,0.55)';
    ctx.fillRect(0, 0, 1280, 720);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd21f';
    ctx.font = 'bold 84px system-ui, sans-serif';
    ctx.fillText('HARBORLIGHT', 640, 210);
    ctx.fillStyle = '#fff';
    ctx.font = '22px system-ui, sans-serif';
    ctx.fillText('An open-world crime story — steal, drive, run, and take the city.', 640, 252);
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillStyle = '#cfe0ea';
    ctx.fillText('Five jobs for Marta Solis. A city of five districts. The Harborlight PD is always watching.', 640, 282);
    const items = ['Story  —  five jobs for Marta', 'Continue  —  pick up your save', 'Free Roam  —  the city, no strings'];
    const hasSave = Game.hasSave();
    items.forEach((label, i) => {
      const y = 360 + i * 62;
      const sel = i === this.menuSel;
      if (i === 1 && !hasSave) ctx.globalAlpha = 0.45;
      ctx.fillStyle = sel ? '#ffd21f' : 'rgba(255,255,255,0.12)';
      ctx.fillRect(440, y - 30, 400, 44);
      ctx.fillStyle = sel ? '#101418' : '#fff';
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.fillText(label, 640, y);
      ctx.globalAlpha = 1;
    });
    ctx.fillStyle = '#9fb4c4';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText('WASD move / drive · E enter car · Click shoot · F punch · Shift run · Space handbrake · P pause · M mute', 640, 580);
    ctx.fillText('Your progress saves after every job. Up / Down to choose, Enter to play.', 640, 606);
    ctx.textAlign = 'left';
  }

  drawBriefing(ctx, job) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, 1280, 720);
    ctx.fillStyle = '#10181f';
    ctx.fillRect(340, 180, 600, 300);
    ctx.strokeStyle = '#ffd21f';
    ctx.lineWidth = 2;
    ctx.strokeRect(340, 180, 600, 300);
    ctx.fillStyle = '#ffd21f';
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.fillText(`JOB ${job.id} — ${job.name}`, 370, 228);
    ctx.fillStyle = '#fff';
    ctx.font = '16px system-ui, sans-serif';
    const words = job.brief.split(' ');
    let line = '', y = 268;
    for (const w of words) {
      if ((line + ' ' + w).length > 52) { ctx.fillText(line, 370, y); y += 24; line = w; }
      else line = line ? line + ' ' + w : w;
    }
    ctx.fillText(line, 370, y);
    ctx.fillStyle = '#8fe08f';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillText(`Reward: $${job.reward.toLocaleString('en-US')}`, 370, y + 48);
    ctx.fillStyle = '#cfe0ea';
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillText('Press E to take the job · Esc to walk away', 370, y + 82);
  }

  drawPanel(ctx, title, body) {
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, 0, 1280, 720);
    ctx.fillStyle = '#10181f';
    ctx.fillRect(390, 260, 500, 200);
    ctx.strokeStyle = '#ffd21f';
    ctx.lineWidth = 2;
    ctx.strokeRect(390, 260, 500, 200);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd21f';
    ctx.font = 'bold 40px system-ui, sans-serif';
    ctx.fillText(title, 640, 330);
    ctx.fillStyle = '#fff';
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillText(body, 640, 372);
    ctx.fillStyle = '#9fb4c4';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText('Enter to continue · Esc for the menu', 640, 420);
    ctx.textAlign = 'left';
  }
}
export { JOBS };
