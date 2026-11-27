// Screenshot scenes behind ?shot=title|cover|field|end&seed=N. Each scene plays the real
// simulation forward from a fresh seeded world, steered by a simple autopilot (look ahead,
// jump what can be jumped, leave lanes that cannot, chase corn when safe, dive into hay
// when the farmer is close), so every frame is a moment a real run passes through and the
// same seed always gives the same frame. For the cover and field scenes the staging first
// scans the run for its most complete-looking moment, then replays to exactly that step.

import { GAP_LUNGE, LANE_Y, STEP } from './config.js';
import { KIND, isJumpable } from './entities.js';

/** Metres ahead the autopilot worries about when choosing a lane. */
const LOOKAHEAD_M = 11;
/** Jump when a jumpable hazard is this many seconds of running away. */
const JUMP_LEAD_S = 0.36;

/** True when the entity threatens the turkey now or is about to (a warning knife counts). */
function threatens(entity) {
  if (entity.kind === KIND.KNIFE) return entity.state !== 'waiting' && entity.state !== 'gone';
  return entity.kind === KIND.FENCE || entity.kind === KIND.PUMPKIN || entity.kind === KIND.DOG || entity.kind === KIND.OVEN;
}

/** Distance from the turkey to the nearest threat in a lane, or Infinity when clear. */
function laneClearance(world, lane) {
  let nearest = Infinity;
  for (const entity of world.entities) {
    if (entity.lane !== lane || !threatens(entity)) continue;
    const gap = entity.x - world.distance;
    if (gap > -entity.width && gap < nearest) nearest = gap;
  }
  return nearest;
}

/** The nearest corn ahead in a lane within reach, or null. */
function cornAhead(world, lane) {
  let best = null;
  for (const entity of world.entities) {
    if (entity.kind !== KIND.CORN || entity.lane !== lane || entity.collected) continue;
    const gap = entity.x - world.distance;
    if (gap > 0 && gap < 14 && (best === null || gap < best)) best = gap;
  }
  return best;
}

/** One autopilot decision for the current world state. A shorter lookahead reacts later. */
export function autopilot(world, lookahead = LOOKAHEAD_M) {
  const turkey = world.turkey;
  const actions = { laneDelta: 0, jump: false, hide: false };
  if (world.over) return actions;
  const lane = world.currentLane();

  // Hidden in hay: wait until the farmer has lost the trail, then pop out.
  if (turkey.hidden) {
    if (world.farmer.gap > 15) actions.hide = true;
    return actions;
  }

  // Farmer close and hay underfoot: dive in.
  if (world.farmer.gap < GAP_LUNGE && turkey.grounded && world.overHay()) {
    actions.hide = true;
    return actions;
  }

  const clearance = [0, 1, 2].map((i) => laneClearance(world, i));
  const mine = clearance[lane];

  // Jump a jumpable hazard that is about to arrive in this lane.
  if (turkey.grounded && mine < world.speed * JUMP_LEAD_S + 0.4) {
    for (const entity of world.entities) {
      if (entity.lane === lane && threatens(entity) && isJumpable(entity) && entity.x - world.distance > -entity.width && entity.x - world.distance < world.speed * JUMP_LEAD_S + 0.4) {
        actions.jump = true;
        return actions;
      }
    }
  }

  // Leave a lane that is about to hurt, for the clearest neighbouring lane.
  if (mine < lookahead) {
    let bestLane = lane;
    let bestClear = mine;
    for (const candidate of [lane - 1, lane + 1]) {
      if (candidate < 0 || candidate > 2) continue;
      if (clearance[candidate] > bestClear + 1.5) {
        bestClear = clearance[candidate];
        bestLane = candidate;
      }
    }
    if (bestLane !== lane) {
      actions.laneDelta = Math.sign(bestLane - lane);
      return actions;
    }
    if (mine < world.speed * JUMP_LEAD_S + 0.4 && turkey.grounded) actions.jump = true;
    return actions;
  }

  // Safe for now: drift toward corn.
  let target = lane;
  let targetGap = cornAhead(world, lane);
  for (const candidate of [lane - 1, lane + 1]) {
    if (candidate < 0 || candidate > 2) continue;
    const gap = cornAhead(world, candidate);
    if (gap !== null && clearance[candidate] > lookahead && (targetGap === null || gap < targetGap)) {
      targetGap = gap;
      target = candidate;
    }
  }
  if (target !== lane) actions.laneDelta = Math.sign(target - lane);
  return actions;
}

/**
 * A greedy, hurried pilot: chases corn first and only dodges at the last moment, so it
 * clips hazards, stumbles, and lets the farmer close in — as a hurried player does.
 */
export function greedyPilot(world) {
  const turkey = world.turkey;
  const actions = { laneDelta: 0, jump: false, hide: false };
  if (world.over) return actions;
  if (turkey.hidden) {
    if (world.farmer.gap > 15) actions.hide = true;
    return actions;
  }
  const lane = world.currentLane();
  // last-moment dodge of anything that cannot be jumped
  for (const entity of world.entities) {
    if (entity.lane !== lane || !threatens(entity) || isJumpable(entity)) continue;
    const gap = entity.x - world.distance;
    if (gap > -entity.width && gap < 2.2) {
      actions.laneDelta = lane === 0 ? 1 : lane === 2 ? -1 : (entity.x % 2 < 1 ? -1 : 1);
      return actions;
    }
  }
  // jump jumpable hazards, a touch late
  if (turkey.grounded) {
    for (const entity of world.entities) {
      if (entity.lane !== lane || !threatens(entity) || !isJumpable(entity)) continue;
      const gap = entity.x - world.distance;
      if (gap > 0 && gap < world.speed * 0.3) {
        actions.jump = true;
        return actions;
      }
    }
  }
  // greed: head for the nearest corn whatever lane it is in
  let target = lane;
  let targetGap = cornAhead(world, lane);
  for (const candidate of [0, 1, 2]) {
    if (candidate === lane) continue;
    const gap = cornAhead(world, candidate);
    if (gap !== null && (targetGap === null || gap < targetGap)) {
      targetGap = gap;
      target = candidate;
    }
  }
  if (target !== lane) actions.laneDelta = Math.sign(target - lane);
  return actions;
}

