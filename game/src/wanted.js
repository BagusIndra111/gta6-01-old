// Wanted level: 0–5 stars. Crimes add heat; staying clean and out of sight
// lets it cool off. Police cars scale with the level; at 5 stars the whole
// city is after you. Busted = a cop sits on the player on foot.

import { WANTED_MAX, WANTED_DECAY_DELAY, WANTED_DECAY_TIME, BUST_TIME } from './config.js';
import { spawnPolice } from './vehicles.js';

export function createWanted() {
  return {
    level: 0,
    heat: 0, // 0..1 progress toward the next star
    cleanTimer: 0, // seconds since the last crime
    policeTarget: 0, // how many cop cars should be on the road
    addCrime,
    update,
  };
}

function addCrime(game, kind, stars) {
  const w = game.wanted;
  w.level = Math.min(WANTED_MAX, w.level + (stars || 1));
  w.heat = 0;
  w.cleanTimer = 0;
  w.policeTarget = policeCountFor(w.level);
  const have = game.cars.filter((c) => c.driver === 'police').length;
  if (have < w.policeTarget) spawnPolice(game, w.policeTarget - have);
  if (w.level >= 3) game.toast('WANTED LEVEL ' + w.level + ' — lose the cops!');
}

function policeCountFor(level) {
  return [0, 1, 2, 3, 4, 6][level] || 0;
}

function update(game, dt) {
  const w = game.wanted;
  const cops = game.cars.filter((c) => c.driver === 'police');
  // Top up police if some were stalled/despawned.
  if (cops.length < w.policeTarget && Math.random() < dt * 0.5) {
    spawnPolice(game, 1);
  }
  // Remove extra cops once the heat is gone.
  if (w.level === 0 && cops.length > 0) {
    for (const cop of cops) {
      if (Math.hypot(cop.x - game.player.x, cop.y - game.player.y) > 800) {
        game.cars.splice(game.cars.indexOf(cop), 1);
      }
    }
  }
  // Decay: only while no crime has happened recently and no cop sees the player.
  const seen = cops.some((c) => Math.hypot(c.x - game.player.x, c.y - game.player.y) < 420);
  if (w.level > 0) {
    w.cleanTimer += dt;
    if (!seen && w.cleanTimer > WANTED_DECAY_DELAY) {
      w.heat += dt / WANTED_DECAY_TIME;
      if (w.heat >= 1) {
        w.heat = 0;
        w.level -= 1;
        w.policeTarget = policeCountFor(w.level);
        w.cleanTimer = 0;
        game.toast(w.level === 0 ? 'You lost them. Clean.' : 'Wanted level down to ' + w.level + '.');
      }
    }
  }
  // Busted: a cop sitting on the player on foot.
  if (game.player.onFoot && game.player.busted >= BUST_TIME) {
    game.state = 'busted';
    game.audio.busted();
  }
}
