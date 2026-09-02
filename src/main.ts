import Phaser from 'phaser';
import './style.css';
import { Direction, GameEngine, OBJECTIVES, OBJECTIVE_TEXT, Objective, Pos } from './game';
import { GameScene } from './scene';

type ActionMode = 'move' | 'strike' | 'nudge' | null;

let engine = new GameEngine();
let selectedUnitId: string | null = null;
let actionMode: ActionMode = null;
let nudgeShadePos: Pos | null = null;
let aiTimer: number | null = null;

const statusEl = must<HTMLDivElement>('status');
const objectiveNameEl = must<HTMLHeadingElement>('objective-name');
const objectiveTextEl = must<HTMLParagraphElement>('objective-text');
const objectiveProgressEl = must<HTMLDivElement>('objective-progress');
const selectionEl = must<HTMLDivElement>('selection');
const moveBtn = must<HTMLButtonElement>('move-btn');
const strikeBtn = must<HTMLButtonElement>('strike-btn');
const nudgeBtn = must<HTMLButtonElement>('nudge-btn');
const endBtn = must<HTMLButtonElement>('end-btn');
const nudgeDirectionsEl = must<HTMLDivElement>('nudge-directions');
const publicRecordEl = must<HTMLDivElement>('public-record');
const logEl = must<HTMLOListElement>('log');
const legendEl = must<HTMLDivElement>('legend');
const guessDialog = must<HTMLDialogElement>('guess-dialog');
const guessForm = must<HTMLFormElement>('guess-form');
const guessEyebrow = must<HTMLParagraphElement>('guess-eyebrow');
const guessTitle = must<HTMLHeadingElement>('guess-title');
const guessHelp = must<HTMLParagraphElement>('guess-help');
const guessOptions = must<HTMLDivElement>('guess-options');
const resultDialog = must<HTMLDialogElement>('result-dialog');
const resultTitle = must<HTMLHeadingElement>('result-title');
const resultBody = must<HTMLDivElement>('result-body');
const restartBtn = must<HTMLButtonElement>('restart-btn');

const scene = new GameScene(engine, handleCellClick);
new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 600,
  height: 600,
  backgroundColor: '#0b1120',
  scene: [scene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    antialias: true,
  },
});

legendEl.innerHTML = [
  '<span><i style="background:#54a6ff"></i>HUMAN</span>',
  '<span><i style="background:#ffa45b"></i>AI</span>',
  '<span><i style="background:#b17cff"></i>SHADE</span>',
  '<span><i style="background:#f1c75b"></i>CORE</span>',
  '<span><i style="background:#5fd8c3"></i>RUNE</span>',
].join('');

moveBtn.addEventListener('click', () => setActionMode('move'));
strikeBtn.addEventListener('click', () => setActionMode('strike'));
nudgeBtn.addEventListener('click', () => setActionMode('nudge'));
endBtn.addEventListener('click', () => {
  if (!isHumanTurn()) return;
  engine.endTurn();
  clearInteraction();
  sync();
});

guessForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const data = new FormData(guessForm);
  const value = data.get('guess');
  if (typeof value !== 'string') return;
  engine.submitHumanGuess(value as Objective);
  guessDialog.close();
  clearInteraction();
  sync();
});

restartBtn.addEventListener('click', () => {
  if (aiTimer !== null) window.clearTimeout(aiTimer);
  aiTimer = null;
  engine = new GameEngine();
  scene.setEngine(engine);
  clearInteraction();
  resultDialog.close();
  sync();
});

function handleCellClick(pos: Pos): void {
  if (!isHumanTurn()) return;
  const humanUnit = engine.state.units.find((unit) => unit.side === 'human' && same(unit.pos, pos));
  if (humanUnit) {
    selectedUnitId = humanUnit.id;
    nudgeShadePos = null;
    updateHighlights();
    syncHudOnly();
    return;
  }
  if (!selectedUnitId || !actionMode) return;

  let changed = false;
  if (actionMode === 'move') changed = engine.move(selectedUnitId, pos);
  if (actionMode === 'strike') changed = engine.strike(selectedUnitId, pos);
  if (actionMode === 'nudge') {
    const directions = engine.legalNudgeDirections(selectedUnitId, pos);
    if (directions.length > 0) {
      nudgeShadePos = { ...pos };
      renderNudgeDirections(directions);
      updateHighlights();
      return;
    }
  }
  if (changed) {
    if (!isHumanTurn()) clearInteraction();
    else nudgeShadePos = null;
    sync();
  }
}

