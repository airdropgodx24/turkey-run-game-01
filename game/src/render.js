// Everything the player sees, drawn with canvas paths from the world state: three stage
// backdrops with parallax, the turkey and the farmer, every hazard, the HUD, and the
// title, pause and end screens. No images are loaded; the art is code.

import { ESCAPE_M, GAP_LUNGE, GAP_MAX, GROUND_Y, LANE_Y, PALETTE, PX_PER_M, STAGES, TURKEY_X, VIEW } from './config.js';
import { KIND } from './entities.js';

/** Clickable button rectangles in canvas coordinates, shared with main.js. */
export const BUTTONS = {
  start: { x: VIEW.width / 2 - 150, y: 478, w: 300, h: 62 },
  again: { x: VIEW.width / 2 - 150, y: 470, w: 300, h: 62 },
};

const FONT = "'Trebuchet MS', Verdana, Geneva, sans-serif";

/** Deterministic 0..1 hash of an integer, for scattering decoration without RNG state. */
function hash(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Rounded rectangle path. */
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Filled ellipse helper. */
function ellipse(ctx, x, y, rx, ry, colour) {
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** World metres along the track to a screen x, given the turkey's distance. */
function screenX(worldX, distance) {
  return TURKEY_X + (worldX - distance) * PX_PER_M;
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  /**
   * Draw one frame.
   * screen: 'title' | 'play' | 'pause' | 'end'
   * ui: { best: number, muted: boolean, time: number }
   */
  draw(world, screen, ui) {
    const ctx = this.ctx;
    ctx.save();
    ctx.clearRect(0, 0, VIEW.width, VIEW.height);
    this.drawBackdrop(world);
    this.drawGround(world);
    this.drawEntities(world);
    this.drawFarmer(world);
    this.drawTurkey(world);
    this.drawPopups(world);
    if (screen === 'play' || screen === 'pause') this.drawHud(world, ui);
    if (screen === 'title') this.drawTitle(world, ui);
    if (screen === 'pause') this.drawPause();
    if (screen === 'end') this.drawEnd(world, ui);
    ctx.restore();
  }

  // ---------------------------------------------------------------- backdrop
  drawBackdrop(world) {
    const ctx = this.ctx;
    const stage = world.stage;
    if (stage === 2) {
      this.drawKitchenWall(world);
      return;
    }
    // sunset sky
    const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    sky.addColorStop(0, PALETTE.skyTop);
    sky.addColorStop(1, PALETTE.skyBottom);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, VIEW.width, GROUND_Y);
    // sun, low and big
    ellipse(ctx, 940, 150, 58, 58, PALETTE.sun);
    ellipse(ctx, 940, 150, 78, 78, 'rgba(255,243,176,0.35)');
    // clouds drifting with parallax
    ctx.fillStyle = 'rgba(255,248,225,0.85)';
    for (let i = 0; i < 6; i += 1) {
      const cx = ((hash(i * 7 + 1) * 1400 - world.distance * 2.2) % 1400 + 1400) % 1400 - 120;
      const cy = 40 + hash(i * 13 + 2) * 110;
      ellipse(ctx, cx, cy, 52, 17, 'rgba(255,248,225,0.85)');
      ellipse(ctx, cx + 34, cy + 6, 38, 13, 'rgba(255,248,225,0.85)');
      ellipse(ctx, cx - 36, cy + 7, 34, 12, 'rgba(255,248,225,0.85)');
    }
    // far hills
    ctx.fillStyle = PALETTE.hillFar;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    for (let x = 0; x <= VIEW.width; x += 32) {
      const y = GROUND_Y - 120 - Math.sin((x + world.distance * 4) * 0.008) * 46 - hash(Math.floor((x + world.distance * 4) / 180)) * 22;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(VIEW.width, GROUND_Y);
    ctx.closePath();
    ctx.fill();
    if (stage === 0) this.drawFarmyardProps(world);
    else this.drawFieldProps(world);
  }

  /** Barn, silo and a fence line scrolling past in the Farmyard. */
  drawFarmyardProps(world) {
    const ctx = this.ctx;
    const scroll = world.distance * PX_PER_M * 0.35;
    // barn + silo, repeating every 900 px
    for (let k = -1; k < 3; k += 1) {
      const bx = k * 900 - (scroll % 900) + 120;
      ctx.fillStyle = PALETTE.barnRed;
      ctx.fillRect(bx, GROUND_Y - 150, 170, 150);
      ctx.fillStyle = PALETTE.barnRoof;
      ctx.beginPath();
      ctx.moveTo(bx - 14, GROUND_Y - 150);
      ctx.lineTo(bx + 85, GROUND_Y - 215);
      ctx.lineTo(bx + 184, GROUND_Y - 150);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fff8e1';
      ctx.fillRect(bx + 62, GROUND_Y - 92, 46, 92);
      ctx.strokeStyle = PALETTE.barnRoof;
      ctx.lineWidth = 4;
      ctx.strokeRect(bx + 62, GROUND_Y - 92, 46, 92);
      ctx.beginPath();
      ctx.moveTo(bx + 62, GROUND_Y - 92);
      ctx.lineTo(bx + 108, GROUND_Y);
      ctx.moveTo(bx + 108, GROUND_Y - 92);
      ctx.lineTo(bx + 62, GROUND_Y);
      ctx.stroke();
      // silo
      ctx.fillStyle = '#b0bec5';
      ctx.fillRect(bx + 210, GROUND_Y - 190, 56, 190);
      ctx.fillStyle = '#90a4ae';
      ctx.beginPath();
      ctx.arc(bx + 238, GROUND_Y - 190, 28, Math.PI, 0);
      ctx.fill();
    }
    // fence line
    ctx.strokeStyle = '#7c4a21';
    ctx.lineWidth = 5;
    const fenceScroll = world.distance * PX_PER_M * 0.6;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y - 46);
    ctx.lineTo(VIEW.width, GROUND_Y - 46);
    ctx.moveTo(0, GROUND_Y - 24);
    ctx.lineTo(VIEW.width, GROUND_Y - 24);
    ctx.stroke();
    ctx.fillStyle = '#7c4a21';
    for (let x = -(fenceScroll % 90); x < VIEW.width; x += 90) {
      ctx.fillRect(x, GROUND_Y - 58, 9, 58);
    }
  }

  /** Wheat band, scarecrow and hay stacks in the Harvest Field. */
  drawFieldProps(world) {
    const ctx = this.ctx;
    // wheat band
    ctx.fillStyle = PALETTE.wheatDark;
    ctx.fillRect(0, GROUND_Y - 86, VIEW.width, 86);
    const scroll = world.distance * PX_PER_M * 0.7;
    ctx.strokeStyle = PALETTE.wheat;
    ctx.lineWidth = 3;
    for (let x = -(scroll % 26); x < VIEW.width; x += 26) {
      const sway = Math.sin(world.time * 1.6 + x * 0.05) * 4;
      ctx.beginPath();
      ctx.moveTo(x, GROUND_Y);
      ctx.quadraticCurveTo(x + sway, GROUND_Y - 44, x + sway * 1.6, GROUND_Y - 78);
      ctx.stroke();
      ellipse(ctx, x + sway * 1.6, GROUND_Y - 80, 4, 8, PALETTE.wheat);
    }
    // scarecrow every ~1100 px
    const sScroll = world.distance * PX_PER_M * 0.45;
    for (let k = -1; k < 3; k += 1) {
      const sx = k * 1100 - (sScroll % 1100) + 420;
      ctx.strokeStyle = '#6d4c41';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(sx, GROUND_Y);
      ctx.lineTo(sx, GROUND_Y - 120);
      ctx.moveTo(sx - 44, GROUND_Y - 96);
      ctx.lineTo(sx + 44, GROUND_Y - 96);
      ctx.stroke();
      ctx.fillStyle = '#5d7fa3';
      ctx.fillRect(sx - 24, GROUND_Y - 118, 48, 52);
      ellipse(ctx, sx, GROUND_Y - 134, 17, 17, '#e8c39e');
      ctx.fillStyle = PALETTE.farmerHat;
      ctx.fillRect(sx - 26, GROUND_Y - 148, 52, 8);
      ctx.fillRect(sx - 13, GROUND_Y - 162, 26, 15);
      ctx.fillStyle = PALETTE.ink;
      ellipse(ctx, sx - 6, GROUND_Y - 136, 2.4, 2.4, PALETTE.ink);
      ellipse(ctx, sx + 6, GROUND_Y - 136, 2.4, 2.4, PALETTE.ink);
    }
  }

  /** Tiled wall, hanging pans, shelves and a window inside the Kitchen. */
  drawKitchenWall(world) {
    const ctx = this.ctx;
    ctx.fillStyle = PALETTE.kitchenWall;
    ctx.fillRect(0, 0, VIEW.width, GROUND_Y);
    // wall tiles
    ctx.strokeStyle = PALETTE.kitchenTile;
    ctx.lineWidth = 2;
    const tileScroll = (world.distance * PX_PER_M * 0.3) % 64;
    ctx.beginPath();
    for (let x = -tileScroll; x < VIEW.width; x += 64) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, GROUND_Y);
    }
    for (let y = 0; y < GROUND_Y; y += 64) {
      ctx.moveTo(0, y);
      ctx.lineTo(VIEW.width, y);
    }
    ctx.stroke();
    // window with evening light
    const wx = 830 - (world.distance * PX_PER_M * 0.3) % 1400;
    ctx.fillStyle = '#ffcc80';
    ctx.fillRect(wx, 60, 190, 150);
    ctx.strokeStyle = '#8d6e63';
    ctx.lineWidth = 8;
    ctx.strokeRect(wx, 60, 190, 150);
    ctx.beginPath();
    ctx.moveTo(wx + 95, 60);
    ctx.lineTo(wx + 95, 210);
    ctx.moveTo(wx, 135);
    ctx.lineTo(wx + 190, 135);
    ctx.stroke();
    ellipse(ctx, wx + 140, 100, 22, 22, PALETTE.sun);
    // hanging pans on a rail
    ctx.strokeStyle = '#6d4c41';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(0, 92);
    ctx.lineTo(VIEW.width, 92);
    ctx.stroke();
    const panScroll = world.distance * PX_PER_M * 0.5;
    for (let i = 0; i < 7; i += 1) {
      const px = ((i * 210 - panScroll) % 1470 + 1470) % 1470 - 80;
      ctx.strokeStyle = '#6d4c41';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(px, 92);
      ctx.lineTo(px, 118);
      ctx.stroke();
      ellipse(ctx, px, 148, 30, 30, i % 2 ? '#b87333' : '#90a4ae');
      ellipse(ctx, px, 148, 21, 21, i % 2 ? '#d98e4a' : '#b0bec5');
    }
    // shelf with jars
    const shelfScroll = world.distance * PX_PER_M * 0.4;
    for (let k = -1; k < 3; k += 1) {
      const sx = k * 760 - (shelfScroll % 760) + 60;
      ctx.fillStyle = '#8d6e63';
      ctx.fillRect(sx, 300, 320, 12);
      const jarColours = ['#c0392b', '#e67e22', '#7fb069', '#f1c40f', '#8e6cc8'];
      for (let j = 0; j < 5; j += 1) {
        ctx.fillStyle = jarColours[j];
        roundRect(ctx, sx + 18 + j * 62, 252, 38, 48, 6);
        ctx.fill();
        ctx.fillStyle = '#6d4c41';
        ctx.fillRect(sx + 24 + j * 62, 244, 26, 10);
      }
    }
  }

  // ---------------------------------------------------------------- ground
  drawGround(world) {
    const ctx = this.ctx;
    const kitchen = world.stage === 2;
    ctx.fillStyle = kitchen ? '#bcaaa4' : PALETTE.ground;
    ctx.fillRect(0, GROUND_Y, VIEW.width, VIEW.height - GROUND_Y);
    // the three running lanes as lighter bands
    for (let i = 0; i < LANE_Y.length; i += 1) {
      ctx.fillStyle = kitchen ? 'rgba(255,255,255,0.13)' : 'rgba(255,214,150,0.14)';
      ctx.fillRect(0, LANE_Y[i] - 26, VIEW.width, 52);
    }
    // scrolling lane dashes + ground speckle
    const scroll = world.distance * PX_PER_M;
    ctx.fillStyle = kitchen ? 'rgba(93,64,55,0.35)' : PALETTE.laneLine;
    for (let i = 0; i < LANE_Y.length; i += 1) {
      for (let x = -(scroll % 72); x < VIEW.width; x += 72) {
        ctx.fillRect(x, LANE_Y[i] + 24, 40, 4);
      }
    }
    ctx.fillStyle = kitchen ? 'rgba(93,64,55,0.25)' : PALETTE.groundDark;
    for (let i = 0; i < 46; i += 1) {
      const gx = ((hash(i * 31 + 5) * 1600 - scroll) % 1600 + 1600) % 1600 - 60;
      const gy = GROUND_Y + 12 + hash(i * 17 + 3) * 64;
      ellipse(ctx, gx, gy, 5 + hash(i) * 6, 2.6, kitchen ? 'rgba(93,64,55,0.25)' : PALETTE.groundDark);
    }
  }

  // ---------------------------------------------------------------- entities
  drawEntities(world) {
    for (const entity of world.entities) {
      const x = screenX(entity.x, world.distance);
      if (x < -160 || x > VIEW.width + 160) continue;
      const y = LANE_Y[entity.lane];
      switch (entity.kind) {
        case KIND.FENCE: this.drawFence(x, y); break;
        case KIND.PUMPKIN: this.drawPumpkin(x, y); break;
        case KIND.HAY: this.drawHay(world, entity, x, y); break;
        case KIND.CORN: this.drawCorn(world, x, y); break;
        case KIND.DOG: this.drawDog(world, x, y); break;
        case KIND.OVEN: this.drawOven(world, x, y); break;
        case KIND.KNIFE: this.drawKnife(entity, x, y); break;
        default: break;
      }
    }
  }

  drawFence(x, y) {
    const ctx = this.ctx;
    ctx.fillStyle = '#8a5a2b';
    ctx.fillRect(x, y - 44, 8, 44);
    ctx.fillRect(x + 20, y - 44, 8, 44);
    ctx.fillStyle = '#a06a33';
    ctx.fillRect(x - 4, y - 40, 36, 8);
    ctx.fillRect(x - 4, y - 22, 36, 8);
    ctx.fillStyle = '#6e451f';
    ellipse(ctx, x + 4, y - 36, 2, 2, '#6e451f');
    ellipse(ctx, x + 24, y - 18, 2, 2, '#6e451f');
  }

  drawPumpkin(x, y) {
    const ctx = this.ctx;
    ellipse(ctx, x + 13, y - 15, 15, 13, PALETTE.pumpkin);
    ellipse(ctx, x + 6, y - 15, 9, 12, PALETTE.pumpkinDark);
    ellipse(ctx, x + 20, y - 15, 9, 12, PALETTE.pumpkinDark);
    ellipse(ctx, x + 13, y - 15, 8, 13, PALETTE.pumpkin);
    ctx.fillStyle = '#558b2f';
    ctx.fillRect(x + 11, y - 32, 5, 7);
  }

  drawHay(world, entity, x, y) {
    const ctx = this.ctx;
    const w = entity.width * PX_PER_M;
    ctx.fillStyle = PALETTE.hay;
    roundRect(ctx, x, y - 52, w, 52, 16);
    ctx.fill();
    ctx.strokeStyle = PALETTE.hayDark;
    ctx.lineWidth = 3;
    for (let i = 0; i < 5; i += 1) {
      ctx.beginPath();
      ctx.moveTo(x + 8 + i * (w / 5), y - 46);
      ctx.lineTo(x + 14 + i * (w / 5), y - 8);
      ctx.stroke();
    }
    ctx.strokeStyle = '#8a5a2b';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.3, y - 52);
    ctx.lineTo(x + w * 0.3, y);
    ctx.moveTo(x + w * 0.7, y - 52);
    ctx.lineTo(x + w * 0.7, y);
    ctx.stroke();
    // the turkey is inside: tail feathers poke out of the top
    const turkey = world.turkey;
    if (turkey.hidden && world.currentLane() === entity.lane && Math.abs(world.distance - (entity.x + entity.width / 2)) < entity.width / 2 + 0.3) {
      const wiggle = Math.sin(world.time * 9) * 3;
      ctx.fillStyle = PALETTE.turkeyTail;
      for (let i = -2; i <= 2; i += 1) {
        ctx.save();
        ctx.translate(x + w / 2 + wiggle, y - 50);
        ctx.rotate(i * 0.32);
        ellipse(ctx, 0, -13, 6, 15, PALETTE.turkeyTail);
        ctx.restore();
      }
      ctx.fillStyle = PALETTE.ink;
      ctx.font = `bold 17px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('shh…', x + w / 2, y - 84);
    }
  }

  drawCorn(world, x, y) {
    const ctx = this.ctx;
    const bob = Math.sin(world.time * 4 + x * 0.05) * 3;
    ctx.save();
    ctx.translate(x + 10, y - 26 + bob);
    ctx.rotate(0.5);
    ctx.fillStyle = PALETTE.cornHusk;
    ctx.beginPath();
    ctx.moveTo(-6, 12);
    ctx.lineTo(-13, 24);
    ctx.lineTo(-2, 24);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(6, 12);
    ctx.lineTo(13, 24);
    ctx.lineTo(2, 24);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PALETTE.corn;
    roundRect(ctx, -6, -16, 12, 30, 6);
    ctx.fill();
    ctx.fillStyle = '#e6a817';
    for (let r = 0; r < 4; r += 1) {
      for (let c = 0; c < 3; c += 1) {
        ellipse(ctx, -3 + c * 3.4, -10 + r * 6.4, 1.3, 1.8, '#e6a817');
      }
    }
    ctx.restore();
  }

  drawDog(world, x, y) {
    const ctx = this.ctx;
    const phase = world.time * 16;
    const legSwing = Math.sin(phase) * 9;
    ctx.save();
    ctx.translate(x + 16, y);
    // legs
    ctx.strokeStyle = '#6d4c41';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-12, -16); ctx.lineTo(-12 + legSwing, 0);
    ctx.moveTo(10, -16); ctx.lineTo(10 - legSwing, 0);
    ctx.stroke();
    // body (facing left, toward the turkey)
    ellipse(ctx, 0, -24, 24, 13, '#8d6e63');
    // tail up
    ctx.strokeStyle = '#8d6e63';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(22, -30);
    ctx.quadraticCurveTo(32, -44, 28, -52);
    ctx.stroke();
    // head
    ellipse(ctx, -24, -34, 11, 9, '#8d6e63');
    ellipse(ctx, -33, -30, 6, 4.5, '#6d4c41');
    ellipse(ctx, -27, -37, 2.2, 2.2, PALETTE.ink);
    // ear flapping
    ctx.fillStyle = '#5d4037';
    ctx.beginPath();
    ctx.moveTo(-20, -42);
    ctx.lineTo(-12, -30 + Math.sin(phase) * 3);
    ctx.lineTo(-24, -28);
    ctx.closePath();
    ctx.fill();
    // tongue
    ctx.fillStyle = '#ef9a9a';
    ctx.fillRect(-37, -27, 7, 4);
    ctx.restore();
  }

  drawOven(world, x, y) {
    const ctx = this.ctx;
    const w = 3 * PX_PER_M;
    const flicker = 0.75 + Math.sin(world.time * 11 + x) * 0.25;
    ctx.fillStyle = PALETTE.ovenBody;
    roundRect(ctx, x, y - 96, w, 96, 8);
    ctx.fill();
    // glowing door window
    ctx.fillStyle = `rgba(255,112,67,${0.55 + flicker * 0.4})`;
    roundRect(ctx, x + 12, y - 62, w - 24, 44, 6);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,213,79,0.8)';
    roundRect(ctx, x + 20, y - 54, w - 40, 16, 5);
    ctx.fill();
    // handle and knobs
    ctx.strokeStyle = PALETTE.metalDark;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x + 10, y - 70);
    ctx.lineTo(x + w - 10, y - 70);
    ctx.stroke();
    for (let i = 0; i < 4; i += 1) {
      ellipse(ctx, x + 16 + i * ((w - 32) / 3), y - 84, 5, 5, PALETTE.metal);
    }
    // steam puffs
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (let i = 0; i < 3; i += 1) {
      const rise = ((world.time * 26 + i * 17) % 46);
      ellipse(ctx, x + 18 + i * 22 + Math.sin(world.time * 2 + i) * 4, y - 104 - rise, 7 + rise * 0.14, 5 + rise * 0.1, 'rgba(255,255,255,0.5)');
    }
    // warning label
    ctx.fillStyle = '#fff8e1';
    ctx.font = `bold 13px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('HOT!', x + w / 2, y - 8);
  }

  drawKnife(entity, x, y) {
    const ctx = this.ctx;
    const cx = x + 9;
    if (entity.state === 'waiting' || entity.state === 'gone') return;
    if (entity.state === 'telegraph') {
      const pulse = 0.5 + Math.sin(entity.stateT * 18) * 0.3;
      ellipse(ctx, cx, y - 2, 20, 5, `rgba(43,26,14,${pulse})`);
      ctx.fillStyle = PALETTE.danger;
      ctx.font = `bold 26px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('!', cx, y - 120);
      // ghost of the blade above
      ctx.globalAlpha = 0.35;
      this.knifeBlade(cx, y - 150, 0);
      ctx.globalAlpha = 1;
      return;
    }
    if (entity.state === 'falling') {
      const fall = Math.min(1, entity.stateT / 0.16);
      this.knifeBlade(cx, y - 150 + fall * 132, 0);
      return;
    }
    // stuck: wobbling in the floor
    const wobble = Math.sin(entity.stateT * 14) * 0.06 * Math.max(0, 1 - entity.stateT);
    this.knifeBlade(cx, y - 18, wobble);
  }

  /** One carving knife, point down, tip at (cx, tipY). */
  knifeBlade(cx, tipY, tilt) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(cx, tipY);
    ctx.rotate(tilt);
    ctx.fillStyle = PALETTE.metal;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(5, -34);
    ctx.lineTo(5, -52);
    ctx.lineTo(-5, -52);
    ctx.lineTo(-5, -34);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#5d4037';
    roundRect(ctx, -4, -72, 8, 22, 3);
    ctx.fill();
    ctx.restore();
  }

  // ---------------------------------------------------------------- turkey
  drawTurkey(world) {
    const ctx = this.ctx;
    const turkey = world.turkey;
    if (turkey.hidden) return; // inside the hay; drawHay shows the tail
    if (turkey.invulnT > 0 && Math.floor(world.time * 14) % 2 === 0) ctx.globalAlpha = 0.45;
    const x = TURKEY_X;
    const feetY = turkey.laneY - turkey.jumpY;
    const stumbleTilt = turkey.stumbleT > 0 ? Math.sin(world.time * 22) * 0.12 : 0;
    ctx.save();
    ctx.translate(x, feetY);
    ctx.rotate(stumbleTilt);
    // shadow on the lane
    ctx.globalAlpha *= 1;
    ellipse(ctx, 0, turkey.jumpY + 2, 30 - Math.min(14, turkey.jumpY * 0.05), 6, 'rgba(43,26,14,0.3)');
    // tail fan
    ctx.fillStyle = PALETTE.turkeyTail;
    for (let i = -2; i <= 2; i += 1) {
      ctx.save();
      ctx.translate(-26, -34);
      ctx.rotate(-0.5 + i * 0.3);
      ellipse(ctx, 0, -16, 8, 19, i % 2 ? PALETTE.turkeyTail : '#8d6e63');
      ctx.restore();
    }
    // legs
    const legSwing = turkey.grounded ? Math.sin(turkey.runPhase * 6) * 11 : 5;
    ctx.strokeStyle = '#e65100';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-6, -14); ctx.lineTo(-6 + legSwing, 0);
    ctx.moveTo(8, -14); ctx.lineTo(8 - legSwing, 0);
    ctx.stroke();
    // body
    ellipse(ctx, 0, -30, 30, 21, PALETTE.turkeyBody);
    ellipse(ctx, -2, -33, 24, 16, PALETTE.turkeyDark);
    // wing (spread when jumping)
    ctx.save();
    ctx.translate(-4, -34);
    ctx.rotate(turkey.grounded ? 0.15 : -0.7);
    ellipse(ctx, -8, 2, 17, 9, PALETTE.turkeyTail);
    ctx.restore();
    // neck and head
    ctx.strokeStyle = PALETTE.turkeyHead;
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(20, -40);
    ctx.quadraticCurveTo(30, -52, 30, -60);
    ctx.stroke();
    ellipse(ctx, 31, -62, 9, 8, PALETTE.turkeyHead);
    // beak
    ctx.fillStyle = PALETTE.beak;
    ctx.beginPath();
    ctx.moveTo(38, -64);
    ctx.lineTo(49, -60);
    ctx.lineTo(38, -57);
    ctx.closePath();
    ctx.fill();
    // wattle
    ellipse(ctx, 34, -52, 4, 7, PALETTE.wattle);
    // eye: wide with panic when the farmer is close
    const panic = world.farmer.gap < GAP_LUNGE;
    ellipse(ctx, 33, -64, panic ? 3.4 : 2.4, panic ? 3.4 : 2.4, PALETTE.ink);
    if (panic) ellipse(ctx, 34, -65, 1.2, 1.2, '#ffffff');
    ctx.restore();
    ctx.globalAlpha = 1;
    // stumble stars
    if (turkey.stumbleT > 0) {
      ctx.fillStyle = '#ffd23f';
      ctx.font = `bold 15px ${FONT}`;
      ctx.textAlign = 'center';
      for (let i = 0; i < 3; i += 1) {
        const sx = x + Math.cos(world.time * 6 + i * 2.1) * 22;
        const sy = feetY - 78 + Math.sin(world.time * 6 + i * 2.1) * 5;
        ctx.fillText('✶', sx, sy);
      }
    }
  }

  // ---------------------------------------------------------------- farmer
  drawFarmer(world) {
    const ctx = this.ctx;
    const farmer = world.farmer;
    const gapPx = farmer.gap * PX_PER_M;
    const x = Math.max(56, TURKEY_X - gapPx);
    const laneY = world.turkey.laneY; // he runs in the turkey's lane, closing in
    const searching = farmer.state === 'search';
    const lunging = farmer.state === 'lunge';
    const legSwing = searching ? 0 : Math.sin(farmer.runPhase * 6) * 13;
    const lean = lunging ? 0.38 : searching ? 0 : 0.12;
    ctx.save();
    ctx.translate(x, laneY);
    ellipse(ctx, 0, 2, 26, 5, 'rgba(43,26,14,0.3)');
    ctx.rotate(lean);
    // legs in overalls
    ctx.strokeStyle = PALETTE.farmerOveralls;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(-4, -34); ctx.lineTo(-4 + legSwing, 0);
    ctx.moveTo(6, -34); ctx.lineTo(6 - legSwing, 0);
    ctx.stroke();
    // boots
    ctx.fillStyle = '#4e342e';
    ctx.fillRect(-9 + legSwing, -5, 13, 5);
    ctx.fillRect(1 - legSwing, -5, 13, 5);
    // torso: overalls + checked shirt
    ctx.fillStyle = PALETTE.farmerOveralls;
    roundRect(ctx, -13, -66, 27, 34, 5);
    ctx.fill();
    ctx.fillStyle = PALETTE.farmerShirt;
    roundRect(ctx, -13, -78, 27, 16, 5);
    ctx.fill();
    // arm holding the net (extended when lunging)
    const reach = lunging ? 34 : 16;
    ctx.strokeStyle = PALETTE.farmerShirt;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(10, -70);
    ctx.lineTo(10 + reach, -58);
    ctx.stroke();
    // butterfly net
    ctx.strokeStyle = '#8a5a2b';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(10 + reach, -58);
    ctx.lineTo(26 + reach, -66);
    ctx.stroke();
    ctx.strokeStyle = '#b0bec5';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(36 + reach, -68, 13, 10, -0.4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(176,190,197,0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(28 + reach, -74); ctx.lineTo(44 + reach, -62);
    ctx.moveTo(28 + reach, -62); ctx.lineTo(44 + reach, -74);
    ctx.stroke();
    // head
    const look = searching ? Math.sin(world.time * 1.8) * 5 : 3;
    ellipse(ctx, 2 + look * 0.4, -88, 11, 11, PALETTE.farmerSkin);
    // straw hat
    ctx.fillStyle = PALETTE.farmerHat;
    ctx.fillRect(-14 + look * 0.4, -98, 32, 6);
    roundRect(ctx, -7 + look * 0.4, -110, 18, 13, 4);
    ctx.fill();
    // eyes + moustache
    ellipse(ctx, 6 + look, -89, 1.8, 1.8, PALETTE.ink);
    ctx.strokeStyle = '#6d4c41';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(2 + look, -81);
    ctx.quadraticCurveTo(8 + look, -78, 13 + look, -81);
    ctx.stroke();
    ctx.restore();
    // searching thought bubble
    if (searching) {
      ctx.fillStyle = '#fff8e1';
      ellipse(ctx, x + 30, laneY - 128, 15, 13, '#fff8e1');
      ellipse(ctx, x + 18, laneY - 112, 6, 5, '#fff8e1');
      ctx.fillStyle = PALETTE.ink;
      ctx.font = `bold 19px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('?', x + 30, laneY - 121);
    }
    if (lunging) {
      ctx.fillStyle = PALETTE.danger;
      ctx.font = `bold 17px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('GOTCHA!', x + 8, laneY - 128);
    }
  }

  // ---------------------------------------------------------------- HUD
  drawHud(world, ui) {
    const ctx = this.ctx;
    // score panel
    ctx.fillStyle = PALETTE.hudPanel;
    roundRect(ctx, 16, 14, 252, 74, 10);
    ctx.fill();
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = `bold 26px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText('SCORE ' + world.score, 30, 48);
    ctx.font = `bold 19px ${FONT}`;
    ctx.fillText('🌽 × ' + world.corn, 30, 76);
    ctx.font = `15px ${FONT}`;
    ctx.fillText(Math.floor(world.distance) + ' m', 150, 76);
    // progress bar to freedom
    const barX = 330;
    const barW = 492;
    ctx.fillStyle = PALETTE.hudPanel;
    roundRect(ctx, barX - 12, 14, barW + 24, 74, 10);
    ctx.fill();
    ctx.fillStyle = '#5d4037';
    roundRect(ctx, barX, 44, barW, 16, 8);
    ctx.fill();
    const frac = Math.min(1, world.distance / ESCAPE_M);
    ctx.fillStyle = PALETTE.good;
    roundRect(ctx, barX, 44, Math.max(14, barW * frac), 16, 8);
    ctx.fill();
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = `bold 15px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('FREEDOM', barX + barW / 2, 34);
    for (const stage of STAGES) {
      const tx = barX + (stage.from / ESCAPE_M) * barW;
      ctx.fillStyle = '#fff8e1';
      ctx.fillRect(tx - 1, 40, 2, 24);
    }
    ctx.font = `12px ${FONT}`;
    ctx.fillText('FARMYARD', barX + 82, 76);
    ctx.fillText('FIELD', barX + 246, 76);
    ctx.fillText('KITCHEN', barX + 410, 76);
    // feathers (lives)
    ctx.fillStyle = PALETTE.hudPanel;
    roundRect(ctx, VIEW.width - 268, 14, 252, 74, 10);
    ctx.fill();
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = `bold 16px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText('FEATHERS', VIEW.width - 252, 40);
    for (let i = 0; i < 3; i += 1) {
      this.drawFeather(VIEW.width - 216 + i * 52, 62, i < world.feathers);
    }
    // farmer meter
    const danger = world.farmer.gap < GAP_LUNGE;
    ctx.fillStyle = PALETTE.hudPanel;
    roundRect(ctx, 16, VIEW.height - 58, 300, 44, 10);
    ctx.fill();
    ctx.fillStyle = danger && Math.floor(world.time * 6) % 2 === 0 ? PALETTE.danger : PALETTE.hudText;
    ctx.font = `bold 16px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText('FARMER', 28, VIEW.height - 30);
    ctx.fillStyle = '#5d4037';
    roundRect(ctx, 116, VIEW.height - 44, 140, 13, 6);
    ctx.fill();
    ctx.fillStyle = danger ? PALETTE.danger : PALETTE.wheat;
    roundRect(ctx, 116, VIEW.height - 44, Math.max(8, 140 * (world.farmer.gap / GAP_MAX)), 13, 6);
    ctx.fill();
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = `bold 15px ${FONT}`;
    ctx.fillText(world.farmer.gap.toFixed(0) + ' m', 264, VIEW.height - 31);
    // mute hint
    ctx.font = `14px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(ui.muted ? 'M: sound off' : 'M: sound on', VIEW.width - 18, VIEW.height - 24);
    // stage banner
    if (world.stageBannerT > 0) {
      const alpha = Math.min(1, world.stageBannerT / 0.5);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = PALETTE.hudPanel;
      roundRect(ctx, VIEW.width / 2 - 240, 120, 480, 84, 14);
      ctx.fill();
      ctx.fillStyle = '#ffd23f';
      ctx.font = `bold 42px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(STAGES[world.stage].name + '!', VIEW.width / 2, 172);
      ctx.globalAlpha = 1;
    }
    // hidden indicator
    if (world.turkey.hidden) {
      ctx.fillStyle = PALETTE.hudPanel;
      roundRect(ctx, VIEW.width / 2 - 150, VIEW.height - 58, 300, 44, 10);
      ctx.fill();
      ctx.fillStyle = PALETTE.good;
      ctx.font = `bold 17px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('HIDDEN — he is searching…', VIEW.width / 2, VIEW.height - 30);
    }
  }

  /** One feather life icon at (x, y); greyed when lost. */
  drawFeather(x, y, alive) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.5);
    ellipse(ctx, 0, 0, 9, 16, alive ? '#ffd23f' : 'rgba(255,248,225,0.22)');
    ctx.strokeStyle = alive ? '#c98f2e' : 'rgba(255,248,225,0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -15);
    ctx.lineTo(0, 17);
    ctx.stroke();
    ctx.restore();
  }

  drawPopups(world) {
    const ctx = this.ctx;
    ctx.font = `bold 21px ${FONT}`;
    ctx.textAlign = 'center';
    for (const popup of world.popups) {
      const y = LANE_Y[popup.lane] - 96 - popup.t * 46;
      ctx.globalAlpha = Math.max(0, 1 - popup.t / 1.1);
      ctx.fillStyle = popup.colour;
      ctx.fillText(popup.text, TURKEY_X + 30, y);
    }
    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- screens
  drawTitle(world, ui) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(28,18,7,0.45)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    // title with a chunky outline
    ctx.font = `bold 96px ${FONT}`;
    ctx.lineWidth = 14;
    ctx.strokeStyle = PALETTE.ink;
    ctx.strokeText('GOBBLE DASH', VIEW.width / 2, 150);
    ctx.fillStyle = '#ffd23f';
    ctx.fillText('GOBBLE DASH', VIEW.width / 2, 150);
    ctx.font = `bold 30px ${FONT}`;
    ctx.fillStyle = '#fff8e1';
    ctx.fillText('— The Great Thanksgiving Escape —', VIEW.width / 2, 196);
    ctx.font = `21px ${FONT}`;
    ctx.fillText('It is Thanksgiving morning. The farmer has the oven on and the knife sharpened.', VIEW.width / 2, 242);
    ctx.fillText('Run 1200 m to freedom: farmyard, harvest field, then through the kitchen itself!', VIEW.width / 2, 272);
    // instructions panel
    ctx.fillStyle = PALETTE.hudPanel;
    roundRect(ctx, VIEW.width / 2 - 330, 296, 660, 156, 14);
    ctx.fill();
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = `bold 20px ${FONT}`;
    ctx.textAlign = 'left';
    const lines = [
      '↑ ↓  or  W S      change lane',
      'SPACE             jump fences and pumpkins',
      'C  at a hay bale  hide while the farmer searches',
      'Mouse: click a lane to hop there, click the turkey to jump',
      'P pause · M mute · dodge the oven, the knife and the dog!',
    ];
    lines.forEach((line, i) => ctx.fillText(line, VIEW.width / 2 - 300, 332 + i * 27));
    // best score
    ctx.textAlign = 'center';
    ctx.font = `bold 20px ${FONT}`;
    ctx.fillStyle = '#ffd23f';
    ctx.fillText(ui.best > 0 ? 'BEST SCORE: ' + ui.best : 'No escapes yet — be the first!', VIEW.width / 2, 468 - 6);
    this.drawButton(BUTTONS.start, 'START RUNNING');
    ctx.font = `16px ${FONT}`;
    ctx.fillStyle = '#fff8e1';
    ctx.fillText('or press ENTER', VIEW.width / 2, BUTTONS.start.y + BUTTONS.start.h + 26);
  }

  drawPause() {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(28,18,7,0.55)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff8e1';
    ctx.font = `bold 64px ${FONT}`;
    ctx.fillText('PAUSED', VIEW.width / 2, 300);
    ctx.font = `22px ${FONT}`;
    ctx.fillText('The farmer waits. Press P or ESC to keep running.', VIEW.width / 2, 344);
  }

  drawEnd(world, ui) {
    const ctx = this.ctx;
    const escaped = world.over === 'escaped';
    ctx.fillStyle = escaped ? 'rgba(46,74,20,0.5)' : 'rgba(74,20,20,0.5)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.font = `bold 84px ${FONT}`;
    ctx.lineWidth = 12;
    ctx.strokeStyle = PALETTE.ink;
    const headline = escaped ? 'YOU ESCAPED!' : 'CAUGHT!';
    ctx.strokeText(headline, VIEW.width / 2, 150);
    ctx.fillStyle = escaped ? '#9ccc65' : '#ff8a65';
    ctx.fillText(headline, VIEW.width / 2, 150);
    ctx.font = `bold 24px ${FONT}`;
    ctx.fillStyle = '#fff8e1';
    ctx.fillText(
      escaped ? 'Over the fence and gone — no dinner tonight, farmer!' : 'The farmer got you. The oven is already warm…',
      VIEW.width / 2,
      196,
    );
    // stats panel
    ctx.fillStyle = PALETTE.hudPanel;
    roundRect(ctx, VIEW.width / 2 - 260, 224, 520, 196, 14);
    ctx.fill();
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = `bold 24px ${FONT}`;
    ctx.textAlign = 'left';
    const stats = [
      'Distance:  ' + Math.floor(world.distance) + ' m of ' + ESCAPE_M + ' m',
      'Score:  ' + world.score + (world.score >= ui.best && world.score > 0 ? '  ★ NEW BEST!' : ''),
      'Corn gobbled:  ' + world.corn,
      'Near misses:  ' + world.nearMisses,
      'Feathers left:  ' + Math.max(0, world.feathers),
      'Best score:  ' + Math.max(ui.best, world.score),
    ];
    stats.forEach((line, i) => ctx.fillText(line, VIEW.width / 2 - 220, 268 + i * 27));
    this.drawButton(BUTTONS.again, 'RUN AGAIN');
    ctx.font = `16px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff8e1';
    ctx.fillText('or press ENTER', VIEW.width / 2, BUTTONS.again.y + BUTTONS.again.h + 26);
    if (escaped) this.drawConfetti(world);
  }

  /** Feather confetti for the escape screen, deterministic from world time. */
  drawConfetti(world) {
    const ctx = this.ctx;
    const colours = ['#ffd23f', '#ff8a65', '#9ccc65', '#fff8e1', '#e67e22'];
    for (let i = 0; i < 42; i += 1) {
      const fall = ((world.time * (30 + hash(i * 3) * 40) + hash(i * 7) * 700) % 720) - 40;
      const x = hash(i * 11) * VIEW.width + Math.sin(world.time * 2 + i) * 14;
      ctx.save();
      ctx.translate(x, fall);
      ctx.rotate(world.time * (1 + hash(i)) + i);
      ellipse(ctx, 0, 0, 5, 9, colours[i % colours.length]);
      ctx.restore();
    }
  }

  /** A chunky menu button. */
  drawButton(rect, label) {
    const ctx = this.ctx;
    ctx.fillStyle = '#c0392b';
    roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 12);
    ctx.fill();
    ctx.fillStyle = '#e74c3c';
    roundRect(ctx, rect.x, rect.y, rect.w, rect.h - 10, 12);
    ctx.fill();
    ctx.fillStyle = '#fff8e1';
    ctx.font = `bold 26px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 9);
  }
}
