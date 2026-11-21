// Harborlight city: a 3200x3200 grid of roads, blocks, buildings, parks
// and a bay along the south edge. One fixed layout, generated from a seed.
import { makeRng, rangeInt, pick } from './rng.js';

export const WORLD = 3200;
export const ROAD_GAP = 320;      // distance between road centerlines
export const ROAD_HALF = 34;      // half width of a road
export const ROAD0 = 160;         // first road centerline

const ROOFS = ['#5a6b7d', '#6d5a4a', '#4a5d6b', '#7d6a5a', '#54606e', '#6b5a6d', '#4f6355'];

// Road centerlines along one axis.
export function roadLines() {
  const lines = [];
  for (let p = ROAD0; p < WORLD; p += ROAD_GAP) lines.push(p);
  return lines;
}

export function isRoad(x, y) {
  const near = (v) => {
    const m = ((v - ROAD0) % ROAD_GAP + ROAD_GAP) % ROAD_GAP;
    return Math.min(m, ROAD_GAP - m) <= ROAD_HALF;
  };
  return near(x) || near(y);
}

// Snap a point onto the nearest road centerline (one axis at a time).
export function nearestRoadPoint(x, y) {
  const snap = (v) => ROAD0 + Math.round((v - ROAD0) / ROAD_GAP) * ROAD_GAP;
  const sx = snap(x), sy = snap(y);
  return Math.abs(sx - x) < Math.abs(sy - y) ? { x: sx, y } : { x, y: sy };
}

export function districtAt(x, y) {
  if (x >= 1280 && x < 1920 && y >= 1280 && y < 1920) return 'Old Town';
  if (x < 1600 && y < 1600) return 'Downtown';
  if (x >= 1600 && y < 1600) return 'Riverside';
  if (x < 1600) return 'The Docks';
  return 'Palm Beach';
}

export function buildCity(seed) {
  const rng = makeRng(seed);
  const lines = roadLines();
  const buildings = [];
  const parks = [];
  const trees = [];
  // Blocks are the squares between neighbouring roads.
  for (let i = 0; i < lines.length - 1; i++) {
    for (let j = 0; j < lines.length - 1; j++) {
      const x0 = lines[i] + ROAD_HALF + 14;
      const y0 = lines[j] + ROAD_HALF + 14;
      const x1 = lines[i + 1] - ROAD_HALF - 14;
      const y1 = lines[j + 1] - ROAD_HALF - 14;
      // The south strip is the bay: beach and water, no buildings.
      if (y0 > 2880) continue;
      const roll = rng();
      if (roll < 0.16) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        const n = rangeInt(rng, 3, 7);
        for (let t = 0; t < n; t++) {
          trees.push({ x: x0 + rng() * (x1 - x0), y: y0 + rng() * (y1 - y0), r: 9 + rng() * 8 });
        }
        continue;
      }
      // One or two buildings per block, facing the street.
      const split = rng() < 0.5;
      if (split) {
        const mid = x0 + (x1 - x0) * (0.35 + rng() * 0.3);
        buildings.push({ x: x0, y: y0, w: mid - x0 - 10, h: y1 - y0, roof: pick(rng, ROOFS) });
        buildings.push({ x: mid + 10, y: y0, w: x1 - mid - 10, h: y1 - y0, roof: pick(rng, ROOFS) });
      } else {
        buildings.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, roof: pick(rng, ROOFS) });
      }
    }
  }
  return {
    buildings, parks, trees,
    // Named places the story and the HUD point at.
    landmarks: [
      { name: 'Harborlight Trust', x: 1600, y: 1600, kind: 'bank' },
      { name: "Marta's Garage", x: 480, y: 2720, kind: 'garage' },
      { name: 'Lock & Load', x: 800, y: 480, kind: 'shop' },
      { name: 'Safehouse', x: 2560, y: 800, kind: 'house' },
      { name: 'Pier 9', x: 1600, y: 3080, kind: 'pier' },
      { name: 'Riverside Market', x: 2240, y: 1120, kind: 'market' },
    ],
    bay: { y: 2960 },
  };
}

// Circle-vs-building collision: push a circle out of every building it overlaps.
export function collideBuildings(city, p, r) {
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(p.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(p.y, b.y + b.h));
    const dx = p.x - cx, dy = p.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r && d2 > 0.0001) {
      const d = Math.sqrt(d2);
      p.x = cx + (dx / d) * r;
      p.y = cy + (dy / d) * r;
      return true;
    }
    if (d2 <= 0.0001) { p.x = b.x - r; return true; }
  }
  return false;
}

export function pointInBuilding(city, x, y) {
  for (const b of city.buildings) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
  }
  return null;
}
