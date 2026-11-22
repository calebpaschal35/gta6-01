// Harborlight — weapons, shooting, bullets.
const WEAPONS = {
  fists: { name: 'Fists', dmg: 12, rate: 0.45, range: 42, auto: false, mag: Infinity },
  pistol: { name: 'Pistol', dmg: 16, rate: 0.28, range: 420, auto: false, mag: 12 },
  smg: { name: 'SMG', dmg: 11, rate: 0.09, range: 380, auto: true, mag: 30 },
};
function updateCombat(state, dt) {
  const w = WEAPONS[state.weapon];
  state.fireCd -= dt;
  const p = state.player;
  // Aim at the mouse (world coords).
  p.aim = Math.atan2(state.mouseWorldY - p.y, state.mouseWorldX - p.x);
  const wantFire = w.auto ? Input.mouseDown : Input.clicked();
  if (wantFire && state.fireCd <= 0 && state.screen === 'play') {
    if (state.weapon === 'fists') {
      state.fireCd = w.rate;
      state.shotsFired++;
      // Melee arc: hit gang / cops / peds in front.
      const hit = nearestEnemy(state, p.x + Math.cos(p.aim) * 26, p.y + Math.sin(p.aim) * 26, 40);
      if (hit) damageEnemy(state, hit, w.dmg);
      AudioSys._tone(140, 0.08, 'square', 0.1, 70);
    } else if (state.ammo > 0) {
      state.fireCd = w.rate;
      state.ammo--;
      state.shotsFired++;
      const spread = state.weapon === 'smg' ? 0.09 : 0.03;
      const a = p.aim + state.rng.range(-spread, spread);
      state.bullets.push({
        x: p.x + Math.cos(p.aim) * 18, y: p.y + Math.sin(p.aim) * 18,
        vx: Math.cos(a) * 760, vy: Math.sin(a) * 760,
        life: 0.9, fromPlayer: true, dmg: w.dmg,
      });
      AudioSys.shot();
      if (state.ammo === 0) state.toast('Out of ammo — press R to reload ($' + CFG.AMMO_PRICE + ')', '#ffd060');
    } else {
      state.fireCd = 0.25;
      AudioSys.click();
    }
  }
  // Reload.
  if (Input.pressed('KeyR') && state.weapon !== 'fists' && state.ammo < w.mag) {
    if (state.cash >= CFG.AMMO_PRICE) {
      state.cash -= CFG.AMMO_PRICE;
      state.ammo = w.mag;
      state.toast('Reloaded ' + w.name + ' — $' + CFG.AMMO_PRICE, '#80d0ff');
      AudioSys.chime();
    } else {
      state.toast('Not enough cash to reload ($' + CFG.AMMO_PRICE + ')', '#ff6060');
    }
  }
  // Weapon switch: 1 fists, 2 pistol, 3 SMG (if owned).
  if (Input.pressed('Digit1')) { state.weapon = 'fists'; AudioSys.click(); }
  if (Input.pressed('Digit2')) { state.weapon = 'pistol'; state.ammo = Math.min(state.ammo, WEAPONS.pistol.mag); AudioSys.click(); }
  if (Input.pressed('Digit3') && state.ownedSmg) { state.weapon = 'smg'; AudioSys.click(); }
  // Bullets fly.
  for (const b of state.bullets) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (collideBuildings(state.city, b.x, b.y, 2)) { b.life = 0; spawnParticles(state, b.x, b.y, 3, '#c8c8c8'); continue; }
    if (b.fromPlayer) {
      const hit = nearestEnemy(state, b.x, b.y, 16);
      if (hit) { damageEnemy(state, hit, b.dmg); b.life = 0; continue; }
      // Shoot traffic / gang cars.
      for (const c of [...state.traffic, ...state.police]) {
        if (c.wrecked) continue;
        if (Math.abs(b.x - c.x) < 26 && Math.abs(b.y - c.y) < 16) {
          c.hp -= b.dmg; b.life = 0;
          spawnParticles(state, b.x, b.y, 4, '#ffb020');
          if (c.hp <= 0 && !c.wrecked) {
            c.wrecked = true; c.smoke = 1; AudioSys.explosion();
            spawnParticles(state, c.x, c.y, 24, '#ff8020');
            if (c.police) { addWanted(state, 1, 'cop car destroyed'); state.cash += 50; }
            if (c.gang) state.missionCarWrecks = (state.missionCarWrecks || 0) + 1;
          }
          break;
        }
      }
      if (b.life <= 0) continue;
      // Shoot parked cars.
      for (const c of state.parked) {
        if (c.wrecked) continue;
        if (Math.abs(b.x - c.x) < 26 && Math.abs(b.y - c.y) < 16) {
          c.hp -= b.dmg; b.life = 0;
          if (c.hp <= 0) { c.wrecked = true; c.smoke = 1; AudioSys.explosion(); }
          break;
        }
      }
    } else {
      // Enemy bullets hit the player (or the player's car).
      const tx = state.playerCar ? state.playerCar.x : p.x;
      const ty = state.playerCar ? state.playerCar.y : p.y;
      const rr = state.playerCar ? 26 : 12;
      if (dist2(b.x, b.y, tx, ty) < rr * rr) {
        b.life = 0;
        state.lastHurtAt = state.time;
        if (state.playerCar) {
          state.playerCar.hp -= b.dmg;
          if (state.playerCar.hp <= 0) wreckPlayerCar(state);
        } else {
          p.hp -= b.dmg;
          AudioSys.hurt();
          spawnParticles(state, p.x, p.y, 5, '#ff4040');
          if (p.hp <= 0) wasted(state);
        }
      }
    }
  }
  state.bullets = state.bullets.filter((b) => b.life > 0);
  // Slow HP regen out of combat.
  if (state.time - state.lastHurtAt > 8 && p.hp > 0 && p.hp < CFG.PLAYER.hp) {
    p.hp = Math.min(CFG.PLAYER.hp, p.hp + 4 * dt);
  }
}
function nearestEnemy(state, x, y, r) {
  let best = null, bd = r * r;
  for (const g of state.gang) {
    if (g.hp <= 0) continue;
    const d = dist2(x, y, g.x, g.y);
    if (d < bd) { bd = d; best = g; }
  }
  return best;
}
function damageEnemy(state, g, dmg) {
  g.hp -= dmg;
  spawnParticles(state, g.x, g.y, 6, '#ff4040');
  if (g.hp <= 0) {
    state.cash += 25;
    AudioSys.cash();
    addWanted(state, 0, ''); // no wanted change for gang kills in self-defence
    state.toast('Redline down — +$25', '#80d0ff');
  }
}
