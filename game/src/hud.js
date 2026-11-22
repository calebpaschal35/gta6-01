// Harborlight — HUD: health, cash, wanted stars, clock, objective, weapon.
function drawHUD(ctx, state, W, H) {
  // Top-left: health bar + cash.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRect(ctx, 12, 12, 220, 58, 8); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('JESSE KANE', 22, 32);
  ctx.fillStyle = '#222'; ctx.fillRect(22, 40, 160, 12);
  ctx.fillStyle = state.player.hp > 30 ? '#40c040' : '#e04040';
  ctx.fillRect(22, 40, 160 * Math.max(0, state.player.hp / 100), 12);
  ctx.fillStyle = '#40d040';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('$' + state.cash.toLocaleString(), 188, 32);
  // Top-right: wanted stars + clock.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRect(ctx, W - 232, 12, 220, 58, 8); ctx.fill();
  ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < state.wanted ? '#ffd020' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', W - 200 + i * 28, 38);
  }
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 15px sans-serif';
  const hh = Math.floor(state.clock / 60) % 24, mm = Math.floor(state.clock % 60);
  ctx.fillText(String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0') + '  ' + districtAt(state.player.x, state.player.y).name, W - 122, 62);
  // Top-center: objective.
  if (state.objective) {
    ctx.font = 'bold 15px sans-serif';
    const w = ctx.measureText(state.objective).width + 28;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    roundRect(ctx, (W - w) / 2, 12, w, 30, 8); ctx.fill();
    ctx.fillStyle = '#ffd060';
    ctx.fillText(state.objective, W / 2, 32);
  }
  // Mission timer — only while the job is actually running.
  if (state.missionStarted && state.mission >= 0 && MISSIONS[state.mission] && MISSIONS[state.mission].timer) {
    const t = Math.max(0, state.missionTimer);
    ctx.fillStyle = t < 15 ? '#ff6060' : '#fff';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0'), W / 2, 66);
  }
  // Bottom-left: weapon + ammo.
  const w = WEAPONS[state.weapon];
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRect(ctx, 12, H - 56, 190, 44, 8); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText(w.name + (state.weapon === 'fists' ? '' : '  •  ' + state.ammo + ' / ' + w.mag), 22, H - 28);
  ctx.font = '12px sans-serif';
  ctx.fillStyle = '#aaa';
  ctx.fillText(state.ownedSmg ? '1 fists · 2 pistol · 3 smg · R reload' : '1 fists · 2 pistol · R reload', 22, H - 14);
  // Gun shop hint.
  if (state.nearShop) {
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    roundRect(ctx, W / 2 - 190, H - 110, 380, 34, 8); ctx.fill();
    ctx.fillStyle = '#ffd060';
    ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(state.ownedSmg ? 'Gun shop — press B for ammo ($' + CFG.AMMO_PRICE + ')' : 'Gun shop — press B to buy SMG ($' + CFG.SMG_PRICE + ')', W / 2, H - 88);
    ctx.textAlign = 'left';
  }
  // Toasts (stacked, fading).
  let ty = 92;
  for (const t of state.toasts) {
    ctx.globalAlpha = Math.min(1, t.life / 1.2);
    ctx.font = 'bold 15px sans-serif';
    const tw = ctx.measureText(t.text).width + 24;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    roundRect(ctx, (W - tw) / 2, ty, tw, 28, 8); ctx.fill();
    ctx.fillStyle = t.color || '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(t.text, W / 2, ty + 19);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
    ty += 34;
  }
  // Controls hint (first minute).
  if (state.time < 25 && state.screen === 'play') {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.font = '13px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('WASD move / drive · E steal car · Click shoot · T next job · M mute · Esc pause', W / 2, H - 70);
    ctx.textAlign = 'left';
  }
}
