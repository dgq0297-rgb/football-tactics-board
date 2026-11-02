// 战术演示的播放：一步一步把球员和足球移到目标位置，并显示这一步的说明。
// 可以重播、结束，可以随时让对方断球，也可以从现在的位置接着选下一个战术。

import { leftBench, lineup, rightBench, startingNumbers } from "../data/formations.js";

const FRAME_MS = 16;
const STEP_MS = 1600;
const PAUSE_MS = 900;
const MOVED_ENOUGH = 0.01;

const ease = (t) => t * t * (3 - 2 * t); // 慢起慢停
const blend = (start, end, t) => [start[0] + (end[0] - start[0]) * t, start[1] + (end[1] - start[1]) * t];

export class TacticPlayer {
  constructor(captionBar, { players, ball, trails }, invalidate) {
    this.players = players;
    this.ball = ball;
    this.trails = trails;
    this.invalidate = invalidate;
    this.bar = captionBar;
    this.caption = captionBar.querySelector("#caption-text");
    this.simulation = null;
    this.job = null;
    this.stepIndex = 0;
    this.stepStarts = new Map();
    this.ballStart = null;
    this.elapsed = 0;
    this.lastTick = 0;
    this.playing = false;
    this.hasRun = false; // 演示过之后，下一个战术可以从现在的位置接着来
    this.onNext = () => {}; // 由外部接上：用户点“接着选战术”时通知
    captionBar.querySelector("#caption-steal").addEventListener("click", () => this.intercept());
    captionBar.querySelector("#caption-next").addEventListener("click", () => this.nextTactic());
    captionBar.querySelector("#caption-replay").addEventListener("click", () => this.replay());
    captionBar.querySelector("#caption-close").addEventListener("click", () => this.close());
  }

  play(simulation) {
    this.simulation = simulation;
    this.hasRun = true;
    this.bar.hidden = false;
    this.replay();
  }

  replay() {
    this.pause();
    const { simulation } = this;
    this.players.setLineups(lineup(leftBench(), simulation.home), lineup(rightBench(), simulation.away));
    this.trails.clear();
    this.ball.giveTo(this.players.team(simulation.attackingTeam)[simulation.holder - 1]);
    this.trails.receive(simulation.attackingTeam);
    this.stepIndex = 0;
    this.playing = true;
    this.beginStep();
  }

  pause() {
    this.playing = false;
    clearTimeout(this.job);
    this.job = null;
  }

  close() {
    this.pause();
    this.simulation = null;
    this.bar.hidden = true;
  }

  /** 换了阵型或打开存档：之前的演示作废，不能再接着来。 */
  reset() {
    this.close();
    this.hasRun = false;
  }

  nextTactic() {
    this.pause();
    this.onNext();
  }

  /** 现在球在哪队脚下；球没人控制时为 null。 */
  possession() {
    return this.ball.owner === null ? null : this.ball.owner.team;
  }

  /** 这一步要动的球员和目标。 */
  starters(step) {
    const pairs = [];
    for (const [number, pos] of step.home) pairs.push([this.players.red[number - 1], pos]);
    for (const [number, pos] of step.away) pairs.push([this.players.blue[number - 1], pos]);
    return pairs;
  }

  beginStep() {
    const step = this.simulation.steps[this.stepIndex];
    this.caption.textContent = step.caption;
    this.stepStarts = new Map(this.starters(step).map(([player]) => [player, player.pos]));
    this.elapsed = 0;
    if (step.ball[0] === "pass" || step.ball[0] === "steal") {
      this.ballStart = this.ball.anchor();
      this.ball.pos = this.ballStart;
      this.ball.owner = null;
    }
    this.lastTick = performance.now();
    this.job = setTimeout(() => this.tick(), FRAME_MS);
  }

