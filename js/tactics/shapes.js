// 战术的静态部分：按阵型算站位、攻防对应关系。这里只做计算，不碰画面。

import { GOALKEEPER_NUMBER, LEFT_LINE, RIGHT_LINE, mirrored } from "../data/formations.js";
import { ATTACK_TACTICS, BEST_ATTACKS, COUNTERS, DEFENSE_TACTICS, TRAP_NAME } from "../data/tactic_data.js";

const MIN_WIDTH_PER_PLAYER = 0.075; // 一条线人多时至少铺这么开，球员才不会叠在一起
export const MARK_GAP = 0.045; // 盯人时站在对手身前多远（朝本方球门）
const MARK_GOALKEEPER_DEPTH = 0.05; // 盯人时门将贴近球门，给身前的球员让位
export const MARK_DEEPEST = 0.10; // 盯人球员最多退到这里，不和门将叠在一起
const PITCH_ASPECT = 474 / 681; // 球场图的宽高比，算距离时把横向换算成和纵向同一比例
const MIN_PLAYER_GAP = 0.042; // 两名球员至少隔这么远（纵向比例），大约一个球员的宽度
const SPREAD_ROUNDS = 12;

const blend = (start, end, amount) => start + (end - start) * amount;

function lineDepth(tactic, index, lineCount) {
  const place = index / (lineCount - 1);
  return place <= 0.5 ? blend(tactic.back, tactic.mid, place * 2) : blend(tactic.mid, tactic.front, place * 2 - 1);
}

/** 在上半场球队的视角里算站位：门将加各条线。 */
export function shapedPositions(lines, tactic) {
  const positions = new Map([[GOALKEEPER_NUMBER, [0.5, tactic.goalkeeper]]]);
  lines.forEach((numbers, index) => {
    const depth = lineDepth(tactic, index, lines.length);
    const width = Math.min(1, Math.max(tactic.width, MIN_WIDTH_PER_PLAYER * numbers.length));
    const span = (RIGHT_LINE - LEFT_LINE) * width;
    const left = 0.5 - span / 2;
    numbers.forEach((number, i) => positions.set(number, [left + (span * (i + 0.5)) / numbers.length, depth]));
  });
  return positions;
}

/** 人盯人：离本方球门最近的对手先分配，由离他最近的球员去盯。opponents 已换算成同一视角。 */
function markingPositions(lines, opponents) {
  const free = new Map(shapedPositions(lines, DEFENSE_TACTICS[0]));
  free.delete(GOALKEEPER_NUMBER);
  const positions = new Map([[GOALKEEPER_NUMBER, [0.5, MARK_GOALKEEPER_DEPTH]]]);
  const targets = [...opponents].filter(([number]) => number !== GOALKEEPER_NUMBER).map(([, pos]) => pos);
  targets.sort((a, b) => a[1] - b[1]);
  for (const [x, y] of targets) {
    let marker = null;
    let best = Infinity;
    for (const [number, pos] of free) {
      const distance = (pos[0] - x) ** 2 + (pos[1] - y) ** 2;
      if (distance < best) {
        best = distance;
        marker = number;
      }
    }
    free.delete(marker);
    positions.set(marker, [x, Math.max(y - MARK_GAP, MARK_DEEPEST)]);
  }
  return positions;
}

/** point 离 other 太近时，返回沿两人连线推开后的位置；重合时朝本方球门方向退。 */
function pushedAway(point, other) {
  let across = (point[0] - other[0]) * PITCH_ASPECT;
  let deep = point[1] - other[1];
  let distance = Math.hypot(across, deep);
  if (distance >= MIN_PLAYER_GAP) return point;
  if (distance === 0) {
    across = 0;
    deep = -1;
    distance = 1;
  }
  const push = (MIN_PLAYER_GAP - distance) / distance;
  const x = Math.min(Math.max(point[0] + (across * push) / PITCH_ASPECT, LEFT_LINE), RIGHT_LINE);
  const y = Math.min(Math.max(point[1] + deep * push, MARK_DEEPEST), 1 - MARK_DEEPEST);
  return [x, y];
}

/** movable 这些号码靠得太近时互相推开，碰到 fixed 这些点也让开，号码才不会被挡住。 */
export function spreadApart(source, fixed, movable) {
  const positions = new Map(source);
  for (let round = 0; round < SPREAD_ROUNDS; round++) {
    for (const number of movable) {
      const others = fixed.concat(movable.filter((other) => other !== number).map((other) => positions.get(other)));
      for (const other of others) positions.set(number, pushedAway(positions.get(number), other));
    }
  }
  return positions;
}

function spreadDefenders(defenders, attackers) {
  const fixed = [...attackers.values(), defenders.get(GOALKEEPER_NUMBER)];
  const movable = [...defenders.keys()].filter((number) => number !== GOALKEEPER_NUMBER);
  return spreadApart(defenders, fixed, movable);
}

/** 进攻方最前一线不站到防守方后防线身后（那是越位），超了就整队按比例往回收。 */
export function onsideAttack(attack, defense) {
  if (defense.marking) return attack;
  const limit = 1 - defense.back;
  if (attack.front <= limit) return attack;
  const scale = limit / attack.front;
  return { ...attack, back: attack.back * scale, mid: attack.mid * scale, front: limit };
}

/** 模拟开始时的站位，各自在本队视角里（0 是本方球门）：返回 [进攻方, 防守方]。 */
export function startingShapes(attackLines, defenseLines, attack, defense, offside = true) {
  const attackers = shapedPositions(attackLines, offside ? onsideAttack(attack, defense) : attack);
  if (defense.marking) return [attackers, markingPositions(defenseLines, mirrored(attackers))];
  return [attackers, spreadDefenders(shapedPositions(defenseLines, defense), mirrored(attackers))];
}

export function counterReason(attack, defense) {
  const found = COUNTERS[attack.name].find(([name]) => name === defense.name);
  return found ? found[1] : null;
}

/** 我方能选的防守战术；不判越位时越位陷阱没有意义。 */
export function defensesAvailable(offside) {
  return DEFENSE_TACTICS.filter((tactic) => offside || tactic.name !== TRAP_NAME);
}

const aimedAtFirst = (tactics, isAimed) => [...tactics.filter(isAimed), ...tactics.filter((tactic) => !isAimed(tactic))];

/** 我方这样防时，对面可能的进攻：这个防守专门针对的排在前面。 */
export function attacksMetBy(defense) {
  return aimedAtFirst(ATTACK_TACTICS, (attack) => counterReason(attack, defense) !== null);
}

/** 我方这样打时，对面可能的防守：全部都能选，专门针对这个打法的排在前面。 */
export function defensesMetBy(attack, offside) {
  return aimedAtFirst(defensesAvailable(offside), (defense) => counterReason(attack, defense) !== null);
}

/** 对面打这个进攻战术时，推荐的防守：[[战术, 理由], ...]。 */
export function countersFor(attack, offside) {
  return COUNTERS[attack.name]
    .filter(([name]) => offside || name !== TRAP_NAME)
    .map(([name, reason]) => [DEFENSE_TACTICS.find((tactic) => tactic.name === name), reason]);
}

/** 对面用这个防守时，推荐的打法：[[战术, 理由], ...]。 */
export function attacksAgainst(defense) {
  return BEST_ATTACKS[defense.name].map(([name, reason]) => [ATTACK_TACTICS.find((tactic) => tactic.name === name), reason]);
}
