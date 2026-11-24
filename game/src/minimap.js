// Circular minimap: player, cars, police, waypoints, north.
import { WORLD } from './config.js';

export class Minimap {
  draw(ctx, world, vw, vh) {
    const cx = 96, cy = vh - 96, R = 74;
    const scale = (R * 2) / WORLD;
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R + 4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = '#1c2733';
    ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
    const p = world.player;
    const px = p.inCar ? p.car.x : p.x, py = p.inCar ? p.car.y : p.y;
    // districts (subtle tint blocks)
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    // roads (thin)
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1.5;
    for (const rx of world.city.roadsX) {
      ctx.beginPath(); ctx.moveTo(cx + (rx - px) * scale, cy - R); ctx.lineTo(cx + (rx - px) * scale, cy + R); ctx.stroke();
    }
    for (const ry of world.city.roadsY) {
      ctx.beginPath(); ctx.moveTo(cx - R, cy + (ry - py) * scale); ctx.lineTo(cx + R, cy + (ry - py) * scale); ctx.stroke();
    }
    // waypoint
    const wp = world.missions.waypoint(world);
    if (wp) {
      const wx = cx + (wp.x - px) * scale, wy = cy + (wp.y - py) * scale;
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath(); ctx.arc(wx, wy, 5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(wx, wy, 9, 0, Math.PI * 2); ctx.stroke();
    }
    // cars
    for (const c of world.cars) {
      if (c.dead) continue;
      ctx.fillStyle = c.isPolice ? '#4a90ff' : '#e8e8e8';
      ctx.fillRect(cx + (c.x - px) * scale - 2, cy + (c.y - py) * scale - 2, 4, 4);
    }
    // gang
    ctx.fillStyle = '#ff4040';
    for (const g of world.gang) if (!g.dead) ctx.fillRect(cx + (g.x - px) * scale - 2, cy + (g.y - py) * scale - 2, 4, 4);
    // player arrow
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(-6, -6); ctx.lineTo(-6, 6); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.restore();
    // ring + N
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, R + 4, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('N', cx, cy - R - 10);
    ctx.textAlign = 'left';
  }
}
