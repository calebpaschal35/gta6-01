// Harborlight — wanted level + Harborlight PD pursuit.
function addWanted(state, n, reason) {
  state.wanted = clamp(state.wanted + n, 0, 5);
  state.lastSeen = 0;
  if (n > 0) state.toast('Wanted level ' + state.wanted + ' — ' + reason, '#ff6060');
}
function updateWanted(state, dt) {
  // Police can see the player when close or when the player is in a car chase.
  let seen = false;
  for (const cop of state.police) {
    const d = dist2(cop.x, cop.y, state.player.x, state.player.y);
    if (d < 520 * 520) { seen = true; break; }
  }
  if (state.wanted > 0) {
    if (seen) state.lastSeen = 0; else state.lastSeen += dt;
    if (state.lastSeen > CFG.WANTED_DECAY) {
      state.wanted -= 1;
      state.lastSeen = 0;
      state.toast(state.wanted === 0 ? 'You lost them. Clean.' : 'Wanted level ' + state.wanted, '#ffd060');
    }
  }
  // Spawn police to match the wanted level.
  const want = state.wanted === 0 ? 0 : Math.min(CFG.COP_MAX, 1 + state.wanted);
  while (state.police.length < want) {
    const a = state.rng.range(0, Math.PI * 2);
    const car = makeCar(6, state.player.x + Math.cos(a) * 700, state.player.y + Math.sin(a) * 700, a);
    car.police = true;
    car.speed = 200;
    state.police.push(car);
  }
  // Update police cars: chase, ram, shoot at 3+ stars.
  for (const cop of state.police) {
    const px = state.playerCar ? state.playerCar.x : state.player.x;
    const py = state.playerCar ? state.playerCar.y : state.player.y;
    const d = dist2(cop.x, cop.y, px, py);
    const target = angleTo(cop.x, cop.y, px, py);
    cop.angle += angleDiff(cop.angle, target) * Math.min(1, dt * 2.2);
    const wantSpeed = state.wanted >= 3 ? 330 : 270;
    cop.speed = lerp(cop.speed, d > 60 * 60 ? wantSpeed : wantSpeed * 0.4, Math.min(1, dt * 1.5));
    cop.x += Math.cos(cop.angle) * cop.speed * dt;
    cop.y += Math.sin(cop.angle) * cop.speed * dt;
    if (collideBuildings(state.city, cop.x, cop.y, 14)) {
      cop.x -= Math.cos(cop.angle) * cop.speed * dt * 2;
      cop.y -= Math.sin(cop.angle) * cop.speed * dt * 2;
      cop.angle += Math.PI / 2;
    }
    // Ram the player's car (steady damage, survivable for a few seconds).
    if (state.playerCar && d < 55 * 55) {
      state.playerCar.hp -= 25 * dt;
      state.playerCar.speed *= 0.98;
      if (state.playerCar.hp <= 0) wreckPlayerCar(state);
    }
    // On foot: busted if a cop touches the player at wanted >= 2.
    // A short grace period right after the car is wrecked, so the player
    // gets a chance to run instead of being busted on the spot.
    if (state.bustedGrace > 0) state.bustedGrace -= dt;
    if (!state.playerCar && d < 30 * 30 && state.wanted >= 2 && state.bustedGrace <= 0) {
      busted(state);
    }
    // Shoot at 3+ stars.
    cop.shootCd = (cop.shootCd || 1) - dt;
    if (state.wanted >= 3 && cop.shootCd <= 0 && d < 430 * 430) {
      cop.shootCd = 0.9 + state.rng.range(0, 0.6);
      state.bullets.push({
        x: cop.x + Math.cos(cop.angle) * 16, y: cop.y + Math.sin(cop.angle) * 16,
        vx: Math.cos(cop.angle + state.rng.range(-0.1, 0.1)) * 540,
        vy: Math.sin(cop.angle + state.rng.range(-0.1, 0.1)) * 540,
        life: 1.2, fromPlayer: false, dmg: 6,
      });
      AudioSys.shot();
    }
    if (cop.hp <= 0 && !cop.wrecked) { cop.wrecked = true; cop.smoke = 1; state.cash += 50; }
  }
  // Remove wrecked / far police; wanted drops when all are gone.
  state.police = state.police.filter((c) => !c.wrecked && dist2(c.x, c.y, state.player.x, state.player.y) < 1600 * 1600);
  AudioSys.siren(state.wanted > 0 && state.police.length > 0);
}
function wreckPlayerCar(state) {
  const car = state.playerCar;
  if (!car) return;
  car.wrecked = true; car.smoke = 1;
  state.bustedGrace = 2.5;
  AudioSys.explosion();
  spawnParticles(state, car.x, car.y, 26, '#ff8020');
  state.playerCar = null;
  state.player.x = car.x + 40; state.player.y = car.y + 40;
  state.player.hp -= 25;
  state.toast('Your car is wrecked!', '#ff6060');
  if (state.player.hp <= 0) wasted(state);
}
function busted(state) {
  if (state.screen !== 'play') return;
  state.screen = 'busted';
  AudioSys.busted();
  AudioSys.siren(false); AudioSys.engineStop();
  state.cash = Math.max(0, state.cash - 200);
}
function wasted(state) {
  if (state.screen !== 'play') return;
  state.screen = 'wasted';
  AudioSys.busted();
  AudioSys.siren(false); AudioSys.engineStop();
}
function respawn(state) {
  state.player.hp = CFG.PLAYER.hp;
  state.player.x = 1600; state.player.y = 1600;
  state.playerCar = null;
  state.wanted = 0;
  state.police = [];
  state.bullets = [];
  state.screen = 'play';
  state.toast('Back on the streets of Harborlight.', '#80d0ff');
}
