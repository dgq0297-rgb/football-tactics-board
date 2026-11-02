// 存档的内容：把球员、号码、足球、轨迹、人制和阵型全部变成一份数据，也能读回来。
// 格式和桌面版的存档一样，桌面版存的文件也能打开。这里不碰界面。

import { FORMATIONS, SQUAD_SIZE, defaultShape, outfieldCount } from "../data/formations.js";
import { DEFAULT_AWAY, DEFAULT_HOME, JERSEYS } from "../data/jerseys.js";

const FILE_VERSION = 9;
const TEAMS = ["red", "blue"];
const MIN_NUMBER = 1;
const MAX_NUMBER = 99;

export function collectState(pieces, menu) {
  return {
    version: FILE_VERSION,
    format: menu.current,
    formation: menu.detail,
    players: pieces.players.toState(),
    ball: pieces.ball.toState(),
    trails: pieces.trails.toState(),
  };
}

export function applyState(pieces, menu, state) {
  pieces.simulator.reset();
  pieces.editor.close();
  pieces.players.restoreState(state.players);
  pieces.ball.restoreState(state.ball);
  pieces.trails.restoreState(state.trails);
  menu.showCurrent(state.format, state.formation);
}

function require(condition, message) {
  if (!condition) throw new Error(message);
}

function checkPosition(pos) {
  require(Array.isArray(pos) && pos.length === 2 && pos.every((value) => value >= -1 && value <= 2), "位置不正确");
}

function checkPath(path) {
  require(path.length >= 2, "轨迹不完整");
  path.forEach(checkPosition);
}

function checkLines(lines) {
  if (lines === null) return;
  const numbers = lines.flat();
  require(lines.length >= 2 && new Set(numbers).size === numbers.length, "阵型不正确");
  require(numbers.every((number) => Number.isInteger(number) && number >= 2 && number <= SQUAD_SIZE), "阵型不正确");
}

function checkPlayers(players) {
  const { jerseys } = players;
  require(jerseys.red in JERSEYS && jerseys.blue in JERSEYS, "球衣颜色不正确");
  require(jerseys.red !== jerseys.blue, "两队球衣不能同色");
  checkLines(players.home_lines);
  checkLines(players.away_lines);
  for (const team of TEAMS) {
    const members = players[team];
    require(members.length === SQUAD_SIZE, "球员人数不正确");
    require(new Set(members.map((member) => member.number)).size === SQUAD_SIZE, "号码有重复");
    for (const member of members) {
      require(Number.isInteger(member.number) && member.number >= MIN_NUMBER && member.number <= MAX_NUMBER, "号码不正确");
      checkPosition(member.pos);
    }
  }
}

function checkBall(ball) {
  checkPosition(ball.pos);
  if (ball.owner !== null) {
    const [team, index] = ball.owner;
    require(TEAMS.includes(team) && Number.isInteger(index) && index >= 0 && index < SQUAD_SIZE, "持球球员不正确");
  }
}

function checkTrails(trails) {
  const teamOk = (team) => TEAMS.includes(team) || team === null;
  for (const segment of trails.segments) {
    checkPath(segment.path);
    require(teamOk(segment.team), "轨迹的球队不正确");
    require(Number.isInteger(segment.number) && segment.number >= 1, "轨迹的次数不正确");
    require(typeof segment.carried === "boolean", "轨迹的线型不正确");
  }
  for (const run of trails.runs) {
    checkPath(run.path);
    require(TEAMS.includes(run.team), "轨迹的球队不正确");
    require(Number.isInteger(run.number) && run.number >= 1, "轨迹的次数不正确");
    require(run.player === null || (Number.isInteger(run.player) && run.player >= 0 && run.player < SQUAD_SIZE), "跑动的球员不正确");
  }
  require(teamOk(trails.chain_team), "轨迹的球队不正确");
  require(Number.isInteger(trails.chain_count) && trails.chain_count >= 0, "轨迹的次数不正确");
  require(typeof trails.ball_lines === "boolean" && typeof trails.player_lines === "boolean", "有线无线模式不正确");
}

function checkFormation(size, formation) {
  if (size === null) {
    require(formation === null, "阵型不正确");
    return;
  }
  const shapes = formation.split(" / ");
  require(shapes.length === 2, "阵型不正确");
  for (const shape of shapes) {
    const parts = shape.split("-");
    require(parts.every((part) => /^\d+$/.test(part)), "阵型不正确");
    require(parts.reduce((sum, part) => sum + Number(part), 0) === outfieldCount(size), "阵型人数不对");
  }
}

/** 内容不对时抛出错误；先检查再应用，打开坏文件不会弄乱当前画面。 */
function checkState(state) {
  require(state.version === FILE_VERSION, "不支持这个存档版本");
  require(state.format === null || FORMATIONS.has(state.format), "人制不正确");
  checkFormation(state.format, state.formation);
  checkPlayers(state.players);
  checkBall(state.ball);
  checkTrails(state.trails);
}

/** 把桌面版的旧存档补齐到现在的格式。 */
function upgradeState(state) {
  const { version, trails } = state;
  if (version === 1) {
    for (const segment of trails.segments) {
      segment.path = [segment.start, segment.end];
      delete segment.start;
      delete segment.end;
    }
  }
  if (version <= 2) trails.runs = [];
  if (version <= 3) {
    for (const run of trails.runs) {
      run.player = null;
      run.number = 1;
    }
    trails.visible = true;
  }
  if (version <= 4) trails.segments.forEach((segment) => { segment.carried = false; });
  if (version <= 5) {
    trails.ball_lines = trails.visible;
    trails.player_lines = trails.visible;
    delete trails.visible;
  }
  if (version <= 6) state.formation = FORMATIONS.has(state.format) ? defaultShape(state.format) : null;
  if (version <= 7) {
    state.formation = state.formation === null ? null : `${state.formation} / ${state.formation}`;
    state.players.jerseys = { red: DEFAULT_HOME, blue: DEFAULT_AWAY };
  }
  if (version <= 8) {
    state.players.home_lines = null;
    state.players.away_lines = null;
    state.version = FILE_VERSION;
  }
}

/** 解析存档文字，有问题时抛出带中文说明的错误。 */
export function parseState(text) {
  let state;
  try {
    state = JSON.parse(text);
  } catch {
    throw new Error("这不是有效的存档文件");
  }
  try {
    upgradeState(state);
    checkState(state);
  } catch (error) {
    if (error instanceof TypeError) throw new Error("文件内容不完整");
    throw error;
  }
  return state;
}