function setActionMode(mode: Exclude<ActionMode, null>): void {
  if (!isHumanTurn() || !selectedUnitId) return;
  actionMode = actionMode === mode ? null : mode;
  nudgeShadePos = null;
  nudgeDirectionsEl.hidden = true;
  updateHighlights();
  syncHudOnly();
}

function renderNudgeDirections(directions: Direction[]): void {
  nudgeDirectionsEl.replaceChildren();
  nudgeDirectionsEl.hidden = false;
  for (const direction of directions) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = direction.toUpperCase();
    button.addEventListener('click', () => {
      if (!selectedUnitId || !nudgeShadePos) return;
      if (engine.nudge(selectedUnitId, nudgeShadePos, direction)) {
        nudgeShadePos = null;
        nudgeDirectionsEl.hidden = true;
        if (!isHumanTurn()) clearInteraction();
        sync();
      }
    });
    nudgeDirectionsEl.append(button);
  }
}

function updateHighlights(): void {
  const unit = selectedUnitId ? engine.getUnit(selectedUnitId) : undefined;
  if (!unit) {
    scene.setHighlights(null, []);
    return;
  }
  let targets: Pos[] = [];
  if (actionMode === 'move') targets = engine.legalMoveTargets(unit.id);
  if (actionMode === 'strike') targets = engine.legalStrikeCells(unit.id);
  if (actionMode === 'nudge') {
    targets = engine.state.shades
      .filter((shade) => Math.abs(shade.pos.x - unit.pos.x) + Math.abs(shade.pos.y - unit.pos.y) === 1)
      .filter((shade, index, list) => list.findIndex((other) => same(other.pos, shade.pos)) === index)
      .filter((shade) => engine.legalNudgeDirections(unit.id, shade.pos).length > 0)
      .map((shade) => shade.pos);
  }
  scene.setHighlights(unit.pos, targets);
}

function sync(): void {
  scene.redraw();
  syncHudOnly();
  openPhaseDialog();
  pumpAi();
}

function syncHudOnly(): void {
  const state = engine.state;
  const active = state.activeSide ? state.activeSide.toUpperCase() : state.phase.replace('_', ' ').toUpperCase();
  statusEl.innerHTML = `<div>ROUND <strong>${state.round}/8</strong> · CORE <strong>${'♥'.repeat(state.coreHp)}${'♡'.repeat(3 - state.coreHp)}</strong></div><div>${active}${state.phase === 'playing' ? ` · ${state.ap} AP` : ''}</div>`;

  objectiveNameEl.textContent = state.humanObjective;
  objectiveTextEl.textContent = OBJECTIVE_TEXT[state.humanObjective];
  objectiveProgressEl.textContent = engine.objectiveProgress('human');

  const selected = selectedUnitId ? engine.getUnit(selectedUnitId) : undefined;
  selectionEl.textContent = selected
    ? `${selected.id} selected${actionMode ? ` · ${actionMode.toUpperCase()}` : ' · choose an action'}`
    : isHumanTurn() ? 'Select one of your units.' : 'Waiting for the board…';

  const humanTurn = isHumanTurn();
  moveBtn.disabled = !humanTurn || !selectedUnitId || state.ap < 1;
  strikeBtn.disabled = !humanTurn || !selectedUnitId || state.ap < 2;
  nudgeBtn.disabled = !humanTurn || !selectedUnitId || state.ap < 1;
  endBtn.disabled = !humanTurn;
  moveBtn.classList.toggle('active', actionMode === 'move');
  strikeBtn.classList.toggle('active', actionMode === 'strike');
  nudgeBtn.classList.toggle('active', actionMode === 'nudge');

  publicRecordEl.innerHTML = engine.publicRecord().map((line) => `<div>${escapeHtml(line)}</div>`).join('');
  logEl.innerHTML = state.log.slice(0, 12).map((line) => `<li>${escapeHtml(line)}</li>`).join('');
}

