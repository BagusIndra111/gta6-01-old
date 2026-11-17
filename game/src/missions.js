// The story: five jobs for Mara Voss, the fixer who runs Solmar from her bar.
// Each mission is a stage machine; completing one pays cash and starts the next.
// Finishing the fifth wins the game.

import { MISSION_CASH } from './config.js';

const MISSIONS = [
  {
    id: 'wheels',
    title: '1 — WHEELS',
    briefing: 'Mara needs a clean car. Steal one off the street and bring it to Rook\'s Garage.',
    objective: 'Steal a car (E) and deliver it to the garage',
  },
  {
    id: 'package',
    title: '2 — THE PACKAGE',
    briefing: 'A package is waiting at the docks. Pick it up on foot, then bring it to Mara\'s Bar.',
    objective: 'Pick up the package at the docks',
  },
  {
    id: 'getaway',
    title: '3 — GETAWAY',
    briefing: 'The cops made you. Survive 45 seconds with 2 stars on you. Don\'t get busted.',
    objective: 'Survive the heat — 45 s',
  },
  {
    id: 'vault',
    title: '4 — VAULT RUN',
    briefing: 'Solmar Bank, midday. Grab the vault cash, then lose 3 stars and live for 60 seconds.',
    objective: 'Grab the cash at Solmar Bank',
  },
  {
    id: 'harbor',
    title: '5 — HARBOR LIGHTS',
    briefing: 'Last job. Deliver a getaway car to the pier. Three stars are already on you. Make it count.',
    objective: 'Deliver a car to the pier',
  },
];

export function createMissions() {
  return {
    index: 0,
    stage: 0, // per-mission progress step
    timer: 0,
    channel: 0, // grab timer for the bank
    banner: 0, // seconds the mission banner stays up
    done: 0, // missions completed
    get current() { return MISSIONS[this.index] || null; },
    get finished() { return this.index >= MISSIONS.length; },
    objectiveText,
    marker,
    start,
    update,
    reset,
  };
}

function objectiveText(game) {
  const m = game.missions;
  if (m.finished) return 'Solmar is yours. Free roam — rack up cash.';
  const cur = MISSIONS[m.index];
  switch (cur.id) {
    case 'wheels':
      return m.stage === 0 ? 'Steal a car — walk up to one and press E' : 'Deliver the car to Rook\'s Garage';
    case 'package':
      return m.stage === 0 ? 'Walk to the docks and pick up the package' : 'Deliver the package to Mara\'s Bar';
    case 'getaway':
      return 'Survive the heat — ' + Math.ceil(m.timer) + ' s left';
    case 'vault':
      if (m.stage === 0) return 'Get to Solmar Bank and grab the cash';
      if (m.stage === 1) return 'Grabbing the vault… hold still';
      return 'Lose the cops — ' + Math.ceil(m.timer) + ' s left';
    case 'harbor':
      return 'Deliver a car to the pier — 3 stars on you';
    default:
      return cur.objective;
  }
}

function marker(game) {
  const m = game.missions;
  if (m.finished) return null;
  const L = game.city.landmarks;
  const cur = MISSIONS[m.index];
  switch (cur.id) {
    case 'wheels': return m.stage === 0 ? null : { x: L.garage.x, y: L.garage.y, label: 'GARAGE' };
    case 'package': return m.stage === 0 ? { x: L.docks.x, y: L.docks.y, label: 'PACKAGE' } : { x: L.bar.x, y: L.bar.y, label: "MARA'S BAR" };
    case 'getaway': return null;
    case 'vault': return m.stage < 2 ? { x: L.bank.x, y: L.bank.y, label: 'BANK' } : null;
    case 'harbor': return { x: L.pier.x, y: L.pier.y, label: 'PIER' };
    default: return null;
  }
}

function start(game) {
  const m = game.missions;
  const cur = MISSIONS[m.index];
  if (!cur) return;
  m.stage = 0;
  m.timer = 0;
  m.channel = 0;
  m.banner = 4;
  game.toast(cur.title + ' — ' + cur.briefing);
  if (cur.id === 'getaway') {
    m.timer = 45;
    game.wanted.addCrime(game, 'spotted', 2);
  }
  if (cur.id === 'harbor') {
    game.wanted.addCrime(game, 'spotted', 3);
  }
}

function completeMission(game) {
  const m = game.missions;
  const cur = MISSIONS[m.index];
  const cash = MISSION_CASH[m.index] || 500;
  game.player.cash += cash;
  game.player.rep += 1;
  m.done += 1;
  m.index += 1;
  game.audio.missionDone();
  game.toast(cur.title + ' complete! +$' + cash);
  game.save();
  if (m.index >= MISSIONS.length) {
    game.state = 'won';
    return;
  }
  start(game);
}

function update(game, dt) {
  const m = game.missions;
  if (m.finished) return;
  if (m.banner > 0) m.banner -= dt;
  const cur = MISSIONS[m.index];
  const L = game.city.landmarks;
  const p = game.player;
  const near = (spot, r) => Math.hypot(p.x - spot.x, p.y - spot.y) < r;

  if (cur.id === 'wheels') {
    if (m.stage === 0 && p.car) m.stage = 1;
    if (m.stage === 1 && p.car && near(L.garage, 90)) {
      // Leave the car at the garage.
      p.car.driver = null;
      p.car = null;
      p.onFoot = true;
      p.x = L.garage.x + 60;
      p.y = L.garage.y + 30;
      completeMission(game);
    }
  } else if (cur.id === 'package') {
    if (m.stage === 0 && p.onFoot && near(L.docks, 60)) {
      m.stage = 1;
      game.audio.pickup();
      game.toast('Package secured. Get it to Mara\'s Bar.');
    }
    if (m.stage === 1 && near(L.bar, 80)) completeMission(game);
  } else if (cur.id === 'getaway') {
    m.timer -= dt;
    if (m.timer <= 0) completeMission(game);
  } else if (cur.id === 'vault') {
    if (m.stage === 0 && near(L.bank, 70)) {
      m.stage = 1;
      m.channel = 1.5;
      game.toast('Cracking the vault…');
    } else if (m.stage === 1) {
      m.channel -= dt;
      if (!near(L.bank, 90)) { m.stage = 0; game.toast('You left the bank — grab aborted.'); }
      else if (m.channel <= 0) {
        m.stage = 2;
        m.timer = 60;
        game.wanted.addCrime(game, 'bank-job', 3);
        game.audio.pickup();
        game.toast('Vault cash grabbed! Lose the cops — 60 s.');
      }
    } else if (m.stage === 2) {
      m.timer -= dt;
      if (m.timer <= 0) completeMission(game);
    }
  } else if (cur.id === 'harbor') {
    if (p.car && near(L.pier, 80)) completeMission(game);
  }
}

function reset(game) {
  const m = game.missions;
  m.index = 0;
  m.stage = 0;
  m.timer = 0;
  m.channel = 0;
  m.done = 0;
  start(game);
}
