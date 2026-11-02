// 把球场、轨迹、球员和足球画到画布上。只负责画，不改任何数据。

import { pointAlong } from "../core/path_smoothing.js";

const PITCH_ASPECT = 474 / 681; // 球场图的宽高比
const MIN_SIDE_WIDTH = 54; // 球场两边至少留这么宽放替补，手机竖屏时球场跟着缩小
const LINE_WIDTH = 3;
const BALL_DASH = [14, 5, 3, 5]; // 球自身运动：一长一点的点线
const CARRY_DASH = [10, 6]; // 有人持球运动：虚线
const LABEL_SPOTS = [0.5, 0.3, 0.6]; // 次数沿路线错开摆放，来回传球时数字不会叠在一起
const DETAIL_SCALE = 0.7; // 括号里的号码相对次数的字号
const FONT_FAMILY = "Arial, sans-serif";

function loadImage(src, onLoad) {
  const image = new Image();
  image.onload = onLoad;
  image.src = src;
  return image;
}

export class Renderer {
  constructor(canvas, pieces) {
    this.canvas = canvas;
    this.context = canvas.getContext("2d");
    this.pieces = pieces;
    this.pending = false;
    this.pitch = loadImage("assets/pitch.jpg", () => this.invalidate());
    this.ballImage = loadImage("assets/football.png", () => this.invalidate());
  }

  /** 画布大小变化时重新算球场的位置。 */
  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(rect.width * ratio);
    this.canvas.height = Math.round(rect.height * ratio);
    this.ratio = ratio;
    this.pieces.board.resize(this.fitField(rect.width, rect.height), [rect.width, rect.height]);
    this.invalidate();
  }

  /** 球场等比缩放后在画布中居中，两边留出放替补的地方，返回 [左, 上, 右, 下]。 */
  fitField(width, height) {
    let fieldHeight = height;
    let fieldWidth = fieldHeight * PITCH_ASPECT;
    if (width - fieldWidth < MIN_SIDE_WIDTH * 2) {
      fieldWidth = Math.max(1, width - MIN_SIDE_WIDTH * 2);
      fieldHeight = fieldWidth / PITCH_ASPECT;
    }
    const left = (width - fieldWidth) / 2;
    const top = (height - fieldHeight) / 2;
    return [left, top, left + fieldWidth, top + fieldHeight];
  }

  /** 下一帧重画；一帧里多次调用也只画一次。 */
  invalidate() {
    if (this.pending) return;
    this.pending = true;
    requestAnimationFrame(() => {
      this.pending = false;
      this.draw();
    });
  }

  draw() {
    const { context, ratio } = this;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.drawField();
    this.drawTrails();
    this.pieces.players.all.forEach((player) => this.drawPlayer(player));
    this.drawBall();
  }

  drawField() {
    const { context } = this;
    const [width, height] = this.pieces.board.size;
    const [left, top, right, bottom] = this.pieces.board.field;
    context.fillStyle = "#1f7a1f";
    context.fillRect(0, 0, width, height);
    if (this.pitch.complete && this.pitch.naturalWidth) {
      context.drawImage(this.pitch, left, top, right - left, bottom - top);
    }
  }

  drawTrails() {
    const { trails, players } = this.pieces;
    if (trails.ballLines) {
      for (const segment of trails.segments) {
        this.drawTrail(segment, players.trailColor(segment.team), segment.carried ? CARRY_DASH : BALL_DASH, null);
      }
    }
    if (trails.playerLines) {
      for (const run of trails.runs) {
        const detail = run.player === null ? null : `(${players.numberOf(run.team, run.player)})`;
        this.drawTrail(run, players.trailColor(run.team), [], detail);
      }
    }
  }

  drawTrail(trail, color, dash, detail) {
    const { context } = this;
    const pixels = this.pieces.trails.toPixels(trail.path);
    context.strokeStyle = color;
    context.lineWidth = LINE_WIDTH;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.setLineDash(dash);
    context.beginPath();
    context.moveTo(pixels[0][0], pixels[0][1]);
    // 穿过相邻两点的中点画曲线，弧线才圆滑
    for (let i = 1; i < pixels.length - 1; i++) {
      const midX = (pixels[i][0] + pixels[i + 1][0]) / 2;
      const midY = (pixels[i][1] + pixels[i + 1][1]) / 2;
      context.quadraticCurveTo(pixels[i][0], pixels[i][1], midX, midY);
    }
    const last = pixels[pixels.length - 1];
    context.lineTo(last[0], last[1]);
    context.stroke();
    context.setLineDash([]);
    this.drawTrailLabel(pixels, trail.number, color, detail);
  }

  /** 次数写在路线上方；跑动的次数后面用小字标出球员号码，比如 1(10)。 */
  drawTrailLabel(pixels, number, color, detail) {
    const { context } = this;
    const size = Math.max(12, this.pieces.board.playerRadius);
    const spot = LABEL_SPOTS[(number - 1) % LABEL_SPOTS.length];
    const [x, y, dx, dy] = pointAlong(pixels, spot);
    const length = Math.max(1, Math.hypot(dx, dy));
    let normalX = dy / length;
    let normalY = -dx / length;
    if (normalY > 0) {
      normalX = -normalX;
      normalY = -normalY;
    }
    const labelX = x + normalX * size;
    const labelY = y + normalY * size;
    context.fillStyle = color;
    context.textBaseline = detail ? "alphabetic" : "middle";
    context.font = `bold ${size}px ${FONT_FAMILY}`;
    if (detail) {
      context.textAlign = "right";
      context.fillText(String(number), labelX, labelY + size / 2);
      context.textAlign = "left";
      context.font = `bold ${Math.round(size * DETAIL_SCALE)}px ${FONT_FAMILY}`;
      context.fillText(detail, labelX, labelY + size / 2);
    } else {
      context.textAlign = "center";
      context.fillText(String(number), labelX, labelY);
    }
  }

  drawPlayer(player) {
    const { context } = this;
    const [x, y] = player.center();
    const radius = this.pieces.board.playerRadius;
    const jersey = this.pieces.players.jerseyOf(player);
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fillStyle = jersey.fill;
    context.fill();
    context.lineWidth = 2;
    context.strokeStyle = jersey.outline;
    context.stroke();
    context.fillStyle = jersey.text;
    context.font = `bold ${Math.max(10, radius)}px ${FONT_FAMILY}`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(String(player.number), x, y + 0.5);
  }

  drawBall() {
    if (!this.ballImage.complete || !this.ballImage.naturalWidth) return;
    const { ball } = this.pieces;
    const [x, y] = ball.center();
    const radius = ball.radius;
    this.context.drawImage(this.ballImage, x - radius, y - radius, radius * 2, radius * 2);
  }
}
