// Harborlight — city generation + map drawing. Deterministic from seed 7.
// Roads on a 400px grid; buildings fill the blocks; water on west (river),
// south (harbor) and east (ocean, Palm Beach).
function buildCity() {
  const rng = makeRng(7);
  const city = { buildings: [], parks: [], palms: [], piers: [], roads: [] };
  const roadSet = new Set();
  for (let x = 0; x <= CFG.WORLD; x += CFG.BLOCK) roadSet.add('v' + x);
  for (let y = 0; y <= CFG.WORLD; y += CFG.BLOCK) roadSet.add('h' + y);
  // Buildings: one or two per block, inset from the road edge.
  for (let bx = 0; bx < CFG.WORLD / CFG.BLOCK; bx++) {
    for (let by = 0; by < CFG.WORLD / CFG.BLOCK; by++) {
      const x0 = bx * CFG.BLOCK + CFG.ROAD_W / 2 + 14;
      const y0 = by * CFG.BLOCK + CFG.ROAD_W / 2 + 14;
      const cx = x0 + (CFG.BLOCK - CFG.ROAD_W) / 2, cy = y0 + (CFG.BLOCK - CFG.ROAD_W) / 2;
      const d = districtAt(cx, cy);
      if (rng.chance(0.14)) { // park instead of buildings
        city.parks.push({ x: x0, y: y0, w: CFG.BLOCK - CFG.ROAD_W - 28, h: CFG.BLOCK - CFG.ROAD_W - 28 });
        continue;
      }
      const n = rng.chance(0.45) ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const w = rng.range(70, 150), h = rng.range(70, 150);
        const x = x0 + rng.range(0, Math.max(1, CFG.BLOCK - CFG.ROAD_W - 28 - w));
        const y = y0 + rng.range(0, Math.max(1, CFG.BLOCK - CFG.ROAD_W - 28 - h));
        city.buildings.push({
          x, y, w, h,
          color: rng.pick(d.bldg),
          tall: d.tall && rng.chance(0.5),
          roof: rng.pick(['#c8b898', '#a89878', '#8899aa', '#b0a080']),
        });
      }
    }
  }
  // Palm trees along Palm Beach + a few in parks.
  for (let i = 0; i < 90; i++) {
    city.palms.push({ x: rng.range(2450, 3180), y: rng.range(1250, 2350) });
  }
  for (const p of city.parks) {
    const n = Math.floor(rng.range(2, 6));
    for (let i = 0; i < n; i++) city.palms.push({ x: p.x + rng.range(10, p.w - 10), y: p.y + rng.range(10, p.h - 10) });
  }
  // Docks piers jutting into the southern harbor.
  for (let i = 0; i < 5; i++) city.piers.push({ x: 300 + i * 560, y: 3080, w: 90, h: 120 });
  return city;
}
function districtAt(x, y) {
  for (const d of CFG.DISTRICTS) {
    if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d;
  }
  return CFG.DISTRICTS[0];
}
function isRoad(x, y) {
  if (x < 0 || y < 0 || x >= CFG.WORLD || y >= CFG.WORLD) return false;
  const m = CFG.BLOCK;
  return (x % m) < CFG.ROAD_W / 2 || (x % m) > m - CFG.ROAD_W / 2 ||
         (y % m) < CFG.ROAD_W / 2 || (y % m) > m - CFG.ROAD_W / 2;
}
function isWater(x, y) {
  if (x < 90) return true;                 // western river
  if (y > CFG.WORLD - 90) return true;     // southern harbor
  if (x > CFG.WORLD - 90 && y > 1100 && y < 2500) return true; // eastern ocean
  return false;
}
function collideBuildings(city, x, y, r) {
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
  }
  return null;
}
function drawCity(ctx, city, cam) {
  const x0 = Math.max(0, cam.x - 40), y0 = Math.max(0, cam.y - 40);
  const x1 = Math.min(CFG.WORLD, cam.x + cam.w + 40), y1 = Math.min(CFG.WORLD, cam.y + cam.h + 40);
  // Ground: district tint.
  ctx.fillStyle = '#b0a080';
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  for (const d of CFG.DISTRICTS) {
    ctx.fillStyle = d.ground;
    ctx.fillRect(Math.max(d.x, x0), Math.max(d.y, y0),
      Math.min(d.x + d.w, x1) - Math.max(d.x, x0), Math.min(d.y + d.h, y1) - Math.max(d.y, y0));
  }
  // Water.
  ctx.fillStyle = '#3a7ab8';
  ctx.fillRect(x0, Math.max(y0, CFG.WORLD - 90), x1 - x0, Math.min(y1, CFG.WORLD) - Math.max(y0, CFG.WORLD - 90));
  ctx.fillRect(x0, y0, Math.min(x1, 90) - x0, y1 - y0);
  ctx.fillRect(Math.max(x0, CFG.WORLD - 90), Math.max(y0, 1100), x1 - Math.max(x0, CFG.WORLD - 90), Math.min(y1, 2500) - Math.max(y0, 1100));
  // Sand strip on Palm Beach.
  ctx.fillStyle = '#e8d8a0';
  ctx.fillRect(Math.max(x0, CFG.WORLD - 130), Math.max(y0, 1100), Math.min(x1, CFG.WORLD - 90) - Math.max(x0, CFG.WORLD - 130), Math.min(y1, 2500) - Math.max(y0, 1100));
  // Parks.
  for (const p of city.parks) {
    if (p.x > x1 || p.y > y1 || p.x + p.w < x0 || p.y + p.h < y0) continue;
    ctx.fillStyle = '#5a9a4a'; ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = '#6ab05a'; ctx.fillRect(p.x + 8, p.y + 8, p.w - 16, p.h - 16);
  }
  // Roads.
  ctx.fillStyle = '#3a3a3e';
  for (let gx = 0; gx <= CFG.WORLD; gx += CFG.BLOCK) {
    if (gx + CFG.ROAD_W / 2 < x0 || gx - CFG.ROAD_W / 2 > x1) continue;
    ctx.fillRect(gx - CFG.ROAD_W / 2, y0, CFG.ROAD_W, y1 - y0);
  }
  for (let gy = 0; gy <= CFG.WORLD; gy += CFG.BLOCK) {
    if (gy + CFG.ROAD_W / 2 < y0 || gy - CFG.ROAD_W / 2 > y1) continue;
    ctx.fillRect(x0, gy - CFG.ROAD_W / 2, x1 - x0, CFG.ROAD_W);
  }
  // Road center dashes.
  ctx.fillStyle = '#d8c860';
  for (let gx = 0; gx <= CFG.WORLD; gx += CFG.BLOCK) {
    for (let gy = Math.floor(y0 / 48) * 48; gy < y1; gy += 48) {
      if (gx >= x0 - 4 && gx <= x1 + 4) ctx.fillRect(gx - 2, gy, 4, 22);
    }
  }
  for (let gy = 0; gy <= CFG.WORLD; gy += CFG.BLOCK) {
    for (let gx = Math.floor(x0 / 48) * 48; gx < x1; gx += 48) {
      if (gy >= y0 - 4 && gy <= y1 + 4) ctx.fillRect(gx, gy - 2, 22, 4);
    }
  }
  // Piers.
  ctx.fillStyle = '#8a6a4a';
  for (const p of city.piers) ctx.fillRect(p.x, p.y, p.w, p.h);
  // Buildings with sun shadows.
  for (const b of city.buildings) {
    if (b.x > x1 || b.y > y1 || b.x + b.w < x0 || b.y + b.h < y0) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(b.x + 10, b.y + 12, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
    if (b.tall) {
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(b.x + 8, b.y + 8, b.w - 16, 6);
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
  }
  // Palms.
  for (const p of city.palms) {
    if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) continue;
    ctx.fillStyle = '#5a8a3a';
    ctx.beginPath(); ctx.arc(p.x, p.y, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#7a5a30';
    ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill();
  }
  // District labels.
  ctx.fillStyle = 'rgba(40,30,20,0.55)';
  ctx.font = 'bold 26px sans-serif'; ctx.textAlign = 'center';
  for (const d of CFG.DISTRICTS) {
    const cx = d.x + d.w / 2, cy = d.y + d.h / 2;
    if (cx < x0 - 100 || cx > x1 + 100 || cy < y0 - 40 || cy > y1 + 40) continue;
    ctx.fillText(d.name.toUpperCase(), cx, cy);
  }
  ctx.textAlign = 'left';
}
