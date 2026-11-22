// Harborlight — particles: sparks, smoke, explosions, cash pops.
function spawnParticles(state, x, y, n, color) {
  for (let i = 0; i < n; i++) {
    const a = state.rng.range(0, Math.PI * 2);
    const sp = state.rng.range(40, 260);
    state.particles.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: state.rng.range(0.3, 0.9), max: 0.9, color,
      size: state.rng.range(2, 6),
    });
  }
}
function updateParticles(state, dt) {
  for (const p of state.particles) {
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= (1 - 2 * dt); p.vy *= (1 - 2 * dt);
    p.life -= dt;
  }
  state.particles = state.particles.filter((p) => p.life > 0);
}
function drawParticles(ctx, state) {
  for (const p of state.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
