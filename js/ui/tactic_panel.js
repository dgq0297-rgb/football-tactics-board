// 战术模拟面板：我方一次只选一种战术（进攻或防守），再选对面的打法，并勾选这次是否判越位。
// 对面这么防，会建议我方怎么打；对面这么打，会建议我方怎么防。演示过之后可以从现在的位置接着来，
// 这时球在谁脚下决定谁能选进攻：球在我方脚下只能选进攻战术，球在对面脚下只能选防守战术。

import { ATTACK_TACTICS } from "../data/tactic_data.js";
import { attacksAgainst, attacksMetBy, countersFor, defensesAvailable, defensesMetBy } from "../tactics/shapes.js";
import { button, el, openPanel } from "./dom.js";

export class TacticPanel {
  /**
   * onChoose(choice) 收到选择；isReady() 说明是否已经选好阵型；
   * canContinue() 说明能否接着上一段；possession() 返回现在球在哪队脚下。
   */
  constructor({ onChoose, isReady, canContinue, possession }) {
    this.onChoose = onChoose;
    this.isReady = isReady;
    this.canContinue = canContinue;
    this.possession = possession;
    this.closePanel = null;
    this.body = null;
    this.myHome = true;
    this.tactic = ATTACK_TACTICS[0];
    this.isAttack = true;
    this.opponent = null;
    this.offside = true;
    this.continuing = false;
    this.message = "";
    this.advised = null;
  }

  open() {
    this.close();
    this.body = el("div", { class: "panel-body" });
    this.closePanel = openPanel(this.body, "tactic");
    this.continuing = this.canContinue();
    this.offside = true; // 每次都从默认的“判越位”开始
    this.message = "";
    this.pickAllowedSide();
  }

  close() {
    if (this.closePanel) this.closePanel();
    this.closePanel = null;
  }

  myTeam() {
    return this.myHome ? "red" : "blue";
  }

  /** 接着上一段时，球在我方脚下只能进攻，球在对面脚下只能防守；其他情况都能选。 */
  allowedKinds() {
    const holder = this.continuing ? this.possession() : null;
    if (holder === null) return [true, true];
    return [holder === this.myTeam(), holder !== this.myTeam()];
  }

  /** 选中的战术不能选了，就换成能选的第一个。 */
  pickAllowedSide() {
    const [attackOk, defenseOk] = this.allowedKinds();
    if (this.isAttack && !attackOk) this.selectTactic(defensesAvailable(this.offside)[0], false);
    else if (!this.isAttack && !defenseOk) this.selectTactic(ATTACK_TACTICS[0], true);
    else this.render();
  }

  selectSide(myHome) {
    this.myHome = myHome;
    this.pickAllowedSide();
  }

  selectStart(continuing) {
    this.continuing = continuing && this.canContinue();
    this.pickAllowedSide();
  }

  /** 是和否只能选一个，也不能都不选：点已经选中的那个不会取消。 */
  setOffside(offside) {
    this.offside = offside;
    if (!this.isAttack && !defensesAvailable(offside).includes(this.tactic)) this.tactic = defensesAvailable(offside)[0];
    this.render();
  }

  /** 一次只选一种：选了这个，另一列的选中就没了。换了战术，对面回到它最可能的打法。 */
  selectTactic(tactic, isAttack) {
    this.tactic = tactic;
    this.isAttack = isAttack;
    this.opponent = null;
    this.render();
  }

  selectOpponent(tactic) {
    this.opponent = tactic;
    this.render();
  }

  opponentOptions() {
    return this.isAttack ? defensesMetBy(this.tactic, this.offside) : attacksMetBy(this.tactic);
  }

  /** 按建议换我方战术，对面的打法不变。 */
  takeAdvice() {
    this.tactic = this.advised;
    this.render();
  }

  confirm() {
    if (!this.isReady()) {
      this.message = "请先在顶部选择人制和阵型";
      this.render();
      return;
    }
    const choice = {
      myHome: this.myHome, tactic: this.tactic, isAttack: this.isAttack,
      opponent: this.opponent, offside: this.offside, continuing: this.continuing,
    };
    this.close();
    this.onChoose(choice);
  }

  toggleButton(text, isOn, onclick) {
    const element = button(text, onclick);
    element.classList.toggle("is-on", isOn);
    return element;
  }

  render() {
    const options = this.opponentOptions();
    if (!options.includes(this.opponent)) this.opponent = options[0];
    const startChoice = this.canContinue() ? [this.renderStart()] : [];
    this.body.replaceChildren(
      el("h2", {}, "战术模拟：我方一次选一种战术，再选对面的打法"),
      this.renderSide(),
      ...startChoice,
      this.renderOffside(),
      el("div", { class: "tactic-columns" }, this.renderAttacks(), this.renderDefenses(), this.renderOpponent(options)),
      el("div", { class: "hint is-error" }, this.message),
      el("div", { class: "panel-actions" }, button("开始模拟", () => this.confirm(), "btn btn-primary"), button("取消", () => this.close())),
    );
  }

  renderSide() {
    return el("div", { class: "option-row" }, el("span", {}, "我方是"),
      this.toggleButton("主场", this.myHome, () => this.selectSide(true)),
      this.toggleButton("客场", !this.myHome, () => this.selectSide(false)));
  }

  renderStart() {
    return el("div", { class: "option-row" }, el("span", {}, "从哪开始"),
      this.toggleButton("现在的位置", this.continuing, () => this.selectStart(true)),
      this.toggleButton("阵型站位", !this.continuing, () => this.selectStart(false)));
  }

  renderOffside() {
    const box = (text, value) => el("label", { class: "check" },
      el("input", { type: "checkbox", checked: this.offside === value, onclick: () => this.setOffside(value) }), text);
    return el("div", { class: "option-row" }, el("span", {}, "是否判越位"), box("是", true), box("否", false));
  }

  renderList(tactics, isAttack, allowed) {
    const grid = el("div", { class: "tactic-list" });
    for (const tactic of tactics) {
      const chosen = this.isAttack === isAttack && this.tactic === tactic;
      const item = this.toggleButton(tactic.name, chosen, () => this.selectTactic(tactic, isAttack));
      item.disabled = !allowed;
      grid.append(item);
    }
    return grid;
  }

  renderAttacks() {
    return el("section", { class: "panel-column" }, el("h3", {}, "我方进攻战术"), this.renderList(ATTACK_TACTICS, true, this.allowedKinds()[0]));
  }

  renderDefenses() {
    return el("section", { class: "panel-column" }, el("h3", {}, "我方防守战术"), this.renderList(defensesAvailable(this.offside), false, this.allowedKinds()[1]));
  }

  renderOpponent(options) {
    const grid = el("div", { class: "tactic-list" });
    for (const tactic of options) grid.append(this.toggleButton(tactic.name, tactic === this.opponent, () => this.selectOpponent(tactic)));
    return el("section", { class: "panel-column" }, el("h3", {}, `对面的${this.isAttack ? "防守" : "进攻"}打法`), grid,
      el("p", { class: "note" }, this.tactic.description), this.renderAdvice());
  }

  /** 对面这么防，建议我方怎么打；对面这么打，建议我方怎么防。 */
  renderAdvice() {
    const [best, reason] = this.isAttack ? attacksAgainst(this.opponent)[0] : countersFor(this.opponent, this.offside)[0];
    this.advised = best;
    const text = `对面${this.opponent.name}时，建议${this.isAttack ? "打" : "防"}${best.name}：${reason}`;
    return el("div", {}, el("p", { class: "note" }, text), best === this.tactic ? null : button("改选这个", () => this.takeAdvice()));
  }
}
