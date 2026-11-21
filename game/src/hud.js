// HUD and minimap, drawn on the same canvas as the world: health and
// cash, wanted stars, clock and district, objective, weapon, toasts, and
// a circular minimap with the player, police and the mission marker.
import { WORLD, districtAt } from './city.js';

export class Hud {
  constructor() {
    this.toasts = [];
  }

  toast(text, dur) {
    this.toasts.push({ text, t: dur || 3.2 });
  }

  update(dt) {
    for (const t of this.toasts) t.t -= dt;
    this.toasts = this.toasts.filter((t) => t.t > 0);
  }

  draw(ctx, g) {
    const W = 1280, H = 720;
    ctx.save();
    ctx.textBaseline = 'alphabetic';
    // Health bar, top left.
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(14, 12, 224, 16);
    ctx.fillStyle = g.health > 30 ? '#58d158' : '#e04040';
    ctx.fillRect(16, 14, 220 * Math.max(0, g.health) / 100, 12);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText('$' + g.cash.toLocaleString('en-US'), 16, 58);
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillStyle = '#cfe8cf';
    ctx.fillText(g.weaponName + (g.ammo === Infinity ? '  ∞' : '  ' + g.ammo + ' rds'), 16, 78);
    // Wanted stars, top right.
    const cx = W - 24;
    ctx.font = '26px system-ui, sans-serif';
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i < g.stars ? '#ffd21f' : 'rgba(255,255,255,0.25)';
      ctx.fillText('★', cx - (5 - i) * 30, 40);
    }
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('HARBORLIGHT  ·  ' + g.clock, cx, 62);
    ctx.fillText(districtAt(g.px, g.py), cx, 82);
    ctx.textAlign = 'left';
    // Objective, top center.
    if (g.objective) {
      ctx.font = 'bold 15px system-ui, sans-serif';
      const w = ctx.measureText(g.objective).width + 24;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect((W - w) / 2, 10, w, 26);
      ctx.fillStyle = '#ffe9a8';
      ctx.fillText(g.objective, (W - w) / 2 + 12, 29);
    }
    // Toasts under the objective.
    ctx.font = '14px system-ui, sans-serif';
    let ty = 56;
    for (const t of this.toasts) {
      ctx.globalAlpha = Math.min(1, t.t);
      const w = ctx.measureText(t.text).width + 20;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect((W - w) / 2, ty, w, 24);
      ctx.fillStyle = '#fff';
      ctx.fillText(t.text, (W - w) / 2 + 10, ty + 17);
      ty += 30;
    }
    ctx.globalAlpha = 1;
    // Controls hint, bottom left.
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText('WASD move / drive · E enter car · Click shoot · F punch · Shift run · Space handbrake · P pause · M mute', 14, H - 12);
    // Speed, bottom center-left when driving.
    if (g.speedMph !== null) {
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.fillStyle = '#fff';
      ctx.fillText(g.speedMph + ' mph', 14, H - 36);
    }
    this.drawMinimap(ctx, g);
    ctx.restore();
  }

  drawMinimap(ctx, g) {
    const cx = 1280 - 92, cy = 720 - 92, r = 74;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = 'rgba(10,18,28,0.85)';
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    // Roads as a faint grid.
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.lineWidth = 2;
    const scale = (r * 2) / WORLD;
    for (let p = 160; p < WORLD; p += 320) {
      const sx = cx - r + p * scale;
      ctx.beginPath(); ctx.moveTo(sx, cy - r); ctx.lineTo(sx, cy + r); ctx.stroke();
      const sy = cy - r + p * scale;
      ctx.beginPath(); ctx.moveTo(cx - r, sy); ctx.lineTo(cx + r, sy); ctx.stroke();
    }
    // Bay at the bottom.
    ctx.fillStyle = '#1d4e6e';
    ctx.fillRect(cx - r, cy - r + 2960 * scale, r * 2, r * 2);
    // Mission marker, pulsing.
    if (g.marker) {
      const pulse = 5 + Math.sin(g.time * 5) * 2;
      ctx.fillStyle = '#ffd21f';
      ctx.beginPath();
      ctx.arc(cx - r + g.marker.x * scale, cy - r + g.marker.y * scale, pulse, 0, Math.PI * 2);
      ctx.fill();
    }
    // Police as red dots.
    ctx.fillStyle = '#ff4d4d';
    for (const c of g.police) {
      ctx.beginPath();
      ctx.arc(cx - r + c.x * scale, cy - r + c.y * scale, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Player arrow, pointing north up.
    const px = cx - r + g.px * scale, py = cy - r + g.py * scale;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(px, py - 7); ctx.lineTo(px + 5, py + 5); ctx.lineTo(px - 5, py + 5);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    // Ring + north tick.
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillText('N', cx - 4, cy - r + 13);
  }
}
