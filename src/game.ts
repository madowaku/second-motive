export type Side = 'human' | 'ai';
export type Objective = 'HUNTER' | 'SHEPHERD' | 'PILGRIM' | 'SENTINEL' | 'INFILTRATOR' | 'BAIT';
export type Phase = 'playing' | 'mid_guess' | 'final_guess' | 'game_over';
export type Direction = 'up' | 'right' | 'down' | 'left';
export type Winner = Side | 'draw' | 'shared_loss' | null;
export type GameMode = 'grant_demo' | 'random';

export interface Pos {
  x: number;
  y: number;
}

export interface Unit {
  id: string;
  side: Side;
  pos: Pos;
}

export interface Shade {
  id: number;
  pos: Pos;
}

interface Metrics {
  kills: Record<Side, number>;
  nudges: Record<Side, number>;
  runesVisited: Record<Side, Set<string>>;
  coreAdjacentVisited: Record<Side, Set<string>>;
  enemyTerritoryVisited: Record<Side, Set<string>>;
  baitBlocks: Record<Side, Set<string>>;
  baitPushed: Record<Side, boolean>;
}

export interface ScoreBreakdown {
  mission: number;
  veil: number;
  mid: number;
  final: number;
  total: number;
}

export interface RevealEvidence {
  round: number;
  kind: 'bait_position' | 'bait_push';
  title: string;
  publicRead: string;
  secondMotive: string;
  pos?: Pos;
}

export interface ShadeForecast {
  id: number;
  from: Pos;
  to: Pos;
}

export interface GameState {
  mode: GameMode;
  round: number;
  phase: Phase;
  activeSide: Side | null;
  ap: number;
  coreHp: number;
  units: Unit[];
  shades: Shade[];
  humanObjective: Objective;
  aiObjective: Objective;
  humanMidGuess: Objective | null;
  aiMidGuess: Objective | null;
  humanFinalGuess: Objective | null;
  aiFinalGuess: Objective | null;
  scores: Record<Side, ScoreBreakdown>;
  winner: Winner;
  log: string[];
}

export interface GameOptions {
  mode?: GameMode;
}

export const BOARD_SIZE = 5;
export const CORE: Pos = { x: 2, y: 2 };
export const RUNES: Pos[] = [
  { x: 1, y: 1 }, { x: 3, y: 1 }, { x: 1, y: 3 }, { x: 3, y: 3 },
];
export const PORTALS: Pos[] = [
  { x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 4 }, { x: 0, y: 4 },
];
export const HUMAN_STARTS: Pos[] = [{ x: 1, y: 4 }, { x: 3, y: 4 }];
export const AI_STARTS: Pos[] = [{ x: 1, y: 0 }, { x: 3, y: 0 }];

export const OBJECTIVES: Objective[] = ['HUNTER', 'SHEPHERD', 'PILGRIM', 'SENTINEL', 'INFILTRATOR', 'BAIT'];

export const OBJECTIVE_TEXT: Record<Objective, string> = {
  HUNTER: 'Defeat 5 SHADEs.',
  SHEPHERD: 'Successfully NUDGE a SHADE 4 times.',
  PILGRIM: 'End turns on 3 different RUNE spaces.',
  SENTINEL: 'End turns on 3 different spaces adjacent to the CORE.',
  INFILTRATOR: 'End turns on 3 different spaces in enemy territory.',
  BAIT: 'Block a SHADE route from 3 different CORE-adjacent spaces, and get PUSHed there at least once.',
};

export const OBJECTIVE_SHORT_TEXT: Record<Objective, string> = {
  HUNTER: 'Defeat 5 SHADEs',
  SHEPHERD: 'NUDGE 4 times',
  PILGRIM: 'Visit 3 different RUNEs',
  SENTINEL: 'End near the CORE from 3 positions',
  INFILTRATOR: 'End in enemy territory from 3 positions',
  BAIT: 'Block 3 SHADE routes and get PUSHed',
};

const SPAWNS_PER_ROUND = [1, 1, 2, 1, 2, 1, 2, 1];
const DIRS: Record<Direction, Pos> = {
  up: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};

