// SOLMAR CITY — tuning, palette and world constants. One place for every
// number the rest of the game reads, so a balance change is a one-line edit.

export const WORLD = 2600; // world is WORLD x WORLD pixels
export const ROAD_EVERY = 260; // road centre lines every 260 px
export const ROAD_W = 64; // road width
export const WALK_W = 16; // sidewalk width each side of a road
export const SEA_Y = 2300; // sea starts here (south edge)

// Player on foot
export const WALK_SPEED = 165;
export const RUN_SPEED = 245;
export const PLAYER_RADIUS = 13;
export const PLAYER_HEALTH = 100;

// Cars
export const CAR_LENGTH = 46;
export const CAR_WIDTH = 22;
export const CAR_ACCEL = 420;
export const CAR_BRAKE = 620;
export const CAR_MAX_SPEED = 430; // sport cars go faster, see CAR_KINDS
export const CAR_REVERSE_MAX = 150;
export const CAR_TURN = 2.9; // radians per second at full lock, scaled by speed
export const CAR_DRAG = 0.55; // per second, exponential
export const CAR_GRIP = 3.2; // lateral velocity damping

// Traffic
export const TRAFFIC_COUNT = 14;
export const TRAFFIC_SPEED = 105;
export const PED_COUNT = 26;
export const PED_SPEED = 42;

// Wanted
export const WANTED_MAX = 5;
export const WANTED_DECAY_DELAY = 16; // seconds clean before decay starts
export const WANTED_DECAY_TIME = 9; // seconds per star once decaying
export const BUST_TIME = 2.0; // seconds a cop must sit on the player to bust

// Combat
export const BULLET_SPEED = 780;
export const BULLET_RANGE = 520;
export const BULLET_DAMAGE = 34;
export const FIRE_COOLDOWN = 0.22;
export const COP_HEALTH = 100;

// Missions
export const MISSION_CASH = [400, 700, 900, 1600, 2500];
export const SAVE_KEY = 'solmar-city-save-v1';

// Palette: sun-soaked coastal city — warm sand, teal sea, terracotta roofs.
export const PALETTE = {
  grass: '#7fae62',
  grassDark: '#74a158',
  sand: '#e8d29a',
  sea: '#1f7f96',
  seaDeep: '#166b80',
  road: '#3a3f46',
  roadEdge: '#2c3036',
  sidewalk: '#b9b3a4',
  marking: '#e8e4d2',
  building: ['#c96f4a', '#d9a05b', '#8fa8bf', '#b5b0a6', '#a87f5f', '#7d9b76', '#c2b280', '#9b7fb5'],
  roof: ['#a34d33', '#8a6d3b', '#5d7a99', '#7a756a', '#96502f', '#5f7d58'],
  park: '#5d8f4e',
  pier: '#8a6f4d',
  player: '#ffd23f',
  cop: '#2f6fb2',
  copLight: '#e33e2b',
  ped: ['#e8e4d8', '#d96f5f', '#5f8fd9', '#e8b45f', '#7fd9a8', '#c98fd9'],
};

export const CAR_KINDS = {
  sedan: { color: '#b8452f', top: 380, accel: 400 },
  taxi: { color: '#f2c230', top: 360, accel: 380 },
  sport: { color: '#2f9e6e', top: 470, accel: 500 },
  truck: { color: '#7d8a99', top: 320, accel: 300 },
  cop: { color: '#2f6fb2', top: 440, accel: 470 },
  coupe: { color: '#8a5fc0', top: 400, accel: 430 },
};

export const CAR_COLORS = ['#b8452f', '#2f9e6e', '#8a5fc0', '#d9a05b', '#5f8fd9', '#e8e4d8', '#3a3f46', '#c96f4a'];
