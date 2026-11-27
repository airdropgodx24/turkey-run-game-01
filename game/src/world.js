// The simulation: one turkey, one farmer, three lanes and 1200 metres of trouble.
// world.step advances the run by a fixed slice; render.js only reads the state it leaves.
// Everything random comes from the seeded generator, so a seed replays the same run.

import {
  ESCAPE_M,
  FEATHERS_START,
  GAP_LUNGE,
  GAP_MAX,
  GAP_RATE,
  GAP_START,
  GRAVITY,
  HIDE_MAX_S,
  INVULN_S,
  JUMP_VY,
  LANE_COUNT,
  LANE_HOP_S,
  LANE_Y,
  PX_PER_M,
  SCORE,
  SPAWN_GAP,
  SPEED_END,
  SPEED_START,
  STAGES,
  STUMBLE_S,
  TURKEY_X,
  VIEW,
} from './config.js';
import { KIND, isBehind, isDangerous, isJumpable, makeEntity, stepEntity } from './entities.js';
import { chance, intRange, makeRng, pick, range, shuffled } from './random.js';

/** Metres of track visible ahead of the turkey, plus a margin so things scroll in smoothly. */
const VIEW_AHEAD_M = (VIEW.width - TURKEY_X) / PX_PER_M + 6;
/** Half the turkey's footprint on the track, in metres, for overlap tests. */
const TURKEY_HALF_M = 0.38;
/** How high (pixels) the turkey's feet must be for a jump to clear a jumpable hazard. */
const JUMP_CLEAR_PX = 46;
/** Seconds between farmer lunges once he is close enough to try. */
const LUNGE_COOLDOWN_S = 2.4;
/** How long a lunge lasts, and how much gap it eats. */
const LUNGE_S = 0.45;
const LUNGE_GAIN_M = 2.4;
/** Cooldown before the turkey may dive into hay again after popping out. */
const HIDE_COOLDOWN_S = 0.9;

export class World {
  constructor(seed = 1) {
    this.reset(seed);
  }

  /** Start a fresh run from the given seed. */
  reset(seed = 1) {
    this.rng = makeRng(seed);
    this.seed = seed;
    this.time = 0;
    this.distance = 0;
    this.speed = SPEED_START;
    this.corn = 0;
    this.nearMisses = 0;
    this.stageBonus = 0;
    this.feathers = FEATHERS_START;
    this.stage = 0;
    this.stageBannerT = 0;
    this.over = null; // null | 'caught' | 'escaped'
    this.turkey = {
      lane: 1,
      laneY: LANE_Y[1],
      jumpY: 0,
      vy: 0,
      grounded: true,
      hidden: false,
      hideT: 0,
      hideCooldown: 0,
      stumbleT: 0,
      invulnT: 0,
      lastLaneChangeT: -10,
      runPhase: 0,
    };
    this.farmer = {
      gap: GAP_START,
      state: 'chase', // 'chase' | 'search' | 'lunge'
      lungeT: 0,
      lungeCooldown: 0,
      runPhase: 0,
    };
    this.entities = [];
    this.popups = [];
    this.events = [];
    this.nextSpawnAt = 16;
    this.spawnAhead();
  }

  /** The current score: metres run, corn, near misses and stage bonuses. */
  get score() {
    return Math.floor(this.distance) * SCORE.perMetre + this.corn * SCORE.corn + this.nearMisses * SCORE.nearMiss + this.stageBonus;
  }

  /** Which lane the turkey's body is in right now (nearest lane centre to its drawn y). */
  currentLane() {
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < LANE_COUNT; i += 1) {
      const d = Math.abs(this.turkey.laneY - LANE_Y[i]);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    return best;
  }

  /** Stage index for a track position. */
  stageAt(distance) {
    for (let i = STAGES.length - 1; i >= 0; i -= 1) {
      if (distance >= STAGES[i].from) return i;
    }
    return 0;
  }

  /** Note an event for the audio/render layer to pick up. */
  emit(name) {
    this.events.push(name);
  }

  /** Take (and clear) the events gathered since the last call. */
  drainEvents() {
    const out = this.events;
    this.events = [];
    return out;
  }

  /** Add a floating score popup at the turkey. */
  popup(text, colour) {
    this.popups.push({ text, colour, t: 0, lane: this.currentLane() });
  }

