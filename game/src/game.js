// Harborlight — core game state, loop wiring, menus, save, interactions.
function newState() {
  return {
    city: null, rng: makeRng(99),
    player: { x: 1600, y: 1600, aim: 0, hp: CFG.PLAYER.hp },
    playerCar: null,
    traffic: [], parked: [], police: [], peds: [], gang: [], bullets: [], particles: [],
    toasts: [], wanted: 0, lastSeen: 0, cash: 250,
    weapon: 'pistol', ammo: 12, ownedSmg: false,
    mission: 0, missionStarted: false, missionStage: 0, missionTimer: 0,
    missionCarWrecks: 0, missionHold: 0, missionTarget: null, missionCoupe: null,
    storyDone: false, failedMission: -1,
    objective: 'Press T to start the first job for Marta.',
    screen: 'menu', // menu | play | pause | busted | wasted
    menuSel: 0, time: 0, clock: 9 * 60 + 15, // 09:15
    shotsFired: 0, lastHurtAt: -100, fireCd: 0,
    mouseWorldX: 0, mouseWorldY: 0, nearShop: false,
    cam: { x: 0, y: 0, w: 1280, h: 720 },
    scene: null,
  };
}
function initGame(state) {
  bindStateMethods(state);
  state.city = buildCity();
  spawnTraffic(state);
  spawnPeds(state);
  state.toasts = [];
  // Gun shop marker (Downtown) + boat at Palm Beach marina.
  state.shop = { x: 1500, y: 1300 };
  state.boat = { x: 3050, y: 1900 };
}
function toast(state, text, color) {
  state.toasts.push({ text, color: color || '#fff', life: 3.2 });
  if (state.toasts.length > 4) state.toasts.shift();
}
// Back-compat: addWanted uses state.toast as a method on the state object.
function bindStateMethods(state) {
  state.toast = (text, color) => toast(state, text, color);
}
function updateGame(state, dt) {
  state.time += dt;
  state.clock += dt * 0.35; // game clock runs ~20x
  if (state.clock >= 24 * 60) state.clock -= 24 * 60;
  for (const t of state.toasts) t.life -= dt;
  state.toasts = state.toasts.filter((t) => t.life > 0);
  const p = state.player;
  // Mouse world position (camera-relative).
  state.mouseWorldX = state.cam.x + Input.mouseX;
  state.mouseWorldY = state.cam.y + Input.mouseY;
  const ax = Input.axis();
  if (state.playerCar) {
    const car = state.playerCar;
    const throttle = ax.y < 0 ? 1 : ax.y > 0 ? -0.7 : 0;
    const steer = ax.x;
    carPhysics(car, dt, throttle, steer);
    if (collideBuildings(state.city, car.x, car.y, 16)) {
      car.x -= Math.cos(car.angle) * car.speed * dt * 2;
      car.y -= Math.sin(car.angle) * car.speed * dt * 2;
      car.speed *= 0.5;
      if (Math.abs(car.speed) > 120) { car.hp -= 8; spawnParticles(state, car.x, car.y, 5, '#c8c8c8'); }
      if (car.hp <= 0) wreckPlayerCar(state);
    }
    p.x = car.x; p.y = car.y;
    p.aim = car.angle;
    AudioSys.engineStart(Math.abs(car.speed) / CFG.CARS[car.model].top);
    // Exit car.
    if (Input.pressed('KeyE')) {
      state.playerCar = null;
      p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
      p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
      AudioSys.engineStop();
    }
  } else {
    AudioSys.engineStop();
    const run = Input.down('ShiftLeft') || Input.down('ShiftRight');
    const sp = run ? CFG.PLAYER.runSpeed : CFG.PLAYER.walkSpeed;
    let mx = ax.x, my = ax.y;
    const len = Math.hypot(mx, my);
    if (len > 0) { mx /= len; my /= len; }
    const nx = p.x + mx * sp * dt, ny = p.y + my * sp * dt;
    if (!collideBuildings(state.city, nx, p.y, 12)) p.x = nx;
    if (!collideBuildings(state.city, p.x, ny, 12)) p.y = ny;
    p.x = clamp(p.x, 20, CFG.WORLD - 20);
    p.y = clamp(p.y, 20, CFG.WORLD - 20);
    // Enter a nearby parked / traffic car.
    if (Input.pressed('KeyE')) {
      let best = null, bd = 60 * 60;
      for (const c of [...state.parked, ...state.traffic]) {
        if (c.wrecked || c.police) continue;
        const d = dist2(p.x, p.y, c.x, c.y);
        if (d < bd) { bd = d; best = c; }
      }
      if (best) {
        state.playerCar = best;
        best.parked = false;
        best.traffic = false;
        if (best === state.missionCoupe) addWanted(state, 0, '');
        else if (state.rng.chance(0.6)) addWanted(state, 1, 'grand theft auto');
        AudioSys.chime();
        state.toast('You are driving a ' + CFG.CARS[best.model].name + '.', '#80d0ff');
      }
    }
  }
  // Gun shop.
  state.nearShop = dist2(p.x, p.y, state.shop.x, state.shop.y) < 70 * 70;
  if (state.nearShop && Input.pressed('KeyB')) {
    if (!state.ownedSmg) {
      if (state.cash >= CFG.SMG_PRICE) {
        state.cash -= CFG.SMG_PRICE;
        state.ownedSmg = true; state.weapon = 'smg'; state.ammo = WEAPONS.smg.mag;
        state.toast('SMG bought — $' + CFG.SMG_PRICE, '#40d040');
        AudioSys.cash();
      } else state.toast('SMG costs $' + CFG.SMG_PRICE + ' — you have $' + state.cash, '#ff6060');
    } else if (state.cash >= CFG.AMMO_PRICE) {
      state.cash -= CFG.AMMO_PRICE; state.ammo = WEAPONS[state.weapon].mag;
      state.toast('Ammo bought — $' + CFG.AMMO_PRICE, '#80d0ff');
      AudioSys.cash();
    } else state.toast('Not enough cash for ammo.', '#ff6060');
  }
  // Start next job.
  if (Input.pressed('KeyT') && state.mission >= 0 && state.mission < MISSIONS.length && !state.missionStarted) {
    startMission(state, state.mission);
    state.missionStarted = true;
  }
  // Mute.
  if (Input.pressed('KeyM')) {
    const m = AudioSys.toggleMute();
    state.toast(m ? 'Muted' : 'Sound on', '#aaa');
  }
  updateTraffic(state, dt);
  updatePeds(state, dt);
  updateWanted(state, dt);
  updateCombat(state, dt);
  updateMissions(state, dt);
  updateParticles(state, dt);
  // Camera follows the player.
  const cw = state.cam.w, ch = state.cam.h;
  state.cam.x = clamp(p.x - cw / 2, 0, CFG.WORLD - cw);
  state.cam.y = clamp(p.y - ch / 2, 0, CFG.WORLD - ch);
}
function renderGame(ctx, state, W, H) {
  ctx.clearRect(0, 0, W, H);
  state.cam.w = W; state.cam.h = H;
  ctx.save();
  ctx.translate(-state.cam.x, -state.cam.y);
  drawCity(ctx, state.city, state.cam);
  // Mission target marker on the ground.
  const tgt = currentMissionTarget(state);
  if (tgt) {
    const pulse = 26 + 6 * Math.sin(performance.now() / 250);
    ctx.strokeStyle = '#ffd020'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(tgt.x, tgt.y, pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#ffd020';
    ctx.beginPath(); ctx.arc(tgt.x, tgt.y, 6, 0, Math.PI * 2); ctx.fill();
  }
  // Gun shop + boat markers.
  ctx.fillStyle = '#ffd020';
  ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('GUN SHOP', state.shop.x, state.shop.y - 18);
  ctx.fillStyle = '#40c0ff';
  ctx.fillText('MARINA', state.boat.x, state.boat.y - 18);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#8a6a4a';
  ctx.fillRect(state.shop.x - 16, state.shop.y - 10, 32, 20);
  ctx.fillStyle = '#e8e8e8';
  ctx.fillRect(state.boat.x - 22, state.boat.y - 8, 44, 16);
  for (const c of state.parked) if (!c.wrecked) drawCar(ctx, c);
  for (const c of state.traffic) drawCar(ctx, c);
  for (const c of state.police) drawCar(ctx, c);
  if (state.playerCar) drawCar(ctx, state.playerCar);
  drawPeople(ctx, state);
  if (!state.playerCar) drawPlayer(ctx, state);
  drawParticles(ctx, state);
  ctx.restore();
  drawHUD(ctx, state, W, H);
  drawMinimap(ctx, state, W, H);
}
// --- Menus / overlays (drawn in screen space) ---
function drawMenu(ctx, state, W, H) {
  ctx.fillStyle = '#1a2438'; ctx.fillRect(0, 0, W, H);
  // Sun-soaked skyline backdrop.
  ctx.fillStyle = '#e8a860'; ctx.fillRect(0, H - 260, W, 260);
  ctx.fillStyle = '#c08050';
  const rng = makeRng(3);
  let x = 0;
  while (x < W) { const bw = rng.range(50, 130), bh = rng.range(90, 230); ctx.fillRect(x, H - 260 - bh + 120, bw, bh); x += bw + 6; }
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd060';
  ctx.font = 'bold 72px sans-serif';
  ctx.fillText('HARBORLIGHT', W / 2, 170);
  ctx.fillStyle = '#fff';
  ctx.font = '28px sans-serif';
  ctx.fillText('An open-world crime story in the spirit of GTA 6', W / 2, 215);
  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#c8d0e0';
  ctx.fillText('Five districts. Five jobs for Marta Solis. One city that never sleeps.', W / 2, 250);
  const items = ['STORY — start the jobs', 'CONTINUE — resume your save', 'FREE ROAM — explore Harborlight'];
  for (let i = 0; i < items.length; i++) {
    const y = 330 + i * 62;
    const sel = state.menuSel === i;
    ctx.fillStyle = sel ? '#ffd060' : 'rgba(255,255,255,0.12)';
    roundRect(ctx, W / 2 - 260, y - 26, 520, 46, 8); ctx.fill();
    ctx.fillStyle = sel ? '#1a2438' : '#fff';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(items[i], W / 2, y + 5);
  }
  ctx.fillStyle = '#98a0b0';
  ctx.font = '14px sans-serif';
  ctx.fillText('WASD move / drive · E steal car · Mouse aim, click to shoot · T next job · M mute', W / 2, 560);
  ctx.fillText('Original game. Nothing from Rockstar Games. Built for make.fun — gta6-01.', W / 2, 586);
  ctx.textAlign = 'left';
}
function drawOverlay(ctx, state, W, H, title, lines, color) {
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = color || '#fff';
  ctx.font = 'bold 54px sans-serif';
  ctx.fillText(title, W / 2, H / 2 - 40);
  ctx.fillStyle = '#fff';
  ctx.font = '18px sans-serif';
  lines.forEach((l, i) => ctx.fillText(l, W / 2, H / 2 + 10 + i * 28));
  ctx.fillStyle = '#ffd060';
  ctx.font = 'bold 17px sans-serif';
  ctx.fillText('Press ENTER to keep playing', W / 2, H / 2 + 130);
  ctx.textAlign = 'left';
}
// --- Save / load ---
function saveGame(state) {
  try {
    localStorage.setItem(CFG.SAVE_KEY, JSON.stringify({
      cash: state.cash, mission: state.mission, ownedSmg: state.ownedSmg,
      x: state.player.x, y: state.player.y, storyDone: state.storyDone,
    }));
  } catch (e) {}
}
function loadGame(state) {
  try {
    const raw = localStorage.getItem(CFG.SAVE_KEY);
    if (!raw) return false;
    const s = JSON.parse(raw);
    state.cash = s.cash; state.mission = s.mission; state.ownedSmg = !!s.ownedSmg;
    state.player.x = s.x; state.player.y = s.y; state.storyDone = !!s.storyDone;
    state.missionStarted = false;
    state.objective = 'Press T to start the next job for Marta.';
    return true;
  } catch (e) { return false; }
}
function hasSave() {
  try { return !!localStorage.getItem(CFG.SAVE_KEY); } catch (e) { return false; }
}