function key(pos: Pos): string { return `${pos.x},${pos.y}`; }
function same(a: Pos, b: Pos): boolean { return a.x === b.x && a.y === b.y; }
function add(a: Pos, b: Pos): Pos { return { x: a.x + b.x, y: a.y + b.y }; }
function distance(a: Pos, b: Pos): number { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }
function inBounds(pos: Pos): boolean { return pos.x >= 0 && pos.x < BOARD_SIZE && pos.y >= 0 && pos.y < BOARD_SIZE; }
function isCoreAdjacent(pos: Pos): boolean { return distance(pos, CORE) === 1; }
function isRune(pos: Pos): boolean { return RUNES.some((r) => same(r, pos)); }
function isPortal(pos: Pos): boolean { return PORTALS.some((p) => same(p, pos)); }
function isEnemyTerritory(side: Side, pos: Pos): boolean { return side === 'human' ? pos.y <= 1 : pos.y >= 3; }
function copyPos(pos: Pos): Pos { return { x: pos.x, y: pos.y }; }

function emptyScores(): Record<Side, ScoreBreakdown> {
  const score = (): ScoreBreakdown => ({ mission: 0, veil: 0, mid: 0, final: 0, total: 0 });
  return { human: score(), ai: score() };
}

function emptyMetrics(): Metrics {
  return {
    kills: { human: 0, ai: 0 },
    nudges: { human: 0, ai: 0 },
    runesVisited: { human: new Set(), ai: new Set() },
    coreAdjacentVisited: { human: new Set(), ai: new Set() },
    enemyTerritoryVisited: { human: new Set(), ai: new Set() },
    baitBlocks: { human: new Set(), ai: new Set() },
    baitPushed: { human: false, ai: false },
  };
}

export class GameEngine {
  private metrics: Metrics = emptyMetrics();
  private turnIndex = 0;
  private nextShadeId = 1;
  private spawnCursor = 0;
  private readonly portalOffset: number;
  private readonly mode: GameMode;
  private revealEvidence: RevealEvidence[] = [];
  state: GameState;

  constructor(options: GameOptions = {}) {
    this.mode = options.mode ?? 'random';
    this.portalOffset = this.mode === 'grant_demo' ? 0 : Math.floor(Math.random() * PORTALS.length);
    this.state = this.createInitialState();
  }

  private createInitialState(): GameState {
    this.metrics = emptyMetrics();
    this.turnIndex = 0;
    this.nextShadeId = 1;
    this.spawnCursor = 0;
    this.revealEvidence = [];

    let humanObjective: Objective;
    let aiObjective: Objective;
    if (this.mode === 'grant_demo') {
      humanObjective = 'HUNTER';
      aiObjective = 'BAIT';
    } else {
      const shuffled = [...OBJECTIVES].sort(() => Math.random() - 0.5);
      humanObjective = shuffled[0];
      aiObjective = shuffled[1];
    }

    const units: Unit[] = [
      { id: 'H1', side: 'human', pos: copyPos(HUMAN_STARTS[0]) },
      { id: 'H2', side: 'human', pos: copyPos(HUMAN_STARTS[1]) },
      { id: 'A1', side: 'ai', pos: copyPos(AI_STARTS[0]) },
      { id: 'A2', side: 'ai', pos: copyPos(AI_STARTS[1]) },
    ];
    const shades: Shade[] = [
      { id: this.nextShadeId++, pos: { x: 0, y: 0 } },
      { id: this.nextShadeId++, pos: { x: 4, y: 4 } },
    ];
    return {
      mode: this.mode,
      round: 1,
      phase: 'playing',
      activeSide: 'human',
      ap: 2,
      coreHp: 3,
      units,
      shades,
      humanObjective,
      aiObjective,
      humanMidGuess: null,
      aiMidGuess: null,
      humanFinalGuess: null,
      aiFinalGuess: null,
      scores: emptyScores(),
      winner: null,
      log: [this.mode === 'grant_demo' ? 'Grant Demo. Round 1. HUMAN acts first.' : 'Round 1. HUMAN acts first.'],
    };
  }

  getObjective(side: Side): Objective {
    return side === 'human' ? this.state.humanObjective : this.state.aiObjective;
  }

  getUnit(id: string): Unit | undefined {
    return this.state.units.find((u) => u.id === id);
  }

  shadesAt(pos: Pos): Shade[] {
    return this.state.shades.filter((shade) => same(shade.pos, pos));
  }