/** How complete a moment looks for the cover: kitchen, oven, knife, farmer close, airborne. */
function coverScore(world) {
  if (world.stage !== 2 || world.over) return -1;
  let score = 0;
  for (const entity of world.entities) {
    const ahead = entity.x - world.distance;
    if (ahead < -2 || ahead > 30) continue;
    if (entity.kind === KIND.OVEN) score += 3;
    if (entity.kind === KIND.KNIFE && entity.state !== 'waiting') score += 2;
    if (entity.kind === KIND.CORN) score += 0.4;
  }
  if (world.farmer.gap < 9) score += 6;
  else if (world.farmer.gap < 14) score += 3;
  else if (world.farmer.gap > 16) score -= 3;
  if (world.farmer.state === 'lunge') score += 2;
  if (world.turkey.stumbleT > 0) score += 1.5;
  if (!world.turkey.grounded && world.turkey.jumpY > 30) score += 1;
  if (world.turkey.hidden) score -= 4;
  return score;
}

/** How complete a moment looks for the field scene: dog charging, hay and corn in view. */
function fieldScore(world) {
  if (world.stage !== 1 || world.over) return -1;
  let score = 0;
  for (const entity of world.entities) {
    const ahead = entity.x - world.distance;
    if (ahead < -2 || ahead > 30) continue;
    if (entity.kind === KIND.DOG) score += ahead > 3 && ahead < 19 ? 3.5 : 1;
    if (entity.kind === KIND.HAY) score += 1.5;
    if (entity.kind === KIND.CORN) score += 0.4;
    if (entity.kind === KIND.PUMPKIN) score += 0.6;
  }
  if (world.farmer.gap < 14) score += 2;
  else if (world.farmer.gap > 24) score -= 2;
  if (world.turkey.hidden) score -= 4;
  return score;
}

/** Step the world with the autopilot for the given number of fixed steps. */
function runSteps(world, steps, lookahead = LOOKAHEAD_M) {
  for (let i = 0; i < steps; i += 1) {
    if (world.over) break;
    world.step(STEP, autopilot(world, lookahead));
  }
}

/**
 * Find the best-scoring step of a run (by the given scorer), then replay the same seeded
 * run to that step so the world holds exactly that moment. The pilot runs hurried (short
 * lookahead), and from sloppyFromM metres it turns greedy and distracted — chasing corn,
 * dodging late, deciding only every DISTRACTED_EVERY steps — so it clips hazards,
 * stumbles, and the farmer stays in the chase.
 */
function stageBestMoment(world, seed, scorer, maxSeconds, sloppyFromM) {
  const HURRIED_LOOKAHEAD = 6.5;
  const DISTRACTED_EVERY = 55;
  const decide = (w, stepIndex) => {
    if (w.distance >= sloppyFromM) {
      if (stepIndex % DISTRACTED_EVERY !== 0) return { laneDelta: 0, jump: false, hide: false };
      return greedyPilot(w);
    }
    return autopilot(w, HURRIED_LOOKAHEAD);
  };
  world.reset(seed);
  let bestStep = 0;
  let bestScore = -Infinity;
  const maxSteps = Math.floor(maxSeconds / STEP);
  for (let i = 0; i < maxSteps; i += 1) {
    if (world.over) break;
    world.step(STEP, decide(world, i));
    const score = scorer(world);
    if (score > bestScore) {
      bestScore = score;
      bestStep = i + 1;
    }
  }
  world.reset(seed);
  for (let i = 0; i < bestStep; i += 1) {
    if (world.over) break;
    world.step(STEP, decide(world, i));
  }
}

/**
 * Stage the named screenshot scene in the world and return the screen to draw over it.
 * Scenes: title (the menu over a fresh farmyard), cover (the kitchen at its busiest),
 * field (the harvest field with the dog charging), end (the run played out to its finish).
 */
export function stageShot(name, world, seed) {
  if (name === 'cover') {
    stageBestMoment(world, seed, coverScore, 260, 700);
    return 'play';
  }
  if (name === 'field') {
    stageBestMoment(world, seed, fieldScore, 200, 380);
    return 'play';
  }
  if (name === 'end') {
    world.reset(seed);
    runSteps(world, Math.floor(400 / STEP));
    if (!world.over) {
      // A stubbornly good autopilot may still be running: stand still and let the farmer finish it.
      for (let i = 0; i < Math.floor(120 / STEP) && !world.over; i += 1) {
        world.step(STEP, { laneDelta: 0, jump: false, hide: false });
      }
    }
    return 'end';
  }
  // title (and anything unknown): a fresh world under the menu, turkey posed in the
  // bottom lane so it and the farmer show below the instructions panel
  world.reset(seed);
  world.turkey.lane = 2;
  world.turkey.laneY = LANE_Y[2];
  return 'title';
}

/** The lane centre the turkey is drawn at, re-exported for the screenshot tooling. */
export function turkeyLaneY(world) {
  return LANE_Y[world.currentLane()];
}
