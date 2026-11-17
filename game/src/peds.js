// Pedestrians: Solmar locals walking the sidewalks. They stroll, wait at
// corners, and flee from gunshots, speeding cars and police chases.

import { PED_COUNT, PED_SPEED, PALETTE, WORLD, SEA_Y } from './config.js';
import { clamp, angleDiff, dist2 } from './random.js';
import { pointInBuilding } from './city.js';
import { collideBuildings } from './player.js';

export function spawnPeds(game, count) {
  const { city } = game;
  for (let i = 0; i < count; i++) {
    const s = city.pedSpawns[Math.floor(Math.random() * city.pedSpawns.length)];
    game.peds.push(makePed(s.x, s.y));
  }
}

export function makePed(x, y) {
  return {
    x, y,
    angle: Math.random() * Math.PI * 2,
    speed: PED_SPEED * (0.7 + Math.random() * 0.6),
    state: 'walk', // 'walk' | 'flee' | 'down'
    timer: Math.random() * 4,
    color: PALETTE.ped[Math.floor(Math.random() * PALETTE.ped.length)],
    down: 0,
    targetX: x, targetY: y,
  };
}

export function updatePeds(game, dt) {
  const { player } = game;
  for (const ped of game.peds) {
    if (ped.state === 'down') {
      ped.down -= dt;
      if (ped.down <= 0) {
        ped.state = 'flee';
        ped.timer = 2;
      }
      continue;
    }
    if (ped.state === 'flee') {
      ped.timer -= dt;
      const away = Math.atan2(ped.y - player.y, ped.x - player.x);
      ped.angle += angleDiff(ped.angle, away) * Math.min(1, 6 * dt);
      movePed(game, ped, ped.speed * 2.4, dt);
      if (ped.timer <= 0) ped.state = 'walk';
      continue;
    }
    // Walk: pick a sidewalk target, stroll to it, pause, repeat.
    ped.timer -= dt;
    const dx = ped.targetX - ped.x;
    const dy = ped.targetY - ped.y;
    if (Math.hypot(dx, dy) < 12 || ped.timer <= 0) {
      if (Math.random() < 0.3) {
        ped.timer = 1 + Math.random() * 2; // stand and wait
        ped.targetX = ped.x;
        ped.targetY = ped.y;
      } else {
        const s = game.city.pedSpawns[Math.floor(Math.random() * game.city.pedSpawns.length)];
        ped.targetX = s.x;
        ped.targetY = s.y;
        ped.timer = 12;
      }
    } else {
      const want = Math.atan2(dy, dx);
      ped.angle += angleDiff(ped.angle, want) * Math.min(1, 5 * dt);
      movePed(game, ped, ped.speed, dt);
    }
    // Flee from gunfire and from cars about to hit them.
    if (game.lastShotAt && game.lastShotAt.life > 0) {
      const d = dist2(ped.x, ped.y, game.lastShotAt.x, game.lastShotAt.y);
      if (d < 260 * 260) { ped.state = 'flee'; ped.timer = 2.5; }
    }
    for (const car of game.cars) {
      if (car.wrecked || Math.abs(car.speed) < 60) continue;
      const d = dist2(ped.x, ped.y, car.x, car.y);
      if (d < 90 * 90) { ped.state = 'flee'; ped.timer = 1.5; break; }
    }
  }
}

function movePed(game, ped, speed, dt) {
  ped.x += Math.cos(ped.angle) * speed * dt;
  ped.y += Math.sin(ped.angle) * speed * dt;
  ped.x = clamp(ped.x, 20, WORLD - 20);
  ped.y = clamp(ped.y, 20, SEA_Y - 24);
  collideBuildings(game.city, ped, 9);
}

// A car hitting a ped at speed knocks them down and is a crime.
export function checkPedHits(game) {
  for (const car of game.cars) {
    if (car.wrecked || Math.abs(car.speed) < 90) continue;
    for (const ped of game.peds) {
      if (ped.state === 'down') continue;
      const d = dist2(ped.x, ped.y, car.x, car.y);
      if (d < 26 * 26) {
        ped.state = 'down';
        ped.down = 3;
        game.particles.push({ x: ped.x, y: ped.y, kind: 'hit', life: 0.4, max: 0.4 });
        if (car.driver === 'player') {
          game.wanted.addCrime(game, 'hit-ped', 1);
          game.toast('You hit a pedestrian! Wanted level up.');
        }
        // Push the ped clear of the car so it is not hit every frame.
        const a = Math.atan2(ped.y - car.y, ped.x - car.x);
        ped.x += Math.cos(a) * 30;
        ped.y += Math.sin(a) * 30;
      }
    }
  }
}
