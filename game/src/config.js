// Gobble Dash tuning: view size, lanes, physics, speeds, stages and the autumn palette.
// Every number the simulation and the renderer share lives here so the two never drift apart.

export const VIEW = { width: 1152, height: 648 };

/** The turkey runs on the spot at this x; the world scrolls past it. */
export const TURKEY_X = 320;

/** Pixels per metre of world distance: how far one metre of running scrolls the scene. */
export const PX_PER_M = 26;

/** Ground line (y of the dirt track's top edge) and the three lane centre lines. */
export const GROUND_Y = 560;
export const LANE_Y = [392, 462, 532];
export const LANE_COUNT = 3;

/** Fixed simulation step: the world always advances in slices of this many seconds. */
export const STEP = 1 / 120;

/** The escape: reach this many metres and the turkey is free. */
export const ESCAPE_M = 1200;

/** Stage boundaries in metres: Farmyard, then Harvest Field, then the dreaded Kitchen. */
export const STAGES = [
  { name: 'FARMYARD', from: 0, to: 400 },
  { name: 'HARVEST FIELD', from: 400, to: 800 },
  { name: 'THE KITCHEN', from: 800, to: 1200 },
];

/** Turkey running speed in m/s, from the start of the run to the escape line. */
export const SPEED_START = 6.2;
export const SPEED_END = 11.4;

/** Jump physics: initial upward velocity and gravity, in pixels per second. */
export const JUMP_VY = 760;
export const GRAVITY = 2100;

/** Seconds a lane change hop takes, and how long the turkey may stay hidden in one hay bale. */
export const LANE_HOP_S = 0.16;
export const HIDE_MAX_S = 2.6;

/** Farmer gap in metres: where it starts, the most it can grow to, and the lunge range. */
export const GAP_START = 18;
export const GAP_MAX = 32;
export const GAP_LUNGE = 7;

/** How the farmer gap moves, in metres per second, for each turkey state. */
export const GAP_RATE = {
  clean: 0.55, // running well: the farmer falls slowly behind
  stumble: -9.5, // just hit something: he gains fast
  hidden: 3.4, // hiding in hay: he searches and loses the trail
  jump: 0.2, // airborne: barely gaining
};

/** Feathers (lives), stumble time after a hit, and invulnerability after a hit. */
export const FEATHERS_START = 3;
export const STUMBLE_S = 1.0;
export const INVULN_S = 1.6;

/** Score values. */
export const SCORE = { perMetre: 1, corn: 50, nearMiss: 10, stageBonus: 100 };

/** Spawn spacing in metres between hazard events, by stage index. */
export const SPAWN_GAP = [
  { min: 17, max: 26 },
  { min: 14, max: 22 },
  { min: 12, max: 19 },
];

/** The coherent autumn palette every drawing shares. */
export const PALETTE = {
  ink: '#2b1a0e',
  skyTop: '#ffd9a0',
  skyBottom: '#ff9d5c',
  sun: '#fff3b0',
  hillFar: '#d98e4a',
  hillNear: '#b96a2e',
  ground: '#8a5a2b',
  groundDark: '#6e451f',
  track: '#a06a33',
  laneLine: '#c98f4e',
  barnRed: '#b23a2e',
  barnRoof: '#7c2d24',
  wheat: '#e8b34b',
  wheatDark: '#c98f2e',
  hay: '#e5c15c',
  hayDark: '#c39a35',
  pumpkin: '#e67e22',
  pumpkinDark: '#c25e10',
  corn: '#ffd23f',
  cornHusk: '#7fb069',
  turkeyBody: '#8d6e63',
  turkeyDark: '#6d4c41',
  turkeyTail: '#a1887f',
  turkeyHead: '#90a4ae',
  wattle: '#d32f2f',
  beak: '#ffb300',
  farmerSkin: '#f2c094',
  farmerShirt: '#c0392b',
  farmerOveralls: '#3e5c8a',
  farmerHat: '#e8b34b',
  metal: '#cfd8dc',
  metalDark: '#90a4ae',
  ovenBody: '#455a64',
  ovenGlow: '#ff7043',
  kitchenWall: '#f3e5d8',
  kitchenTile: '#d7ccc8',
  hudPanel: 'rgba(43,26,14,0.78)',
  hudText: '#fff8e1',
  danger: '#ff5252',
  good: '#9ccc65',
};