  shadeForecast(): ShadeForecast[] {
    return this.state.shades.map((shade) => ({ id: shade.id, from: copyPos(shade.pos), to: this.shadeNextStep(shade.pos) }));
  }

  getRevealEvidence(): RevealEvidence[] {
    return this.revealEvidence.map((item) => ({ ...item, pos: item.pos ? copyPos(item.pos) : undefined }));
  }

  legalMoveTargets(unitId: string): Pos[] {
    const unit = this.getUnit(unitId);
    if (!unit || this.state.phase !== 'playing' || unit.side !== this.state.activeSide || this.state.ap < 1) return [];
    return Object.values(DIRS).map((d) => add(unit.pos, d)).filter((pos) => this.canEnterPlayerCell(pos));
  }

  move(unitId: string, target: Pos): boolean {
    const unit = this.getUnit(unitId);
    if (!unit || unit.side !== this.state.activeSide || this.state.phase !== 'playing' || this.state.ap < 1) return false;
    if (distance(unit.pos, target) !== 1 || !this.canEnterPlayerCell(target)) return false;
    unit.pos = copyPos(target);
    this.spendAp(1);
    this.pushLog(`${unit.side === 'human' ? 'HUMAN' : 'AI'} ${unit.id} moved to ${this.label(target)}.`);
    return true;
  }

  legalStrikeCells(unitId: string): Pos[] {
    const unit = this.getUnit(unitId);
    if (!unit || unit.side !== this.state.activeSide || this.state.ap < 2) return [];
    return this.adjacent(unit.pos).filter((pos) => this.shadesAt(pos).length > 0);
  }

  strike(unitId: string, target: Pos): boolean {
    const unit = this.getUnit(unitId);
    if (!unit || unit.side !== this.state.activeSide || this.state.phase !== 'playing' || this.state.ap < 2) return false;
    if (distance(unit.pos, target) !== 1) return false;
    const victim = this.shadesAt(target).sort((a, b) => a.id - b.id)[0];
    if (!victim) return false;
    this.state.shades = this.state.shades.filter((shade) => shade.id !== victim.id);
    this.metrics.kills[unit.side] += 1;
    this.spendAp(2);
    this.pushLog(`${unit.side === 'human' ? 'HUMAN' : 'AI'} ${unit.id} struck SHADE #${victim.id}.`);
    return true;
  }

  legalNudgeDirections(unitId: string, shadePos: Pos): Direction[] {
    const unit = this.getUnit(unitId);
    if (!unit || unit.side !== this.state.activeSide || this.state.ap < 1 || distance(unit.pos, shadePos) !== 1 || this.shadesAt(shadePos).length === 0) return [];
    return (Object.keys(DIRS) as Direction[]).filter((direction) => this.canNudgeTo(add(shadePos, DIRS[direction])));
  }

  nudge(unitId: string, shadePos: Pos, direction: Direction): boolean {
    const unit = this.getUnit(unitId);
    if (!unit || unit.side !== this.state.activeSide || this.state.phase !== 'playing' || this.state.ap < 1) return false;
    if (distance(unit.pos, shadePos) !== 1) return false;
    const shade = this.shadesAt(shadePos).sort((a, b) => a.id - b.id)[0];
    if (!shade) return false;
    const target = add(shade.pos, DIRS[direction]);
    if (!this.canNudgeTo(target)) return false;
    shade.pos = target;
    this.metrics.nudges[unit.side] += 1;
    this.spendAp(1);
    this.pushLog(`${unit.side === 'human' ? 'HUMAN' : 'AI'} ${unit.id} nudged SHADE #${shade.id} ${direction}.`);
    return true;
  }

  endTurn(): void {
    if (this.state.phase !== 'playing' || !this.state.activeSide) return;
    this.finishTurn();
  }

  submitHumanGuess(objective: Objective): void {
    if (objective === this.state.humanObjective) return;
    if (this.state.phase === 'mid_guess') {
      this.state.humanMidGuess = objective;
      this.pushLog(`MID SUSPICION locked: ${objective}.`);
      this.state.round = 5;
      this.startRound();
      return;
    }
    if (this.state.phase === 'final_guess') {
      this.state.humanFinalGuess = objective;
      this.pushLog(`FINAL READ locked: ${objective}.`);
      this.finalizeGame();
    }
  }

