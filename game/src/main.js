// SOLMAR CITY — entry point. Owns the game object, the loop, the state
// machine (title / playing / paused / busted / wasted / won), saving, bullets
// and particles. Systems live in their own modules; this file wires them up.

import { buildCity } from './city.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createPlayer, updatePlayer } from './player.js';
import { spawnTraffic, updateCars, damageCopCar } from './vehicles.js';
import { spawnPeds, updatePeds, checkPedHits } from './peds.js';
import { createWanted } from './wanted.js';
import { createMissions } from './missions.js';
import { render } from './render.js';
import { applyShot } from './shots.js';
import { SAVE_KEY, WORLD, SEA_Y } from './config.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

const params = new URLSearchParams(location.search);
const seed = parseInt(params.get('seed') || '20261117', 10) || 20261117;

const game = {
  canvas, ctx,
  view: { w: window.innerWidth, h: window.innerHeight },
  camera: { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight },
  time: 0,
  state: 'title',
  city: null,
  player: null,
  cars: [],
  peds: [],
  bullets: [],
  particles: [],
  toasts: [],
  lastShotAt: null,
  wanted: null,
  missions: null,
  input: null,
  audio: null,
  saveData: { bestCash: 0, bestMissions: 0, wins: 0 },
  save,
  toast,
};

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      game.saveData.bestCash = data.bestCash || 0;
      game.saveData.bestMissions = data.bestMissions || 0;
      game.saveData.wins = data.wins || 0;
    }
  } catch { /* fresh save */ }
}

function save() {
  const p = game.player;
  if (!p) return;
  game.saveData.bestCash = Math.max(game.saveData.bestCash, p.cash);
  game.saveData.bestMissions = Math.max(game.saveData.bestMissions, game.missions.done);
  if (game.state === 'won') game.saveData.wins += 1;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(game.saveData));
  } catch { /* storage unavailable */ }
}

function toast(text) {
  game.toasts.push({ text, life: 4 });
  if (game.toasts.length > 3) game.toasts.shift();
  if (statusEl) statusEl.textContent = text;
}

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  game.view.w = window.innerWidth;
  game.view.h = window.innerHeight;
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

function buildWorld() {
  game.city = buildCity(seed);
  game.player = createPlayer(game.city);
  game.cars = [];
  game.peds = [];
  game.bullets = [];
  game.particles = [];
  game.toasts = [];
  game.wanted = createWanted();
  game.missions = createMissions();
  // Parked cars from the city plan.
  for (const spot of game.city.parkedCars) {
    const kinds = ['sedan', 'coupe', 'taxi', 'sport'];
    const kind = kinds[Math.floor(Math.random() * kinds.length)];
    game.cars.push({
      id: 1000 + game.cars.length, x: spot.x, y: spot.y, angle: spot.angle, speed: 0,
      kind, driver: null, color: ['#b8452f', '#2f9e6e', '#8a5fc0', '#d9a05b'][Math.floor(Math.random() * 4)],
      top: 380, accel: 400, roadVertical: false, roadDir: 1, targetSpeed: 100,
      stall: 0, hits: 0, wrecked: false, skid: 0,
    });
  }
  spawnTraffic(game, 14);
  spawnPeds(game, 26);
  game.camera.x = Math.max(0, Math.min(game.player.x - game.view.w / 2, WORLD - game.view.w));
  game.camera.y = Math.max(0, Math.min(game.player.y - game.view.h / 2, WORLD - game.view.h));
}

function startGame() {
  game.audio.unlock();
  game.audio.click();
  game.state = 'playing';
  game.missions.start(game);
  toast('Mission 1: steal a car and bring it to the garage.');
}

function retryMission() {
  // Back to the garage, healthy, heat gone. Cash and completed missions stay.
  const g = game.city.landmarks.garage;
  game.player.x = g.x + 90;
  game.player.y = g.y + 40;
  game.player.angle = 0;
  game.player.health = 100;
  game.player.busted = 0;
  if (game.player.car) { game.player.car.driver = null; game.player.car = null; }
  game.player.onFoot = true;
  game.cars = game.cars.filter((c) => c.driver !== 'police');
  game.wanted.level = 0;
  game.wanted.heat = 0;
  game.wanted.cleanTimer = 0;
  game.wanted.policeTarget = 0;
  game.bullets = [];
  game.state = 'playing';
  game.missions.start(game);
}

function restartRun() {
  buildWorld();
  game.state = 'playing';
  game.missions.start(game);
}

