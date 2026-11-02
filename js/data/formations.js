// 各人制的常见阵型和默认号码，以及阵型对应的球场位置。
//
// 1 号门将另算。人制 -> 常见阵型，第一个是默认；阵型从后卫到前锋分成几条线，每条线从球队的右路排到左路。
// 这里的数字是默认号码，号码对应位置：2 右后卫、3 左后卫、4 和 5 中卫、6 和 8 中场、
// 7 右路、11 左路、10 前腰或第二前锋、9 中锋。
// 位置都用 Map（号码 -> [x, y]）保存，遍历顺序就是写入顺序。

export const GOALKEEPER_NUMBER = 1;

export const FORMATIONS = new Map([
  [11, [
    [[2, 4, 5, 3], [6, 8], [7, 10, 11], [9]], // 4-2-3-1
    [[2, 4, 5, 3], [8, 6, 10], [7, 9, 11]], // 4-3-3
    [[4, 5, 3], [2, 6, 8, 11], [7, 10], [9]], // 3-4-2-1
    [[2, 4, 5, 3], [7, 6, 8, 11], [9, 10]], // 4-4-2
    [[2, 4, 5, 3], [6], [7, 8, 10, 11], [9]], // 4-1-4-1
    [[4, 5, 3], [2, 8, 6, 10, 11], [7, 9]], // 3-5-2
    [[4, 5, 3], [2, 6, 8, 11], [7, 9, 10]], // 3-4-3
    [[2, 4, 5, 3], [7, 6, 8, 11], [10], [9]], // 4-4-1-1
    [[2, 4, 5, 3], [6], [8, 7], [10], [9, 11]], // 4-1-2-1-2
  ]],
  [9, [
    [[2, 5, 3], [7, 8, 11], [9, 10]], // 3-3-2
    [[2, 5, 3], [7, 6, 8, 11], [9]], // 3-4-1
    [[2, 3], [8, 6, 10], [7, 9, 11]], // 2-3-3
    [[2, 5, 3], [6, 8], [7, 9, 11]], // 3-2-3
    [[2, 4, 5, 3], [7, 8, 11], [9]], // 4-3-1
    [[2, 3], [8, 6, 10], [7, 11], [9]], // 2-3-2-1
  ]],
  [8, [
    [[2, 5, 3], [7, 8, 11], [9]], // 3-3-1
    [[2, 3], [7, 8, 11], [9, 10]], // 2-3-2
    [[2, 5, 3], [6, 8], [9, 10]], // 3-2-2
    [[2, 3], [7, 6, 8, 11], [9]], // 2-4-1
  ]],
  [7, [
    [[2, 3], [7, 8, 11], [9]], // 2-3-1
    [[2, 5, 3], [7, 11], [9]], // 3-2-1
    [[2, 5, 3], [8], [9, 10]], // 3-1-2
    [[2, 3], [7, 11], [9, 10]], // 2-2-2
    [[2, 3], [8], [7, 11], [9]], // 2-1-2-1
  ]],
  [6, [
    [[2, 3], [7, 11], [9]], // 2-2-1
    [[2, 5, 3], [8], [9]], // 3-1-1
    [[5], [7, 8, 11], [9]], // 1-3-1
    [[2, 3], [8], [9, 10]], // 2-1-2
  ]],
  [5, [
    [[5], [7, 11], [9]], // 1-2-1
    [[2, 3], [9, 10]], // 2-2
    [[2, 3], [8], [9]], // 2-1-1
    [[5], [8], [9, 10]], // 1-1-2
  ]],
]);

// 自定义阵型按这些顺序分号码，门将之外一共 10 个号码（2~11）；前锋先挑，保证 9 号在锋线
const PRIORITY = {
  front: [9, 7, 11, 10, 8, 6, 4, 5, 2, 3],
  back: [2, 3, 5, 4, 6, 8, 7, 11, 10, 9],
  mid: [8, 7, 11, 6, 10, 4, 5, 2, 3, 9],
};
const SPECIAL_LINES = { "front:2": [9, 10], "back:1": [5], "mid:2": [6, 8] };
const RIGHT_TO_LEFT = [2, 7, 4, 6, 9, 5, 8, 10, 11, 3]; // 同一条线上从球队右路排到左路的顺序

// 以下位置都是球场比例，对着背景图的白线取值；只算上半场，下半场镜像得到
export const LEFT_LINE = 0.063;
export const RIGHT_LINE = 0.937;
const GOALKEEPER_DEPTH = 0.085;
const FIRST_LINE_DEPTH = 0.22;
const LAST_LINE_DEPTH = 0.43;

