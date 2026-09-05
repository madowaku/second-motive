import Phaser from 'phaser';
import './style.css';
import {
  Direction,
  GameEngine,
  GameMode,
  OBJECTIVES,
  OBJECTIVE_SHORT_TEXT,
  OBJECTIVE_TEXT,
  Objective,
  Pos,
  RevealEvidence,
} from './game';
import { GameScene } from './scene';

type ActionMode = 'move' | 'strike' | 'nudge' | null;

let engine = new GameEngine({ mode: 'grant_demo' });
let selectedUnitId: string | null = null;
let actionMode: ActionMode = null;
let nudgeShadePos: Pos | null = null;
let aiTimer: number | null = null;
let noticeTimer: number | null = null;
let introIndex = 0;
let twoReasonsShown = false;

const statusEl = must<HTMLDivElement>('status');
const objectiveNameEl = must<HTMLHeadingElement>('objective-name');
const objectiveTextEl = must<HTMLParagraphElement>('objective-text');
const objectiveProgressEl = must<HTMLDivElement>('objective-progress');
const selectionEl = must<HTMLDivElement>('selection');
const moveBtn = must<HTMLButtonElement>('move-btn');
const strikeBtn = must<HTMLButtonElement>('strike-btn');
const nudgeBtn = must<HTMLButtonElement>('nudge-btn');
const endBtn = must<HTMLButtonElement>('end-btn');
const motivesBtn = must<HTMLButtonElement>('motives-btn');
const nudgeDirectionsEl = must<HTMLDivElement>('nudge-directions');
const publicRecordEl = must<HTMLDivElement>('public-record');
const logEl = must<HTMLOListElement>('log');
const legendEl = must<HTMLDivElement>('legend');
const noticeEl = must<HTMLDivElement>('notice');

const introDialog = must<HTMLDialogElement>('intro-dialog');
const introKicker = must<HTMLParagraphElement>('intro-kicker');
const introTitle = must<HTMLHeadingElement>('intro-title');
const introCopy = must<HTMLParagraphElement>('intro-copy');
const introVisual = must<HTMLDivElement>('intro-visual');
const introNextBtn = must<HTMLButtonElement>('intro-next');

const motivesDialog = must<HTMLDialogElement>('motives-dialog');
const motivesList = must<HTMLDivElement>('motives-list');
const motivesCloseBtn = must<HTMLButtonElement>('motives-close');

const guessDialog = must<HTMLDialogElement>('guess-dialog');
const guessForm = must<HTMLFormElement>('guess-form');
const guessEyebrow = must<HTMLParagraphElement>('guess-eyebrow');
const guessTitle = must<HTMLHeadingElement>('guess-title');
const guessHelp = must<HTMLParagraphElement>('guess-help');
const guessOptions = must<HTMLDivElement>('guess-options');

const resultDialog = must<HTMLDialogElement>('result-dialog');
const resultEyebrow = must<HTMLParagraphElement>('result-eyebrow');
const resultTitle = must<HTMLHeadingElement>('result-title');
const resultBody = must<HTMLDivElement>('result-body');
const restartBtn = must<HTMLButtonElement>('restart-btn');
const replayDemoBtn = must<HTMLButtonElement>('replay-demo-btn');

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

const introSlides = [
  {
    kicker: 'SHARED PROBLEM',
    title: 'Keep the CORE alive.',
    copy: 'You and the AI defend the same CORE. If it falls, both of you lose.',
    visual: '<div class="intro-core">CORE <span>♥♥♥</span></div><div class="intro-pair"><span>YOU</span><b>+</b><span>AI</span></div>',
  },
  {
    kicker: 'PUBLIC RULE',
    title: 'SHADE movement is deterministic.',
    copy: 'Purple route marks show each SHADE’s next step. The enemy is readable. Your rival’s reason is not.',
    visual: '<div class="intro-route"><span>SHADE</span><b>→</b><span>→</span><b>CORE</b></div>',
  },
  {
    kicker: 'YOUR SECOND MOTIVE',
    title: 'HUNTER',
    copy: 'Defeat 5 SHADEs. The AI cannot see this. You cannot see the AI’s mission either.',
    visual: '<div class="intro-secret"><strong>YOU</strong><span>HUNTER · 0 / 5</span></div><div class="intro-secret hidden"><strong>AI</strong><span>????????</span></div>',
  },
];

