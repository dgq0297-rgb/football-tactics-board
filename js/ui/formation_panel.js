// 选完人制后弹出的面板：主场和客场分别选阵型和球衣颜色。
// 阵型可以点常见阵型，也可以从后场开始填人数；门将固定 1 人，不用填。

import { FORMATIONS, countProblem, customLines, outfieldCount, parseCount, shapeOf } from "../data/formations.js";
import { JERSEYS } from "../data/jerseys.js";
import { button, el, openPanel } from "./dom.js";

const LINE_NAMES = ["后场", "中场", "前场"];

/** 面板里的一列：一支球队的阵型和球衣。 */
class TeamChoice {
  constructor(title, size, jersey, onConfirm) {
    this.size = size;
    this.onConfirm = onConfirm;
    this.preset = FORMATIONS.get(size)[0];
    this.jersey = jersey;
    this.presetButtons = new Map();
    this.jerseyButtons = new Map();
    this.entries = [];
    this.hint = el("div", { class: "hint" });
    this.element = el("section", { class: "panel-column" },
      el("h3", {}, title), this.createPresets(), this.createCustomInputs(), this.hint, this.createJerseys());
    this.showSelection();
  }

  createPresets() {
    const grid = el("div", { class: "choice-grid" });
    FORMATIONS.get(this.size).forEach((lines, index) => {
      const text = shapeOf(lines) + (index === 0 ? "（最常见）" : "");
      const preset = button(text, () => this.selectPreset(lines));
      this.presetButtons.set(lines, preset);
      grid.append(preset);
    });
    return grid;
  }

  createCustomInputs() {
    const row = el("div", { class: "count-row" });
    for (const name of LINE_NAMES) {
      const entry = el("input", {
        type: "text", inputMode: "numeric", class: "count-input", "aria-label": name,
        oninput: () => this.showSelection(),
        onkeydown: (event) => { if (event.key === "Enter") this.onConfirm(); },
      });
      this.entries.push(entry);
      row.append(el("label", {}, name, entry));
    }
    return el("div", {}, el("p", { class: "note" }, `或自己填人数（门将之外共 ${outfieldCount(this.size)} 人）`), row);
  }

  createJerseys() {
    const grid = el("div", { class: "jersey-grid" });
    for (const [name, jersey] of Object.entries(JERSEYS)) {
      const swatch = button(name, () => this.selectJersey(name), "jersey-btn");
      swatch.style.background = jersey.fill;
      swatch.style.color = jersey.text;
      this.jerseyButtons.set(name, swatch);
      grid.append(swatch);
    }
    return el("div", {}, el("p", { class: "note" }, "球衣颜色"), grid);
  }

  /** 点常见阵型时清掉填的人数。 */
  selectPreset(lines) {
    this.preset = lines;
    this.entries.forEach((entry) => { entry.value = ""; });
    this.showSelection();
  }

  selectJersey(name) {
    this.jersey = name;
    this.showSelection();
  }

  customActive() {
    return this.entries.some((entry) => entry.value.trim());
  }

  readCounts() {
    return this.entries.map((entry) => parseCount(entry.value));
  }

  problem() {
    return this.customActive() ? countProblem(this.size, this.readCounts()) : null;
  }

  /** 填了人数就以人数为准，否则高亮选中的常见阵型。 */
  showSelection(isError = false) {
    const custom = this.customActive();
    for (const [lines, preset] of this.presetButtons) preset.classList.toggle("is-on", lines === this.preset && !custom);
    for (const [name, swatch] of this.jerseyButtons) swatch.textContent = name === this.jersey ? `✓${name}` : name;
    this.hint.textContent = custom ? this.problem() || "人数正好" : "";
    this.hint.classList.toggle("is-error", isError);
  }

  pick() {
    const lines = this.customActive() ? customLines(this.size, ...this.readCounts()) : this.preset;
    return { lines, jersey: this.jersey };
  }
}

export class FormationPanel {
  /** onChoose(size, home, away) 收到人制和两队的选择；currentJerseys() 返回两队现在的球衣。 */
  constructor(onChoose, currentJerseys) {
    this.onChoose = onChoose;
    this.currentJerseys = currentJerseys;
    this.closePanel = null;
    this.teams = [];
    this.size = null;
    this.message = null;
  }

  open(size) {
    this.close();
    this.size = size;
    const [homeJersey, awayJersey] = this.currentJerseys();
    const confirm = () => this.confirm();
    this.teams = [new TeamChoice("主场", size, homeJersey, confirm), new TeamChoice("客场", size, awayJersey, confirm)];
    this.message = el("div", { class: "hint is-error" });
    this.closePanel = openPanel(el("div", { class: "panel-body" },
      el("h2", {}, `${size}人制：选择阵型和球衣（门将固定 1 人）`),
      el("div", { class: "panel-columns" }, this.teams[0].element, this.teams[1].element),
      this.message,
      el("div", { class: "panel-actions" }, button("确定", confirm, "btn btn-primary"), button("取消", () => this.close()))), "formation");
  }

  close() {
    if (this.closePanel) this.closePanel();
    this.closePanel = null;
  }

  /** 两队人数都对、球衣不同色才摆放。 */
  confirm() {
    const [home, away] = this.teams;
    this.teams.forEach((team) => team.showSelection(Boolean(team.problem())));
    const sameJersey = home.jersey === away.jersey;
    this.message.textContent = sameJersey ? "两队球衣不能同色" : "";
    if (home.problem() || away.problem() || sameJersey) return;
    const picks = [home.pick(), away.pick()];
    this.close();
    this.onChoose(this.size, picks[0], picks[1]);
  }
}
