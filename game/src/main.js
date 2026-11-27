// Gobble Dash boot and game loop: owns the canvas, the screen state machine
// (title → play → pause → end), the fixed-step simulation clock, and the wiring
// between input, world, renderer and sound. With ?shot=… in the address it instead
// stages one screenshot scene, draws it, and flags the frame ready.

import { SoundBank } from './audio.js';
import { LANE_Y, STEP, TURKEY_X, VIEW } from './config.js';
import { Input, pointInRect } from './input.js';
import { BUTTONS, Renderer } from './render.js';
import { stageShot } from './shots.js';
import { World } from './world.js';

const BEST_KEY = 'gobble-dash-best';

/** Read the best score from local storage, tolerating browsers that refuse it. */
function loadBest() {
  try {
    return Number(window.localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

/** Save the best score, tolerating browsers that refuse storage. */
function saveBest(score) {
  try {
    window.localStorage.setItem(BEST_KEY, String(score));
  } catch {
    // Private mode and friends: the run still counts, it just is not remembered.
  }
}

/** Play the sound that belongs to a world event. */
function playEvent(sound, event) {
  switch (event) {
    case 'gobble': sound.gobble(); break;
    case 'jump': sound.jump(); break;
    case 'land': sound.land(); break;
    case 'corn': sound.corn(); break;
    case 'hit': sound.thud(); break;
    case 'bark': sound.bark(); break;
    case 'knifeFall': sound.knifeWhoosh(); break;
    case 'hide': sound.rustle(); break;
    case 'popout': sound.gobble(); break;
    case 'lunge': sound.farmerShout(); break;
    case 'stage': sound.stageFanfare(); break;
    case 'caught': sound.caughtSting(); break;
    case 'escaped': sound.escapedJingle(); break;
    default: break;
  }
}

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new Renderer(canvas);
    this.input = new Input(canvas);
    this.sound = new SoundBank();
    this.world = new World(1);
    this.screen = 'title';
    this.best = loadBest();
    this.uiTime = 0;
    this.accumulator = 0;
    this.lastStamp = null;
    this.statusLine = document.getElementById('status');
    this.fitCanvas();
    window.addEventListener('resize', () => this.fitCanvas());
    window.addEventListener('blur', () => {
      this.input.reset();
      if (this.screen === 'play') this.setScreen('pause');
    });
  }

  /** Scale the canvas to the window while keeping its 1152×648 shape. */
  fitCanvas() {
    const scale = Math.min(window.innerWidth / VIEW.width, window.innerHeight / VIEW.height);
    this.canvas.style.width = Math.floor(VIEW.width * scale) + 'px';
    this.canvas.style.height = Math.floor(VIEW.height * scale) + 'px';
  }

  /** Switch screens, keeping the screen-reader status line honest. */
  setScreen(screen) {
    this.screen = screen;
    const lines = {
      title: 'Gobble Dash title screen. Press Enter or click Start Running.',
      play: 'Running. Arrow keys change lane, Space jumps, C hides in hay.',
      pause: 'Paused. Press P to keep running.',
      end: this.world.over === 'escaped' ? 'You escaped! Press Enter to run again.' : 'Caught! Press Enter to run again.',
    };
    if (this.statusLine) this.statusLine.textContent = lines[screen] || '';
  }

  /** Begin a fresh run with a new seed. */
  startRun() {
    this.world.reset((Date.now() & 0xffff) + 1);
    this.accumulator = 0;
    this.setScreen('play');
    this.sound.click();
  }

  /** One animation frame: advance the simulation, then draw. */
  frame(stamp) {
    if (this.lastStamp === null) this.lastStamp = stamp;
    const elapsed = Math.min(0.1, (stamp - this.lastStamp) / 1000);
    this.lastStamp = stamp;
    this.uiTime += elapsed;
    if (this.input.anyGesture) this.sound.unlock();
    if (this.input.wasPressed('mute')) this.sound.toggleMute();

    if (this.screen === 'title') this.titleInput();
    else if (this.screen === 'play') this.playInput(elapsed);
    else if (this.screen === 'pause') this.pauseInput();
    else if (this.screen === 'end') this.endInput();

    this.renderer.draw(this.world, this.screen, { best: this.best, muted: this.sound.muted, time: this.uiTime });
    this.input.endFrame();
    window.requestAnimationFrame((next) => this.frame(next));
  }

  titleInput() {
    if (this.input.wasPressed('confirm')) {
      this.startRun();
      return;
    }
    for (const click of this.input.takeClicks()) {
      if (pointInRect(click, BUTTONS.start)) this.startRun();
    }
  }

  pauseInput() {
    if (this.input.wasPressed('pause') || this.input.wasPressed('confirm')) this.setScreen('play');
  }

  endInput() {
    if (this.input.wasPressed('confirm')) {
      this.startRun();
      return;
    }
    for (const click of this.input.takeClicks()) {
      if (pointInRect(click, BUTTONS.again)) this.startRun();
    }
  }

  /** Read this frame's controls and step the world in fixed slices. */
  playInput(elapsed) {
    if (this.input.wasPressed('pause')) {
      this.setScreen('pause');
      return;
    }
    // mouse: click near the turkey to jump, elsewhere to hop one lane toward the click
    let mouseLaneDelta = 0;
    let mouseJump = false;
    for (const click of this.input.takeClicks()) {
      const laneY = this.world.turkey.laneY;
      if (Math.abs(click.x - TURKEY_X) < 100 && Math.abs(click.y - laneY) < 70) mouseJump = true;
      else if (click.y < laneY - 24) mouseLaneDelta = -1;
      else if (click.y > laneY + 24) mouseLaneDelta = 1;
    }
    const actions = {
      laneDelta: (this.input.wasPressed('laneDown') ? 1 : 0) - (this.input.wasPressed('laneUp') ? 1 : 0) + mouseLaneDelta,
      jump: this.input.wasPressed('jump') || mouseJump,
      hide: this.input.wasPressed('hide'),
    };
    actions.laneDelta = Math.max(-1, Math.min(1, actions.laneDelta));

    this.accumulator += elapsed;
    let first = true;
    while (this.accumulator >= STEP) {
      // edge-triggered actions land on the first slice of the frame only
      this.world.step(STEP, first ? actions : { laneDelta: 0, jump: false, hide: false });
      first = false;
      this.accumulator -= STEP;
      for (const event of this.world.drainEvents()) playEvent(this.sound, event);
      if (this.world.over) {
        if (this.world.score > this.best) {
          this.best = this.world.score;
          saveBest(this.best);
        }
        this.setScreen('end');
        break;
      }
    }
  }
}

/** Boot: screenshot mode when the address asks for one, the playable game otherwise. */
function boot() {
  const canvas = document.getElementById('game');
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  if (shot) {
    const seed = Number(params.get('seed')) || 1;
    const world = new World(seed);
    const screen = stageShot(shot, world, seed);
    const renderer = new Renderer(canvas);
    const ui = { best: 0, muted: true, time: world.time };
    renderer.draw(world, screen, ui);
    renderer.draw(world, screen, ui); // second paint settles gradients and fonts
    window.__shotReady = true;
    return;
  }
  const game = new Game(canvas);
  game.setScreen('title');
  window.requestAnimationFrame((stamp) => game.frame(stamp));
}

boot();