  runAiStep(): boolean {
    if (this.state.phase !== 'playing' || this.state.activeSide !== 'ai' || this.state.ap <= 0) return false;
    if (!this.takeAiAction()) this.endTurn();
    return this.state.phase === 'playing' && this.state.activeSide === 'ai';
  }

  runAiTurn(): void {
    let guard = 0;
    while (this.state.phase === 'playing' && this.state.activeSide === 'ai' && this.state.ap > 0 && guard++ < 6) {
      if (!this.takeAiAction()) {
        this.endTurn();
        return;
      }
    }
  }

  objectiveAchieved(side: Side, objective = this.getObjective(side)): boolean {
    switch (objective) {
      case 'HUNTER': return this.metrics.kills[side] >= 5;
      case 'SHEPHERD': return this.metrics.nudges[side] >= 4;
      case 'PILGRIM': return this.metrics.runesVisited[side].size >= 3;
      case 'SENTINEL': return this.metrics.coreAdjacentVisited[side].size >= 3;
      case 'INFILTRATOR': return this.metrics.enemyTerritoryVisited[side].size >= 3;
      case 'BAIT': return this.metrics.baitBlocks[side].size >= 3 && this.metrics.baitPushed[side];
    }
  }

  objectiveProgress(side: Side, objective = this.getObjective(side)): string {
    switch (objective) {
      case 'HUNTER': return `${Math.min(this.metrics.kills[side], 5)} / 5 SHADEs`;
      case 'SHEPHERD': return `${Math.min(this.metrics.nudges[side], 4)} / 4 NUDGEs`;
      case 'PILGRIM': return `${Math.min(this.metrics.runesVisited[side].size, 3)} / 3 RUNEs`;
      case 'SENTINEL': return `${Math.min(this.metrics.coreAdjacentVisited[side].size, 3)} / 3 CORE-adjacent spaces`;
      case 'INFILTRATOR': return `${Math.min(this.metrics.enemyTerritoryVisited[side].size, 3)} / 3 enemy-territory spaces`;
      case 'BAIT': return `${Math.min(this.metrics.baitBlocks[side].size, 3)} / 3 blocks · PUSH ${this.metrics.baitPushed[side] ? '✓' : '—'}`;
    }
  }

  publicRecord(): string[] {
    return [`HUMAN kills ${this.metrics.kills.human}`, `AI kills ${this.metrics.kills.ai}`, `HUMAN nudges ${this.metrics.nudges.human}`, `AI nudges ${this.metrics.nudges.ai}`];
  }

  private spendAp(cost: number): void {
    this.state.ap -= cost;
    if (this.state.ap <= 0 && this.state.phase === 'playing') this.finishTurn();
  }

  private finishTurn(): void {
    const side = this.state.activeSide;
    if (!side) return;
    this.recordEndTurnProgress(side);
    const order = this.turnOrder();
    if (this.turnIndex === 0) {
      this.turnIndex = 1;
      this.state.activeSide = order[1];
      this.state.ap = 2;
      this.pushLog(`${order[1] === 'human' ? 'HUMAN' : 'AI'} turn.`);
      return;
    }
    this.enemyPhase();
    if (this.state.phase === 'game_over') return;
    if (this.state.round === 4) {
      this.state.aiMidGuess = this.inferObjective('human');
      this.state.phase = 'mid_guess';
      this.state.activeSide = null;
      this.state.ap = 0;
      this.pushLog('Round 4 complete. MID SUSPICION required.');
      return;
    }
    if (this.state.round === 8) {
      this.state.aiFinalGuess = this.inferObjective('human');
      this.state.phase = 'final_guess';
      this.state.activeSide = null;
      this.state.ap = 0;
      this.pushLog('Round 8 complete. FINAL READ required.');
      return;
    }
    this.state.round += 1;
    this.startRound();
  }

  private startRound(): void {
    this.turnIndex = 0;
    const order = this.turnOrder();
    this.state.phase = 'playing';
    this.state.activeSide = order[0];
    this.state.ap = 2;
    this.pushLog(`Round ${this.state.round}. ${order[0] === 'human' ? 'HUMAN' : 'AI'} acts first.`);
  }

  private turnOrder(): [Side, Side] {
    return this.state.round % 2 === 1 ? ['human', 'ai'] : ['ai', 'human'];
  }