// 每队总人数，以及场外两列的摆法（-1~0 是球场左边的空白区域）
export const SQUAD_SIZE = 26;
const BENCH_ROWS = 13;
const BENCH_NEAR_COLUMN = -0.28;
const BENCH_FAR_COLUMN = -0.72;

export function shapeOf(lines) {
  return lines.map((line) => line.length).join("-");
}

export function defaultShape(size) {
  return shapeOf(FORMATIONS.get(size)[0]);
}

export function outfieldCount(size) {
  return size - 1;
}

/** 人数输入框的内容：空着算 0，不是数字返回 null。 */
export function parseCount(text) {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return /^\d+$/.test(trimmed) ? Number(trimmed) : null;
}

/** 自定义人数有问题时返回提示文字，没问题返回 null。 */
export function countProblem(size, counts) {
  if (counts.includes(null)) return "人数只能填数字";
  const total = counts.reduce((sum, count) => sum + count, 0);
  const need = outfieldCount(size);
  if (total < need) return `门将之外要 ${need} 人，还差 ${need - total} 人`;
  if (total > need) return `门将之外要 ${need} 人，多了 ${total - need} 人`;
  return null;
}

function pickNumbers(role, count, taken) {
  const special = SPECIAL_LINES[`${role}:${count}`];
  if (special && !special.some((number) => taken.has(number))) return special;
  const chosen = PRIORITY[role].filter((number) => !taken.has(number)).slice(0, count);
  return chosen.sort((a, b) => RIGHT_TO_LEFT.indexOf(a) - RIGHT_TO_LEFT.indexOf(b));
}

/** 自定义阵型的三条线，某条线可以是 0 人；和常见阵型人数一样时直接用常见阵型的号码。 */
export function customLines(size, back, mid, front) {
  const preset = FORMATIONS.get(size).find((lines) => shapeOf(lines) === `${back}-${mid}-${front}`);
  if (preset) return preset;
  const frontLine = pickNumbers("front", front, new Set());
  const backLine = pickNumbers("back", back, new Set(frontLine));
  const midLine = pickNumbers("mid", mid, new Set([...frontLine, ...backLine]));
  return [backLine, midLine, frontLine];
}

/** 这个阵型上场的默认号码，包括门将。 */
export function startingNumbers(lines) {
  return [GOALKEEPER_NUMBER, ...lines.flat()];
}

function lineDepth(index, lineCount) {
  const step = (LAST_LINE_DEPTH - FIRST_LINE_DEPTH) / (lineCount - 1);
  return FIRST_LINE_DEPTH + step * index;
}

/** 上半场一方的 号码 -> 位置：门将加各条线。它的右路在屏幕左边，所以每条线从屏幕左边排起。 */
export function topTeamPositions(lines) {
  const positions = new Map([[GOALKEEPER_NUMBER, [0.5, GOALKEEPER_DEPTH]]]);
  const width = RIGHT_LINE - LEFT_LINE;
  lines.forEach((numbers, index) => {
    numbers.forEach((number, i) => {
      positions.set(number, [LEFT_LINE + (width * (i + 0.5)) / numbers.length, lineDepth(index, lines.length)]);
    });
  });
  return positions;
}

export function mirrored(positions) {
  const result = new Map();
  for (const [number, [u, v]] of positions) result.set(number, [1 - u, 1 - v]);
  return result;
}

/** 左边空白区域的 26 个位置，排成两列；1~13 号靠近球场。 */
export function leftBench() {
  const columns = [BENCH_NEAR_COLUMN, BENCH_FAR_COLUMN];
  const positions = [];
  for (let i = 0; i < SQUAD_SIZE; i++) {
    positions.push([columns[Math.floor(i / BENCH_ROWS)], ((i % BENCH_ROWS) + 0.5) / BENCH_ROWS]);
  }
  return positions;
}

export function rightBench() {
  return leftBench().map(([u, v]) => [1 - u, v]);
}

/** 全队 26 人的位置，按默认号码排列：上场的用阵型位置，其余留在场边。 */
export function lineup(bench, starters) {
  const positions = bench.slice();
  for (const [number, pos] of starters) positions[number - 1] = pos;
  return positions;
}

export function topTeamLineup(lines) {
  return lineup(leftBench(), topTeamPositions(lines));
}

export function bottomTeamLineup(lines) {
  return lineup(rightBench(), mirrored(topTeamPositions(lines)));
}
