// 鼠标和手指操作：判断按在了足球还是哪名球员身上，再交给它们自己处理拖动。

const TOUCH_SLOP = 8; // 手指不如鼠标准，按的范围放宽一点
const MIN_PLAYER_HIT = 18;

export class PointerControl {
  constructor(canvas, pieces, invalidate) {
    this.canvas = canvas;
    this.pieces = pieces;
    this.invalidate = invalidate;
    this.target = null;
    this.bind();
  }

  bind() {
    const { canvas } = this;
    if (window.PointerEvent) {
      canvas.addEventListener("pointerdown", (event) => {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        event.preventDefault();
        if (canvas.setPointerCapture) canvas.setPointerCapture(event.pointerId);
        this.press(this.point(event));
      });
      canvas.addEventListener("pointermove", (event) => this.move(this.point(event)));
      canvas.addEventListener("pointerup", (event) => this.release(this.point(event)));
      canvas.addEventListener("pointercancel", (event) => this.release(this.point(event)));
      return;
    }
    // 不支持 PointerEvent 的老浏览器
    const touchPoint = (event) => this.point(event.changedTouches[0]);
    canvas.addEventListener("touchstart", (event) => { event.preventDefault(); this.press(touchPoint(event)); }, { passive: false });
    canvas.addEventListener("touchmove", (event) => { event.preventDefault(); this.move(touchPoint(event)); }, { passive: false });
    canvas.addEventListener("touchend", (event) => { event.preventDefault(); this.release(touchPoint(event)); }, { passive: false });
    canvas.addEventListener("mousedown", (event) => this.press(this.point(event)));
    window.addEventListener("mousemove", (event) => this.move(this.point(event)));
    window.addEventListener("mouseup", (event) => this.release(this.point(event)));
  }

  point(event) {
    const rect = this.canvas.getBoundingClientRect();
    return [event.clientX - rect.left, event.clientY - rect.top];
  }

  /** 手指按的范围比棋子大，球和持球人的范围会重叠，所以谁的中心离手指更近就算按到谁。 */
  hitTest(x, y) {
    const { ball, players, board } = this.pieces;
    const [ballX, ballY] = ball.center();
    const ballDistance = Math.hypot(ballX - x, ballY - y);
    const onBall = ballDistance <= ball.radius + TOUCH_SLOP;
    const reach = Math.max(board.playerRadius + TOUCH_SLOP / 2, MIN_PLAYER_HIT);
    let found = null;
    let best = reach;
    for (const player of players.all) {
      const [px, py] = player.center();
      const distance = Math.hypot(px - x, py - y);
      if (distance <= best) {
        best = distance;
        found = player;
      }
    }
    if (onBall && (!found || ballDistance <= best)) return { ball: true };
    return found ? { player: found } : null;
  }

  press([x, y]) {
    const { editor, simulator, ball, players } = this.pieces;
    editor.commit();
    simulator.pause(); // 用户动手拖球员或足球时，演示让位
    this.target = this.hitTest(x, y);
    if (!this.target) return;
    if (this.target.ball) ball.startDrag(x, y);
    else players.startDrag(this.target.player, x, y);
    this.invalidate();
  }

  move([x, y]) {
    if (!this.target) return;
    if (this.target.ball) this.pieces.ball.drag(x, y);
    else this.pieces.players.drag(x, y);
    this.invalidate();
  }

  release([x, y]) {
    if (!this.target) return;
    const { target } = this;
    this.target = null;
    if (target.ball) this.pieces.ball.stopDrag(x, y);
    else this.pieces.players.stopDrag(x, y);
    this.invalidate();
  }
}