function updatePlaying(dt) {
  const p = game.player;
  updatePlayer(game, dt);
  updateCars(game, dt);
  updatePeds(game, dt);
  checkPedHits(game);
  game.wanted.update(game, dt);
  game.missions.update(game, dt);
  updateBullets(game, dt);
  updateParticles(game, dt);
  // Health slowly recovers while clean.
  if (game.wanted.level === 0 && p.health > 0 && p.health < 100) {
    p.health = Math.min(100, p.health + 2 * dt);
  }
  // Engine + siren follow the action.
  const speedRatio = p.car ? Math.abs(p.car.speed) / p.car.top : 0;
  game.audio.engine(speedRatio, dt);
  const copNear = game.cars.some((c) => c.driver === 'police' && Math.hypot(c.x - p.x, c.y - p.y) < 520);
  game.audio.siren(copNear && game.wanted.level > 0, dt);
  // Toasts age out.
  for (let i = game.toasts.length - 1; i >= 0; i--) {
    game.toasts[i].life -= dt;
    if (game.toasts[i].life <= 0) game.toasts.splice(i, 1);
  }
  if (game.lastShotAt) {
    game.lastShotAt.life -= dt;
    if (game.lastShotAt.life <= 0) game.lastShotAt = null;
  }
}

function updateBullets(game, dt) {
  for (let i = game.bullets.length - 1; i >= 0; i--) {
    const b = game.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0 || b.x < 0 || b.x > WORLD || b.y < 0 || b.y > SEA_Y;
    if (!dead) {
      // Hit a pedestrian.
      for (const ped of game.peds) {
        if (ped.state === 'down') continue;
        const dx = ped.x - b.x;
        const dy = ped.y - b.y;
        if (dx * dx + dy * dy < 14 * 14) {
          ped.state = 'down';
          ped.down = 4;
          game.particles.push({ x: ped.x, y: ped.y, kind: 'hit', life: 0.3, max: 0.3 });
          if (b.fromPlayer) {
            game.wanted.addCrime(game, 'shooting', 1);
            game.toast('You shot a civilian! Wanted level up.');
          }
          dead = true;
          break;
        }
      }
    }
    if (!dead) {
      // Hit a police car.
      for (const car of game.cars) {
        if (car.driver !== 'police' || car.stall > 0) continue;
        const dx = car.x - b.x;
        const dy = car.y - b.y;
        if (dx * dx + dy * dy < 26 * 26) {
          damageCopCar(game, car);
          dead = true;
          break;
        }
      }
    }
    if (dead) game.bullets.splice(i, 1);
  }
}

function updateParticles(game, dt) {
  for (let i = game.particles.length - 1; i >= 0; i--) {
    game.particles[i].life -= dt;
    if (game.particles[i].life <= 0) game.particles.splice(i, 1);
  }
}

// Title screen: the city lives behind the menu (traffic + peds keep moving).
function updateTitle(dt) {
  updateCars(game, dt);
  updatePeds(game, dt);
  updateParticles(game, dt);
  // Slow cinematic pan around the garage.
  const g = game.city.landmarks.garage;
  game.camera.x = g.x - game.view.w / 2 + Math.sin(game.time * 0.08) * 120;
  game.camera.y = g.y - game.view.h / 2 + Math.cos(game.time * 0.06) * 80;
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  game.time += dt;

  if (game.state === 'playing') updatePlaying(dt);
  else if (game.state === 'title') updateTitle(dt);
  else if (game.state === 'won' && game.input.down('Enter')) {
    game.state = 'playing';
  }

  // Global keys.
  if (game.input.justPressed('Enter') && game.state === 'title') startGame();
  if (game.input.justPressed('Enter') && game.state === 'won') game.state = 'playing';
  if ((game.input.justPressed('p') || game.input.justPressed('P') || game.input.justPressed('Escape')) && game.state === 'playing') {
    game.state = 'paused';
    game.audio.stopEngine();
  } else if ((game.input.justPressed('p') || game.input.justPressed('P') || game.input.justPressed('Escape')) && game.state === 'paused') {
    game.state = 'playing';
  }
  if (game.input.justPressed('r') || game.input.justPressed('R')) {
    if (game.state === 'busted' || game.state === 'wasted') retryMission();
    else if (game.state === 'won' || game.state === 'paused') restartRun();
  }
  if (game.input.justPressed('m') || game.input.justPressed('M')) {
    const muted = game.audio.toggleMute();
    toast(muted ? 'Sound muted' : 'Sound on');
  }
  if (game.input.anyKeyPressed() || game.input.mouse.down) game.audio.unlock();

  render(game);
  game.input.endFrame();
  requestAnimationFrame(loop);
}

loadSave();
game.input = createInput(canvas);
game.audio = createAudio();
buildWorld();

// Screenshot poses (?shot=...) — used by the build to capture real renders.
const shot = params.get('shot');
if (shot) applyShot(game, shot);

// Debug handle for automated play-testing (no network, local only).
window.__solmar = game;

requestAnimationFrame(loop);
