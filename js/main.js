// 入口：创建各个模块，把它们之间的通知接好，再绑定顶部的按钮。

import { Board } from "./core/board.js";
import { FORMATIONS, bottomTeamLineup, leftBench, rightBench, shapeOf, topTeamLineup } from "./data/formations.js";
import { Ball } from "./game/ball.js";
import { Players } from "./game/players.js";
import { Trails } from "./game/trails.js";
import { buildSimulation } from "./tactics/simulation.js";
import { FormatMenu } from "./ui/format_menu.js";
import { FormationPanel } from "./ui/formation_panel.js";
import { NumberEditor } from "./ui/number_editor.js";
import { PointerControl } from "./ui/pointer.js";
import { Renderer } from "./ui/renderer.js";
import { SavePanel } from "./ui/save_panel.js";
import { TacticPanel } from "./ui/tactic_panel.js";
import { TacticPlayer } from "./ui/tactic_player.js";

function createPieces(stage, captionBar) {
  const board = new Board();
  const players = new Players(board);
  const ball = new Ball(board, players);
  const trails = new Trails(board);
  const pieces = { board, players, ball, trails };
  const invalidate = () => pieces.renderer.invalidate();
  pieces.editor = new NumberEditor(stage, players, invalidate);
  pieces.simulator = new TacticPlayer(captionBar, pieces, invalidate);
  pieces.renderer = new Renderer(stage.querySelector("#board"), pieces);
  players.onDrop = (player, path) => ball.playerDropped(player, path);
  players.onClick = (player) => pieces.editor.open(player);
  ball.onTravel = (path, from, to) => trails.recordTravel(path, from, to);
  ball.onCarry = (path, team, slot) => trails.recordCarry(path, team, slot);
  ball.onCatch = (team) => trails.receive(team);
  ball.onRun = (path, team, slot) => trails.recordRun(path, team, slot);
  return pieces;
}

/** 给两队换上选好的球衣、摆成选好的阵型，足球回到中圈，轨迹清空。主场在上半场，客场在下半场。 */
function applyFormation(pieces, home, away) {
  const { players, ball, trails, simulator, editor, renderer } = pieces;
  simulator.reset();
  editor.commit();
  players.setJerseys(home.jersey, away.jersey);
  players.setFormations(home.lines, away.lines);
  players.setLineups(topTeamLineup(home.lines), bottomTeamLineup(away.lines));
  ball.reset();
  trails.clear();
  renderer.invalidate();
}

/** 所有球员回到当前阵型的站位（还没选阵型就回到场边），足球回中圈，正在放的演示结束。 */
function restorePositions(pieces) {
  const { players, ball, simulator, editor, renderer } = pieces;
  simulator.reset();
  editor.commit();
  if (players.hasFormations()) players.setLineups(topTeamLineup(players.homeLines), bottomTeamLineup(players.awayLines));
  else players.setLineups(leftBench(), rightBench());
  ball.reset();
  renderer.invalidate();
}

/** 按选好的战术一步步演示：我方防守时会在中途断球，我方进攻时可以随时点“这里断球”。 */
function applyTactics(pieces, choice) {
  const { players, simulator, editor } = pieces;
  editor.commit();
  const [attack, defense] = choice.isAttack ? [choice.tactic, choice.opponent] : [choice.opponent, choice.tactic];
  const homeAttacks = choice.isAttack ? choice.myHome : !choice.myHome;
  const attackingTeam = homeAttacks ? "red" : "blue";
  simulator.play(buildSimulation({
    homeLines: players.homeLines,
    awayLines: players.awayLines,
    homeAttacks,
    attack,
    defense,
    numberOf: (team, slot) => players.numberOf(team, slot),
    offside: choice.offside,
    current: choice.continuing ? simulator.currentState(attackingTeam) : null,
    steal: !choice.isAttack,
  }));
}

function createMenu(pieces) {
  const { players } = pieces;
  const options = new Map([...FORMATIONS.keys()].map((size) => [size, `${size}人制`]));
  const panel = new FormationPanel((size, home, away) => {
    applyFormation(pieces, home, away);
    menu.showCurrent(size, `${shapeOf(home.lines)} / ${shapeOf(away.lines)}`);
  }, () => [players.jerseys.red, players.jerseys.blue]);
  const menu = new FormatMenu(document.querySelector("#toolbar"), options, (size) => panel.open(size));
  menu.panel = panel;
  return menu;
}

function bindLineSwitches(pieces) {
  const { trails, renderer } = pieces;
  const buttons = {
    ballOn: document.querySelector("#ball-on"), ballOff: document.querySelector("#ball-off"),
    playerOn: document.querySelector("#player-on"), playerOff: document.querySelector("#player-off"),
  };
  buttons.ballOn.addEventListener("click", () => trails.setBallLines(true));
  buttons.ballOff.addEventListener("click", () => trails.setBallLines(false));
  buttons.playerOn.addEventListener("click", () => trails.setPlayerLines(true));
  buttons.playerOff.addEventListener("click", () => trails.setPlayerLines(false));
  const show = () => {
    buttons.ballOn.classList.toggle("is-on", trails.ballLines);
    buttons.ballOff.classList.toggle("is-on", !trails.ballLines);
    buttons.playerOn.classList.toggle("is-on", trails.playerLines);
    buttons.playerOff.classList.toggle("is-on", !trails.playerLines);
    renderer.invalidate();
  };
  trails.onLinesChange = show;
  show();
}

function createTacticPanel(pieces) {
  const { simulator, players } = pieces;
  const panel = new TacticPanel({
    onChoose: (choice) => applyTactics(pieces, choice),
    isReady: () => players.hasFormations(),
    canContinue: () => simulator.hasRun,
    possession: () => simulator.possession(),
  });
  simulator.onNext = () => panel.open();
  return panel;
}

function bindActions(pieces, tacticPanel, savePanel) {
  const { trails, renderer } = pieces;
  document.querySelector("#open-tactics").addEventListener("click", () => tacticPanel.open());
  document.querySelector("#open-saves").addEventListener("click", () => savePanel.open());
  document.querySelector("#restore").addEventListener("click", () => restorePositions(pieces));
  document.querySelector("#clear").addEventListener("click", () => {
    trails.clear();
    renderer.invalidate();
  });
}

function watchSize(pieces, stage) {
  const resize = () => pieces.renderer.resize();
  if (window.ResizeObserver) new ResizeObserver(resize).observe(stage);
  window.addEventListener("resize", resize);
  window.addEventListener("orientationchange", resize);
  resize();
}

function main() {
  const stage = document.querySelector("#stage");
  const pieces = createPieces(stage, document.querySelector("#caption-bar"));
  const menu = createMenu(pieces);
  const tacticPanel = createTacticPanel(pieces);
  const savePanel = new SavePanel(pieces, menu, () => pieces.renderer.invalidate());
  new PointerControl(stage.querySelector("#board"), pieces, () => pieces.renderer.invalidate());
  bindLineSwitches(pieces);
  bindActions(pieces, tacticPanel, savePanel);
  watchSize(pieces, stage);
  window.tacticsBoard = { pieces, menu, tacticPanel, savePanel }; // 方便在浏览器控制台里查看和测试
}

main();