  private recordEndTurnProgress(side: Side): void {
    for (const unit of this.state.units.filter((u) => u.side === side)) {
      if (isRune(unit.pos)) this.metrics.runesVisited[side].add(key(unit.pos));
      if (isCoreAdjacent(unit.pos)) {
        this.metrics.coreAdjacentVisited[side].add(key(unit.pos));
        if (this.state.shades.some((shade) => this.shadePathIncludes(shade.pos, unit.pos))) {
          const positionKey = key(unit.pos);
          const isNewBaitPosition = !this.metrics.baitBlocks[side].has(positionKey);
          this.metrics.baitBlocks[side].add(positionKey);
          if (side === 'ai' && this.state.aiObjective === 'BAIT' && isNewBaitPosition) {
            const count = this.metrics.baitBlocks.ai.size;
            this.revealEvidence.push({
              round: this.state.round,
              kind: 'bait_position',
              title: `Round ${this.state.round} · ${this.label(unit.pos)}`,
              publicRead: 'It could be read as ordinary CORE defense.',
              secondMotive: `It was also BAIT position #${count}.`,
              pos: copyPos(unit.pos),
            });
          }
        }
      }
      if (isEnemyTerritory(side, unit.pos)) this.metrics.enemyTerritoryVisited[side].add(key(unit.pos));
    }
  }

  private enemyPhase(): void {
    this.pushLog('SHADE phase.');
    const ids = this.state.shades.map((s) => s.id).sort((a, b) => a - b);
    for (const id of ids) {
      const shade = this.state.shades.find((s) => s.id === id);
      if (!shade) continue;
      const target = this.shadeNextStep(shade.pos);
      if (same(target, CORE)) {
        this.state.coreHp -= 1;
        this.state.shades = this.state.shades.filter((s) => s.id !== shade.id);
        this.pushLog(`SHADE #${shade.id} struck the CORE. HP ${this.state.coreHp}/3.`);
        if (this.state.coreHp <= 0) {
          this.state.phase = 'game_over';
          this.state.activeSide = null;
          this.state.ap = 0;
          this.state.winner = 'shared_loss';
          this.state.scores = emptyScores();
          this.pushLog('CORE destroyed. Both players lose.');
          return;
        }
        continue;
      }
      const unit = this.state.units.find((u) => same(u.pos, target));
      if (unit) {
        const wasCoreAdjacent = isCoreAdjacent(unit.pos);
        const original = copyPos(unit.pos);
        this.pushUnit(unit);
        if (wasCoreAdjacent) {
          const firstBaitPush = !this.metrics.baitPushed[unit.side];
          this.metrics.baitPushed[unit.side] = true;
          if (unit.side === 'ai' && this.state.aiObjective === 'BAIT' && firstBaitPush) {
            this.revealEvidence.push({
              round: this.state.round,
              kind: 'bait_push',
              title: `Round ${this.state.round} · PUSH at ${this.label(original)}`,
              publicRead: 'It looked like the AI had accepted a risky defensive position.',
              secondMotive: 'The PUSH was also a required part of BAIT.',
              pos: original,
            });
          }
        }
        shade.pos = original;
        this.pushLog(`SHADE #${shade.id} PUSHed ${unit.id}.`);
      } else {
        shade.pos = target;
      }
    }
    if (this.state.round < 8) this.spawnShades();
  }

  private spawnShades(): void {
    const count = SPAWNS_PER_ROUND[this.state.round - 1];
    for (let i = 0; i < count; i += 1) {
      const portal = PORTALS[(this.portalOffset + this.spawnCursor) % PORTALS.length];
      this.spawnCursor += 1;
      const shade: Shade = { id: this.nextShadeId++, pos: copyPos(portal) };
      this.state.shades.push(shade);
      this.pushLog(`SHADE #${shade.id} emerged at ${this.label(portal)}.`);
    }
  }

  private pushUnit(unit: Unit): void {
    const dx = Math.sign(unit.pos.x - CORE.x);
    const dy = Math.sign(unit.pos.y - CORE.y);
    const push = dx !== 0 ? { x: dx, y: 0 } : { x: 0, y: dy || (unit.side === 'human' ? 1 : -1) };
    const target = add(unit.pos, push);
    if (inBounds(target) && !isPortal(target) && !same(target, CORE) && !this.state.units.some((u) => u.id !== unit.id && same(u.pos, target))) {
      unit.pos = target;
      return;
    }
    const starts = unit.side === 'human' ? HUMAN_STARTS : AI_STARTS;
    const fallback = starts.find((pos) => !this.state.units.some((u) => u.id !== unit.id && same(u.pos, pos))) ?? starts[0];
    unit.pos = copyPos(fallback);
  }

