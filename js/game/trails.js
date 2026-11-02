// 运动轨迹：足球每次运动记一条带次数的线（球自身运动是点线，有人持球是虚线），
// 球到了对方球员脚上这一轮就结束；球员无球跑动记一条带次数的实线，每名球员单独计数。
// 球和球员可以分别选有线或无线：无线时运动不记录，也不计次数。默认无线。

import { onPitch } from "../core/board.js";
import { cleanPath, pathLength } from "../core/path_smoothing.js";

const MIN_LENGTH = 4; // 总路程短于这个像素数不算运动

export class Trails {
  constructor(board) {
    this.board = board;
    this.segments = [];
    this.runs = [];
    this.runCounts = new Map();
    this.chainTeam = null;
    this.chainCount = 0;
    this.ballLines = false;
    this.playerLines = false;
    this.onLinesChange = () => {}; // 由外部接上：有线无线变化时通知
  }

  setBallLines(on) {
    this.ballLines = on;
    this.onLinesChange();
  }

  setPlayerLines(on) {
    this.playerLines = on;
    this.onLinesChange();
  }

  toPixels(path) {
    return path.map((pos) => this.board.toPixels(pos));
  }

  /** 磨平后换算回球场比例；起点和终点保持原样，正好落在球员身上。 */
  smoothed(path, pixels) {
    const cleaned = cleanPath(pixels);
    const middle = cleaned.slice(1, -1).map(([x, y]) => this.board.toPosition(x, y, 0));
    return [path[0], ...middle, path[path.length - 1]];
  }

  /** 球员无球跑动；从场外入场或者离场不算跑动，不画线也不计次数。 */
  recordRun(path, team, player) {
    if (!this.playerLines || !onPitch(path[0]) || !onPitch(path[path.length - 1])) return;
    const pixels = this.toPixels(path);
    if (pathLength(pixels) < MIN_LENGTH) return;
    const number = (this.runCounts.get(`${team}:${player}`) || 0) + 1;
    this.addRun(this.smoothed(path, pixels), team, player, number);
  }

  /** 球员带球：球有线时记球的虚线；球无线时这就只是球员的跑动。 */
  recordCarry(path, team, player) {
    if (this.ballLines) {
      this.recordTravel(path, team, team, true);
    } else {
      this.receive(team);
      this.recordRun(path, team, player);
    }
  }

  /** 球无线时不画线不计次数，但控球方照常更新。 */
  recordTravel(path, fromTeam, toTeam, carried = false) {
    const pixels = this.toPixels(path);
    if (pathLength(pixels) >= MIN_LENGTH) {
      if (this.chainTeam === null) this.chainTeam = fromTeam || toTeam;
      if (this.ballLines) {
        this.chainCount += 1;
        this.segments.push({ path: this.smoothed(path, pixels), team: this.chainTeam, number: this.chainCount, carried });
      }
    }
    this.receive(toTeam);
  }

  /** 球到了某队球员脚上；换成对方时这一轮结束，下一轮从 1 重新计数。 */
  receive(team) {
    if (team === null) return;
    if (this.chainTeam !== null && team !== this.chainTeam) this.chainCount = 0;
    this.chainTeam = team;
  }

  addRun(path, team, player, number) {
    this.runs.push({ path, team, player, number });
    if (player !== null) {
      const key = `${team}:${player}`;
      this.runCounts.set(key, Math.max(this.runCounts.get(key) || 0, number));
    }
  }

  clear() {
    this.segments = [];
    this.runs = [];
    this.runCounts = new Map();
    this.chainTeam = null;
    this.chainCount = 0;
  }

  toState() {
    return {
      segments: this.segments,
      runs: this.runs,
      chain_team: this.chainTeam,
      chain_count: this.chainCount,
      ball_lines: this.ballLines,
      player_lines: this.playerLines,
    };
  }

  restoreState(state) {
    this.clear();
    this.ballLines = state.ball_lines;
    this.playerLines = state.player_lines;
    this.segments = state.segments.map((segment) => ({ ...segment }));
    for (const run of state.runs) this.addRun(run.path, run.team, run.player, run.number);
    this.chainTeam = state.chain_team;
    this.chainCount = state.chain_count;
    this.onLinesChange();
  }
}
