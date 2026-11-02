// 进攻战术的逐步脚本，按场地大小分三组。
//
// 位置都在进攻方视角：x 从 0（进攻方的右路）到 1（左路），depth 从 0（本方球门）到 1（对方球门）。
// 每一步：说明文字、球的动作（带球或传球）、点名球员的目标位置、全队整体前压多少。

function step(caption, ball, moves, advance) {
  return { caption, ball, moves, advance };
}
const carry = (role, target) => ["carry", role, target];
const pass = (giver, receiver) => ["pass", giver, receiver];

/** 人制越小，场上空间和人数越少，打法也不同：大场靠多条线配合，小场靠全员轮转。 */
export function fieldGroup(size) {
  if (size >= 9) return "large";
  return size >= 7 ? "medium" : "small";
}

export const SCRIPTS = {
  // 11、9 人制：有完整的边后卫、中场和锋线，换位主要是边锋内收、中锋回撤、边后卫内收或套边
  large: {
    边路进攻: [
      step("{wing}号持球沿边路向前推进，全队跟着压上", carry("wing", [0.08, 0.60]), { rb: [0.14, 0.46] }, 0.07),
      step("{wing}号带球内收到中场，{playmaker}号换位拉到边路，{rb}号沿边线插上", carry("wing", [0.32, 0.68]),
        { playmaker: [0.12, 0.72], rb: [0.06, 0.64], striker: [0.45, 0.78], far: [0.74, 0.74] }, 0.05),
      step("{wing}号分给套上来的{rb}号，自己前插禁区", pass("wing", "rb"),
        { rb: [0.06, 0.80], wing: [0.34, 0.80], holder: [0.38, 0.62] }, 0.03),
      step("{rb}号下底传中，{striker}号抢前点，{far}号包抄后点，{wing}号守弧顶", pass("rb", "striker"),
        { striker: [0.44, 0.90], far: [0.64, 0.88], wing: [0.38, 0.78] }, 0.02),
    ],
    破阵地防守: [
      step("{cb}号后场横传给{holder}号，全队压上耐心找空当", pass("cb", "holder"), { holder: [0.50, 0.50] }, 0.04),
      step("{holder}号转移到弱侧，{far}号内收到肋部，{lb}号换位拉到边线接球", pass("holder", "lb"),
        { lb: [0.92, 0.66], far: [0.66, 0.72], wing: [0.08, 0.72] }, 0.03),
      step("{lb}号回传内收的{far}号，{striker}号回撤到中场带走中卫，{playmaker}号前插填补", pass("lb", "far"),
        { far: [0.62, 0.76], striker: [0.50, 0.68], playmaker: [0.46, 0.84] }, 0.02),
      step("{far}号直塞，{playmaker}号接球，{wing}号从另一侧后插", pass("far", "playmaker"),
        { playmaker: [0.44, 0.90], wing: [0.30, 0.88] }, 0.01),
    ],
    控球推进: [
      step("{cb}号持球向前，{holder}号回撤到两名中卫之间，边后卫压上", carry("cb", [0.38, 0.36]),
        { holder: [0.54, 0.30], cb2: [0.72, 0.32], rb: [0.08, 0.50], lb: [0.92, 0.50] }, 0.03),
      step("{cb}号传给内收到中场的{rb}号，{wing}号留在边路拉开", pass("cb", "rb"),
        { rb: [0.34, 0.50], wing: [0.06, 0.62] }, 0.05),
      step("{rb}号分给{playmaker}号，{far}号内切和{lb}号换位", pass("rb", "playmaker"),
        { playmaker: [0.44, 0.64], far: [0.66, 0.72], lb: [0.90, 0.66] }, 0.05),
      step("{playmaker}号传给{striker}号后前插，两人撞墙配合", pass("playmaker", "striker"),
        { striker: [0.55, 0.76], playmaker: [0.44, 0.78] }, 0.03),
      step("{striker}号回敲，{playmaker}号接球进入禁区", pass("striker", "playmaker"),
        { playmaker: [0.46, 0.88], striker: [0.58, 0.86] }, 0.02),
    ],
    快速反击: [
      step("{holder}号抢断后立刻抬头，{striker}号和两翼开始冲刺", carry("holder", [0.50, 0.38]),
        { striker: [0.45, 0.68], wing: [0.15, 0.60], far: [0.85, 0.60] }, 0.02),
      step("{holder}号长传身后，{striker}号拉向边路接球，{wing}号斜插中路换位", pass("holder", "striker"),
        { striker: [0.14, 0.76], wing: [0.44, 0.78] }, 0.03),
      step("{striker}号沿边路带球直插，{far}号从另一侧跟进", carry("striker", [0.20, 0.86]), { far: [0.74, 0.82] }, 0.05),
      step("{striker}号横传，{wing}号包抄抢点", pass("striker", "wing"), { wing: [0.50, 0.92], far: [0.66, 0.88] }, 0.03),
    ],
    中路渗透: [
      step("{holder}号持球沿中路推进，两翼向中路靠拢", carry("holder", [0.50, 0.52]),
        { wing: [0.34, 0.68], far: [0.66, 0.68] }, 0.05),
      step("{holder}号传给回撤到中场的{striker}号，{playmaker}号前插顶到中锋位置", pass("holder", "striker"),
        { striker: [0.48, 0.62], playmaker: [0.50, 0.78] }, 0.04),
      step("{striker}号转身分给内收的{wing}号", pass("striker", "wing"), { wing: [0.38, 0.76] }, 0.02),
      step("{wing}号直塞，{playmaker}号打穿防线", pass("wing", "playmaker"),
        { playmaker: [0.48, 0.90], far: [0.62, 0.86] }, 0.02),
    ],
    长传冲吊: [
      step("{cb}号后场直接长传找{striker}号", pass("cb", "striker"), { striker: [0.50, 0.78] }, 0.03),
      step("{striker}号头球摆渡，{far}号内收到中路抢第二落点", pass("striker", "far"),
        { far: [0.56, 0.72], lb: [0.90, 0.66] }, 0.04),
      step("{far}号分给插上的{lb}号，{striker}号压进禁区", pass("far", "lb"),
        { lb: [0.90, 0.80], striker: [0.50, 0.86] }, 0.02),
      step("{lb}号传中，{striker}号抢点，{wing}号包抄", pass("lb", "striker"),
        { striker: [0.50, 0.92], wing: [0.34, 0.88] }, 0.01),
    ],
  },
  // 8、7 人制：线少、场地小，靠中场和边路互相换位，少了边后卫大范围套边
  medium: {
    边路进攻: [
      step("{wing}号持球沿边路推进，{playmaker}号靠过来接应", carry("wing", [0.10, 0.60]), { playmaker: [0.30, 0.52] }, 0.06),
      step("{wing}号和{playmaker}号换位：{wing}号内收到中路，{playmaker}号拉到边路", carry("wing", [0.38, 0.66]),
        { playmaker: [0.10, 0.66], rb: [0.18, 0.46], striker: [0.48, 0.76] }, 0.04),
      step("{wing}号分给边路的{playmaker}号，自己前插", pass("wing", "playmaker"),
        { playmaker: [0.08, 0.80], wing: [0.42, 0.78] }, 0.03),
      step("{playmaker}号传中，{striker}号和{wing}号抢点", pass("playmaker", "striker"),
        { striker: [0.44, 0.90], wing: [0.58, 0.86] }, 0.02),
    ],
    破阵地防守: [
      step("{rb}号横传给{lb}号，把对方防线拉向一侧", pass("rb", "lb"), { lb: [0.88, 0.50] }, 0.05),
      step("{lb}号传给内收的{far}号，自己沿边线套上", pass("lb", "far"), { far: [0.70, 0.66], lb: [0.92, 0.62] }, 0.03),
      step("{far}号分回套上来的{lb}号，{striker}号前插牵制", pass("far", "lb"),
        { lb: [0.92, 0.76], striker: [0.44, 0.82] }, 0.02),
      step("{lb}号倒三角回传，{wing}号从后点插入", pass("lb", "wing"), { wing: [0.40, 0.86] }, 0.01),
    ],
    控球推进: [
      step("{rb}号持球向前，{playmaker}号回撤接应", carry("rb", [0.30, 0.38]), { playmaker: [0.50, 0.46] }, 0.03),
      step("{rb}号传给{playmaker}号，两翼同时拉开前压", pass("rb", "playmaker"),
        { playmaker: [0.50, 0.54], wing: [0.12, 0.66], far: [0.88, 0.66] }, 0.04),
      step("{playmaker}号传给回撤的{striker}号，{wing}号内收前插换到中锋位置", pass("playmaker", "striker"),
        { striker: [0.50, 0.62], wing: [0.34, 0.78] }, 0.03),
      step("{striker}号直塞，{wing}号接球进入禁区", pass("striker", "wing"), { wing: [0.38, 0.88] }, 0.02),
    ],
    快速反击: [
      step("{playmaker}号抢断后带球，两翼和{striker}号开始冲刺", carry("playmaker", [0.50, 0.42]),
        { wing: [0.14, 0.62], far: [0.86, 0.62], striker: [0.50, 0.70] }, 0.02),
      step("{playmaker}号直传边路，{wing}号接球", pass("playmaker", "wing"), { wing: [0.12, 0.76] }, 0.03),
      step("{wing}号斜向中路带球，{striker}号拉开换到右侧", carry("wing", [0.28, 0.84]), { striker: [0.56, 0.84] }, 0.04),
      step("{wing}号横传，{striker}号抢点，{far}号跟进", pass("wing", "striker"),
        { striker: [0.50, 0.92], far: [0.70, 0.86] }, 0.02),
    ],
    中路渗透: [
      step("{playmaker}号持球沿中路推进，两翼内收", carry("playmaker", [0.50, 0.52]),
        { wing: [0.36, 0.64], far: [0.64, 0.64] }, 0.05),
      step("{playmaker}号传给回撤的{striker}号，{wing}号前插换位", pass("playmaker", "striker"),
        { striker: [0.50, 0.68], wing: [0.40, 0.78] }, 0.03),
      step("{striker}号横敲给{far}号", pass("striker", "far"), { far: [0.60, 0.76] }, 0.02),
      step("{far}号直塞，{wing}号打穿防线", pass("far", "wing"), { wing: [0.44, 0.90] }, 0.01),
    ],
    长传冲吊: [
      step("{rb}号长传找{striker}号", pass("rb", "striker"), { striker: [0.50, 0.76] }, 0.03),
      step("{striker}号摆渡，{wing}号斜插到另一侧肋部抢第二落点，{far}号换到右路", pass("striker", "wing"),
        { wing: [0.60, 0.70], far: [0.14, 0.70] }, 0.04),
      step("{wing}号分回右路的{far}号，{striker}号压进禁区", pass("wing", "far"),
        { far: [0.12, 0.78], striker: [0.50, 0.86] }, 0.02),
      step("{far}号传中，{striker}号抢点", pass("far", "striker"), { striker: [0.50, 0.92] }, 0.01),
    ],
  },
  // 6、5 人制：人少空间小，靠传切和全员轮转，前面有支点，后卫也会插上
  small: {
    边路进攻: [
      step("{wing}号持球沿边线推进，{rb}号上提保护", carry("wing", [0.10, 0.60]), { rb: [0.40, 0.44] }, 0.05),
      step("{wing}号传给支点{striker}号后内切，和{far}号轮转换位", pass("wing", "striker"),
        { striker: [0.50, 0.76], wing: [0.44, 0.68], far: [0.12, 0.66] }, 0.03),
      step("{striker}号分给轮转到边路的{far}号", pass("striker", "far"), { far: [0.10, 0.80] }, 0.02),
      step("{far}号横传，{wing}号后插抢点", pass("far", "wing"), { wing: [0.46, 0.90] }, 0.01),
    ],
    破阵地防守: [
      step("{rb}号分给{far}号，全队开始轮转", pass("rb", "far"), { far: [0.88, 0.56] }, 0.04),
      step("{far}号横穿中路传给{wing}号，{rb}号前提到中场", pass("far", "wing"),
        { wing: [0.12, 0.62], rb: [0.48, 0.52] }, 0.03),
      step("{wing}号传给支点{striker}号后内切", pass("wing", "striker"),
        { striker: [0.50, 0.80], wing: [0.30, 0.76] }, 0.02),
      step("{striker}号背身回做，{rb}号后插射门", pass("striker", "rb"), { rb: [0.46, 0.84] }, 0.01),
    ],
    控球推进: [
      step("{rb}号持球向前，两翼拉开", carry("rb", [0.46, 0.40]), { wing: [0.12, 0.52], far: [0.88, 0.52] }, 0.03),
      step("{rb}号传给边路的{wing}号后跟上", pass("rb", "wing"), { wing: [0.12, 0.64], rb: [0.40, 0.54] }, 0.03),
      step("{wing}号传给{striker}号后斜插到另一侧，传切换位", pass("wing", "striker"),
        { striker: [0.46, 0.74], wing: [0.62, 0.72] }, 0.02),
      step("{striker}号回敲，{wing}号接球进入禁区", pass("striker", "wing"), { wing: [0.56, 0.86] }, 0.01),
    ],
    快速反击: [
      step("{rb}号抢断后立刻带球，{striker}号和两翼冲刺", carry("rb", [0.50, 0.38]),
        { striker: [0.50, 0.72], wing: [0.14, 0.58], far: [0.86, 0.58] }, 0.02),
      step("{rb}号直传前场的{striker}号", pass("rb", "striker"), { striker: [0.50, 0.78] }, 0.03),
      step("{striker}号带球斜插，两翼交叉换位跟进", carry("striker", [0.52, 0.84]), { wing: [0.82, 0.78], far: [0.18, 0.78] }, 0.03),
      step("{striker}号横传，换到右路的{far}号抢点", pass("striker", "far"), { far: [0.34, 0.87] }, 0.01),
    ],
    中路渗透: [
      step("{rb}号持球沿中路推进，两翼内收", carry("rb", [0.50, 0.50]), { wing: [0.30, 0.60], far: [0.70, 0.60] }, 0.04),
      step("{rb}号传给支点{striker}号后跟上", pass("rb", "striker"), { striker: [0.50, 0.74], rb: [0.50, 0.60] }, 0.03),
      step("{striker}号分给前插的{wing}号", pass("striker", "wing"), { wing: [0.40, 0.76] }, 0.02),
      step("{wing}号回做，{rb}号后插打穿防线", pass("wing", "rb"), { rb: [0.46, 0.88] }, 0.01),
    ],
    长传冲吊: [
      step("{rb}号长传找前场支点{striker}号", pass("rb", "striker"), { striker: [0.50, 0.78] }, 0.03),
      step("{striker}号摆渡，{wing}号斜插到另一侧抢第二落点，{far}号轮转到右路", pass("striker", "wing"),
        { wing: [0.62, 0.70], far: [0.14, 0.68] }, 0.03),
      step("{wing}号分回轮转到右路的{far}号", pass("wing", "far"), { far: [0.12, 0.78] }, 0.02),
      step("{far}号传中，{striker}号抢点", pass("far", "striker"), { striker: [0.50, 0.90] }, 0.01),
    ],
  },
};
