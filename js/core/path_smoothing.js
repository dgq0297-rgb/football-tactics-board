// 拖动轨迹的处理：保留弧线的走向，只磨平手抖产生的噪点。坐标都是画布像素。

const MIN_STEP = 8; // 相邻两点至少隔这么多像素，更近的点多半是手抖
const SMOOTH_PASSES = 3;

function dist(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

export function pathLength(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += dist(points[i - 1], points[i]);
  return total;
}

function thinPoints(points) {
  const kept = [points[0]];
  for (const point of points.slice(1, -1)) {
    if (dist(point, kept[kept.length - 1]) >= MIN_STEP) kept.push(point);
  }
  const last = points[points.length - 1];
  if (kept.length > 1 && dist(last, kept[kept.length - 1]) < MIN_STEP) kept.pop();
  kept.push(last);
  return kept;
}

function smoothOnce(points) {
  const result = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const [before, point, after] = [points[i - 1], points[i], points[i + 1]];
    result.push([(before[0] + 2 * point[0] + after[0]) / 4, (before[1] + 2 * point[1] + after[1]) / 4]);
  }
  result.push(points[points.length - 1]);
  return result;
}

/** 先去掉过密的点，再反复磨平，首尾两点不动。 */
export function cleanPath(points) {
  let result = thinPoints(points);
  for (let i = 0; i < SMOOTH_PASSES; i++) result = smoothOnce(result);
  return result;
}

/** 沿路径走到总长的 fraction 处，返回该点和这一段的方向 [x, y, dx, dy]。 */
export function pointAlong(points, fraction) {
  let remaining = pathLength(points) * fraction;
  for (let i = 1; i < points.length; i++) {
    const [a, b] = [points[i - 1], points[i]];
    const step = dist(a, b);
    if (step > 0 && remaining <= step) {
      const t = remaining / step;
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, b[0] - a[0], b[1] - a[1]];
    }
    remaining -= step;
  }
  const [a, b] = [points[points.length - 2], points[points.length - 1]];
  return [b[0], b[1], b[0] - a[0], b[1] - a[1]];
}
