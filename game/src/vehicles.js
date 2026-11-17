// Cars: arcade driving physics, traffic that follows the roads, and police
// that chase the player. One circle at the nose and one at the tail keep cars
// out of buildings; cars push each other apart on contact.

import {
  CAR_LENGTH, CAR_WIDTH, CAR_ACCEL, CAR_BRAKE, CAR_MAX_SPEED,
  CAR_REVERSE_MAX, CAR_TURN, CAR_DRAG, CAR_GRIP, CAR_KINDS, CAR_COLORS,
  TRAFFIC_SPEED, WORLD, SEA_Y,
} from './config.js';
import { clamp, angleDiff, dist2 } from './random.js';
import { isOnRoad, nearestRoadPoint, roadSpawnNear } from './city.js';
import { collideBuildings, damagePlayer } from './player.js';

let carId = 1;

export function createCar(x, y, angle, kind, driver) {
  const spec = CAR_KINDS[kind] || CAR_KINDS.sedan;
  return {
    id: carId++,
    x, y, angle, speed: 0,
    kind, driver, // 'player' | 'traffic' | 'police' | null (parked)
    color: kind === 'cop' ? spec.color : (Math.random() < 0.5 ? spec.color : CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)]),
    top: spec.top, accel: spec.accel,
    // Traffic state
    roadVertical: Math.random() > 0.5,
    roadDir: Math.random() > 0.5 ? 1 : -1,
    targetSpeed: TRAFFIC_SPEED * (0.85 + Math.random() * 0.3),
    // Police state
    stall: 0, hits: 0, wrecked: false,
    skid: 0,
  };
}

export function spawnTraffic(game, count) {
  const { city } = game;
  for (let i = 0; i < count; i++) {
    const horizontal = Math.random() > 0.5;
    const road = horizontal
      ? city.roadYs[Math.floor(Math.random() * city.roadYs.length)]
      : city.roadXs[Math.floor(Math.random() * city.roadXs.length)];
    const along = 100 + Math.random() * (WORLD - 200);
    const kind = ['sedan', 'sedan', 'taxi', 'coupe', 'truck', 'sport'][Math.floor(Math.random() * 6)];
    const car = createCar(
      horizontal ? along : road,
      horizontal ? road : along,
      horizontal ? (Math.random() > 0.5 ? 0 : Math.PI) : (Math.random() > 0.5 ? Math.PI / 2 : -Math.PI / 2),
      kind, 'traffic',
    );
    car.roadVertical = !horizontal;
    car.roadDir = horizontal
      ? (car.angle === 0 ? 1 : -1)
      : (car.angle === Math.PI / 2 ? 1 : -1);
    car.speed = car.targetSpeed * 0.6;
    game.cars.push(car);
  }
}

export function spawnPolice(game, count) {
  const { player } = game;
  for (let i = 0; i < count; i++) {
    const p = roadSpawnNear(game.city, player.x, player.y, 420);
    const car = createCar(p.x, p.y, Math.atan2(player.y - p.y, player.x - p.x), 'cop', 'police');
    car.speed = 200;
    game.cars.push(car);
  }
}

export function updateCars(game, dt) {
  for (const car of game.cars) {
    if (car.wrecked) continue;
    if (car.stall > 0) {
      car.stall -= dt;
      car.speed *= Math.max(0, 1 - 2 * dt);
      continue;
    }
    if (car.driver === 'player') drivePlayerCar(game, car, dt);
    else if (car.driver === 'police') updatePoliceCar(game, car, dt);
    else if (car.driver === 'traffic') updateTrafficCar(game, car, dt);
    // Parked cars (driver null) do not move.
    moveCar(game, car, dt);
  }
  collideCars(game);
  // Remove traffic that drifted far off the map edges (they respawn elsewhere).
  for (let i = game.cars.length - 1; i >= 0; i--) {
    const car = game.cars[i];
    if (car.driver === 'traffic' && (car.x < -80 || car.x > WORLD + 80 || car.y < -80 || car.y > WORLD + 80)) {
      game.cars.splice(i, 1);
    }
  }
}

