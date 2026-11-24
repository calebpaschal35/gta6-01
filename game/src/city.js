// Harborlight city: 3200x3200, 5 districts, road grid, buildings, landmarks.
import { WORLD, TILE, ROAD_W, DISTRICTS, SEED } from './config.js';
import { Rng, clamp } from './rng.js';

export class City {
  constructor() {
    this.rng = new Rng(SEED);
    this.roadsX = []; this.roadsY = [];
    for (let v = 200; v < WORLD; v += TILE) { this.roadsX.push(v); this.roadsY.push(v); }
    this.buildings = [];
    this._genBuildings();
    this.landmarks = {
      garage: { x: 1400, y: 1300, name: 'Downtown Garage' },
      marta: { x: 1800, y: 1800, name: "Marta's Corner" },
      docksWarehouse: { x: 1400, y: 2700, name: 'Docks Warehouse' },
      bank: { x: 1400, y: 1400, name: 'Harborlight Bank' },
      boat: { x: 3000, y: 1400, name: 'Palm Beach Marina' },
      gunShop: { x: 1800, y: 600, name: 'Old Town Guns' },
      hospital: { x: 2500, y: 2200, name: 'Palm General' },
    };
    this.trees = [];
    for (let i = 0; i < 160; i++) {
      const x = this.rng.range(60, WORLD - 60), y = this.rng.range(60, WORLD - 60);
      if (!this.onRoad(x, y) && !this.collides(x, y, 10, 10)) this.trees.push({ x, y, r: this.rng.range(7, 12) });
    }
  }
  _genBuildings() {
    const rng = this.rng;
    // Blocks sit between consecutive roads (roads at 200 + k*400). Block bx
    // spans [bx*400+242, bx*400+558]; buildings keep a 24px margin inside it.
    for (let bx = 0; bx < 7; bx++) {
      for (let by = 0; by < 7; by++) {
        const x0 = bx * TILE + 200 + ROAD_W / 2 + 24, y0 = by * TILE + 200 + ROAD_W / 2 + 24;
        const w = TILE - ROAD_W - 48, h = TILE - ROAD_W - 48;
        if (rng.chance(0.12)) continue; // plaza / parking lot
        const n = rng.int(1, 3);
        for (let i = 0; i < n; i++) {
          const bw = rng.range(70, Math.min(150, w - 10));
          const bh = rng.range(70, Math.min(150, h - 10));
          const x = rng.range(x0, x0 + w - bw), y = rng.range(y0, y0 + h - bh);
          const d = this.districtAt(x + bw / 2, y + bh / 2);
          this.buildings.push({ x, y, w: bw, h: bh, color: d.build, roof: d.accent, hgt: rng.int(1, 4) });
        }
      }
    }
  }
  districtAt(x, y) {
    for (const d of DISTRICTS) if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d;
    return DISTRICTS[0];
  }
  onRoad(x, y) {
    for (const rx of this.roadsX) if (Math.abs(x - rx) < ROAD_W / 2 + 6) return true;
    for (const ry of this.roadsY) if (Math.abs(y - ry) < ROAD_W / 2 + 6) return true;
    return false;
  }
  roadCenterX(x) {
    let best = this.roadsX[0], bd = 1e9;
    for (const rx of this.roadsX) { const d = Math.abs(x - rx); if (d < bd) { bd = d; best = rx; } }
    return best;
  }
  roadCenterY(y) {
    let best = this.roadsY[0], bd = 1e9;
    for (const ry of this.roadsY) { const d = Math.abs(y - ry); if (d < bd) { bd = d; best = ry; } }
    return best;
  }
  collides(x, y, w, h) {
    const hw = w / 2, hh = h / 2;
    if (x - hw < 0 || y - hh < 0 || x + hw > WORLD || y + hh > WORLD) return true;
    for (const b of this.buildings) {
      if (x + hw > b.x && x - hw < b.x + b.w && y + hh > b.y && y - hh < b.y + b.h) return true;
    }
    return false;
  }
  resolveMove(e, dx, dy) {
    // Move with AABB building collision, axis separated.
    const nx = e.x + dx;
    if (!this.collides(nx, e.y, e.w || 26, e.h || 26)) e.x = nx;
    const ny = e.y + dy;
    if (!this.collides(e.x, ny, e.w || 26, e.h || 26)) e.y = ny;
    e.x = clamp(e.x, 20, WORLD - 20);
    e.y = clamp(e.y, 20, WORLD - 20);
  }
  randomRoadPoint(rng) {
    if (rng.chance(0.5)) return { x: rng.pick(this.roadsX), y: rng.range(100, WORLD - 100), horiz: false };
    return { x: rng.range(100, WORLD - 100), y: rng.pick(this.roadsY), horiz: true };
  }
  draw(ctx, cam, vw, vh) {
    const x0 = Math.max(0, cam.x - 60), y0 = Math.max(0, cam.y - 60);
    const x1 = Math.min(WORLD, cam.x + vw + 60), y1 = Math.min(WORLD, cam.y + vh + 60);
    // ground by district
    for (const d of DISTRICTS) {
      const ix0 = Math.max(d.x, x0), iy0 = Math.max(d.y, y0);
      const ix1 = Math.min(d.x + d.w, x1), iy1 = Math.min(d.y + d.h, y1);
      if (ix1 <= ix0 || iy1 <= iy0) continue;
      ctx.fillStyle = d.ground;
      ctx.fillRect(ix0 - cam.x, iy0 - cam.y, ix1 - ix0, iy1 - iy0);
    }
    // roads
    ctx.fillStyle = '#1c1c22';
    for (const rx of this.roadsX) if (rx > x0 - 60 && rx < x1 + 60) ctx.fillRect(rx - ROAD_W / 2 - cam.x, y0 - cam.y, ROAD_W, y1 - y0);
    for (const ry of this.roadsY) if (ry > y0 - 60 && ry < y1 + 60) ctx.fillRect(x0 - cam.x, ry - ROAD_W / 2 - cam.y, x1 - x0, ROAD_W);
    // center dashes
    ctx.strokeStyle = 'rgba(230,200,90,0.55)'; ctx.lineWidth = 3; ctx.setLineDash([22, 26]);
    ctx.beginPath();
    for (const rx of this.roadsX) if (rx > x0 - 60 && rx < x1 + 60) { ctx.moveTo(rx - cam.x, y0 - cam.y); ctx.lineTo(rx - cam.x, y1 - cam.y); }
    for (const ry of this.roadsY) if (ry > y0 - 60 && ry < y1 + 60) { ctx.moveTo(x0 - cam.x, ry - cam.y); ctx.lineTo(x1 - cam.x, ry - cam.y); }
    ctx.stroke(); ctx.setLineDash([]);
    // trees
    ctx.fillStyle = '#2c6b3a';
    for (const t of this.trees) {
      if (t.x < x0 || t.x > x1 || t.y < y0 || t.y > y1) continue;
      ctx.beginPath(); ctx.arc(t.x - cam.x, t.y - cam.y, t.r, 0, Math.PI * 2); ctx.fill();
    }
    // buildings
    for (const b of this.buildings) {
      if (b.x + b.w < x0 || b.x > x1 || b.y + b.h < y0 || b.y > y1) continue;
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x - cam.x, b.y - cam.y, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x - cam.x + 4, b.y - cam.y + 4, b.w - 8, Math.min(14, b.h - 8));
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2;
      ctx.strokeRect(b.x - cam.x, b.y - cam.y, b.w, b.h);
    }
    // water edge east of Palm Beach
    ctx.fillStyle = '#2a6b8a';
    ctx.fillRect(WORLD - 40 - cam.x, y0 - cam.y, 40, y1 - y0);
    // district labels
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.font = 'bold 26px sans-serif'; ctx.textAlign = 'center';
    for (const d of DISTRICTS) {
      const cx = d.x + d.w / 2, cy = d.y + d.h / 2;
      if (cx > x0 && cx < x1 && cy > y0 && cy < y1) ctx.fillText(d.name.toUpperCase(), cx - cam.x, cy - cam.y);
    }
    ctx.textAlign = 'left';
  }
}
