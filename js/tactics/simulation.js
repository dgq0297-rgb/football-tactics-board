// 战术的逐步演变：进攻方按脚本走，防守方按自己的战术对球做出反应，算出每一步的目标站位。
// 这里只做计算，不碰画面。位置都是 Map（号码 -> [x, depth]）。

import { SCRIPTS, fieldGroup } from "../data/attack_scripts.js";
import { GOALKEEPER_NUMBER, LEFT_LINE, RIGHT_LINE, mirrored } from "../data/formations.js";
import { BEHAVIORS, DEFAULT_STEAL_AFTER, DEFENSE_TACTICS, STEAL_AFTER } from "../data/tactic_data.js";
import { MARK_DEEPEST, MARK_GAP, counterReason, onsideAttack, shapedPositions, spreadApart, startingShapes } from "./shapes.js";

// 角色和优先的默认号码；缺这些号码时（小人制或自定义阵型）按位置找最合适的人
const ROLE_NUMBERS = [
  ["wing", [7]], ["striker", [9]], ["far", [11]], ["rb", [2]], ["playmaker", [10, 8]],
  ["holder", [6, 8]], ["cb", [4, 5]], ["cb2", [5, 4]], ["lb", [3]],
];
const ROLE_FIT = {
  wing: (x, d) => x - d * 0.3,
  striker: (x, d) => Math.abs(x - 0.5) - d,
  far: (x, d) => -x - d * 0.3,
  rb: (x, d) => x + d,
  lb: (x, d) => d - x,
  playmaker: (x, d) => Math.abs(x - 0.5) + Math.abs(d - 0.6),
  holder: (x, d) => Math.abs(x - 0.5) + Math.abs(d - 0.45),
  cb: (x, d) => Math.abs(x - 0.5) + d,
  cb2: (x, d) => Math.abs(x - 0.5) + d,
};
const PRESS_SPREAD = 0.07; // 多人围抢时左右错开
const MIN_CARRY = 0.06; // 带球至少往前走这么多
const MAX_DEPTH = 0.87; // 最多压到这里，不和对方门将叠在一起
const MAX_RUN = 0.20; // 接着上一段打时，每名球员一步最多跑这么远（球场长度的比例）
const OFFSIDE_MARGIN = 0.005; // 和越位线平行不算越位
const TRAP_STEP = 0.05; // 越位陷阱时防线上提多少

// 取到 9 位小数：两名球员离球一样远时不让浮点误差决定选谁，打平就按固定顺序选
const dist = (a, b) => Math.round(Math.hypot(a[0] - b[0], a[1] - b[1]) * 1e9) / 1e9;
const ascending = (numbers) => [...numbers].sort((a, b) => a - b);
const clampAcross = (x) => Math.min(Math.max(x, LEFT_LINE), RIGHT_LINE);
const clampDepth = (depth) => Math.min(Math.max(depth, MARK_DEEPEST), MAX_DEPTH);

function minBy(items, key) {
  let best = items[0];
  let bestValue = key(best);
  for (const item of items.slice(1)) {
    const value = key(item);
    if (value < bestValue) {
      best = item;
      bestValue = value;
    }
  }
  return best;
}

function outfieldOf(positions) {
  return new Map([...positions].filter(([number]) => number !== GOALKEEPER_NUMBER));
}

/** 给每个角色挑一名球员；人比角色少时后面的角色可以和前面的重复。 */
function assignRoles(positions) {
  const roles = {};
  const free = new Set(positions.keys());
  for (const [role, numbers] of ROLE_NUMBERS) {
    const preferred = numbers.find((number) => free.has(number));
    const pool = ascending(free.size ? free : positions.keys());
    const best = preferred !== undefined ? preferred : minBy(pool, (number) => ROLE_FIT[role](...positions.get(number)));
    roles[role] = best;
    free.delete(best);
  }
  return roles;
}

function mostAdvancedOther(positions, excluded) {
  const others = ascending(positions.keys()).filter((number) => number !== excluded);
  let best = others[0];
  for (const number of others.slice(1)) {
    if (positions.get(number)[1] > positions.get(best)[1]) best = number;
  }
  return best;
}

/**
 * 每名球员这一步该在的位置：全队整体前压一点，点名的人到指定位置。
 * anchors 从阵型层次算起，不从球员当前位置算起，所以接着上一段打时，前后几条线不会挤到一起。
 * shift 是脚本要平移多少：接着打时要从球现在的位置往前推。
 */