  private shadeNextStep(from: Pos): Pos {
    if (from.x !== CORE.x) return { x: from.x + Math.sign(CORE.x - from.x), y: from.y };
    if (from.y !== CORE.y) return { x: from.x, y: from.y + Math.sign(CORE.y - from.y) };
    return copyPos(from);
  }

  private shadePathIncludes(from: Pos, target: Pos): boolean {
    let cursor = copyPos(from);
    for (let i = 0; i < 8 && !same(cursor, CORE); i += 1) {
      cursor = this.shadeNextStep(cursor);
      if (same(cursor, target)) return true;
    }
    return false;
  }

  private canEnterPlayerCell(pos: Pos): boolean {
    return inBounds(pos) && !same(pos, CORE) && !isPortal(pos) && !this.state.units.some((u) => same(u.pos, pos)) && this.shadesAt(pos).length === 0;
  }

  private canNudgeTo(pos: Pos): boolean {
    return inBounds(pos) && !same(pos, CORE) && !isPortal(pos) && !this.state.units.some((u) => same(u.pos, pos));
  }

  private adjacent(pos: Pos): Pos[] {
    return Object.values(DIRS).map((d) => add(pos, d)).filter(inBounds);
  }

  private takeAiAction(): boolean {
    const units = this.state.units.filter((u) => u.side === 'ai');
    const objective = this.state.aiObjective;
    if (this.state.ap >= 2) {
      const emergencyStrike = units.flatMap((unit) => this.legalStrikeCells(unit.id).map((pos) => ({ unit, pos })))
        .find(({ pos }) => this.shadesAt(pos).some((shade) => same(this.shadeNextStep(shade.pos), CORE)));
      if (emergencyStrike) return this.strike(emergencyStrike.unit.id, emergencyStrike.pos);
    }
    if (objective === 'HUNTER' && this.state.ap >= 2) {
      const strike = units.flatMap((unit) => this.legalStrikeCells(unit.id).map((pos) => ({ unit, pos })))[0];
      if (strike) return this.strike(strike.unit.id, strike.pos);
    }
    if (objective === 'SHEPHERD') {
      const nudge = this.bestAiNudge();
      if (nudge) return this.nudge(nudge.unit.id, nudge.shadePos, nudge.direction);
    }
    const move = this.bestAiMove(objective);
    if (move) return this.move(move.unit.id, move.target);
    const defensiveNudge = this.bestAiNudge();
    if (defensiveNudge) return this.nudge(defensiveNudge.unit.id, defensiveNudge.shadePos, defensiveNudge.direction);
    if (this.state.ap >= 2) {
      const strike = units.flatMap((unit) => this.legalStrikeCells(unit.id).map((pos) => ({ unit, pos })))[0];
      if (strike) return this.strike(strike.unit.id, strike.pos);
    }
    return false;
  }

  private bestAiNudge(): { unit: Unit; shadePos: Pos; direction: Direction } | null {
    let best: { unit: Unit; shadePos: Pos; direction: Direction; score: number } | null = null;
    for (const unit of this.state.units.filter((u) => u.side === 'ai')) {
      for (const shadePos of this.adjacent(unit.pos).filter((p) => this.shadesAt(p).length > 0)) {
        for (const direction of this.legalNudgeDirections(unit.id, shadePos)) {
          const target = add(shadePos, DIRS[direction]);
          const score = distance(target, CORE) - distance(shadePos, CORE);
          if (!best || score > best.score) best = { unit, shadePos, direction, score };
        }
      }
    }
    return best;
  }