function drivePlayerCar(game, car, dt) {
  const input = game.input;
  const fwd = input.axis('s', 'w') + input.axis('ArrowDown', 'ArrowUp');
  const steer = input.axis('a', 'd') + input.axis('ArrowLeft', 'ArrowRight');
  const handbrake = input.down(' ');
  if (fwd > 0) car.speed += car.accel * dt;
  else if (fwd < 0) {
    car.speed -= (car.speed > 10 ? CAR_BRAKE : car.accel * 0.6) * dt;
  }
  car.speed = clamp(car.speed, -CAR_REVERSE_MAX, car.top);
  const grip = handbrake ? 0.4 : 1;
  const turnRate = CAR_TURN * clamp(Math.abs(car.speed) / 160, 0, 1) * (car.speed < 0 ? -1 : 1);
  car.angle += steer * turnRate * grip * dt;
  if (handbrake) car.skid = Math.min(1, car.skid + dt * 3);
  else car.skid = Math.max(0, car.skid - dt * 2);
  if (Math.abs(car.speed) > 240 && Math.abs(steer) > 0.3) {
    game.particles.push({ x: car.x, y: car.y, kind: 'smoke', life: 0.5, max: 0.5 });
  }
}

function updateTrafficCar(game, car, dt) {
  const { city } = game;
  // Snap back onto the road centre line if pushed off.
  const p = nearestRoadPoint(city, car.x, car.y);
  if (p) {
    if (car.roadVertical) {
      const wantX = p.x + (car.roadDir > 0 ? -14 : 14);
      car.x += (wantX - car.x) * Math.min(1, 2.2 * dt);
      car.y += car.roadDir * car.speed * dt * 0; // y moves via moveCar below
      car.angle += angleDiff(car.angle, car.roadDir > 0 ? Math.PI / 2 : -Math.PI / 2) * Math.min(1, 3 * dt);
    } else {
      const wantY = p.y + (car.roadDir > 0 ? 14 : -14);
      car.y += (wantY - car.y) * Math.min(1, 2.2 * dt);
      car.angle += angleDiff(car.angle, car.roadDir > 0 ? 0 : Math.PI) * Math.min(1, 3 * dt);
    }
  }
  // Slow down for the car ahead.
  let target = car.targetSpeed;
  for (const other of game.cars) {
    if (other === car || other.wrecked) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const ahead = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
    const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
    if (ahead > 0 && ahead < 78 && side < 26) { target = Math.min(target, 30); break; }
  }
  // Slow for the player crossing in front.
  const pl = game.player;
  if (pl.onFoot) {
    const dx = pl.x - car.x;
    const dy = pl.y - car.y;
    const ahead = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
    const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
    if (ahead > 0 && ahead < 64 && side < 24) target = Math.min(target, 20);
  }
  car.speed += clamp(target - car.speed, -260 * dt, 200 * dt);
  // At an intersection, sometimes turn onto the crossing road.
  const nearX = city.roadXs.some((rx) => Math.abs(car.x - rx) < 34);
  const nearY = city.roadYs.some((ry) => Math.abs(car.y - ry) < 34);
  if (nearX && nearY && Math.random() < dt * 0.35) {
    car.roadVertical = !car.roadVertical;
    car.roadDir = Math.random() > 0.5 ? 1 : -1;
  }
}

