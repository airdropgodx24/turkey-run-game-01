// Keyboard and mouse input, gathered into one small state the game polls each frame.
// Keys give held state plus one-frame "pressed" edges; the mouse reports clicks in canvas
// coordinates so the title and end screens can offer real buttons.

const KEY_BINDINGS = {
  ArrowUp: 'laneUp',
  KeyW: 'laneUp',
  ArrowDown: 'laneDown',
  KeyS: 'laneDown',
  Space: 'jump',
  KeyC: 'hide',
  ShiftLeft: 'hide',
  ShiftRight: 'hide',
  Enter: 'confirm',
  KeyP: 'pause',
  Escape: 'pause',
  KeyM: 'mute',
};

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.held = new Set();
    this.pressed = new Set();
    this.clicks = [];
    this.anyGesture = false;
    this.onKeyDown = (event) => {
      const action = KEY_BINDINGS[event.code];
      if (!action) return;
      event.preventDefault();
      this.anyGesture = true;
      if (!event.repeat) this.pressed.add(action);
      this.held.add(action);
    };
    this.onKeyUp = (event) => {
      const action = KEY_BINDINGS[event.code];
      if (action) this.held.delete(action);
    };
    this.onPointerDown = (event) => {
      this.anyGesture = true;
      const rect = this.canvas.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * this.canvas.width;
      const y = ((event.clientY - rect.top) / rect.height) * this.canvas.height;
      this.clicks.push({ x, y });
    };
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    canvas.addEventListener('pointerdown', this.onPointerDown);
  }

  /** True while the action's key is down. */
  isHeld(action) {
    return this.held.has(action);
  }

  /** True only on the frame the action was first pressed. Cleared by endFrame(). */
  wasPressed(action) {
    return this.pressed.has(action);
  }

  /** The clicks gathered since the last frame, in canvas coordinates. Cleared by endFrame(). */
  takeClicks() {
    return this.clicks;
  }

  /** Call once per rendered frame after the game has read the input. */
  endFrame() {
    this.pressed.clear();
    this.clicks = [];
  }

  /** Forget everything (used when the window loses focus mid-run). */
  reset() {
    this.held.clear();
    this.pressed.clear();
    this.clicks = [];
  }
}

/** True when the point lies inside the rectangle {x, y, w, h}. */
export function pointInRect(point, rect) {
  return point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h;
}
