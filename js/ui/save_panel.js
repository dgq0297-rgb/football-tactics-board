// 存档面板：存到这台设备的浏览器里，也可以导出成文件、导入文件。
// 微信里下载文件不方便，所以主要靠浏览器存档；换设备或发给别人才用文件。

import { applyState, collectState, parseState } from "../game/save_state.js";
import { button, el, openPanel } from "./dom.js";

const STORAGE_KEY = "football-tactics-saves";

function readSaves() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function writeSaves(saves) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saves));
    return true;
  } catch {
    return false;
  }
}

function timestamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${now.getMonth() + 1}月${now.getDate()}日 ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

export class SavePanel {
  constructor(pieces, menu, invalidate) {
    this.pieces = pieces;
    this.menu = menu;
    this.invalidate = invalidate;
    this.closePanel = null;
    this.body = null;
    this.message = "";
  }

  open() {
    this.close();
    this.pieces.editor.commit();
    this.message = "";
    this.body = el("div", { class: "panel-body" });
    this.closePanel = openPanel(this.body, "save");
    this.render();
  }

  close() {
    if (this.closePanel) this.closePanel();
    this.closePanel = null;
  }

  saveToBrowser() {
    const label = this.menu.detail ? `${this.menu.options.get(this.menu.current)}（${this.menu.detail}）` : "未选阵型";
    const saves = readSaves();
    saves.unshift({ name: `${timestamp()} ${label}`, state: collectState(this.pieces, this.menu) });
    this.message = writeSaves(saves) ? "已保存到这台设备" : "这个浏览器不允许保存，请用“导出文件”";
    this.render();
  }

  openSave(save) {
    try {
      applyState(this.pieces, this.menu, parseState(JSON.stringify(save.state)));
      this.invalidate();
      this.close();
    } catch (error) {
      this.message = `打开失败：${error.message}`;
      this.render();
    }
  }

  deleteSave(index) {
    const saves = readSaves();
    saves.splice(index, 1);
    writeSaves(saves);
    this.render();
  }

  exportFile() {
    const text = JSON.stringify(collectState(this.pieces, this.menu), null, 2);
    const link = el("a", { href: URL.createObjectURL(new Blob([text], { type: "application/json" })), download: "战术存档.json" });
    document.body.append(link);
    link.click();
    link.remove();
    this.message = "已导出。如果没有下载（微信里常见），请用手机浏览器打开这个网页再导出";
    this.render();
  }

  importFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        applyState(this.pieces, this.menu, parseState(String(reader.result)));
        this.invalidate();
        this.close();
      } catch (error) {
        this.message = `打开失败：${error.message}`;
        this.render();
      }
    };
    reader.readAsText(file);
  }

  render() {
    const saves = readSaves();
    const list = saves.length
      ? el("ul", { class: "save-list" }, ...saves.map((save, index) => el("li", {},
        el("span", { class: "save-name" }, save.name),
        button("打开", () => this.openSave(save)),
        button("删除", () => this.deleteSave(index)))))
      : el("p", { class: "note" }, "还没有存档。点“保存当前”把现在的站位和轨迹存下来。");
    const picker = el("input", { type: "file", accept: ".json,application/json", hidden: true, onchange: (event) => this.importFile(event.target.files[0]) });
    this.body.replaceChildren(
      el("h2", {}, "存档"),
      el("div", { class: "panel-actions" }, button("保存当前", () => this.saveToBrowser(), "btn btn-primary"),
        button("导出文件", () => this.exportFile()), button("导入文件", () => picker.click()), picker),
      el("div", { class: "hint" }, this.message),
      list,
      el("div", { class: "panel-actions" }, button("关闭", () => this.close())),
    );
  }
}
