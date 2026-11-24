// HUD: health, cash, wanted stars, clock, objective, weapon/ammo, timer, screens.
import { WEAPONS } from './config.js';

export class Hud {
  draw(ctx, world, vw, vh) {
    const p = world.player;
    ctx.save();
    // top-left: health + cash
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(14, 12, 250, 64);
    ctx.fillStyle = '#e8e8e8'; ctx.font = 'bold 15px sans-serif';
    ctx.fillText(`Jesse Kane`, 24, 32);
    ctx.fillStyle = '#333';
    ctx.fillRect(24, 40, 200, 12);
    ctx.fillStyle = p.hp > 50 ? '#7ee081' : p.hp > 25 ? '#e8c832' : '#e05a5a';
    ctx.fillRect(24, 40, 200 * Math.max(0, p.hp / 100), 12);
    ctx.fillStyle = '#7ee081'; ctx.font = 'bold 16px sans-serif';
    ctx.fillText(`$${p.cash}`, 24, 70);
    // top-right: wanted stars + clock
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(vw - 214, 12, 200, 64);
    ctx.font = 'bold 22px sans-serif';
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i < p.wanted ? '#ffd23f' : 'rgba(255,255,255,0.25)';
      ctx.fillText('★', vw - 200 + i * 30, 40);
    }
    const mins = Math.floor(world.clock) % (24 * 60);
    const hh = String(Math.floor(mins / 60)).padStart(2, '0');
    const mm = String(mins % 60).padStart(2, '0');
    ctx.fillStyle = '#e8e8e8'; ctx.font = 'bold 16px sans-serif';
    ctx.fillText(`${hh}:${mm}`, vw - 200, 68);
    ctx.fillStyle = '#b0b0b0'; ctx.font = '13px sans-serif';
    ctx.fillText(world.city.districtAt(p.x, p.y).name, vw - 120, 68);
    // objective (bottom-left, right of the minimap so it stays readable)
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    const obj = world.objective;
    if (obj) {
      ctx.font = '14px sans-serif';
      const w = Math.min(560, ctx.measureText(obj).width + 24);
      ctx.fillRect(190, vh - 96, w, 30);
      ctx.fillStyle = '#ffe9a8';
      ctx.fillText(obj, 202, vh - 76);
    }
    // mission step (same column as the objective)
    const step = world.missions.stepText();
    if (step) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(190, vh - 132, Math.min(560, ctx.measureText(step).width + 24), 30);
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 14px sans-serif';
      ctx.fillText('▸ ' + step, 202, vh - 112);
    }
    // timer — only while a job is running with a limit
    const a = world.missions.active;
    if (a && a.timeLeft != null && a.missionStarted) {
      const t = Math.max(0, Math.ceil(a.timeLeft));
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(vw / 2 - 60, 14, 120, 40);
      ctx.fillStyle = t <= 15 ? '#ff6b6b' : '#ffffff';
      ctx.font = 'bold 24px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(`${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`, vw / 2, 44);
      ctx.textAlign = 'left';
    }
    // weapon / ammo bottom-right
    const w = WEAPONS[p.weapon];
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(vw - 214, vh - 56, 200, 42);
    ctx.fillStyle = '#e8e8e8'; ctx.font = 'bold 15px sans-serif';
    const ammo = isFinite(w.mag) ? `${p.ammo}/${w.mag}` : '∞';
    ctx.fillText(`${w.name}  ${ammo}`, vw - 200, vh - 30);
    ctx.fillStyle = '#b0b0b0'; ctx.font = '12px sans-serif';
    ctx.fillText('[1] Fists  [2] Pistol  [3] SMG', vw - 200, vh - 14);
    ctx.restore();
  }
  drawCenter(ctx, vw, vh, lines, color) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, vw, vh);
    ctx.textAlign = 'center';
    let y = vh / 2 - (lines.length - 1) * 26;
    for (let i = 0; i < lines.length; i++) {
      ctx.fillStyle = i === 0 ? (color || '#ffffff') : '#d8d8d8';
      ctx.font = i === 0 ? 'bold 44px sans-serif' : '17px sans-serif';
      ctx.fillText(lines[i], vw / 2, y);
      y += i === 0 ? 56 : 30;
    }
    ctx.restore();
  }
}