  private bestAiMove(objective: Objective): { unit: Unit; target: Pos } | null {
    let best: { unit: Unit; target: Pos; score: number } | null = null;
    for (const unit of this.state.units.filter((u) => u.side === 'ai')) {
      for (const target of this.legalMoveTargets(unit.id)) {
        let score = 0;
        const unvisitedRunes = RUNES.filter((p) => !this.metrics.runesVisited.ai.has(key(p)));
        const unvisitedCore = this.adjacent(CORE).filter((p) => !this.metrics.coreAdjacentVisited.ai.has(key(p)) && !isPortal(p));
        const enemyCells = this.allBoardCells().filter((p) => isEnemyTerritory('ai', p) && !isPortal(p) && !same(p, CORE) && !this.metrics.enemyTerritoryVisited.ai.has(key(p)));
        const baitCells = this.adjacent(CORE).filter((p) => !this.metrics.baitBlocks.ai.has(key(p)) && this.state.shades.some((shade) => this.shadePathIncludes(shade.pos, p)));
        const targetSet = objective === 'PILGRIM' ? unvisitedRunes
          : objective === 'SENTINEL' ? unvisitedCore
          : objective === 'INFILTRATOR' ? enemyCells
          : objective === 'BAIT' ? (baitCells.length ? baitCells : unvisitedCore)
          : this.state.shades.map((shade) => shade.pos);
        if (targetSet.length > 0) score -= Math.min(...targetSet.map((p) => distance(target, p))) * 4;
        if (isCoreAdjacent(target)) score += objective === 'BAIT' ? 3 : 1;
        if (objective === 'BAIT' && this.state.shades.some((shade) => this.shadePathIncludes(shade.pos, target))) score += 6;
        if (this.state.shades.some((shade) => distance(target, shade.pos) === 1)) score += objective === 'HUNTER' || objective === 'SHEPHERD' ? 3 : 1;
        if (!best || score > best.score) best = { unit, target, score };
      }
    }
    return best;
  }

  private inferObjective(side: Side): Objective {
    const excluded = side === 'human' ? this.state.aiObjective : this.state.humanObjective;
    const scores: Record<Objective, number> = {
      HUNTER: this.metrics.kills[side] / 5,
      SHEPHERD: this.metrics.nudges[side] / 4,
      PILGRIM: this.metrics.runesVisited[side].size / 3,
      SENTINEL: this.metrics.coreAdjacentVisited[side].size / 3,
      INFILTRATOR: this.metrics.enemyTerritoryVisited[side].size / 3,
      BAIT: this.metrics.baitBlocks[side].size / 3 + (this.metrics.baitPushed[side] ? 0.55 : 0),
    };
    return OBJECTIVES.filter((objective) => objective !== excluded).sort((a, b) => scores[b] - scores[a])[0];
  }

  private finalizeGame(): void {
    const human = this.scoreSide('human');
    const ai = this.scoreSide('ai');
    this.state.scores = { human, ai };
    this.state.winner = human.total === ai.total ? 'draw' : human.total > ai.total ? 'human' : 'ai';
    this.state.phase = 'game_over';
    this.state.activeSide = null;
    this.state.ap = 0;
    this.pushLog(`REVEAL: HUMAN ${this.state.humanObjective}, AI ${this.state.aiObjective}.`);
  }

  private scoreSide(side: Side): ScoreBreakdown {
    const objective = this.getObjective(side);
    const achieved = this.objectiveAchieved(side, objective);
    const opponentFinalGuess = side === 'human' ? this.state.aiFinalGuess : this.state.humanFinalGuess;
    const midGuess = side === 'human' ? this.state.humanMidGuess : this.state.aiMidGuess;
    const finalGuess = side === 'human' ? this.state.humanFinalGuess : this.state.aiFinalGuess;
    const opponentObjective = side === 'human' ? this.state.aiObjective : this.state.humanObjective;
    const mission = achieved ? 4 : 0;
    const veil = achieved && opponentFinalGuess !== objective ? 4 : 0;
    const mid = midGuess === opponentObjective ? 1 : 0;
    const final = finalGuess === opponentObjective ? 2 : 0;
    return { mission, veil, mid, final, total: mission + veil + mid + final };
  }

  private allBoardCells(): Pos[] {
    const cells: Pos[] = [];
    for (let y = 0; y < BOARD_SIZE; y += 1) for (let x = 0; x < BOARD_SIZE; x += 1) cells.push({ x, y });
    return cells;
  }

  private pushLog(message: string): void {
    this.state.log.unshift(message);
    this.state.log = this.state.log.slice(0, 36);
  }

  private label(pos: Pos): string {
    return `${String.fromCharCode(65 + pos.x)}${pos.y + 1}`;
  }
}