  /**
   * Advance the run by dt seconds.
   * actions: { laneDelta: -1|0|1, jump: boolean, hide: boolean } (edge-triggered).
   */
  step(dt, actions) {
    if (this.over) return;
    this.time += dt;
    const turkey = this.turkey;
    const farmer = this.farmer;

    // --- turkey lane movement -------------------------------------------------
    if (turkey.hidden) {
      turkey.hideT += dt;
      if (actions.hide || actions.laneDelta !== 0 || actions.jump || turkey.hideT >= HIDE_MAX_S) {
        turkey.hidden = false;
        turkey.hideCooldown = HIDE_COOLDOWN_S;
        this.emit('popout');
      }
    } else {
      if (actions.laneDelta !== 0) {
        const next = Math.max(0, Math.min(LANE_COUNT - 1, turkey.lane + actions.laneDelta));
        if (next !== turkey.lane) {
          turkey.lane = next;
          turkey.lastLaneChangeT = this.time;
          this.emit('gobble');
        }
      }
      if (actions.jump && turkey.grounded) {
        turkey.vy = JUMP_VY;
        turkey.grounded = false;
        this.emit('jump');
      }
      if (actions.hide && turkey.grounded && turkey.hideCooldown <= 0 && this.overHay()) {
        turkey.hidden = true;
        turkey.hideT = 0;
        this.emit('hide');
      }
    }
    turkey.hideCooldown = Math.max(0, turkey.hideCooldown - dt);

    // lane hop: glide laneY toward the target lane centre
    const targetY = LANE_Y[turkey.lane];
    const hopSpeed = Math.abs(LANE_Y[1] - LANE_Y[0]) / LANE_HOP_S;
    if (turkey.laneY < targetY) turkey.laneY = Math.min(targetY, turkey.laneY + hopSpeed * dt);
    else if (turkey.laneY > targetY) turkey.laneY = Math.max(targetY, turkey.laneY - hopSpeed * dt);

    // jump arc
    if (!turkey.grounded) {
      turkey.jumpY += turkey.vy * dt;
      turkey.vy -= GRAVITY * dt;
      if (turkey.jumpY <= 0) {
        turkey.jumpY = 0;
        turkey.vy = 0;
        turkey.grounded = true;
        this.emit('land');
      }
    }

    // --- speed and distance ---------------------------------------------------
    const pace = this.distance / ESCAPE_M;
    this.speed = SPEED_START + (SPEED_END - SPEED_START) * pace;
    if (turkey.stumbleT > 0) this.speed *= 0.45;
    if (turkey.hidden) this.speed = 0;
    this.distance += this.speed * dt;
    turkey.runPhase += this.speed * dt * 1.9;
    turkey.stumbleT = Math.max(0, turkey.stumbleT - dt);
    turkey.invulnT = Math.max(0, turkey.invulnT - dt);

    // stage transitions
    const stageNow = this.stageAt(this.distance);
    if (stageNow > this.stage) {
      this.stage = stageNow;
      this.stageBannerT = 2.2;
      this.stageBonus += SCORE.stageBonus;
      this.emit('stage');
    }
    this.stageBannerT = Math.max(0, this.stageBannerT - dt);

    // --- farmer ---------------------------------------------------------------
    farmer.lungeCooldown = Math.max(0, farmer.lungeCooldown - dt);
    if (turkey.hidden) {
      farmer.state = 'search';
      farmer.gap += GAP_RATE.hidden * dt;
    } else if (farmer.state === 'lunge') {
      farmer.lungeT += dt;
      farmer.gap -= (LUNGE_GAIN_M / LUNGE_S) * dt;
      if (farmer.lungeT >= LUNGE_S) {
        farmer.state = 'chase';
        farmer.lungeCooldown = LUNGE_COOLDOWN_S;
      }
    } else {
      farmer.state = 'chase';
      let rate = GAP_RATE.clean;
      if (turkey.stumbleT > 0) rate = GAP_RATE.stumble;
      else if (!turkey.grounded) rate = GAP_RATE.jump;
      farmer.gap += rate * dt;
      if (farmer.gap < GAP_LUNGE && farmer.lungeCooldown <= 0 && this.distance > 30) {
        farmer.state = 'lunge';
        farmer.lungeT = 0;
        this.emit('lunge');
      }
    }
    farmer.gap = Math.min(GAP_MAX, farmer.gap);
    farmer.runPhase += this.speed * dt * 1.6;

    // --- entities -------------------------------------------------------------
    this.spawnAhead();
    for (const entity of this.entities) {
      const event = stepEntity(entity, dt, this.distance);
      if (event) this.emit(event);
    }
    this.collide();
    this.entities = this.entities.filter((entity) => !isBehind(entity, this.distance) && entity.state !== 'gone' && !entity.collected);

    // popups age
    for (const popup of this.popups) popup.t += dt;
    this.popups = this.popups.filter((popup) => popup.t < 1.1);

    // --- endings --------------------------------------------------------------
    if (farmer.gap <= 0) {
      this.over = 'caught';
      this.emit('caught');
    } else if (this.distance >= ESCAPE_M) {
      this.over = 'escaped';
      this.emit('escaped');
    }
  }

  /** True when the turkey is standing in a hay bale it could dive into. */
  overHay() {
    const lane = this.currentLane();
    for (const entity of this.entities) {
      if (entity.kind !== KIND.HAY || entity.lane !== lane) continue;
      const centre = entity.x + entity.width / 2;
      if (Math.abs(this.distance - centre) < entity.width / 2 + 0.3) return true;
    }
    return false;
  }

