// 顶部的人制菜单：鼠标指上去或手指点一下展开下拉，点一项就选中。

import { el } from "./dom.js";

const NO_SELECTION = "选择人制";
const HIDE_DELAY_MS = 150;

export class FormatMenu {
  constructor(root, options, onSelect) {
    this.options = options;
    this.onSelect = onSelect;
    this.current = null;
    this.detail = null;
    this.hideJob = null;
    this.trigger = root.querySelector("#format-trigger");
    this.dropdown = root.querySelector("#format-dropdown");
    this.rows = [...options].map(([option, text]) => {
      const row = el("button", { type: "button", class: "dropdown-row", onclick: () => this.select(option) }, text);
      this.dropdown.append(row);
      return row;
    });
    this.bindHover(root.querySelector("#format-menu"));
    this.trigger.addEventListener("click", () => this.toggle());
    this.showCurrent(null, null);
  }

  bindHover(area) {
    // 触屏上的点按也可能带着鼠标事件，只响应真正的鼠标
    area.addEventListener("pointerenter", (event) => { if (event.pointerType === "mouse") this.show(); });
    area.addEventListener("pointerleave", (event) => { if (event.pointerType === "mouse") this.scheduleHide(); });
    document.addEventListener("pointerdown", (event) => { if (!area.contains(event.target)) this.hide(); });
  }

  toggle() {
    if (this.dropdown.hidden) this.show();
  }

  show() {
    clearTimeout(this.hideJob);
    this.dropdown.hidden = false;
  }

  scheduleHide() {
    clearTimeout(this.hideJob);
    this.hideJob = setTimeout(() => this.hide(), HIDE_DELAY_MS);
  }

  hide() {
    clearTimeout(this.hideJob);
    this.dropdown.hidden = true;
  }

  select(option) {
    this.hide();
    this.onSelect(option);
  }

  /** 记下当前选项和补充说明并显示在菜单上；null 表示还没选。 */
  showCurrent(option, detail) {
    this.current = option;
    this.detail = detail;
    let text = option === null ? NO_SELECTION : this.options.get(option);
    if (detail) text += `（${detail}）`;
    this.trigger.textContent = `${text} ▾`;
  }
}
