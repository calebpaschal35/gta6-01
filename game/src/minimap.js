// Harborlight — circular minimap (bottom-right): roads, player, cars, police, waypoint.
function drawMinimap(ctx, state, W, H) {
  const R = 92, cx = W - R - 16, cy = H - R - 16;
  const scale = (R * 2) / CFG.WORLD;
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
  // Ocean / land base.
  ctx.fillStyle = '#2a4a6a'; ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
  ctx.fillStyle = '#8a7a5a'; ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
  // Roads.
  ctx.fillStyle = '#3a3a3e';
  for (let gx = 0; gx <= CFG.WORLD; gx += CFG.BLOCK) {
    ctx.fillRect(cx - R + gx * scale - 2, cy - R, 4, R * 2);
  }
  for (let gy = 0; gy <= CFG.WORLD; gy += CFG.BLOCK) {
    ctx.fillRect(cx - R, cy - R + gy * scale - 2, R * 2, 4);
  }
  // Water edges.
  ctx.fillStyle = '#3a7ab8';
  ctx.fillRect(cx - R, cy - R, 4, R * 2);
  ctx.fillRect(cx - R, cy + R - 4, R * 2, 4);
  // Waypoint (mission target) — pulsing yellow diamond.
  const tgt = currentMissionTarget(state);
  if (tgt) {
    const tx = cx - R + tgt.x * scale, ty = cy - R + tgt.y * scale;
    const pulse = 5 + 2 * Math.sin(performance.now() / 200);
    ctx.fillStyle = '#ffd020';
    ctx.beginPath();
    ctx.moveTo(tx, ty - pulse); ctx.lineTo(tx + pulse, ty);
    ctx.lineTo(tx, ty + pulse); ctx.lineTo(tx - pulse, ty);
    ctx.closePath(); ctx.fill();
  }
  // Police (blue/red), traffic (white), gang (red).
  for (const c of state.traffic) {
    if (c.wrecked) continue;
    ctx.fillStyle = c.gang ? '#ff3030' : '#e8e8e8';
    ctx.fillRect(cx - R + c.x * scale - 2, cy - R + c.y * scale - 2, 4, 4);
  }
  for (const c of state.police) {
    ctx.fillStyle = '#3080ff';
    ctx.beginPath(); ctx.arc(cx - R + c.x * scale, cy - R + c.y * scale, 3.5, 0, Math.PI * 2); ctx.fill();
  }
  // Player arrow (rotates with facing).
  const px = cx - R + state.player.x * scale, py = cy - R + state.player.y * scale;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(state.playerCar ? state.playerCar.angle : state.player.aim);
  ctx.fillStyle = '#40e040';
  ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-6, -5); ctx.lineTo(-6, 5); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.restore();
  // Ring + N marker.
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('N', cx, cy - R + 15);
  ctx.textAlign = 'left';
}
