// Screenshot poses (?shot=start|drive|chase|mission). Each one sets up a
// deterministic, lively scene from the real game so the dossier screenshots
// are genuine renders of the game's own code, not mock-ups.

import { createCar } from './vehicles.js';

// Boulevard used by the driving shots: a long straight east–west road.
const BOULEVARD_Y = 910;
const BOULEVARD_X = 300;

export function applyShot(game, name) {
  const L = game.city.landmarks;
  if (name === 'start') {
    // Title screen over the city — the loop's cinematic pan does the rest.
    return;
  }
  game.state = 'playing';
  game.missions.index = 0;

  if (name === 'drive') {
    // Rook mid-delivery: a sport car tearing down the boulevard, traffic ahead.
    // Kept slow enough that the car is still clear of the traffic 1.5 s in,
    // when the dossier screenshot is taken.
    const car = createCar(BOULEVARD_X, BOULEVARD_Y, 0, 'sport', 'player');
    car.speed = 240;
    game.cars.push(car);
    game.player.car = car;
    game.player.onFoot = false;
    game.player.x = car.x;
    game.player.y = car.y;
    game.player.angle = 0;
    game.missions.start(game);
    game.missions.stage = 1;
    game.missions.banner = 0; // keep the banner off the screenshot
    const ahead1 = createCar(1500, BOULEVARD_Y + 14, 0, 'sedan', 'traffic');
    ahead1.roadVertical = false;
    ahead1.roadDir = 1;
    ahead1.speed = 100;
    const ahead2 = createCar(1850, BOULEVARD_Y - 14, Math.PI, 'taxi', 'traffic');
    ahead2.roadVertical = false;
    ahead2.roadDir = -1;
    ahead2.speed = 95;
    game.cars.push(ahead1, ahead2);
    game.camera.x = Math.max(0, car.x - game.view.w / 2);
    game.camera.y = Math.max(0, car.y - game.view.h / 2);
    return;
  }

  if (name === 'chase') {
    // Three stars, three cop cars on Rook's tail, getaway timer running.
    const car = createCar(700, BOULEVARD_Y, 0, 'sport', 'player');
    car.speed = 340;
    game.cars.push(car);
    game.player.car = car;
    game.player.onFoot = false;
    game.player.x = car.x;
    game.player.y = car.y;
    game.player.angle = 0;
    game.missions.index = 2;
    game.missions.start(game);
    game.missions.timer = 38;
    game.missions.banner = 0;
    game.wanted.level = 3;
    game.wanted.policeTarget = 3;
    game.wanted.cleanTimer = 0;
    const copSpots = [
      { x: 560, y: BOULEVARD_Y + 6 },
      { x: 500, y: BOULEVARD_Y - 18 },
      { x: 600, y: BOULEVARD_Y + 22 },
    ];
    for (const spot of copSpots) {
      const cop = createCar(spot.x, spot.y, 0, 'cop', 'police');
      cop.speed = 380;
      game.cars.push(cop);
    }
    game.camera.x = Math.max(0, car.x - game.view.w / 2);
    game.camera.y = Math.max(0, car.y - game.view.h / 2);
    return;
  }

  if (name === 'mission') {
    // On foot at the docks, the package beacon pulsing ahead.
    game.missions.index = 1;
    game.missions.start(game);
    game.missions.banner = 0;
    game.player.x = L.docks.x - 90;
    game.player.y = L.docks.y + 30;
    game.player.angle = Math.atan2(L.docks.y - game.player.y, L.docks.x - game.player.x);
    game.player.onFoot = true;
    game.camera.x = Math.max(0, game.player.x - game.view.w / 2);
    game.camera.y = Math.max(0, game.player.y - game.view.h / 2);
    return;
  }

  // Unknown ?shot= value: fall back to the title screen.
  game.state = 'title';
}