function nextAnchors(anchors, step, roles, shift) {
  const positions = new Map(anchors);
  for (const [number, [x, depth]] of anchors) {
    if (number !== GOALKEEPER_NUMBER) positions.set(number, [x, Math.min(depth + step.advance, MAX_DEPTH)]);
  }
  for (const [role, [x, depth]] of Object.entries(step.moves)) {
    if (roles[role] !== GOALKEEPER_NUMBER) positions.set(roles[role], [x, clampDepth(depth + shift)]);
  }
  return positions;
}

/** 球永远从当前持球人脚下出发；人少时持球人顶这个角色，接球人重复时换另一名球员。 */
function resolveBall(step, baseRoles, positions, holder) {
  const roles = { ...baseRoles, [step.ball[1]]: holder };
  if (step.ball[0] === "carry") return [["carry", holder], holder, roles];
  let receiver = roles[step.ball[2]];
  if (receiver === holder) {
    receiver = mostAdvancedOther(positions, holder);
    roles[step.ball[2]] = receiver;
  }
  return [["pass", holder, receiver], receiver, roles];
}

/** 离球最近的 count 名球员上抢，站在球和本方球门之间，多人时左右错开。 */
function pressTargets(defenders, ball, count) {
  const outfield = [...defenders.keys()].filter((number) => number !== GOALKEEPER_NUMBER);
  const nearest = outfield.slice().sort((a, b) => dist(defenders.get(a), ball) - dist(defenders.get(b), ball)).slice(0, count);
  const targets = new Map();
  nearest.forEach((number, i) => {
    const side = Math.floor((i + 1) / 2) * (i % 2 ? 1 : -1);
    targets.set(number, [clampAcross(ball[0] + side * PRESS_SPREAD), Math.max(ball[1] - MARK_GAP, MARK_DEEPEST)]);
  });
  return targets;
}

/** 防守方的目标（防守方视角）：向球侧平移，防线守在球身后，有人上抢，其余人让开。 */
function reactInBlock(base, attackersSeen, ball, behavior, isPass, offside) {
  const outfield = [...base.keys()].filter((number) => number !== GOALKEEPER_NUMBER);
  const backDepth = Math.min(...outfield.map((number) => base.get(number)[1]));
  let drop = Math.max(0, backDepth - (ball[1] - 0.05));
  if (!offside) {
    // 不判越位时对手可以站到任何地方，防线还得退到最靠前的对手身前
    const deepest = Math.min(...[...outfieldOf(attackersSeen).values()].map((pos) => pos[1]));
    drop = Math.max(drop, backDepth - (deepest - 0.05));
  }
  const stepUp = behavior.trap && offside && isPass && drop === 0 ? TRAP_STEP : 0;
  const positions = new Map(base);
  for (const number of outfield) {
    const [x, depth] = base.get(number);
    const isBackLine = depth - backDepth < 0.01;
    positions.set(number, [clampAcross(x + (ball[0] - 0.5) * behavior.shift), Math.max(depth - drop + (isBackLine ? stepUp : 0), MARK_DEEPEST)]);
  }
  const presses = behavior.centralOnly && Math.abs(ball[0] - 0.5) > 0.25 ? 0 : behavior.presses;
  for (const [number, target] of pressTargets(positions, ball, presses)) positions.set(number, target);
  const fixed = [...attackersSeen.values(), positions.get(GOALKEEPER_NUMBER)];
  return spreadApart(positions, fixed, outfield);
}

function reactMarking(defenders, marks, attackersSeen) {
  const positions = new Map(defenders);
  for (const [attacker, marker] of marks) {
    const [x, depth] = attackersSeen.get(attacker);
    positions.set(marker, [x, Math.max(depth - MARK_GAP, MARK_DEEPEST)]);
  }
  return positions;
}

/** 人盯人开始时谁盯谁：站得最近的就是。 */
function marksFromStart(attackersSeen, defenders) {
  const free = new Set([...defenders.keys()].filter((number) => number !== GOALKEEPER_NUMBER));
  const marks = new Map();
  for (const attacker of ascending([...attackersSeen.keys()].filter((number) => number !== GOALKEEPER_NUMBER))) {
    const marker = minBy(ascending(free), (number) => dist(defenders.get(number), attackersSeen.get(attacker)));
    free.delete(marker);
    marks.set(attacker, marker);
  }
  return marks;
}

/** 进攻方视角里的越位线：最后一名防守球员（不算门将）的位置。 */
function offsideLimit(defenders) {
  return 1 - Math.min(...[...outfieldOf(defenders).values()].map((pos) => pos[1]));
}

