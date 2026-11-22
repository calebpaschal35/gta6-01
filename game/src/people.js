// Harborlight — pedestrians and Redline gang members.
function spawnPeds(state) {
  state.peds = [];
  for (let i = 0; i < CFG.PED_COUNT; i++) {
    const x = state.rng.range(100, CFG.WORLD - 100);
    const y = state.rng.range(100, CFG.WORLD - 100);
    if (isWater(x, y)) continue;
    state.peds.push({
      x, y, angle: state.rng.range(0, Math.PI * 2), speed: state.rng.range(25, 55),
      color: state.rng.pick(['#d06060', '#60a060', '#6080d0', '#d0a060', '#a060c0', '#e0e0e0']),
      tx: x, ty: y, wait: state.rng.range(0, 4),
    });
  }
  state.gang = [];
}
function updatePeds(state, dt) {
  for (const p of state.peds) {
    if (p.wait > 0) { p.wait -= dt; continue; }
    const d = dist2(p.x, p.y, p.tx, p.ty);
    if (d < 30 * 30) {
      p.tx = clamp(p.x + state.rng.range(-300, 300), 60, CFG.WORLD - 60);
      p.ty = clamp(p.y + state.rng.range(-300, 300), 60, CFG.WORLD - 60);
      if (isWater(p.tx, p.ty)) { p.tx = p.x; p.ty = p.y; }
      p.wait = state.rng.range(1, 5);
      continue;
    }
    const a = angleTo(p.x, p.y, p.tx, p.ty);
    p.angle += angleDiff(p.angle, a) * Math.min(1, dt * 5);
    p.x += Math.cos(p.angle) * p.speed * dt;
    p.y += Math.sin(p.angle) * p.speed * dt;
    // Peds avoid buildings.
    if (collideBuildings(state.city, p.x, p.y, 8)) {
      p.x -= Math.cos(p.angle) * p.speed * dt * 2;
      p.y -= Math.sin(p.angle) * p.speed * dt * 2;
      p.tx = p.x; p.ty = p.y;
    }
    // Peds flee from gunfire near them.
    if (state.shotsFired > 0) {
      const pd = dist2(p.x, p.y, state.player.x, state.player.y);
      if (pd < 400 * 400 && state.rng.chance(dt * 2)) {
        p.tx = p.x + (p.x - state.player.x);
        p.ty = p.y + (p.y - state.player.y);
        p.speed = 110;
      }
    }
  }
  // Gang members: hostile, shoot at the player when close.
  for (const g of state.gang) {
    if (g.hp <= 0) continue;
    const d = dist2(g.x, g.y, state.player.x, state.player.y);
    const inCar = !!state.playerCar;
    if (d < 420 * 420) {
      const a = angleTo(g.x, g.y, state.player.x, state.player.y);
      g.angle += angleDiff(g.angle, a) * Math.min(1, dt * 4);
      if (d > 130 * 130) {
        g.x += Math.cos(g.angle) * 90 * dt;
        g.y += Math.sin(g.angle) * 90 * dt;
      }
      g.shootCd -= dt;
      if (g.shootCd <= 0 && d < 380 * 380) {
        g.shootCd = 1.1 + state.rng.range(0, 0.7);
        state.bullets.push({
          x: g.x + Math.cos(g.angle) * 14, y: g.y + Math.sin(g.angle) * 14,
          vx: Math.cos(g.angle + state.rng.range(-0.08, 0.08)) * 520,
          vy: Math.sin(g.angle + state.rng.range(-0.08, 0.08)) * 520,
          life: 1.2, fromPlayer: false, dmg: 7,
        });
        AudioSys.shot();
      }
    } else {
      g.shootCd -= dt;
      g.x += Math.cos(g.angle) * 40 * dt;
      g.y += Math.sin(g.angle) * 40 * dt;
    }
  }
  state.gang = state.gang.filter((g) => g.hp > 0);
}
function spawnGang(state, x, y, n) {
  for (let i = 0; i < n; i++) {
    state.gang.push({
      x: x + state.rng.range(-90, 90), y: y + state.rng.range(-90, 90),
      angle: state.rng.range(0, Math.PI * 2), hp: 40, shootCd: state.rng.range(0.3, 1.2),
      color: '#c02020',
    });
  }
}
function drawPeople(ctx, state) {
  for (const p of state.peds) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(p.x + 2, p.y + 3, 7, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8c898';
    ctx.beginPath(); ctx.arc(p.x + Math.cos(p.angle) * 3, p.y + Math.sin(p.angle) * 3, 4, 0, Math.PI * 2); ctx.fill();
  }
  for (const g of state.gang) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(g.x + 2, g.y + 3, 8, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = g.color;
    ctx.beginPath(); ctx.arc(g.x, g.y, 8, 0, Math.PI * 2); ctx.fill();
    // Gun barrel + red bandana.
    ctx.strokeStyle = '#222'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(g.x, g.y);
    ctx.lineTo(g.x + Math.cos(g.angle) * 16, g.y + Math.sin(g.angle) * 16); ctx.stroke();
    ctx.fillStyle = '#ff4040';
    ctx.fillRect(g.x - 6, g.y - 10, 12, 4);
    // HP bar.
    ctx.fillStyle = '#222'; ctx.fillRect(g.x - 10, g.y - 18, 20, 4);
    ctx.fillStyle = '#40c040'; ctx.fillRect(g.x - 10, g.y - 18, 20 * (g.hp / 40), 4);
  }
}
function drawPlayer(ctx, state) {
  const p = state.player;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(p.x + 3, p.y + 4, 11, 8, 0, 0, Math.PI * 2); ctx.fill();
  // Jesse Kane: teal jacket, dark jeans.
  ctx.fillStyle = '#208080';
  ctx.beginPath(); ctx.arc(p.x, p.y, 11, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e8c898';
  ctx.beginPath(); ctx.arc(p.x + Math.cos(p.aim) * 4, p.y + Math.sin(p.aim) * 4, 6, 0, Math.PI * 2); ctx.fill();
  // Weapon in hand.
  if (state.weapon !== 'fists') {
    ctx.strokeStyle = '#222'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + Math.cos(p.aim) * 20, p.y + Math.sin(p.aim) * 20); ctx.stroke();
  }
}
