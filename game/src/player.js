// The player: "Rook", a driver-for-hire. On foot (walk/run, shoot with the
// mouse) and behind the wheel (enter with E, drive with W/A/S/D). Crimes the
// player commits here are what the wanted system answers to.

import {
  WALK_SPEED, RUN_SPEED, PLAYER_RADIUS, PLAYER_HEALTH,
  BULLET_SPEED, BULLET_RANGE, BULLET_DAMAGE, FIRE_COOLDOWN,
  WORLD, SEA_Y,
} from './config.js';
import { clamp, dist2 } from './random.js';
import { pointInBuilding } from './city.js';

export function createPlayer(city) {
  const s = city.playerStart;
  return {
    x: s.x, y: s.y, angle: s.angle,
    vx: 0, vy: 0,
    onFoot: true, car: null,
    health: PLAYER_HEALTH,
    cash: 0, rep: 0,
    fireCooldown: 0,
    busted: 0, // seconds a cop has sat on the player
    moving: false,
  };
}

// Push a circle out of every building rect it overlaps. Returns true if it hit.
export function collideBuildings(city, p, r) {
  let hit = false;
  for (const b of city.buildings) {
    const nx = clamp(p.x, b.x, b.x + b.w);
    const ny = clamp(p.y, b.y, b.y + b.h);
    const dx = p.x - nx;
    const dy = p.y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        p.x = nx + (dx / d) * r;
        p.y = ny + (dy / d) * r;
      } else {
        p.y = b.y - r; // centred inside: push up out of the roof
      }
    }
  }
  return hit;
}

export function updatePlayer(game, dt) {
  const { player, input, city, audio } = game;
  player.fireCooldown = Math.max(0, player.fireCooldown - dt);
  if (player.car) {
    updateInCar(game, dt);
    return;
  }

  // On foot: WASD/arrows, Shift to run. Face the mouse when shooting.
  const mx = input.axis('a', 'd') + input.axis('ArrowLeft', 'ArrowRight');
  const my = input.axis('w', 's') + input.axis('ArrowUp', 'ArrowDown');
  const run = input.down('Shift');
  const speed = run ? RUN_SPEED : WALK_SPEED;
  let vx = 0;
  let vy = 0;
  if (mx !== 0 || my !== 0) {
    const len = Math.hypot(mx, my);
    vx = (mx / len) * speed;
    vy = (my / len) * speed;
    player.angle = Math.atan2(vy, vx);
    player.moving = true;
  } else {
    player.moving = false;
  }
  player.vx = vx;
  player.vy = vy;
  player.x = clamp(player.x + vx * dt, 20, WORLD - 20);
  player.y = clamp(player.y + vy * dt, 20, SEA_Y - 24);
  collideBuildings(city, player, PLAYER_RADIUS);

  // Aim at the mouse (screen space -> world space via the camera).
  const wx = game.camera.x + (input.mouse.x / game.view.w) * game.camera.w;
  const wy = game.camera.y + (input.mouse.y / game.view.h) * game.camera.h;
  if (input.mouse.down || input.mouse.clicked) {
    player.angle = Math.atan2(wy - player.y, wx - player.x);
  }

  // Fire.
  if ((input.mouse.down || input.mouse.clicked) && player.fireCooldown <= 0) {
    player.fireCooldown = FIRE_COOLDOWN;
    const a = player.angle;
    game.bullets.push({
      x: player.x + Math.cos(a) * 18, y: player.y + Math.sin(a) * 18,
      vx: Math.cos(a) * BULLET_SPEED, vy: Math.sin(a) * BULLET_SPEED,
      life: BULLET_RANGE / BULLET_SPEED, fromPlayer: true, damage: BULLET_DAMAGE,
    });
    audio.shoot();
    game.particles.push({ x: player.x + Math.cos(a) * 20, y: player.y + Math.sin(a) * 20, kind: 'flash', life: 0.08, max: 0.08 });
  }

  // Enter the nearest car.
  if (input.justPressed('e') || input.justPressed('E')) {
    const car = nearestCar(game, player.x, player.y, 56);
    if (car) enterCar(game, car);
  }
}

function updateInCar(game, dt) {
  const { player } = game;
  const car = player.car;
  if (!car) { player.onFoot = true; return; }
  player.x = car.x;
  player.y = car.y;
  player.angle = car.angle;
  player.moving = Math.abs(car.speed) > 20;
  // Step out.
  if (game.input.justPressed('e') || game.input.justPressed('E')) {
    exitCar(game);
  }
}

export function enterCar(game, car) {
  const { player } = game;
  if (car.driver === 'traffic') {
    // Jacking a moving car: the driver bails and the law notices.
    car.driver = null;
    game.wanted.addCrime(game, 'steal', 1);
    game.toast('Car jacked! The driver ran — the cops saw that.');
    spawnFleeingPed(game, car.x, car.y);
  } else if (car.driver === 'police') {
    return; // cannot steal a police car while a cop is in it
  }
  car.driver = 'player';
  player.car = car;
  player.onFoot = false;
  game.audio.click();
}

export function exitCar(game) {
  const { player, city } = game;
  const car = player.car;
  if (!car) return;
  car.driver = null;
  player.car = null;
  player.onFoot = true;
  // Step out to the car's left side, clear of buildings.
  const side = car.angle + Math.PI / 2;
  player.x = car.x + Math.cos(side) * 34;
  player.y = car.y + Math.sin(side) * 34;
  player.x = clamp(player.x, 20, WORLD - 20);
  player.y = clamp(player.y, 20, SEA_Y - 24);
  if (pointInBuilding(city, player.x, player.y, 4)) {
    player.x = car.x - Math.cos(side) * 34;
    player.y = car.y - Math.sin(side) * 34;
  }
  player.vx = 0;
  player.vy = 0;
}

export function nearestCar(game, x, y, maxDist) {
  let best = null;
  let bestD = maxDist * maxDist;
  for (const car of game.cars) {
    if (car.driver === 'police') continue;
    if (car.wrecked) continue;
    const d = dist2(x, y, car.x, car.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

function spawnFleeingPed(game, x, y) {
  game.peds.push({
    x, y, angle: Math.random() * Math.PI * 2, speed: 120,
    state: 'flee', fleeX: x, fleeY: y, timer: 0, color: '#d96f5f', down: 0,
  });
}

export function damagePlayer(game, amount) {
  const { player } = game;
  if (player.health <= 0) return;
  player.health = Math.max(0, player.health - amount);
  if (player.health <= 0) game.state = 'wasted';
}
