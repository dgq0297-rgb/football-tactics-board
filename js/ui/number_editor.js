// 改号码：在球员身上弹出一个小输入框，回车或点别处确认，Esc 取消。

const MIN_NUMBER = 1;
const MAX_NUMBER = 99;

function parseNumber(text) {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const number = Number(trimmed);
  return number >= MIN_NUMBER && number <= MAX_NUMBER ? number : null;
}

export class NumberEditor {
  constructor(stage, players, invalidate) {
    this.players = players;
    this.invalidate = invalidate;
    this.player = null;
    this.input = stage.querySelector("#number-input");
    this.hint = stage.querySelector("#number-hint");
    this.input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") this.confirm();
      if (event.key === "Escape") this.close();
    });
    this.input.addEventListener("input", () => this.clearHint());
    this.input.addEventListener("blur", () => this.commit());
  }

  open(player) {
    this.commit();
    this.player = player;
    const [x, y] = player.center();
    this.input.value = String(player.number);
    this.input.style.left = `${x}px`;
    this.input.style.top = `${y}px`;
    this.input.hidden = false;
    this.input.focus();
    this.input.select();
  }

  /** 按回车：号码被占用时提示并继续编辑，否则写入。 */
  confirm() {
    const number = parseNumber(this.input.value);
    if (number !== null && this.players.numberTaken(this.player, number)) this.showTaken(number);
    else this.commit();
  }

  /** 写入合法且没被占用的号码；否则保持原来的号码。 */
  commit() {
    if (this.player === null) return;
    const number = parseNumber(this.input.value);
    if (number !== null && !this.players.numberTaken(this.player, number)) this.player.number = number;
    this.close();
  }

  showTaken(number) {
    const [x, y] = this.player.center();
    this.input.classList.add("is-error");
    this.hint.textContent = `${number}号已有人`;
    this.hint.style.left = `${x}px`;
    this.hint.style.top = `${y}px`;
    this.hint.hidden = false;
  }

  clearHint() {
    this.input.classList.remove("is-error");
    this.hint.hidden = true;
  }

  close() {
    if (this.player === null) return;
    this.player = null;
    this.clearHint();
    this.input.hidden = true;
    this.input.blur();
    this.invalidate();
  }
}