  /** Test the turkey against every entity it currently overlaps. */
  collide() {
    const turkey = this.turkey;
    const lane = this.currentLane();
    for (const entity of this.entities) {
      const overlaps = this.distance + TURKEY_HALF_M > entity.x && this.distance - TURKEY_HALF_M < entity.x + entity.width;
      if (!overlaps || entity.lane !== lane) {
        // near miss: a hazard slips past in the next lane right after a lane change
        if (!entity.scored && isDangerous(entity) && Math.abs(entity.lane - lane) === 1 && entity.x + entity.width < this.distance - TURKEY_HALF_M && this.time - turkey.lastLaneChangeT < 0.4) {
          entity.scored = true;
          this.nearMisses += 1;
          this.popup('Close! +' + SCORE.nearMiss, '#ffd23f');
          this.emit('nearmiss');
        }
        continue;
      }
      if (entity.kind === KIND.CORN) {
        if (!entity.collected && !turkey.hidden) {
          entity.collected = true;
          this.corn += 1;
          this.farmer.gap = Math.min(GAP_MAX, this.farmer.gap + 1.2);
          this.popup('+' + SCORE.corn, '#ffd23f');
          this.emit('corn');
        }
        continue;
      }
      if (!isDangerous(entity) || turkey.hidden) continue;
      if (isJumpable(entity) && turkey.jumpY > JUMP_CLEAR_PX) {
        if (!entity.scored) {
          entity.scored = true;
          this.nearMisses += 1;
          this.popup('Close! +' + SCORE.nearMiss, '#ffd23f');
          this.emit('nearmiss');
        }
        continue;
      }
      if (turkey.invulnT > 0 || entity.touched) continue;
      entity.touched = true;
      this.feathers -= 1;
      turkey.stumbleT = STUMBLE_S;
      turkey.invulnT = INVULN_S;
      this.popup('Ouch!', '#ff5252');
      this.emit('hit');
      if (this.feathers <= 0) {
        this.farmer.gap = 0; // no feathers left: the farmer has you
      }
    }
  }

  /** Keep the track ahead stocked with stage-appropriate trouble and corn. */
  spawnAhead() {
    while (this.nextSpawnAt < this.distance + VIEW_AHEAD_M) {
      const x = this.nextSpawnAt;
      const stage = this.stageAt(x);
      this.spawnEvent(x, stage);
      const gap = SPAWN_GAP[stage];
      this.nextSpawnAt += range(this.rng, gap.min, gap.max);
    }
  }

  /** Lay out one spawn event at track position x for the given stage. */
  spawnEvent(x, stage) {
    const lanes = shuffled(this.rng, [0, 1, 2]);
    const roll = this.rng();
    if (stage === 0) {
      // Farmyard: fences to jump, hay to hide in, corn to chase.
      if (roll < 0.42) this.entities.push(makeEntity(KIND.FENCE, lanes[0], x));
      else if (roll < 0.62) this.entities.push(makeEntity(KIND.HAY, lanes[0], x));
      else if (roll < 0.8) this.cornRow(lanes[0], x);
      else {
        this.entities.push(makeEntity(KIND.FENCE, lanes[0], x));
        this.entities.push(makeEntity(KIND.CORN, lanes[1], x + 0.4));
      }
    } else if (stage === 1) {
      // Harvest Field: pumpkins join in, and the dog starts charging.
      if (roll < 0.3) this.entities.push(makeEntity(KIND.PUMPKIN, lanes[0], x));
      else if (roll < 0.48) this.entities.push(makeEntity(KIND.FENCE, lanes[0], x));
      else if (roll < 0.62) this.entities.push(makeEntity(KIND.HAY, lanes[0], x));
      else if (roll < 0.78) this.entities.push(makeEntity(KIND.DOG, lanes[0], x));
      else if (roll < 0.9) this.cornRow(lanes[0], x);
      else {
        this.entities.push(makeEntity(KIND.PUMPKIN, lanes[0], x));
        this.entities.push(makeEntity(KIND.FENCE, lanes[1], x));
      }
    } else {
      // The Kitchen: ovens block lanes whole, knives fall, no hay to hide in.
      if (roll < 0.34) this.entities.push(makeEntity(KIND.OVEN, lanes[0], x));
      else if (roll < 0.58) this.entities.push(makeEntity(KIND.KNIFE, lanes[0], x));
      else if (roll < 0.72) this.entities.push(makeEntity(KIND.PUMPKIN, lanes[0], x));
      else if (roll < 0.84) this.cornRow(lanes[0], x);
      else {
        this.entities.push(makeEntity(KIND.OVEN, lanes[0], x));
        this.entities.push(makeEntity(KIND.KNIFE, lanes[1], x + 0.6));
      }
    }
    // A stray corn in a spare lane keeps the greedy honest.
    if (chance(this.rng, 0.3)) {
      const lane = pick(this.rng, lanes);
      this.entities.push(makeEntity(KIND.CORN, lane, x + range(this.rng, 2, 6)));
    }
  }

  /** A short row of three corn cobs in one lane. */
  cornRow(lane, x) {
    for (let i = 0; i < 3; i += 1) {
      this.entities.push(makeEntity(KIND.CORN, lane, x + i * 1.3));
    }
  }

  /** A random lane other than the given one (used by the screenshot autopilot's helpers). */
  otherLane(lane) {
    const options = [0, 1, 2].filter((i) => i !== lane);
    return options[intRange(this.rng, 0, options.length - 1)];
  }
}
