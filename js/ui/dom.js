// 创建界面元素的小工具。

/** el("div", { class: "x", onclick: fn }, "文字", 子元素...) */
export function el(tag, props = {}, ...children) {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key.startsWith("on")) element.addEventListener(key.slice(2), value);
    else if (key === "class") element.className = value;
    else if (key in element && key !== "list") element[key] = value;
    else element.setAttribute(key, value);
  }
  for (const child of children) {
    if (child !== null && child !== undefined) element.append(child);
  }
  return element;
}

export function button(text, onclick, className = "btn") {
  return el("button", { type: "button", class: className, onclick }, text);
}

/** 打开一个居中的面板，返回关闭它的函数。 */
export function openPanel(content, name) {
  const backdrop = el("div", { class: "panel-backdrop", "data-panel": name }, el("div", { class: "panel" }, content));
  document.body.append(backdrop);
  return () => backdrop.remove();
}
