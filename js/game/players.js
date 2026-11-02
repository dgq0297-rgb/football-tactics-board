// 两队球员的数据：位置、号码、球衣、当前阵型。red 是主场、blue 是客场，只是代号，实际颜色看球衣。

import { leftBench, rightBench } from "../data/formations.js";
import { DEFAULT_AWAY, DEFAULT_HOME, JERSEYS, NEUTRAL_TRAIL } from "../data/jerseys.js";

const CLICK_TOLERANCE = 6; // 手指或鼠标移动不超过这么多像素，算单击不算拖动

class Player {
  constructor(board, team, slot, pos) {
    this.board = board;
    this.team = team;
    this.slot = slot; // 队内序号，改号码也不变
    this.number = slot + 1;
    this.pos = pos;
  }

  center() {
    return this.board.toPixels(this.pos);
  }

  moveTo(x, y) {
    this.pos = this.board.toPosition(x, y, this.board.playerRadius);
  }
}

export class Players {
  constructor(board) {
    this.board = board;
    this.red = leftBench().map((pos, slot) => new Player(board, "red", slot, pos));
    this.blue = rightBench().map((pos, slot) => new Player(board, "blue", slot, pos));
    this.all = [...this.red, ...this.blue];
    this.jerseys = { red: DEFAULT_HOME, blue: DEFAULT_AWAY };
    this.homeLines = null; // 两队当前阵型的各条线，战术模拟要用；还没选阵型时为 null
    this.awayLines = null;
    this.dragging = null;
    // 由外部接上：球员被放下（附带走过的路线）、被单击时通知
    this.onDrop = () => {};
    this.onClick = () => {};
  }

  team(name) {
    return name === "red" ? this.red : this.blue;
  }

  setJerseys(home, away) {
    this.jerseys = { red: home, blue: away };
  }

  jerseyOf(player) {
    return JERSEYS[this.jerseys[player.team]];
  }

  /** 这一队轨迹线的颜色；team 为 null 表示还没有球队控球。 */
  trailColor(team) {
    return team === null ? NEUTRAL_TRAIL : JERSEYS[this.jerseys[team]].trail;
  }

  setFormations(homeLines, awayLines) {
    this.homeLines = homeLines;
    this.awayLines = awayLines;
  }

  hasFormations() {
    return this.homeLines !== null && this.awayLines !== null;
  }

  /** 按给定位置摆放两队，号码保持不变。 */
  setLineups(red, blue) {
    this.red.forEach((player, slot) => { player.pos = red[slot]; });
    this.blue.forEach((player, slot) => { player.pos = blue[slot]; });
  }

  numberOf(team, slot) {
    return this.team(team)[slot].number;
  }

  /** 同队其他球员是否已经用了这个号码。 */
  numberTaken(player, number) {
    return this.team(player.team).some((other) => other !== player && other.number === number);
  }

  startDrag(player, x, y) {
    this.dragging = { player, pressX: x, pressY: y, moved: false, path: [player.pos] };
  }

  drag(x, y) {
    const state = this.dragging;
    if (!state) return null;
    if (!state.moved && Math.abs(x - state.pressX) <= CLICK_TOLERANCE && Math.abs(y - state.pressY) <= CLICK_TOLERANCE) return null;
    state.moved = true;
    state.player.moveTo(x, y);
    state.path.push(state.player.pos);
    return state.player;
  }

  stopDrag(x, y) {
    const state = this.dragging;
    if (!state) return;
    this.drag(x, y); // 松手的位置才算数
    this.dragging = null;
    if (state.moved) this.onDrop(state.player, state.path);
    else this.onClick(state.player);
  }

  toState() {
    const describe = (player) => ({ number: player.number, pos: player.pos });
    return {
      red: this.red.map(describe),
      blue: this.blue.map(describe),
      jerseys: this.jerseys,
      home_lines: this.homeLines,
      away_lines: this.awayLines,
    };
  }

  restoreState(state) {
    this.setJerseys(state.jerseys.red, state.jerseys.blue);
    this.setFormations(state.home_lines, state.away_lines);
    for (const [team, members] of [[this.red, state.red], [this.blue, state.blue]]) {
      team.forEach((player, slot) => {
        player.number = members[slot].number;
        player.pos = members[slot].pos.slice();
      });
    }
  }
}
