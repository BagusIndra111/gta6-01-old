// Rendering: the city, the cars, the people, and the HUD — all canvas-drawn,
// no images. The camera follows the player; the HUD and minimap are drawn in
// screen space on top.

import { WORLD, ROAD_W, WALK_W, SEA_Y, PALETTE, CAR_LENGTH, CAR_WIDTH } from './config.js';
import { clamp } from './random.js';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export function render(game) {
  const { ctx, view } = game;
  ctx.clearRect(0, 0, view.w, view.h);
  updateCamera(game);
  drawWorld(game);
  drawEntities(game);
  drawMarkerArrow(game);
  drawHUD(game);
  drawMinimap(game);
  drawOverlay(game);
}

function updateCamera(game) {
  const { player, view } = game;
  const cam = game.camera;
  cam.w = view.w;
  cam.h = view.h;
  const tx = clamp(player.x - view.w / 2, 0, WORLD - view.w);
  const ty = clamp(player.y - view.h / 2, 0, WORLD - view.h);
  // Keep the camera from showing void past the south sea edge.
  cam.x += (tx - cam.x) * 0.12;
  cam.y += (ty - cam.y) * 0.12;
}

function drawWorld(game) {
  const { ctx, city, camera, time } = game;
  const { x: cx, y: cy, w: cw, h: ch } = camera;
  ctx.save();
  ctx.translate(-cx, -cy);

  // Ground.
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(cx - 4, cy - 4, cw + 8, ch + 8);
  // Mown stripes for a little texture.
  ctx.fillStyle = PALETTE.grassDark;
  const stripe = 130;
  for (let y = Math.floor(cy / stripe) * stripe; y < cy + ch; y += stripe * 2) {
    ctx.fillRect(cx - 4, y, cw + 8, stripe);
  }
  // Beach and sea.
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(cx - 4, SEA_Y - 44, cw + 8, 44);
  ctx.fillStyle = PALETTE.sea;
  ctx.fillRect(cx - 4, SEA_Y, cw + 8, WORLD - SEA_Y + 400);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    const wy = SEA_Y + 26 + i * 34 + Math.sin(time * 0.8 + i * 2) * 4;
    ctx.beginPath();
    for (let x = cx - 20; x < cx + cw + 20; x += 60) {
      ctx.moveTo(x, wy + Math.sin(x * 0.02 + time + i) * 3);
      ctx.lineTo(x + 34, wy + Math.sin((x + 34) * 0.02 + time + i) * 3);
    }
    ctx.stroke();
  }

  // Roads: asphalt, sidewalks, centre dashes.
  for (const rx of city.roadXs) {
    ctx.fillStyle = PALETTE.sidewalk;
    ctx.fillRect(rx - ROAD_W / 2 - WALK_W, Math.max(cy, 0), ROAD_W + WALK_W * 2, Math.min(ch, SEA_Y));
    ctx.fillStyle = PALETTE.road;
    ctx.fillRect(rx - ROAD_W / 2, Math.max(cy, 0), ROAD_W, Math.min(ch, SEA_Y));
    ctx.fillStyle = PALETTE.marking;
    for (let y = Math.floor(cy / 52) * 52; y < cy + ch && y < SEA_Y; y += 52) {
      ctx.fillRect(rx - 2, y, 4, 26);
    }
  }
  for (const ry of city.roadYs) {
    ctx.fillStyle = PALETTE.sidewalk;
    ctx.fillRect(Math.max(cx, 0), ry - ROAD_W / 2 - WALK_W, Math.min(cw, WORLD), ROAD_W + WALK_W * 2);
    ctx.fillStyle = PALETTE.road;
    ctx.fillRect(Math.max(cx, 0), ry - ROAD_W / 2, Math.min(cw, WORLD), ROAD_W);
    ctx.fillStyle = PALETTE.marking;
    for (let x = Math.floor(cx / 52) * 52; x < cx + cw; x += 52) {
      ctx.fillRect(x, ry - 2, 26, 4);
    }
  }

  // Park.
  const park = city.park;
  ctx.fillStyle = PALETTE.park;
  ctx.fillRect(park.x, park.y, park.w, park.h);
  ctx.strokeStyle = '#4a7a3f';
  ctx.lineWidth = 3;
  ctx.strokeRect(park.x + 4, park.y + 4, park.w - 8, park.h - 8);
  ctx.fillStyle = '#e8d29a';
  ctx.beginPath();
  ctx.arc(park.x + park.w / 2, park.y + park.h / 2, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#7fb3d9';
  ctx.beginPath();
  ctx.arc(park.x + park.w / 2, park.y + park.h / 2, 18, 0, Math.PI * 2);
  ctx.fill();

  // Pier.
  const pier = city.pier;
  ctx.fillStyle = PALETTE.pier;
  ctx.fillRect(pier.x, pier.y, pier.w, pier.h);
  ctx.strokeStyle = '#6b543a';
  ctx.lineWidth = 2;
  for (let y = pier.y + 14; y < pier.y + pier.h; y += 18) {
    ctx.beginPath();
    ctx.moveTo(pier.x, y);
    ctx.lineTo(pier.x + pier.w, y);
    ctx.stroke();
  }

  // Buildings.
  for (const b of city.buildings) {
    if (b.x + b.w < cx || b.x > cx + cw || b.y + b.h < cy || b.y > cy + ch) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(b.x + 5, b.y + 6, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    const ins = b.inset || 8;
    ctx.fillRect(b.x + ins, b.y + ins, b.w - ins * 2, b.h - ins * 2);
    // Windows on the walls.
    ctx.fillStyle = 'rgba(255,244,200,0.85)';
    const cols = Math.max(1, Math.floor(b.w / 26));
    const rows = Math.max(1, Math.floor(b.h / 26));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if ((r * cols + c) % 3 === 0) continue;
        ctx.fillRect(b.x + 8 + c * 26, b.y + 8 + r * 26, 10, 12);
      }
    }
    if (b.name) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText(b.name, b.x + b.w / 2, b.y - 8);
      ctx.textAlign = 'left';
    }
  }

  // Palms.
  for (const palm of city.palms) {
    ctx.strokeStyle = '#8a6f4d';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(palm.x, palm.y);
    ctx.lineTo(palm.x + 3, palm.y - 8);
    ctx.stroke();
    ctx.fillStyle = '#3f7d3a';
    ctx.beginPath();
    ctx.arc(palm.x + 3, palm.y - 12, 9, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawEntities(game) {
  const { ctx, camera } = game;
  ctx.save();
  ctx.translate(-camera.x, -camera.y);

  // Mission marker beacon.
  const marker = game.missions.marker(game);
  if (marker) {
    const pulse = 1 + Math.sin(game.time * 4) * 0.15;
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(marker.x, marker.y, 34 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,210,63,0.25)';
    ctx.beginPath();
    ctx.arc(marker.x, marker.y, 34 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.arc(marker.x, marker.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = 'bold 12px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText(marker.label, marker.x, marker.y - 44);
    ctx.textAlign = 'left';
  }

  // Pedestrians.
  for (const ped of game.peds) {
    if (ped.state === 'down') {
      ctx.fillStyle = ped.color;
      ctx.beginPath();
      ctx.ellipse(ped.x, ped.y, 12, 6, ped.angle, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    ctx.fillStyle = ped.color;
    ctx.beginPath();
    ctx.arc(ped.x, ped.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2c89b';
    ctx.beginPath();
    ctx.arc(ped.x + Math.cos(ped.angle) * 3, ped.y + Math.sin(ped.angle) * 3, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Cars.
  for (const car of game.cars) {
    drawCar(game, car);
  }

  // Player on foot.
  const p = game.player;
  if (p.onFoot && game.state !== 'title') {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#222';
    ctx.fillRect(8, -3, 12, 6); // gun / arm direction
    ctx.restore();
    // Busted ring while a cop sits on the player.
    if (p.busted > 0) {
      ctx.strokeStyle = '#e33e2b';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 22, -Math.PI / 2, -Math.PI / 2 + (p.busted / 2) * Math.PI * 2);
      ctx.stroke();
    }
  }

  // Bullets.
  ctx.strokeStyle = '#ffe27a';
  ctx.lineWidth = 3;
  for (const b of game.bullets) {
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  // Particles.
  for (const pt of game.particles) {
    const t = pt.life / pt.max;
    if (pt.kind === 'flash') {
      ctx.fillStyle = 'rgba(255,220,120,' + t + ')';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 14 * t + 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (pt.kind === 'smoke') {
      ctx.fillStyle = 'rgba(120,120,120,' + (t * 0.5) + ')';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 10 + (1 - t) * 14, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(255,180,60,' + t + ')';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 12 * t + 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

function drawCar(game, car) {
  const { ctx } = game;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(-CAR_LENGTH / 2 + 3, -CAR_WIDTH / 2 + 4, CAR_LENGTH, CAR_WIDTH);
  ctx.fillStyle = car.color;
  roundRect(ctx, -CAR_LENGTH / 2, -CAR_WIDTH / 2, CAR_LENGTH, CAR_WIDTH, 7);
  ctx.fill();
  // Windshield + rear window.
  ctx.fillStyle = '#1c2733';
  ctx.fillRect(6, -CAR_WIDTH / 2 + 4, 12, CAR_WIDTH - 8);
  ctx.fillRect(-CAR_LENGTH / 2 + 6, -CAR_WIDTH / 2 + 4, 8, CAR_WIDTH - 8);
  // Headlights.
  ctx.fillStyle = '#fff8c0';
  ctx.fillRect(CAR_LENGTH / 2 - 2, -CAR_WIDTH / 2 + 2, 3, 5);
  ctx.fillRect(CAR_LENGTH / 2 - 2, CAR_WIDTH / 2 - 7, 3, 5);
  if (car.kind === 'cop') {
    // Flashing light bar.
    const phase = Math.floor(game.time * 6) % 2 === 0;
    ctx.fillStyle = phase ? '#e33e2b' : '#2f6fb2';
    ctx.fillRect(-6, -CAR_WIDTH / 2 + 2, 12, 6);
    ctx.fillStyle = phase ? '#2f6fb2' : '#e33e2b';
    ctx.fillRect(-6, CAR_WIDTH / 2 - 8, 12, 6);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText('POLICE', 0, 3);
    ctx.textAlign = 'left';
  }
  if (car.kind === 'taxi') {
    ctx.fillStyle = '#222';
    ctx.font = 'bold 8px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, 3);
    ctx.textAlign = 'left';
  }
  if (car.stall > 0) {
    ctx.fillStyle = 'rgba(90,90,90,0.7)';
    ctx.beginPath();
    ctx.arc(-CAR_LENGTH / 2, 0, 8 + Math.sin(game.time * 8) * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawMarkerArrow(game) {
  const marker = game.missions.marker(game);
  if (!marker || game.state !== 'playing') return;
  const { ctx, view, camera } = game;
  const sx = marker.x - camera.x;
  const sy = marker.y - camera.y;
  if (sx > 40 && sx < view.w - 40 && sy > 40 && sy < view.h - 40) return;
  const cx = view.w / 2;
  const cy = view.h / 2;
  const a = Math.atan2(sy - cy, sx - cx);
  const ex = cx + Math.cos(a) * (Math.min(view.w, view.h) / 2 - 46);
  const ey = cy + Math.sin(a) * (Math.min(view.w, view.h) / 2 - 46);
  ctx.save();
  ctx.translate(ex, ey);
  ctx.rotate(a);
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath();
  ctx.moveTo(16, 0);
  ctx.lineTo(-10, -11);
  ctx.lineTo(-10, 11);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawHUD(game) {
  const { ctx, view, player, wanted } = game;
  if (game.state === 'title') return;
  ctx.save();
  ctx.font = 'bold 15px ' + FONT;
  ctx.textBaseline = 'top';

  // Cash + rep, top left.
  ctx.fillStyle = 'rgba(10,20,28,0.55)';
  roundRect(ctx, 12, 12, 190, 44, 8);
  ctx.fill();
  ctx.fillStyle = '#7ee787';
  ctx.fillText('$ ' + player.cash.toLocaleString('en-US'), 24, 22);
  ctx.fillStyle = '#fff';
  ctx.font = '13px ' + FONT;
  ctx.fillText('REP ' + player.rep + '  •  Missions ' + game.missions.done + '/5', 24, 40);

  // Wanted stars, top right.
  const starY = 30;
  const starX0 = view.w - 12 - 5 * 30;
  ctx.fillStyle = 'rgba(10,20,28,0.55)';
  roundRect(ctx, starX0 - 12, 12, 5 * 30 + 24, 36, 8);
  ctx.fill();
  for (let i = 0; i < 5; i++) {
    drawStar(ctx, starX0 + i * 30 + 12, starY, 11, i < wanted.level);
  }

  // Mission objective, top centre.
  const obj = game.missions.objectiveText(game);
  ctx.font = 'bold 15px ' + FONT;
  const tw = ctx.measureText(obj).width;
  ctx.fillStyle = 'rgba(10,20,28,0.55)';
  roundRect(ctx, view.w / 2 - tw / 2 - 14, 12, tw + 28, 30, 8);
  ctx.fill();
  ctx.fillStyle = '#ffd23f';
  ctx.textAlign = 'center';
  ctx.fillText(obj, view.w / 2, 19);
  ctx.textAlign = 'left';

  // Health, bottom left.
  ctx.fillStyle = 'rgba(10,20,28,0.55)';
  roundRect(ctx, 12, view.h - 44, 210, 32, 8);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px ' + FONT;
  ctx.fillText('HEALTH', 22, view.h - 36);
  ctx.fillStyle = '#333';
  ctx.fillRect(84, view.h - 36, 110, 14);
  ctx.fillStyle = player.health > 40 ? '#7ee787' : '#e33e2b';
  ctx.fillRect(84, view.h - 36, 110 * (player.health / 100), 14);

  // Speed, bottom right (above the minimap).
  if (player.car) {
    const kmh = Math.round(Math.abs(player.car.speed) * 0.36);
    ctx.fillStyle = 'rgba(10,20,28,0.55)';
    roundRect(ctx, view.w - 196, view.h - 44, 70, 32, 8);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px ' + FONT;
    ctx.textAlign = 'right';
    ctx.fillText(kmh + '', view.w - 150, view.h - 38);
    ctx.font = '11px ' + FONT;
    ctx.fillStyle = '#aaa';
    ctx.fillText('km/h', view.w - 136, view.h - 34);
    ctx.textAlign = 'left';
  }

  // Controls hint, bottom centre.
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '12px ' + FONT;
  ctx.textAlign = 'center';
  ctx.fillText(player.car ? 'W/S drive • A/D steer • Space handbrake • E exit • P pause • M mute' : 'WASD move • Shift run • E enter car • Click shoot • P pause • M mute', view.w / 2, view.h - 24);
  ctx.textAlign = 'left';

  // Toasts.
  ctx.font = 'bold 15px ' + FONT;
  let ty = 56;
  for (const t of game.toasts) {
    ctx.globalAlpha = Math.min(1, t.life / 0.6);
    const w = ctx.measureText(t.text).width;
    ctx.fillStyle = 'rgba(10,20,28,0.7)';
    roundRect(ctx, view.w / 2 - w / 2 - 12, ty, w + 24, 28, 8);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(t.text, view.w / 2, ty + 6);
    ctx.textAlign = 'left';
    ty += 34;
  }
  ctx.globalAlpha = 1;

  // Mission banner.
  if (game.missions.banner > 0 && game.missions.current) {
    const cur = game.missions.current;
    ctx.globalAlpha = Math.min(1, game.missions.banner / 0.8);
    ctx.fillStyle = 'rgba(10,20,28,0.72)';
    ctx.fillRect(0, view.h / 2 - 64, view.w, 110);
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 30px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText(cur.title, view.w / 2, view.h / 2 - 52);
    ctx.fillStyle = '#fff';
    ctx.font = '16px ' + FONT;
    ctx.fillText(cur.briefing, view.w / 2, view.h / 2 - 8);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function drawMinimap(game) {
  const { ctx, view, city } = game;
  if (game.state === 'title') return;
  const size = 150;
  const x0 = view.w - size - 12;
  const y0 = 56;
  const scale = size / WORLD;
  ctx.save();
  ctx.fillStyle = 'rgba(10,20,28,0.6)';
  roundRect(ctx, x0 - 4, y0 - 4, size + 8, size + 8, 8);
  ctx.fill();
  ctx.beginPath();
  ctx.rect(x0, y0, size, size);
  ctx.clip();
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(x0, y0, size, size);
  ctx.fillStyle = PALETTE.sea;
  ctx.fillRect(x0, y0 + SEA_Y * scale, size, size);
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 2;
  for (const rx of city.roadXs) {
    ctx.beginPath();
    ctx.moveTo(x0 + rx * scale, y0);
    ctx.lineTo(x0 + rx * scale, y0 + SEA_Y * scale);
    ctx.stroke();
  }
  for (const ry of city.roadYs) {
    ctx.beginPath();
    ctx.moveTo(x0, y0 + ry * scale);
    ctx.lineTo(x0 + size, y0 + ry * scale);
    ctx.stroke();
  }
  const marker = game.missions.marker(game);
  if (marker) {
    const pulse = 3 + Math.sin(game.time * 4) * 1.5;
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.arc(x0 + marker.x * scale, y0 + marker.y * scale, pulse, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const car of game.cars) {
    if (car.driver === 'police') ctx.fillStyle = '#4da3ff';
    else if (car.driver === 'player') ctx.fillStyle = '#ffd23f';
    else ctx.fillStyle = '#ccc';
    ctx.fillRect(x0 + car.x * scale - 1.5, y0 + car.y * scale - 1.5, 3, 3);
  }
  const p = game.player;
  ctx.fillStyle = '#ffd23f';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x0 + p.x * scale, y0 + p.y * scale, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawStar(ctx, x, y, r, filled) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    const px = x + Math.cos(ang) * rr;
    const py = y + Math.sin(ang) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = filled ? '#ffd23f' : 'rgba(255,255,255,0.25)';
  ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawOverlay(game) {
  const { ctx, view } = game;
  if (game.state === 'playing') return;
  ctx.save();
  ctx.fillStyle = 'rgba(8,16,22,0.72)';
  ctx.fillRect(0, 0, view.w, view.h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 54px ' + FONT;
  ctx.fillText('SOLMAR CITY', view.w / 2, view.h / 2 - 130);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 20px ' + FONT;
  if (game.state === 'title') {
    ctx.fillText('HARBOR HEIST — an open-world crime game', view.w / 2, view.h / 2 - 92);
    ctx.font = '16px ' + FONT;
    ctx.fillStyle = '#ddd';
    const lines = [
      'You are Rook, a driver-for-hire. Mara Voss has five jobs for you across the city.',
      'Steal cars, dodge the cops, run the missions — and don\'t get busted.',
      '',
      'WASD move  •  Shift run  •  E enter / steal a car  •  Click to shoot',
      'W/S drive  •  A/D steer  •  Space handbrake  •  P pause  •  M mute',
      '',
      'Best cash: $' + (game.saveData.bestCash || 0).toLocaleString('en-US') + '   •   Missions done: ' + (game.saveData.bestMissions || 0) + '/5',
    ];
    lines.forEach((line, i) => ctx.fillText(line, view.w / 2, view.h / 2 - 56 + i * 24));
    ctx.fillStyle = '#7ee787';
    ctx.font = 'bold 22px ' + FONT;
    ctx.fillText('Press ENTER to start', view.w / 2, view.h / 2 + 110);
  } else if (game.state === 'paused') {
    ctx.fillText('PAUSED', view.w / 2, view.h / 2 - 92);
    ctx.font = '16px ' + FONT;
    ctx.fillStyle = '#ddd';
    ctx.fillText('Press P to resume, or R to restart the run', view.w / 2, view.h / 2 - 56);
  } else if (game.state === 'busted') {
    ctx.fillStyle = '#e33e2b';
    ctx.fillText('BUSTED!', view.w / 2, view.h / 2 - 92);
    ctx.font = '16px ' + FONT;
    ctx.fillStyle = '#ddd';
    ctx.fillText('The Solmar PD took you in. Cash kept: $' + game.player.cash.toLocaleString('en-US'), view.w / 2, view.h / 2 - 56);
    ctx.fillStyle = '#7ee787';
    ctx.font = 'bold 22px ' + FONT;
    ctx.fillText('Press R to retry the mission', view.w / 2, view.h / 2 + 10);
  } else if (game.state === 'wasted') {
    ctx.fillStyle = '#e33e2b';
    ctx.fillText('WASTED', view.w / 2, view.h / 2 - 92);
    ctx.font = '16px ' + FONT;
    ctx.fillStyle = '#ddd';
    ctx.fillText('Rook is down. Cash kept: $' + game.player.cash.toLocaleString('en-US'), view.w / 2, view.h / 2 - 56);
    ctx.fillStyle = '#7ee787';
    ctx.font = 'bold 22px ' + FONT;
    ctx.fillText('Press R to retry the mission', view.w / 2, view.h / 2 + 10);
  } else if (game.state === 'won') {
    ctx.fillStyle = '#7ee787';
    ctx.fillText('SOLMAR LEGEND', view.w / 2, view.h / 2 - 92);
    ctx.font = '16px ' + FONT;
    ctx.fillStyle = '#ddd';
    ctx.fillText('All five jobs done. Mara owns the harbor now — and so do you.', view.w / 2, view.h / 2 - 56);
    ctx.fillText('Final cash: $' + game.player.cash.toLocaleString('en-US'), view.w / 2, view.h / 2 - 28);
    ctx.fillStyle = '#7ee787';
    ctx.font = 'bold 22px ' + FONT;
    ctx.fillText('Press R to play again, or ENTER to keep roaming', view.w / 2, view.h / 2 + 10);
  }
  ctx.restore();
}
