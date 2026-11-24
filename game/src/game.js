// Harborlight — main game: state machine, loop, rendering, save/load, wanted.
import { WORLD, CAR_MODELS, POLICE_MODEL, PLAYER, WANTED, MISSIONS, SAVE_KEY, SEED } from './config.js';
import { Rng, clamp, dist, angleTo } from './rng.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { City } from './city.js';
import { Vehicle, makeTrafficCar, makeParkedCar, carsCollide, separateCars } from './vehicles.js';
import { Ped, GangMember, spawnPeds } from './people.js';
import { Police } from './police.js';
import { Combat } from './combat.js';
import { Missions } from './missions.js';
import { Hud } from './hud.js';
import { Minimap } from './minimap.js';
import { Particles } from './particles.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.vw = canvas.width; this.vh = canvas.height;
    this.input = new Input(canvas);
    this.audio = new AudioSys();
    this.city = new City();
    this.rng = new Rng(SEED);
    this.particles = new Particles();
    this.combat = new Combat();
    this.police = new Police();
    this.missions = new Missions();
    this.hud = new Hud();
    this.minimap = new Minimap();
    this.state = 'menu'; // menu | playing | paused | busted | wasted
    this.mode = 'story';
    this.time = 0;
    this.clock = 8 * 60;
    this.objective = 'Welcome to Harborlight — pick a mode to start.';
    this.camera = { x: 0, y: 0 };
    this.player = this.freshPlayer();
    this.cars = []; this.peds = []; this.gang = []; this.gangCars = [];
    this.bustedTimer = 0; this.bustedGraceUntil = -1;
    this.unseenTimer = 0; this.wantedDropTimer = 0;
    this._reloadPending = false;
    this._spawned = false;
    this.loop = this.loop.bind(this);
    this._last = 0;
    this._raf = 0;
    this._err = null;
    window.addEventListener('error', (e) => { this._err = String(e.message || e.error); });
    window.__harborlight = this;
  }
  freshPlayer() {
    return {
      x: PLAYER.startX, y: PLAYER.startY, angle: -Math.PI / 2,
      hp: PLAYER.maxHp, cash: PLAYER.startCash, wanted: 0,
      inCar: false, car: null, weapon: 'pistol', ammo: 12, hasSmg: false,
      lastHurtAt: -100, w: 26, h: 26, runT: 0,
    };
  }
  spawnWorld() {
    if (this._spawned) return;
    this._spawned = true;
    // traffic
    for (let i = 0; i < 14; i++) this.cars.push(makeTrafficCar(this.city, this.rng, CAR_MODELS));
    // parked cars incl. the job-1 coupe at the garage (on the road, clear)
    const L = this.city.landmarks;
    this.cars.push(makeParkedCar(this.city, this.rng, CAR_MODELS, L.garage.x, L.garage.y, 0, 2));
    const spots = [
      [1000, 700], [2200, 1100], [2600, 1900], [1400, 2400], [2600, 900], [600, 1500], [1800, 2700], [2200, 300],
    ];
    for (const [x, y] of spots) this.cars.push(makeParkedCar(this.city, this.rng, CAR_MODELS, x, y, this.rng.range(0, Math.PI * 2)));
    this.peds = spawnPeds(this.city, this.rng, 26);
  }
  start() { this._raf = requestAnimationFrame(this.loop); }
  startStory() {
    this.spawnWorld();
    this.mode = 'story';
    this.state = 'playing';
    this.audio.ensure();
    this.addObjective('Meet Marta — press J to start the next job.');
    this.missions.start(this);
  }
  startFreeRoam() {
    this.spawnWorld();
    this.mode = 'freeroam';
    this.state = 'playing';
    this.audio.ensure();
    this.addObjective('Free Roam — explore Harborlight. Press J for a job.');
  }
  continueGame() {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) { this.startStory(); return; }
    try {
      const s = JSON.parse(raw);
      this.spawnWorld();
      this.mode = 'story';
      this.player.x = s.x; this.player.y = s.y; this.player.hp = s.hp;
      this.player.cash = s.cash; this.player.wanted = 0;
      this.player.weapon = s.weapon || 'pistol'; this.player.ammo = s.ammo != null ? s.ammo : 12;
      this.player.hasSmg = !!s.hasSmg;
      this.missions.index = s.missionIndex || 0;
      this.missions.completed = s.missionIndex || 0;
      this.state = 'playing';
      this.audio.ensure();
      this.addObjective('Welcome back — press J to start the next job.');
    } catch (e) { this.startStory(); }
  }
  saveGame() {
    const p = this.player;
    const s = { x: p.x, y: p.y, hp: p.hp, cash: p.cash, weapon: p.weapon, ammo: p.ammo, hasSmg: p.hasSmg, missionIndex: this.missions.index };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch (e) {}
  }
  addObjective(t) { this.objective = t; }
  addWanted(n, why) {
    const p = this.player;
    const before = p.wanted;
    p.wanted = Math.min(5, p.wanted + n);
    this.unseenTimer = 0; this.wantedDropTimer = 0;
    if (p.wanted > before) this.addObjective(`Wanted level ${p.wanted} — ${why || 'the law is after you'}`);
  }
  fireBullet(x, y, angle, damage, owner) { this.combat.fireBullet(this, x, y, angle, damage, owner); }
  wreckPlayerCar() {
    const p = this.player;
    if (!p.inCar || !p.car) return;
    const car = p.car;
    car.dead = true; car.hp = 0;
    this.particles.smoke(car.x, car.y);
    this.particles.sparks(car.x, car.y);
    this.audio.crash();
    p.inCar = false; p.car = null;
    p.x = car.x + 30; p.y = car.y + 30;
    this.bustedGraceUntil = this.time + WANTED.bustedGrace; // 2.5s grace before busted can trigger
  }
  onPlayerDown(src) {
    const p = this.player;
    if (p.inCar) { this.busted('Busted'); return; }
    this.state = 'wasted';
    p.cash = Math.floor(p.cash * 0.9);
    this.audio.busted();
  }
  busted(why) {
    const p = this.player;
    this.state = 'busted';
    p.cash = Math.floor(p.cash * 0.9);
    p.wanted = 0;
    this.police.cars = [];
    this.audio.busted();
  }
  onGangKilled(g) { /* gang member down; no wanted for mission kills */ }
  enterCar(car) {
    const p = this.player;
    if (!car || car.dead || car.isPolice) return false;
    if (car.isParked) { this.addWanted(1, 'stole a car'); }
    car.isParked = false; car.isTraffic = false; car.ai = null;
    p.inCar = true; p.car = car;
    p.x = car.x; p.y = car.y;
    this.audio.pickup();
    return true;
  }
  exitCar() {
    const p = this.player;
    if (!p.inCar || !p.car) return;
    const car = p.car;
    p.inCar = false; p.car = null;
    p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
    p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
    car.speed = 0;
  }
  buySmg() {
    const p = this.player;
    if (p.hasSmg || p.cash < 800) return false;
    p.cash -= 800; p.hasSmg = true; p.weapon = 'smg'; p.ammo = 30;
    this.audio.cash();
    this.addObjective('SMG bought — press 3 to equip it.');
    return true;
  }
  teleport(x, y) { const p = this.player; p.x = x; p.y = y; if (p.inCar && p.car) { p.car.x = x; p.car.y = y; } }
  // ---- mission 4 gang cars ----
  spawnGangCars() {
    const L = this.city.landmarks;
    for (let i = 0; i < 3; i++) {
      const car = new Vehicle(CAR_MODELS[6], 1500 + i * 120, 420 + i * 60, 0);
      car.isGang = true; car.color = '#c02020';
      this.cars.push(car); this.gangCars.push(car);
      this.gang.push(new GangMember(car.x + 40, car.y, this.rng));
    }
  }
  updateGangCars(dt) {
    const p = this.player;
    for (const car of this.gangCars) {
      if (car.dead) continue;
      const tx = p.inCar ? p.car.x : p.x, ty = p.inCar ? p.car.y : p.y;
      const d = dist(car.x, car.y, tx, ty);
      const want = Math.atan2(ty - car.y, tx - car.x);
      const diff = (want - car.angle + Math.PI * 3) % (Math.PI * 2) - Math.PI;
      car.speed += (520 - car.speed) * Math.min(1, dt * 0.8);
      car.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff * 2));
      const dx = Math.cos(car.angle) * car.speed * dt, dy = Math.sin(car.angle) * car.speed * dt;
      this.city.resolveMove(car, dx, dy);
      if (d < 60) {
        // ram the player
        if (p.inCar) { p.car.hp -= 18 * dt; if (p.car.hp <= 0) this.wreckPlayerCar(); }
        else this.combat.hurtPlayer(this, 10 * dt, 'gang');
        car.hp -= 6 * dt;
      }
      if (car.hp <= 0 && !car.dead) {
        car.dead = true;
        this.particles.smoke(car.x, car.y);
        this.missions.onGangCarWrecked(this);
      }
    }
  }
  // ---- main loop ----
  loop(ts) {
    this._raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, (ts - this._last) / 1000 || 0.016);
    this._last = ts;
    // Pause toggle lives here (not in update) so one press toggles exactly once.
    if (this.input.hit('Escape') || this.input.hit('KeyP')) {
      if (this.state === 'playing') this.state = 'paused';
      else if (this.state === 'paused') this.state = 'playing';
    }
    if (this.state === 'playing') this.update(dt);
    this.render();
    this.input.endFrame();
  }
  update(dt) {
    this.time += dt;
    this.clock = (this.clock + dt * 2) % (24 * 60);
    const p = this.player, input = this.input;
    this.audio.update(dt);
    // mute
    if (input.hit('KeyM')) this.audio.setMuted(!this.audio.muted);
    // weapon switch
    if (input.hit('Digit1')) { p.weapon = 'fists'; }
    if (input.hit('Digit2')) { p.weapon = 'pistol'; if (p.ammo <= 0) p.ammo = 12; }
    if (input.hit('Digit3') && p.hasSmg) { p.weapon = 'smg'; if (p.ammo <= 0) p.ammo = 30; }
    if (input.hit('KeyR')) this.combat.reload(this);
    // start next job
    if (input.hit('KeyJ') && this.mode === 'story') {
      if (!this.missions.active) {
        if (this.missions.index === 3 && this.gangCars.length === 0) this.spawnGangCars();
        // Mission 3 is a 3-star tail: set wanted to exactly 3 (not add 3).
        if (this.missions.index === 2) { this.player.wanted = 3; this.unseenTimer = 0; this.wantedDropTimer = 0; }
        this.missions.start(this);
      }
    }
    // aim
    const wx = this.camera.x + input.mouse.x, wy = this.camera.y + input.mouse.y;
    p.angle = angleTo(p.x, p.y, wx, wy);
    // enter / exit car, buy SMG
    if (input.hit('KeyE')) {
      if (p.inCar) this.exitCar();
      else {
        let best = null, bd = 70;
        for (const c of this.cars) {
          if (c.dead || c.isPolice) continue;
          const d = dist(p.x, p.y, c.x, c.y);
          if (d < bd && (c.isParked || Math.abs(c.speed) < 30)) { bd = d; best = c; }
        }
        if (best) this.enterCar(best);
        else {
          const gs = this.city.landmarks.gunShop;
          if (dist(p.x, p.y, gs.x, gs.y) < 90 && !p.hasSmg && p.cash >= 800) this.buySmg();
        }
      }
    }
    // movement
    if (p.inCar && p.car) {
      const ax = input.axis();
      p.car.updateDrive(dt, { x: ax.x, y: -ax.y, hb: input.down('Space') || input.down('ShiftLeft') }, this.city);
      p.x = p.car.x; p.y = p.car.y;
      p.angle = p.car.angle;
      this.audio.setEngine(Math.abs(p.car.speed) / p.car.model.top, true);
      if (p.car.drifting && Math.abs(p.car.speed) > 200) this.particles.smoke(p.car.x - Math.cos(p.car.angle) * 20, p.car.y - Math.sin(p.car.angle) * 20);
    } else {
      const ax = input.axis();
      const sp = (input.down('ShiftLeft') || input.down('ShiftRight')) ? PLAYER.runSpeed : PLAYER.walkSpeed;
      const len = Math.hypot(ax.x, ax.y) || 1;
      const dx = (ax.x / len) * sp * dt * (ax.x || ax.y ? 1 : 0);
      const dy = (ax.y / len) * sp * dt * (ax.x || ax.y ? 1 : 0);
      this.city.resolveMove(p, dx, dy);
      this.audio.setEngine(0, false);
    }
    // firing
    if (input.mouse.down || input.mouse.clicked) {
      const fx = p.inCar && p.car ? p.car.x : p.x, fy = p.inCar && p.car ? p.car.y : p.y;
      this.combat.fire(this, fx, fy, p.angle, 'player');
    }
    // traffic + peds + gang
    for (const c of this.cars) if (c.isTraffic && !c.dead) c.updateTraffic(dt, this.city, this.rng);
    for (const ped of this.peds) ped.update(dt, this.city, p.x, p.y);
    for (const g of this.gang) g.update(dt, this.city, p.x, p.y, (x, y, a, d, o) => this.fireBullet(x, y, a, d, o));
    this.updateGangCars(dt);
    this.police.update(dt, this);
    this.combat.update(dt, this);
    this.particles.update(dt);
    this.missions.update(dt, this);
    // car-car collisions
    for (let i = 0; i < this.cars.length; i++) {
      const a = this.cars[i];
      if (a.dead) continue;
      for (let j = i + 1; j < this.cars.length; j++) {
        const b = this.cars[j];
        if (b.dead) continue;
        if (carsCollide(a, b)) {
          separateCars(a, b);
          const rel = Math.abs(a.speed - b.speed);
          if (rel > 260) {
            a.hp -= rel * 0.03; b.hp -= rel * 0.03;
            this.particles.sparks((a.x + b.x) / 2, (a.y + b.y) / 2);
            if (a.hp <= 0 && a.isGang && !a.dead) { a.dead = true; this.missions.onGangCarWrecked(this); }
            if (b.hp <= 0 && b.isGang && !b.dead) { b.dead = true; this.missions.onGangCarWrecked(this); }
            if (a === p.car || b === p.car) this.audio.crash();
          }
        }
      }
    }
    // player car vs police cars (ram already handled in police.js)
    // health regen after 5s without damage
    if (this.time - p.lastHurtAt > 5 && p.hp > 0 && p.hp < PLAYER.maxHp) p.hp = Math.min(PLAYER.maxHp, p.hp + 2 * dt);
    // wanted decay: unseen = no police within sight range
    const nearest = this.police.nearestDist(p);
    if (nearest > WANTED.decaySight || p.wanted === 0) {
      this.unseenTimer += dt;
      if (this.unseenTimer > WANTED.decayWait && p.wanted > 0) {
        this.wantedDropTimer += dt;
        if (this.wantedDropTimer >= WANTED.decayStep) {
          p.wanted -= 1; this.wantedDropTimer = 0;
          if (p.wanted === 0) this.addObjective('You lost the cops.');
        }
      }
    } else { this.unseenTimer = 0; this.wantedDropTimer = 0; }
    // busted: on foot, police close for 1.5s at wanted>=2, after grace period
    if (!p.inCar && p.wanted >= 2 && this.time > this.bustedGraceUntil) {
      if (nearest < WANTED.bustedRange) {
        this.bustedTimer += dt;
        if (this.bustedTimer >= WANTED.bustedTime) { this.bustedTimer = 0; this.busted('Busted'); }
      } else this.bustedTimer = 0;
    } else this.bustedTimer = 0;
    // camera
    const tx = clamp(p.x - this.vw / 2, 0, WORLD - this.vw);
    const ty = clamp(p.y - this.vh / 2, 0, WORLD - this.vh);
    this.camera.x += (tx - this.camera.x) * Math.min(1, dt * 5);
    this.camera.y += (ty - this.camera.y) * Math.min(1, dt * 5);
    // autosave
    if (this.time - (this._lastSave || 0) > 20) { this._lastSave = this.time; this.saveGame(); }
  }
  render() {
    const ctx = this.ctx, cam = this.camera;
    ctx.fillStyle = '#0e0e12';
    ctx.fillRect(0, 0, this.vw, this.vh);
    if (this.state === 'menu') { this.renderMenu(); return; }
    this.city.draw(ctx, cam, this.vw, this.vh);
    // waypoint beacon
    const wp = this.missions.waypoint(this);
    if (wp) {
      const pulse = 14 + Math.sin(this.time * 4) * 5;
      ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(wp.x - cam.x, wp.y - cam.y, pulse, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#ffd23f'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(wp.label, wp.x - cam.x, wp.y - cam.y - 22);
      ctx.textAlign = 'left';
    }
    // landmarks
    for (const [k, L] of Object.entries(this.city.landmarks)) {
      ctx.fillStyle = k === 'gunShop' ? '#e8c832' : '#7ec8ff';
      ctx.beginPath(); ctx.arc(L.x - cam.x, L.y - cam.y, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(L.name, L.x - cam.x, L.y - cam.y - 12);
      ctx.textAlign = 'left';
    }
    for (const c of this.cars) if (!c.dead) c.draw(ctx, cam);
    for (const ped of this.peds) ped.draw(ctx, cam);
    for (const g of this.gang) g.draw(ctx, cam);
    this.police.draw(ctx, cam);
    this.combat.draw(ctx, cam);
    this.particles.draw(ctx, cam);
    this.drawPlayer(ctx, cam);
    this.hud.draw(ctx, this, this.vw, this.vh);
    this.minimap.draw(ctx, this, this.vw, this.vh);
    // prompts
    const p = this.player;
    if (!p.inCar) {
      let prompt = '';
      for (const c of this.cars) {
        if (!c.dead && !c.isPolice && dist(p.x, p.y, c.x, c.y) < 70 && (c.isParked || Math.abs(c.speed) < 30)) { prompt = c.isParked ? `Press E — steal ${c.model.name}` : `Press E — enter ${c.model.name}`; break; }
      }
      const gs = this.city.landmarks.gunShop;
      if (!prompt && dist(p.x, p.y, gs.x, gs.y) < 90) prompt = p.hasSmg ? 'Old Town Guns' : 'Press E — buy SMG ($800)';
      if (prompt) {
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.fillRect(this.vw / 2 - 150, this.vh - 170, 300, 30);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(prompt, this.vw / 2, this.vh - 150);
        ctx.textAlign = 'left';
      }
    }
    if (this.state === 'paused') this.hud.drawCenter(ctx, this.vw, this.vh, ['PAUSED', 'Esc / P — resume', 'M — mute', 'J — next job'], '#ffe9a8');
    if (this.state === 'busted') this.hud.drawCenter(ctx, this.vw, this.vh, ['BUSTED', 'The Harborlight PD got you. You lost 10% of your cash.', 'Press Enter to continue'], '#ff6b6b');
    if (this.state === 'wasted') this.hud.drawCenter(ctx, this.vw, this.vh, ['WASTED', 'You went down. You lost 10% of your cash.', 'Press Enter to continue'], '#ff6b6b');
    // Enter to continue from busted/wasted
    if ((this.state === 'busted' || this.state === 'wasted') && this.input.hit('Enter')) {
      this.player.hp = PLAYER.maxHp;
      this.player.x = this.city.landmarks.hospital.x; this.player.y = this.city.landmarks.hospital.y;
      this.player.wanted = 0;
      this.state = 'playing';
    }
  }
  drawPlayer(ctx, cam) {
    const p = this.player;
    if (p.inCar) return;
    ctx.save();
    ctx.translate(p.x - cam.x, p.y - cam.y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(0, 6, 11, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(p.angle);
    ctx.fillStyle = '#2a6b8a';
    ctx.fillRect(-9, -8, 18, 16);
    ctx.fillStyle = '#e8c8a0';
    ctx.beginPath(); ctx.arc(6, 0, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#222';
    ctx.fillRect(8, -2, 14, 4);
    ctx.restore();
    // health ring when hurt
    if (p.hp < 100) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(p.x - cam.x - 16, p.y - cam.y - 26, 32, 5);
      ctx.fillStyle = p.hp > 50 ? '#7ee081' : '#e05a5a';
      ctx.fillRect(p.x - cam.x - 16, p.y - cam.y - 26, 32 * (p.hp / 100), 5);
    }
  }
  renderMenu() {
    const ctx = this.ctx, vw = this.vw, vh = this.vh;
    ctx.fillStyle = '#0d1526';
    ctx.fillRect(0, 0, vw, vh);
    ctx.fillStyle = '#1a2a4a';
    ctx.fillRect(0, vh - 180, vw, 180);
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 64px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('HARBORLIGHT', vw / 2, 130);
    ctx.fillStyle = '#9ab0d8';
    ctx.font = '20px sans-serif';
    ctx.fillText('An open-world crime story — Jesse Kane & Marta Solis', vw / 2, 168);
    ctx.fillStyle = '#e8e8e8';
    ctx.font = '15px sans-serif';
    ctx.fillText('WASD move / drive  •  Mouse aim  •  Click fire  •  E enter car  •  1/2/3 weapons  •  J jobs  •  Esc pause', vw / 2, 210);
    const btns = [
      { label: 'STORY', sub: 'Five jobs for Marta Solis', key: '1', y: 280 },
      { label: 'CONTINUE', sub: 'Resume your saved game', key: '2', y: 360 },
      { label: 'FREE ROAM', sub: 'Explore Harborlight, no story', key: '3', y: 440 },
    ];
    this._menuBtns = btns.map((b) => ({ ...b, x: vw / 2 - 180, w: 360, h: 56 }));
    for (const b of this._menuBtns) {
      ctx.fillStyle = '#22406e';
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = '#4a7ab8'; ctx.lineWidth = 2;
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 22px sans-serif';
      ctx.fillText(b.label, vw / 2, b.y + 26);
      ctx.fillStyle = '#9ab0d8'; ctx.font = '13px sans-serif';
      ctx.fillText(b.sub, vw / 2, b.y + 46);
    }
    ctx.fillStyle = '#6a7a94'; ctx.font = '13px sans-serif';
    ctx.fillText('All original — a fan-made tribute, not affiliated with Rockstar Games.', vw / 2, vh - 30);
    ctx.textAlign = 'left';
    // clicks + keys
    if (this.input.mouse.clicked) {
      for (const b of this._menuBtns) {
        if (this.input.mouse.x >= b.x && this.input.mouse.x <= b.x + b.w && this.input.mouse.y >= b.y && this.input.mouse.y <= b.y + b.h) {
          if (b.label === 'STORY') this.startStory();
          if (b.label === 'CONTINUE') this.continueGame();
          if (b.label === 'FREE ROAM') this.startFreeRoam();
        }
      }
    }
    if (this.input.hit('Digit1') || this.input.hit('Enter')) this.startStory();
    if (this.input.hit('Digit2')) this.continueGame();
    if (this.input.hit('Digit3')) this.startFreeRoam();
  }
}