function updatePoliceCar(game, car, dt) {
  const { player } = game;
  const dx = player.x - car.x;
  const dy = player.y - car.y;
  const dist = Math.hypot(dx, dy);
  const want = Math.atan2(dy, dx);
  const diff = angleDiff(car.angle, want);
  car.angle += clamp(diff, -2.6 * dt, 2.6 * dt);
  const target = dist > 120 ? car.top : car.top * 0.75;
  car.speed += clamp(target - car.speed, -300 * dt, 420 * dt);
  // Ram the player on foot: damage + busted pressure.
  if (player.onFoot && dist < 34) {
    player.busted += dt;
    if (car.speed > 80) damagePlayer(game, 14 * dt);
    if (Math.random() < dt * 2) {
      game.audio.crash();
      game.particles.push({ x: player.x, y: player.y, kind: 'hit', life: 0.3, max: 0.3 });
    }
  } else {
    player.busted = Math.max(0, player.busted - dt * 0.5);
  }
  // Ram the player's car: shove it.
  if (player.car && dist < 52) {
    player.car.speed *= Math.max(0.86, 1 - 0.5 * dt);
    if (Math.random() < dt * 3) game.audio.crash();
  }
}

function moveCar(game, car, dt) {
  // Drag + off-road slowdown.
  const offRoad = !isOnRoad(game.city, car.x, car.y) && car.driver !== null;
  const drag = offRoad ? CAR_DRAG * 2.4 : CAR_DRAG;
  car.speed *= Math.max(0, 1 - drag * dt * 0.4);
  if (Math.abs(car.speed) < 2) car.speed = 0;
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  car.x = nx;
  car.y = ny;
  // Keep cars out of the sea and inside the world.
  car.x = clamp(car.x, 16, WORLD - 16);
  if (car.y > SEA_Y - 30) { car.y = SEA_Y - 30; car.speed *= 0.4; }
  if (car.y < 16) { car.y = 16; car.speed *= 0.4; }
  // Buildings: two circles, nose and tail.
  const fx = car.x + Math.cos(car.angle) * (CAR_LENGTH / 2 - 6);
  const fy = car.y + Math.sin(car.angle) * (CAR_LENGTH / 2 - 6);
  const bx = car.x - Math.cos(car.angle) * (CAR_LENGTH / 2 - 6);
  const by = car.y - Math.sin(car.angle) * (CAR_LENGTH / 2 - 6);
  const front = { x: fx, y: fy };
  const back = { x: bx, y: by };
  const hitF = collideBuildings(game.city, front, CAR_WIDTH / 2);
  const hitB = collideBuildings(game.city, back, CAR_WIDTH / 2);
  if (hitF || hitB) {
    car.x = (front.x + back.x) / 2;
    car.y = (front.y + back.y) / 2;
    if (Math.abs(car.speed) > 200) {
      game.audio.crash();
      game.particles.push({ x: car.x, y: car.y, kind: 'hit', life: 0.35, max: 0.35 });
    }
    car.speed *= 0.45;
  }
}

function collideCars(game) {
  const cars = game.cars;
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i];
      const b = cars[j];
      if (a.wrecked || b.wrecked) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d2 = dx * dx + dy * dy;
      const min = 40;
      if (d2 < min * min && d2 > 0.01) {
        const d = Math.sqrt(d2);
        const push = (min - d) / 2;
        const nx = dx / d;
        const ny = dy / d;
        a.x -= nx * push;
        a.y -= ny * push;
        b.x += nx * push;
        b.y += ny * push;
        const impact = Math.abs(a.speed - b.speed);
        if (impact > 180) {
          game.audio.crash();
          game.particles.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, kind: 'hit', life: 0.3, max: 0.3 });
        }
        const avg = (a.speed + b.speed) / 2;
        a.speed = avg * 0.8;
        b.speed = avg * 0.8;
      }
    }
  }
}

// A bullet hitting a police car stalls it for a while.
export function damageCopCar(game, car) {
  car.hits += 1;
  game.particles.push({ x: car.x, y: car.y, kind: 'hit', life: 0.3, max: 0.3 });
  if (car.hits >= 3) {
    car.stall = 5;
    car.hits = 0;
    game.toast('Cop car stalled!');
  }
}