/** 除了持球和正在接球的人，其他人不站到越位线身后。超了就全队按比例往回收，不削平。门将不动。 */
function holdOnside(attackers, defenders, ballOwner) {
  const limit = offsideLimit(defenders);
  const others = [...attackers.keys()].filter((number) => number !== ballOwner && number !== GOALKEEPER_NUMBER);
  const furthest = Math.max(...others.map((number) => attackers.get(number)[1]));
  const positions = new Map(attackers);
  if (furthest <= limit) return positions;
  const scale = limit / furthest;
  for (const number of others) {
    const [x, depth] = attackers.get(number);
    positions.set(number, [x, depth * scale]);
  }
  return positions;
}

/** 后防线一起往前提一步。 */
function steppedUp(defenders) {
  const backDepth = Math.min(...[...outfieldOf(defenders).values()].map((pos) => pos[1]));
  const positions = new Map();
  for (const [number, [x, depth]] of defenders) {
    positions.set(number, [x, number !== GOALKEEPER_NUMBER && depth - backDepth < 0.01 ? depth + TRAP_STEP : depth]);
  }
  return positions;
}

/** 传球瞬间接球人在对方半场、在球前面、又在越位线身后，就是越位。 */
function caughtOffside(event, attackers, defenders) {
  if (event[0] !== "pass") return false;
  const receiverDepth = attackers.get(event[2])[1];
  const ballDepth = attackers.get(event[1])[1];
  return receiverDepth > 0.5 && receiverDepth > ballDepth && receiverDepth > offsideLimit(defenders) + OFFSIDE_MARGIN;
}

/** 把球场上的站位换成各队自己的视角：返回 [进攻方, 防守方]。球场坐标就是主场的视角。 */
function viewsFromField(home, away, homeAttacks) {
  return homeAttacks ? [home, mirrored(away)] : [mirrored(away), home];
}

/** 每名球员这一步最多跑 MAX_RUN，接着上一段打时大家从原地一步步过去，不会一步跨半个球场。 */
function limitRuns(targets, positions) {
  const limited = new Map();
  for (const [number, target] of targets) {
    const start = positions.get(number);
    const distance = dist(start, target);
    if (distance <= MAX_RUN) {
      limited.set(number, target);
    } else {
      const part = MAX_RUN / distance;
      limited.set(number, [start[0] + (target[0] - start[0]) * part, start[1] + (target[1] - start[1]) * part]);
    }
  }
  return limited;
}

function nearestOutfield(positions, point) {
  return minBy(ascending(outfieldOf(positions).keys()), (number) => dist(positions.get(number), point));
}

/** 防守方离球最近的人冲上去把球断下来，其他人原地不动。 */
function stealStep(attackers, defenders, ballOwner, toField, numberOf, defendingTeam, defense) {
  const ball = mirrored(attackers).get(ballOwner);
  const stealer = nearestOutfield(defenders, ball);
  const targets = new Map(defenders);
  targets.set(stealer, [ball[0], Math.max(ball[1] - MARK_GAP / 2, MARK_DEEPEST)]);
  const caption = `${numberOf(defendingTeam, stealer - 1)}号上抢把球断下（${defense.name}奏效）\n球权转换：可以点“接着选战术”，从现在的位置打进攻`;
  const [home, away] = toField(attackers, targets);
  return { caption, ball: ["steal", stealer], home, away, runners: new Set() };
}

/**
 * 算出整场演示。numberOf(team, slot) 用来在说明文字里显示球员现在的号码。
 * offside 为真时判越位：进攻方不站到越位线身后，传球瞬间越位就吹停，演示到此结束。
 * current 是接着上一段演示时的 [主场站位, 客场站位, 持球号码]，球员从那里继续跑；没有就从阵型站位开始。
 * steal 为真时防守方按自己的战术在中途把球断下，演示到此结束，好接着选进攻战术。
 */
