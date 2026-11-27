// The things that share the track with the turkey: fences, pumpkins, hay bales, corn,
// the farm dog, the kitchen oven and the falling carving knife. Each entity lives in
// world metres along the track plus a lane; world.js moves them, render.js draws them.

export const KIND = {
  FENCE: 'fence',
  PUMPKIN: 'pumpkin',
  HAY: 'hay',
  CORN: 'corn',
  DOG: 'dog',
  OVEN: 'oven',
  KNIFE: 'knife',
};

/** Static facts per kind: track width in metres, whether a jump clears it, whether it hurts. */
export const KIND_INFO = {
  fence: { width: 1.1, jumpable: true, harmful: true },
  pumpkin: { width: 1.0, jumpable: true, harmful: true },
  hay: { width: 2.2, jumpable: false, harmful: false },
  corn: { width: 0.8, jumpable: false, harmful: false },
  dog: { width: 1.2, jumpable: false, harmful: true },
  oven: { width: 3.0, jumpable: false, harmful: true },
  knife: { width: 0.7, jumpable: false, harmful: true },
};

/** Knife timing: how long its shadow warns, how long it falls, how long it stays stuck. */
export const KNIFE_TELEGRAPH_S = 0.75;
export const KNIFE_FALL_S = 0.16;
export const KNIFE_STUCK_S = 1.3;
/** The knife starts its warning when the turkey is this many metres away. */
export const KNIFE_TRIGGER_M = 17;

/** How fast the dog runs toward the turkey, in metres per second over the ground. */
export const DOG_SPEED = 4.6;

/** A fresh entity of the given kind at track position x (metres) in the given lane. */
export function makeEntity(kind, lane, x) {
  return {
    kind,
    lane,
    x,
    width: KIND_INFO[kind].width,
    age: 0,
    state: kind === KIND.KNIFE ? 'waiting' : 'live',
    stateT: 0,
    scored: false, // near-miss already counted
    touched: false, // already collided or collected
  };
}

/** True while the entity can hurt the turkey right now (a waiting knife cannot). */
export function isDangerous(entity) {
  if (!KIND_INFO[entity.kind].harmful) return false;
  if (entity.kind === KIND.KNIFE) return entity.state === 'falling' || entity.state === 'stuck';
  return true;
}

/** True when a jump clears this entity (fences and pumpkins yes; ovens, dogs and knives no). */
export function isJumpable(entity) {
  return KIND_INFO[entity.kind].jumpable;
}

/**
 * Advance one entity by dt seconds. `distance` is the turkey's track position in metres.
 * Returns an event name ('bark', 'knifeFall') when the entity does something audible.
 */
export function stepEntity(entity, dt, distance) {
  entity.age += dt;
  if (entity.kind === KIND.DOG) {
    entity.x -= DOG_SPEED * dt; // the dog runs back down the track toward the turkey
    if (!entity.barked && entity.x - distance < 30) {
      entity.barked = true;
      return 'bark';
    }
  }
  if (entity.kind === KIND.KNIFE) {
    entity.stateT += dt;
    if (entity.state === 'waiting' && entity.x - distance < KNIFE_TRIGGER_M) {
      entity.state = 'telegraph';
      entity.stateT = 0;
    } else if (entity.state === 'telegraph' && entity.stateT >= KNIFE_TELEGRAPH_S) {
      entity.state = 'falling';
      entity.stateT = 0;
      return 'knifeFall';
    } else if (entity.state === 'falling' && entity.stateT >= KNIFE_FALL_S) {
      entity.state = 'stuck';
      entity.stateT = 0;
    } else if (entity.state === 'stuck' && entity.stateT >= KNIFE_STUCK_S) {
      entity.state = 'gone';
      entity.stateT = 0;
    }
  }
  return null;
}

/** True when the entity is far enough behind the turkey to forget about. */
export function isBehind(entity, distance) {
  return entity.x + entity.width < distance - 9;
}
