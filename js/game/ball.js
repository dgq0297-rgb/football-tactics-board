// 足球：可以拖动，和球员叠在一起时吸附到球员身上，跟着球员走。

const KICKOFF = [0.5, 0.5];
const BALL_TO_PLAYER = 0.6; // 球的半径相对球员半径的比例
const OWNER_OFFSET = 0.65; // 吸附时偏向球员右下角，不挡住号码

const teamOf = (player) => (player === null ? null : player.team);

export class Ball {
  constructor(board, players) {
    this.board = board;
    this.players = players;
    this.pos = KICKOFF;
    this.owner = null;
    this.dragging = false;
    this.dragOwner = null;
    this.dragPath = [];
    this.pressPoint = null;
    // 由外部接上：球运动过、球员带球走、球被无球的球员接住、球员无球跑动时通知
    this.onTravel = () => {};
    this.onCarry = () => {};
    this.onCatch = () => {};
    this.onRun = () => {};
  }

  get radius() {
    return Math.max(5, Math.round(this.board.playerRadius * BALL_TO_PLAYER));
  }

  /** 球所在的球场比例位置：在球员脚上时就是球员的位置。 */
  anchor() {
    return this.owner === null ? this.pos : this.owner.pos;
  }

  center() {
    if (this.owner === null) return this.board.toPixels(this.pos);
    const [x, y] = this.owner.center();
    const offset = this.board.playerRadius * OWNER_OFFSET;
    return [x + offset, y + offset];
  }

  /** 回到中圈，不属于任何球员。 */
  reset() {
    this.owner = null;
    this.pos = KICKOFF;
  }

  /** 直接交给某名球员，不算一次运动。 */
  giveTo(player) {
    this.owner = player;
  }

  distanceTo(player) {
    const [bx, by] = this.center();
    const [px, py] = player.center();
    return Math.hypot(bx - px, by - py);
  }

  overlaps(player) {
    return this.distanceTo(player) <= this.board.playerRadius + this.radius;
  }

  /** 松手时如果压在球员身上，吸附到最近的那个。 */
  attachToNearest() {
    const touching = this.players.all.filter((player) => this.overlaps(player));
    if (!touching.length) return;
    this.owner = touching.reduce((best, player) => (this.distanceTo(player) < this.distanceTo(best) ? player : best));
  }

  /** 球员被放下：带球就算球的一次运动，否则算无球跑动；拖到无主的球上就接住。 */
  playerDropped(player, path) {
    if (this.owner === player) {
      this.onCarry(path, player.team, player.slot);
      return;
    }
    this.onRun(path, player.team, player.slot);
    if (this.owner === null && this.overlaps(player)) {
      this.owner = player;
      this.onCatch(player.team);
    }
  }

  startDrag(x, y) {
    this.dragging = true;
    this.pressPoint = [x, y];
    this.dragOwner = this.owner;
    this.dragPath = [this.anchor()];
  }

  drag(x, y) {
    if (!this.dragging) return;
    this.owner = null;
    this.pos = this.board.toPosition(x, y, this.radius);
    this.dragPath.push(this.pos);
  }

  stopDrag(x, y) {
    if (!this.dragging) return;
    // 松手的位置才算数；没动过就不要把球从球员身上拿下来
    if (this.dragPath.length > 1 || x !== this.pressPoint[0] || y !== this.pressPoint[1]) this.drag(x, y);
    this.dragging = false;
    if (this.owner === null) this.attachToNearest();
    // 拖开又放回原来的球员身上，球等于没动
    if (this.owner !== null && this.owner === this.dragOwner) return;
    this.onTravel([...this.dragPath, this.anchor()], teamOf(this.dragOwner), teamOf(this.owner));
  }

  toState() {
    const owner = this.owner === null ? null : [this.owner.team, this.owner.slot];
    return { pos: this.pos, owner };
  }

  restoreState(state) {
    this.pos = state.pos.slice();
    this.owner = state.owner === null ? null : this.players.team(state.owner[0])[state.owner[1]];
  }
}
