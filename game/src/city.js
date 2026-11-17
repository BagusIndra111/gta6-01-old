// Solmar City — deterministic city generation. Roads on a grid, blocks full of
// buildings, a park, a beach and a harbor pier along the south sea edge.
// The same seed always builds the same city, so screenshots are repeatable.

import { WORLD, ROAD_EVERY, ROAD_W, WALK_W, SEA_Y, PALETTE } from './config.js';
import { mulberry32, pick, range } from './random.js';

export function buildCity(seed) {
  const rng = mulberry32(seed);
  const roadXs = [];
  const roadYs = [];
  for (let x = ROAD_EVERY / 2; x < WORLD - 40; x += ROAD_EVERY) roadXs.push(x);
  for (let y = ROAD_EVERY / 2; y < SEA_Y - 120; y += ROAD_EVERY) roadYs.push(y);

  const buildings = [];
  const palms = [];
  const landmarks = {};
  const park = { x: 4 * ROAD_EVERY + ROAD_EVERY / 2 + ROAD_W / 2 + WALK_W, y: 3 * ROAD_EVERY + ROAD_EVERY / 2 + ROAD_W / 2 + WALK_W, w: ROAD_EVERY - 80, h: ROAD_EVERY - 80 };

  // Landmark blocks, by (column, row) of the road grid.
  const landmarkDefs = [
    { key: 'garage', bx: 1, by: 1, name: "ROOK'S GARAGE", color: '#c96f4a' },
    { key: 'bar', bx: 7, by: 2, name: "MARA'S BAR", color: '#8a5fc0' },
    { key: 'bank', bx: 5, by: 5, name: 'SOLMAR BANK', color: '#8fa8bf' },
    { key: 'hall', bx: 3, by: 6, name: 'CITY HALL', color: '#b5b0a6' },
    { key: 'docks', bx: 8, by: 7, name: 'THE DOCKS', color: '#7d8a99' },
  ];

  // Blocks sit BETWEEN roads: a block's west edge is one half-road past the
  // road centre line (road centre + road half-width + sidewalk).
  const blockX0 = (bx) => bx * ROAD_EVERY + ROAD_EVERY / 2 + ROAD_W / 2 + WALK_W;
  const blockY0 = (by) => by * ROAD_EVERY + ROAD_EVERY / 2 + ROAD_W / 2 + WALK_W;
  const blockW = ROAD_EVERY - ROAD_W - WALK_W * 2;

  for (let by = 0; by < roadYs.length; by++) {
    for (let bx = 0; bx < roadXs.length; bx++) {
      const x0 = blockX0(bx);
      const y0 = blockY0(by);
      if (y0 + blockW > SEA_Y - 60) continue; // beach row stays open
      if (x0 + blockW > WORLD) continue; // east edge stays open
      if (bx === 4 && by === 3) continue; // the park
      const lm = landmarkDefs.find((d) => d.bx === bx && d.by === by);
      if (lm) {
        const b = {
          x: x0 + 14, y: y0 + 14, w: blockW - 28, h: blockW - 28,
          color: lm.color, roof: '#5d4030', name: lm.name, landmark: lm.key,
        };
        buildings.push(b);
        landmarks[lm.key] = { x: b.x + b.w / 2, y: b.y + b.h + 26, bx: b.x + b.w / 2, by: b.y + b.h / 2, building: b };
        continue;
      }
      // Ordinary block: one to three buildings with alleys between them.
      const n = 1 + Math.floor(rng() * 3);
      if (n === 1) {
        buildings.push(makeBuilding(rng, x0 + 10, y0 + 10, blockW - 20, blockW - 20));
      } else if (n === 2) {
        const split = rng() > 0.5;
        if (split) {
          buildings.push(makeBuilding(rng, x0 + 8, y0 + 8, blockW - 16, (blockW - 24) / 2));
          buildings.push(makeBuilding(rng, x0 + 8, y0 + 16 + (blockW - 24) / 2, blockW - 16, (blockW - 24) / 2));
        } else {
          buildings.push(makeBuilding(rng, x0 + 8, y0 + 8, (blockW - 24) / 2, blockW - 16));
          buildings.push(makeBuilding(rng, x0 + 16 + (blockW - 24) / 2, y0 + 8, (blockW - 24) / 2, blockW - 16));
        }
      } else {
        const half = (blockW - 24) / 2;
        buildings.push(makeBuilding(rng, x0 + 8, y0 + 8, half, half));
        buildings.push(makeBuilding(rng, x0 + 16 + half, y0 + 8, half, half));
        buildings.push(makeBuilding(rng, x0 + 8, y0 + 16 + half, blockW - 16, half));
      }
    }
  }

  // Palms along the beach and around the park.
  for (let i = 0; i < 26; i++) {
    palms.push({ x: 60 + rng() * (WORLD - 120), y: SEA_Y - 30 + rng() * 46 });
  }
  for (let i = 0; i < 8; i++) {
    palms.push({ x: park.x + 16 + rng() * (park.w - 32), y: park.y + 16 + rng() * (park.h - 32) });
  }

  // The pier reaches from the beach into the sea. Its gameplay point is the
  // pier entrance, where a car can actually stop — the far end is past the
  // shoreline clamp, so a marker there could never be reached.
  const pier = { x: 5 * ROAD_EVERY + ROAD_W / 2 - 30, y: SEA_Y - 30, w: 60, h: 220 };
  landmarks.pier = { x: pier.x + pier.w / 2, y: pier.y + 20, bx: pier.x + pier.w / 2, by: pier.y + pier.h / 2 };

  // Parked cars sit on road edges; peds start on sidewalks.
  const parkedCars = [];
  for (let i = 0; i < 10; i++) {
    const horizontal = rng() > 0.5;
    const road = horizontal ? pick(rng, roadYs) : pick(rng, roadXs);
    const along = 120 + rng() * (WORLD - 240);
    const side = (rng() > 0.5 ? 1 : -1) * (ROAD_W / 2 - 12);
    parkedCars.push({
      x: horizontal ? along : road + side,
      y: horizontal ? road + side : along,
      angle: horizontal ? (side > 0 ? 0 : Math.PI) : (side > 0 ? Math.PI / 2 : -Math.PI / 2),
    });
  }

  const pedSpawns = [];
  for (let i = 0; i < 40; i++) {
    const horizontal = rng() > 0.5;
    const road = horizontal ? pick(rng, roadYs) : pick(rng, roadXs);
    const along = 80 + rng() * (WORLD - 160);
    const side = (rng() > 0.5 ? 1 : -1) * (ROAD_W / 2 + WALK_W / 2);
    pedSpawns.push({
      x: horizontal ? along : road + side,
      y: horizontal ? road + side : along,
    });
  }

  return {
    seed, roadXs, roadYs, buildings, palms, park, pier, landmarks, parkedCars, pedSpawns,
    playerStart: { x: landmarks.garage.x + 90, y: landmarks.garage.y + 40, angle: 0 },
  };
}