export function buildSimulation({ homeLines, awayLines, homeAttacks, attack, defense, numberOf, offside = true, current = null, steal = false }) {
  const team = homeAttacks ? "red" : "blue";
  const otherTeam = homeAttacks ? "blue" : "red";
  const [attackLines, defenseLines] = homeAttacks ? [homeLines, awayLines] : [awayLines, homeLines];
  let [attackers, defenders] = current
    ? viewsFromField(current[0], current[1], homeAttacks)
    : startingShapes(attackLines, defenseLines, attack, defense, offside);
  const base = shapedPositions(defenseLines, defense.marking ? DEFENSE_TACTICS[0] : defense);
  const marks = defense.marking ? marksFromStart(mirrored(attackers), defenders) : new Map();
  const behavior = BEHAVIORS[defense.name];
  const roles = assignRoles(outfieldOf(attackers));
  const script = SCRIPTS[fieldGroup(attackers.size)][attack.name];

  const toField = (attackView, defenseView) => (homeAttacks ? [attackView, mirrored(defenseView)] : [defenseView, mirrored(attackView)]);
  const shown = (roleTable, step) => step.caption.replace(/\{(\w+)\}/g, (_, role) => numberOf(team, roleTable[role] - 1));

  const [startHome, startAway] = toField(attackers, defenders);
  const first = current && attackers.has(current[2]) ? current[2] : roles[script[0].ball[1]];
  let ballOwner = first;
  let whistled = false;
  let anchors = new Map(attackers);
  let shift = 0;
  if (current) {
    // 接着上一段打：整套打法平移到球现在的位置，全队围绕持球人保持阵型层次，再一步步往前推
    const shape = shapedPositions(attackLines, offside ? onsideAttack(attack, defense) : attack);
    shift = attackers.get(first)[1] - shape.get(first)[1];
    anchors = new Map([...shape].map(([number, [x, depth]]) => [number, [x, clampDepth(depth + shift)]]));
    anchors.set(GOALKEEPER_NUMBER, attackers.get(GOALKEEPER_NUMBER));
    anchors.set(first, attackers.get(first));
  }

  const steps = [];
  for (let index = 0; index < script.length; index++) {
    const step = script[index];
    let event;
    let stepRoles;
    [event, ballOwner, stepRoles] = resolveBall(step, roles, outfieldOf(attackers), ballOwner);
    anchors = nextAnchors(anchors, step, stepRoles, shift);
    if (step.ball[0] === "carry") {
      // 带球一定往前；人少时顶替这个角色的人可能已经站在脚本位置的前面
      const [x, depth] = step.ball[2];
      anchors.set(ballOwner, [x, Math.min(Math.max(depth + shift, attackers.get(ballOwner)[1] + MIN_CARRY), MAX_DEPTH)]);
    }
    let targets = current ? limitRuns(anchors, attackers) : new Map(anchors);
    const named = Object.keys(step.moves).map((role) => stepRoles[role]);
    const involved = new Set([...event.slice(1), ...named]);
    const keepStill = [...ascending(involved).map((number) => targets.get(number)), targets.get(GOALKEEPER_NUMBER)];
    targets = spreadApart(targets, keepStill, [...targets.keys()].filter((number) => number !== GOALKEEPER_NUMBER && !involved.has(number)));
    const seen = mirrored(targets);
    const ball = seen.get(ballOwner);
    // 越位看球出脚那一刻：防线还没回撤，越位陷阱这时正好一起上提
    const lineAtPass = behavior.trap ? steppedUp(defenders) : defenders;
    const whistle = offside && caughtOffside(event, attackers, lineAtPass);
    if (whistle) {
      defenders = lineAtPass;
    } else {
      const reaction = defense.marking
        ? reactMarking(defenders, marks, seen)
        : reactInBlock(base, seen, ball, behavior, event[0] === "pass", offside);
      defenders = current ? limitRuns(reaction, defenders) : reaction;
    }
    if (offside) {
      targets = holdOnside(targets, defenders, ballOwner);
      if (current) targets = limitRuns(targets, attackers);
      const fixed = [targets.get(ballOwner), targets.get(GOALKEEPER_NUMBER)];
      targets = spreadApart(targets, fixed, [...targets.keys()].filter((number) => number !== ballOwner && number !== GOALKEEPER_NUMBER));
    }
    let action = shown(stepRoles, step);
    if (whistle) action += `\n越位！${numberOf(team, ballOwner - 1)}号接球时站在防线身后，裁判吹停`;
    const reason = counterReason(attack, defense) || behavior.note;
    const note = offside ? "" : "（本次不判越位）";
    const caption = `第${index + 1}/${script.length}步：${action}\n防守方（${defense.name}）：${reason}${note}`;
    const [home, away] = toField(targets, defenders);
    steps.push({ caption, ball: event, home, away, runners: new Set(named) });
    attackers = targets;
    if (whistle) {
      whistled = true;
      break;
    }
    const stealAfter = STEAL_AFTER[defense.name] || DEFAULT_STEAL_AFTER;
    if (steal && index + 1 >= stealAfter) {
      // 接着打时，防守球员够得着才断，够不着就继续跟防，等下一步
      const ballNow = mirrored(attackers).get(ballOwner);
      if (!current || dist(defenders.get(nearestOutfield(defenders, ballNow)), ballNow) <= MAX_RUN) {
        steps.push(stealStep(attackers, defenders, ballOwner, toField, numberOf, otherTeam, defense));
        break;
      }
    }
  }
  return { attackingTeam: team, holder: first, home: startHome, away: startAway, steps, whistled };
}