function openPhaseDialog(): void {
  if ((engine.state.phase === 'mid_guess' || engine.state.phase === 'final_guess') && !guessDialog.open) {
    const isMid = engine.state.phase === 'mid_guess';
    guessEyebrow.textContent = isMid ? 'MID SUSPICION · ROUND 4' : 'FINAL READ · ROUND 8';
    guessTitle.textContent = isMid ? 'What is the AI really doing?' : 'Lock your final read.';
    guessHelp.textContent = isMid
      ? 'This guess is worth 1 point and cannot be changed. Your FINAL READ comes after Round 8.'
      : 'Correct FINAL READ: +2. If you identify the AI mission, its +4 VEIL bonus is also denied.';
    renderGuessOptions();
    guessDialog.showModal();
  }
  if (engine.state.phase === 'game_over' && !resultDialog.open) {
    renderResult();
    resultDialog.showModal();
  }
}

function renderGuessOptions(): void {
  guessOptions.replaceChildren();
  for (const objective of OBJECTIVES.filter((candidate) => candidate !== engine.state.humanObjective)) {
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'guess';
    input.value = objective;
    input.required = true;
    const copy = document.createElement('span');
    copy.innerHTML = `<strong>${objective}</strong><small>${escapeHtml(OBJECTIVE_TEXT[objective])}</small>`;
    label.append(input, copy);
    guessOptions.append(label);
  }
}

function renderResult(): void {
  const state = engine.state;
  if (state.winner === 'shared_loss') {
    resultTitle.textContent = 'The CORE fell.';
    resultBody.innerHTML = '<p>Both players lose. Every secret plan was worth exactly zero.</p>';
    return;
  }
  const winnerText = state.winner === 'draw' ? 'Draw' : state.winner === 'human' ? 'Human wins' : 'AI wins';
  resultTitle.textContent = winnerText;
  const h = state.scores.human;
  const a = state.scores.ai;
  resultBody.innerHTML = `
    <p><strong>Your mission:</strong> ${state.humanObjective} ${engine.objectiveAchieved('human') ? '✓' : '✕'}<br>
    <strong>AI mission:</strong> ${state.aiObjective} ${engine.objectiveAchieved('ai') ? '✓' : '✕'}</p>
    <table>
      <thead><tr><th></th><th>Human</th><th>AI</th></tr></thead>
      <tbody>
        <tr><td>MISSION</td><td>${h.mission}</td><td>${a.mission}</td></tr>
        <tr><td>VEIL</td><td>${h.veil}</td><td>${a.veil}</td></tr>
        <tr><td>MID</td><td>${h.mid}</td><td>${a.mid}</td></tr>
        <tr><td>FINAL</td><td>${h.final}</td><td>${a.final}</td></tr>
        <tr><td><strong>Total</strong></td><td><strong>${h.total}</strong></td><td><strong>${a.total}</strong></td></tr>
      </tbody>
    </table>
    <p class="muted">Your reads: MID ${state.humanMidGuess ?? '—'} · FINAL ${state.humanFinalGuess ?? '—'}<br>
    AI reads: MID ${state.aiMidGuess ?? '—'} · FINAL ${state.aiFinalGuess ?? '—'}</p>`;
}

function pumpAi(): void {
  if (aiTimer !== null || engine.state.phase !== 'playing' || engine.state.activeSide !== 'ai') return;
  aiTimer = window.setTimeout(() => {
    aiTimer = null;
    engine.runAiTurn();
    clearInteraction();
    sync();
  }, 360);
}

function clearInteraction(): void {
  selectedUnitId = null;
  actionMode = null;
  nudgeShadePos = null;
  nudgeDirectionsEl.hidden = true;
  scene.setHighlights(null, []);
}

function isHumanTurn(): boolean {
  return engine.state.phase === 'playing' && engine.state.activeSide === 'human';
}

function same(a: Pos, b: Pos): boolean {
  return a.x === b.x && a.y === b.y;
}

function must<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing #${id}`);
  return element as T;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character] ?? character);
}

sync();