function makeBuilding(rng, x, y, w, h) {
  return {
    x, y, w, h,
    color: pick(rng, PALETTE.building),
    roof: pick(rng, PALETTE.roof),
    name: null, landmark: null,
    inset: 6 + rng() * 10,
  };
}

// True when the point is on a road (drivable surface).
export function isOnRoad(city, x, y) {
  if (y >= SEA_Y - 40) return false;
  for (const rx of city.roadXs) if (Math.abs(x - rx) <= ROAD_W / 2) return true;
  for (const ry of city.roadYs) if (Math.abs(y - ry) <= ROAD_W / 2) return true;
  return false;
}

// Nearest road centre point to (x, y), used to snap traffic onto roads.
export function nearestRoadPoint(city, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const rx of city.roadXs) {
    const d = Math.abs(x - rx);
    if (d < bestD) { bestD = d; best = { x: rx, y, vertical: true }; }
  }
  for (const ry of city.roadYs) {
    const d = Math.abs(y - ry);
    if (d < bestD) { bestD = d; best = { x, y: ry, vertical: false }; }
  }
  return best;
}

// A point on a road near (x, y) but not inside a building, for spawning.
export function roadSpawnNear(city, x, y, minDist) {
  for (let tries = 0; tries < 40; tries++) {
    const p = nearestRoadPoint(city, x + (Math.random() - 0.5) * 700, y + (Math.random() - 0.5) * 700);
    if (!p) continue;
    const dx = p.x - x;
    const dy = p.y - y;
    if (dx * dx + dy * dy < minDist * minDist) continue;
    return p;
  }
  return { x: city.roadXs[0], y: city.roadYs[0], vertical: false };
}

export function pointInBuilding(city, x, y, pad) {
  for (const b of city.buildings) {
    if (x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) return b;
  }
  return null;
}