  tick() {
    this.job = null;
    if (!this.playing) return;
    const now = performance.now();
    this.elapsed += now - this.lastTick;
    this.lastTick = now;
    this.showFrame(ease(Math.min(this.elapsed / STEP_MS, 1)));
    if (this.elapsed < STEP_MS) this.job = setTimeout(() => this.tick(), FRAME_MS);
    else this.finishStep();
  }

  showFrame(t) {
    const step = this.simulation.steps[this.stepIndex];
    for (const [player, target] of this.starters(step)) player.pos = blend(this.stepStarts.get(player), target, t);
    if (step.ball[0] === "pass") {
      const receiver = this.players.team(this.simulation.attackingTeam)[step.ball[2] - 1];
      this.ball.pos = blend(this.ballStart, receiver.pos, t);
    }
    this.invalidate();
  }

  finishStep() {
    this.recordLines(this.simulation.steps[this.stepIndex]);
    this.invalidate();
    this.stepIndex += 1;
    if (this.stepIndex < this.simulation.steps.length) {
      this.job = setTimeout(() => this.beginStep(), PAUSE_MS);
      return;
    }
    this.playing = false;
    if (this.simulation.whistled) this.handOver("对方任意球");
  }

  /** 把这一步的运动记成轨迹：球，加上进攻方这一步点名的球员，全画出来就看不清了。 */
  recordLines(step) {
    const attacking = this.simulation.attackingTeam;
    const team = this.players.team(attacking);
    if (step.ball[0] === "steal") {
      const defending = attacking === "red" ? "blue" : "red";
      this.ball.giveTo(this.players.team(defending)[step.ball[1] - 1]);
      this.trails.receive(defending);
      return;
    }
    const carrier = step.ball[0] === "carry" ? team[step.ball[1] - 1] : null;
    if (step.ball[0] === "pass") {
      const receiver = team[step.ball[2] - 1];
      this.trails.recordTravel([this.ballStart, receiver.pos], attacking, attacking);
      this.ball.giveTo(receiver);
    }
    if (carrier !== null) this.trails.recordCarry([this.stepStarts.get(carrier), carrier.pos], carrier.team, carrier.slot);
    for (const number of step.runners) {
      const runner = team[number - 1];
      const start = this.stepStarts.get(runner);
      if (runner !== carrier && Math.abs(start[0] - runner.pos[0]) + Math.abs(start[1] - runner.pos[1]) > MOVED_ENOUGH) {
        this.trails.recordRun([start, runner.pos], runner.team, runner.slot);
      }
    }
  }

  /** 用户让对方在这一刻断球：离球最近的对方球员拿到球。 */
  intercept() {
    if (this.simulation === null) return;
    this.pause();
    this.handOver("断球");
  }

  /** 球交给防守方离球最近的人，球员都停在原地，等着选下一个战术。 */
  handOver(reason) {
    const defending = this.simulation.attackingTeam === "red" ? "blue" : "red";
    const point = this.ball.anchor();
    const lines = defending === "red" ? this.players.homeLines : this.players.awayLines;
    const team = this.players.team(defending);
    const candidates = lines.flat().map((number) => team[number - 1]);
    const distance = (player) => Math.hypot(player.pos[0] - point[0], player.pos[1] - point[1]);
    const winner = candidates.reduce((best, player) => (distance(player) < distance(best) ? player : best));
    this.ball.giveTo(winner);
    this.trails.receive(defending);
    this.caption.textContent = `${reason}：球到了${winner.number}号脚下\n可以点“接着选战术”，双方从现在的位置继续`;
    this.invalidate();
  }

  /** 接着打时双方现在的站位和持球人：[主场站位, 客场站位, 进攻方持球的默认号码]。 */
  currentState(attackingTeam) {
    const { players, ball } = this;
    const positions = (team, lines) => new Map(startingNumbers(lines).map((number) => [number, team[number - 1].pos]));
    const holder = ball.owner !== null && ball.owner.team === attackingTeam ? ball.owner.slot + 1 : null;
    return [positions(players.red, players.homeLines), positions(players.blue, players.awayLines), holder];
  }
}
