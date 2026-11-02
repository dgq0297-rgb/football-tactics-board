// 球场比例位置和画布像素之间的换算。
// 比例位置 0~1 表示球场内，-1~0 和 1~2 分别表示球场前后（左右）的空白区域。

function toCanvas(pos, start, end, length) {
  if (pos < 0) return start * (1 + pos);
  if (pos > 1) return end + (length - end) * (pos - 1);
  return start + (end - start) * pos;
}

function fromCanvas(value, start, end, length) {
  if (value < start) return value / start - 1;
  if (value > end) return 1 + (value - end) / (length - end);
  return (value - start) / (end - start);
}

export function onPitch(pos) {
  return pos[0] >= 0 && pos[0] <= 1 && pos[1] >= 0 && pos[1] <= 1;
}

export class Board {
  constructor() {
    this.field = [0, 0, 1, 1];
    this.size = [1, 1];
  }

  /** field 是球场在画布上的 [左, 上, 右, 下]，size 是画布的 [宽, 高]。 */
  resize(field, size) {
    this.field = field;
    this.size = size;
  }

  get playerRadius() {
    return Math.max(10, Math.floor((this.field[3] - this.field[1]) / 50));
  }

  toPixels(pos) {
    const [left, top, right, bottom] = this.field;
    const [width, height] = this.size;
    return [toCanvas(pos[0], left, right, width), toCanvas(pos[1], top, bottom, height)];
  }

  /** 把像素换算成球场比例；margin 用来保证棋子不会被拖出画布。 */
  toPosition(x, y, margin) {
    const [left, top, right, bottom] = this.field;
    const [width, height] = this.size;
    const clampedX = Math.min(Math.max(x, margin), width - margin);
    const clampedY = Math.min(Math.max(y, margin), height - margin);
    return [fromCanvas(clampedX, left, right, width), fromCanvas(clampedY, top, bottom, height)];
  }
}