legendEl.innerHTML = [
  '<span><i style="background:#54a6ff"></i>HUMAN</span>',
  '<span><i style="background:#ffa45b"></i>AI</span>',
  '<span><i style="background:#b17cff"></i>SHADE</span>',
  '<span><i style="background:#f1c75b"></i>CORE</span>',
  '<span><i style="background:#5fd8c3"></i>RUNE</span>',
  '<span class="route-key">purple line = next SHADE step</span>',
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

motivesBtn.addEventListener('click', () => {
  renderMotives();
  motivesDialog.showModal();
});
motivesCloseBtn.addEventListener('click', () => motivesDialog.close());

introNextBtn.addEventListener('click', () => {
  if (introIndex < introSlides.length - 1) {
    introIndex += 1;
    renderIntro();
    return;
  }
  introDialog.close();
  showNotice('YOUR TURN · 2 AP', 'Select a unit. Every useful move may have two reasons.', 2400);
  syncHudOnly();
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

restartBtn.addEventListener('click', () => startNewGame('random', false));
replayDemoBtn.addEventListener('click', () => startNewGame('grant_demo', false));

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
  const beforeKills = engine.objectiveProgress('human', 'HUNTER');
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
    const afterKills = engine.objectiveProgress('human', 'HUNTER');
    if (engine.state.mode === 'grant_demo' && !twoReasonsShown && beforeKills !== afterKills) {
      twoReasonsShown = true;
      showNotice('ONE MOVE. TWO REASONS.', 'You protected the CORE and advanced HUNTER at the same time.', 3000);
    }
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
  const mode = state.mode === 'grant_demo' ? '<span class="mode-chip">GRANT DEMO</span>' : '<span class="mode-chip random">RANDOM MOTIVES</span>';
  statusEl.innerHTML = `<div>${mode} ROUND <strong>${state.round}/8</strong> · CORE <strong>${'♥'.repeat(state.coreHp)}${'♡'.repeat(3 - state.coreHp)}</strong></div><div>${active}${state.phase === 'playing' ? ` · ${state.ap} AP` : ''}</div>`;

  objectiveNameEl.textContent = state.humanObjective;
  objectiveTextEl.textContent = OBJECTIVE_TEXT[state.humanObjective];
  objectiveProgressEl.textContent = engine.objectiveProgress('human');

  const selected = selectedUnitId ? engine.getUnit(selectedUnitId) : undefined;
  selectionEl.textContent = selected
    ? `${selected.id} selected${actionMode ? ` · ${actionMode.toUpperCase()}` : ' · choose an action'}`
    : isHumanTurn() ? 'Select one of your units.' : state.phase === 'playing' ? 'Read the AI move…' : 'Make your read.';

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
      ? 'Choose your best current theory. New evidence may change your mind later.'
      : engine.state.humanMidGuess
        ? `Your MID read was ${engine.state.humanMidGuess}. Same moves, new evidence.`
        : 'Correct FINAL READ: +2. Identifying the AI also denies its VEIL bonus.';
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
    if (engine.state.phase === 'final_guess' && objective === engine.state.humanMidGuess) label.classList.add('mid-read');
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'guess';
    input.value = objective;
    input.required = true;
    const copy = document.createElement('span');
    const badge = engine.state.phase === 'final_guess' && objective === engine.state.humanMidGuess ? '<em>YOUR MID READ</em>' : '';
    copy.innerHTML = `<strong>${objective}${badge}</strong><small>${escapeHtml(OBJECTIVE_SHORT_TEXT[objective])}</small>`;
    label.append(input, copy);
    guessOptions.append(label);
  }
}

function renderResult(): void {
  const state = engine.state;
  scene.setEvidenceHighlight(null);
  if (state.winner === 'shared_loss') {
    resultEyebrow.textContent = 'SHARED LOSS';
    resultTitle.textContent = 'The CORE fell.';
    resultBody.innerHTML = '<p>Both players lose. Every secret plan was worth exactly zero.</p><p class="muted">The demo still uses the same rule: the public problem comes before every private motive.</p>';
    restartBtn.textContent = 'PLAY ANOTHER MOTIVE';
    return;
  }

  if (state.mode === 'grant_demo') {
    renderGrantReveal();
    return;
  }

  const winnerText = state.winner === 'draw' ? 'Draw' : state.winner === 'human' ? 'Human wins' : 'AI wins';
  resultEyebrow.textContent = 'REVEAL';
  resultTitle.textContent = winnerText;
  resultBody.innerHTML = scoreMarkup();
  restartBtn.textContent = 'PLAY ANOTHER MOTIVE';
}

function renderGrantReveal(): void {
  const state = engine.state;
  const evidence = engine.getRevealEvidence().slice(0, 3);
  resultEyebrow.textContent = 'AI SECOND MOTIVE';
  resultTitle.textContent = state.aiObjective;

  const evidenceMarkup = evidence.length > 0
    ? evidence.map((item, index) => revealEvidenceMarkup(item, index)).join('')
    : '<div class="evidence-card"><strong>No complete BAIT evidence was recorded.</strong><p>This run stayed tactically valid, but the fixed demo seed needs another tuning pass for the intended reveal.</p></div>';

  const mid = state.humanMidGuess ?? '—';
  const final = state.humanFinalGuess ?? '—';
  const changed = state.humanMidGuess && state.humanFinalGuess && state.humanMidGuess !== state.humanFinalGuess;
  const finalCorrect = state.humanFinalGuess === state.aiObjective;

  resultBody.innerHTML = `
    <section class="reveal-hero">
      <p>${escapeHtml(OBJECTIVE_TEXT[state.aiObjective])}</p>
      <strong>${engine.objectiveAchieved('ai') ? 'MISSION COMPLETE ✓' : 'MISSION INCOMPLETE'}</strong>
    </section>
    <section class="read-shift">
      <div><span>MID READ</span><strong>${escapeHtml(mid)}</strong></div>
      <div class="arrow">→</div>
      <div><span>FINAL READ</span><strong>${escapeHtml(final)} ${finalCorrect ? '✓' : '✕'}</strong></div>
    </section>
    ${changed ? '<p class="changed-read">You changed your mind.</p>' : ''}
    <section class="evidence-section">
      <p class="panel-label">THE OTHER REASON</p>
      <h3>Earlier moves, read again.</h3>
      <div class="evidence-list">${evidenceMarkup}</div>
    </section>
    ${scoreMarkup()}`;

  for (const button of resultBody.querySelectorAll<HTMLButtonElement>('[data-evidence]')) {
    button.addEventListener('click', () => {
      const item = evidence[Number(button.dataset.evidence)];
      if (!item?.pos) return;
      scene.setEvidenceHighlight(item.pos);
      showNotice(item.title, item.secondMotive, 3000);
    });
  }

  restartBtn.textContent = 'PLAY ANOTHER MOTIVE';
}

function revealEvidenceMarkup(item: RevealEvidence, index: number): string {
  return `<article class="evidence-card">
    <div><strong>${escapeHtml(item.title)}</strong><span>${item.kind === 'bait_push' ? 'PUSH' : 'POSITION'}</span></div>
    <p>${escapeHtml(item.publicRead)}</p>
    <p class="second-read">${escapeHtml(item.secondMotive)}</p>
    ${item.pos ? `<button type="button" data-evidence="${index}">HIGHLIGHT CELL</button>` : ''}
  </article>`;
}

function scoreMarkup(): string {
  const state = engine.state;
  const h = state.scores.human;
  const a = state.scores.ai;
  return `<details class="score-details">
    <summary>Score breakdown</summary>
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
  </details>`;
}

function pumpAi(): void {
  if (aiTimer !== null || engine.state.phase !== 'playing' || engine.state.activeSide !== 'ai' || introDialog.open || motivesDialog.open) return;
  aiTimer = window.setTimeout(() => {
    aiTimer = null;
    const previousTop = engine.state.log[0];
    const round = engine.state.round;
    engine.runAiStep();
    clearInteraction();
    const newEntries = collectNewLogEntries(previousTop);
    const action = newEntries.find((line) => line.startsWith('AI '));
    if (action) {
      const evidenceHint = engine.state.mode === 'grant_demo' && round >= 2 ? 'Every move is evidence.' : 'Read what changed on the board.';
      showNotice(action, evidenceHint, 1500);
    }
    sync();
  }, 620);
}

function collectNewLogEntries(previousTop: string | undefined): string[] {
  if (!previousTop) return [...engine.state.log];
  const index = engine.state.log.indexOf(previousTop);
  return index === -1 ? [...engine.state.log] : engine.state.log.slice(0, index);
}

function renderIntro(): void {
  const slide = introSlides[introIndex];
  introKicker.textContent = slide.kicker;
  introTitle.textContent = slide.title;
  introCopy.textContent = slide.copy;
  introVisual.innerHTML = slide.visual;
  introNextBtn.textContent = introIndex === introSlides.length - 1 ? 'BEGIN' : 'NEXT';
}

function renderMotives(): void {
  motivesList.innerHTML = OBJECTIVES.map((objective) => `
    <article class="motive-card ${objective === engine.state.humanObjective ? 'yours' : ''}">
      <div><strong>${objective}</strong>${objective === engine.state.humanObjective ? '<span>YOUR MOTIVE</span>' : ''}</div>
      <p>${escapeHtml(OBJECTIVE_TEXT[objective])}</p>
    </article>`).join('');
}

function showNotice(title: string, copy = '', duration = 1800): void {
  if (noticeTimer !== null) window.clearTimeout(noticeTimer);
  noticeEl.innerHTML = `<strong>${escapeHtml(title)}</strong>${copy ? `<span>${escapeHtml(copy)}</span>` : ''}`;
  noticeEl.classList.add('show');
  noticeTimer = window.setTimeout(() => {
    noticeTimer = null;
    noticeEl.classList.remove('show');
  }, duration);
}

function startNewGame(mode: GameMode, showIntro: boolean): void {
  if (aiTimer !== null) window.clearTimeout(aiTimer);
  aiTimer = null;
  if (noticeTimer !== null) window.clearTimeout(noticeTimer);
  noticeTimer = null;
  engine = new GameEngine({ mode });
  scene.setEngine(engine);
  clearInteraction();
  resultDialog.close();
  guessDialog.close();
  twoReasonsShown = false;
  introIndex = 0;
  if (showIntro) {
    renderIntro();
    introDialog.showModal();
  }
  sync();
}

function clearInteraction(): void {
  selectedUnitId = null;
  actionMode = null;
  nudgeShadePos = null;
  nudgeDirectionsEl.hidden = true;
  scene.setHighlights(null, []);
}

function isHumanTurn(): boolean {
  return engine.state.phase === 'playing'
    && engine.state.activeSide === 'human'
    && !introDialog.open
    && !motivesDialog.open;
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

renderIntro();
renderMotives();
sync();
introDialog.showModal();
