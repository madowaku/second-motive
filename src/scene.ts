import Phaser from 'phaser';
import { AI_STARTS, BOARD_SIZE, CORE, GameEngine, HUMAN_STARTS, PORTALS, Pos, RUNES } from './game';

const COLORS = {
  boardA: 0x111a2d,
  boardB: 0x0d1526,
  grid: 0x2b3b5f,
  human: 0x54a6ff,
  ai: 0xffa45b,
  shade: 0xb17cff,
  core: 0xf1c75b,
  rune: 0x5fd8c3,
  portal: 0x65718d,
  selected: 0xf7dc89,
  target: 0x8ee6a8,
};

export class GameScene extends Phaser.Scene {
  private engine: GameEngine;
  private onCell: (pos: Pos) => void;
  private selected: Pos | null = null;
  private targets: Pos[] = [];

  constructor(engine: GameEngine, onCell: (pos: Pos) => void) {
    super('game');
    this.engine = engine;
    this.onCell = onCell;
  }

  create(): void {
    this.redraw();
  }

  setEngine(engine: GameEngine): void {
    this.engine = engine;
    this.selected = null;
    this.targets = [];
    this.redraw();
  }

  setHighlights(selected: Pos | null, targets: Pos[]): void {
    this.selected = selected ? { ...selected } : null;
    this.targets = targets.map((pos) => ({ ...pos }));
    this.redraw();
  }

  redraw(): void {
    if (!this.sys.isActive()) return;
    this.children.removeAll(true);
    const width = 600;
    const pad = 45;
    const cell = (width - pad * 2) / BOARD_SIZE;

    for (let y = 0; y < BOARD_SIZE; y += 1) {
      for (let x = 0; x < BOARD_SIZE; x += 1) {
        const pos = { x, y };
        const cx = pad + x * cell + cell / 2;
        const cy = pad + y * cell + cell / 2;
        const fill = (x + y) % 2 === 0 ? COLORS.boardA : COLORS.boardB;
        const rect = this.add.rectangle(cx, cy, cell - 4, cell - 4, fill, 1)
          .setStrokeStyle(1, COLORS.grid, .85)
          .setInteractive({ useHandCursor: true });
        rect.on('pointerdown', () => this.onCell(pos));

        if (this.targets.some((target) => same(target, pos))) {
          rect.setStrokeStyle(4, COLORS.target, 1);
        }
        if (this.selected && same(this.selected, pos)) {
          rect.setStrokeStyle(5, COLORS.selected, 1);
        }

        this.drawSpecial(pos, cx, cy, cell);
        this.drawPieces(pos, cx, cy, cell);
      }
    }

    for (let i = 0; i < BOARD_SIZE; i += 1) {
      this.add.text(pad + i * cell + cell / 2, 16, String.fromCharCode(65 + i), {
        color: '#7488b2', fontSize: '15px', fontFamily: 'system-ui', fontStyle: 'bold',
      }).setOrigin(.5);
      this.add.text(18, pad + i * cell + cell / 2, String(i + 1), {
        color: '#7488b2', fontSize: '15px', fontFamily: 'system-ui', fontStyle: 'bold',
      }).setOrigin(.5);
    }
  }

  private drawSpecial(pos: Pos, cx: number, cy: number, cell: number): void {
    if (same(pos, CORE)) {
      this.add.circle(cx, cy, cell * .31, COLORS.core, .18).setStrokeStyle(4, COLORS.core, 1);
      this.add.text(cx, cy - 7, 'CORE', { color: '#ffe8a6', fontSize: '14px', fontFamily: 'system-ui', fontStyle: 'bold' }).setOrigin(.5);
      this.add.text(cx, cy + 14, '♥'.repeat(this.engine.state.coreHp), { color: '#ffd063', fontSize: '17px' }).setOrigin(.5);
      return;
    }
    if (RUNES.some((rune) => same(rune, pos))) {
      const diamond = this.add.polygon(cx, cy, [0, -15, 15, 0, 0, 15, -15, 0], COLORS.rune, .22).setStrokeStyle(2, COLORS.rune, .9);
      diamond.setDepth(0);
    }
    if (PORTALS.some((portal) => same(portal, pos))) {
      this.add.circle(cx, cy, cell * .25, COLORS.portal, .15).setStrokeStyle(3, COLORS.portal, .75);
      this.add.text(cx, cy, 'PORTAL', { color: '#7d8ba8', fontSize: '10px', fontFamily: 'system-ui', fontStyle: 'bold' }).setOrigin(.5);
    }
    if (HUMAN_STARTS.some((start) => same(start, pos))) this.cornerMark(cx, cy, cell, COLORS.human);
    if (AI_STARTS.some((start) => same(start, pos))) this.cornerMark(cx, cy, cell, COLORS.ai);
  }

  private drawPieces(pos: Pos, cx: number, cy: number, cell: number): void {
    const unit = this.engine.state.units.find((candidate) => same(candidate.pos, pos));
    if (unit) {
      const color = unit.side === 'human' ? COLORS.human : COLORS.ai;
      this.add.circle(cx, cy, cell * .22, color, .95).setStrokeStyle(3, 0xffffff, .65);
      this.add.text(cx, cy, unit.id, { color: '#07101e', fontSize: '17px', fontFamily: 'system-ui', fontStyle: 'bold' }).setOrigin(.5);
    }
    const shades = this.engine.shadesAt(pos);
    if (shades.length > 0) {
      const offset = unit ? cell * .24 : 0;
      this.add.circle(cx + offset, cy - offset, cell * .17, COLORS.shade, .92).setStrokeStyle(2, 0xe4d2ff, .75);
      this.add.text(cx + offset, cy - offset, shades.length > 1 ? `×${shades.length}` : 'S', {
        color: '#170a28', fontSize: shades.length > 1 ? '13px' : '17px', fontFamily: 'system-ui', fontStyle: 'bold',
      }).setOrigin(.5);
    }
  }

  private cornerMark(cx: number, cy: number, cell: number, color: number): void {
    this.add.rectangle(cx, cy + cell * .36, cell * .38, 4, color, .65);
  }
}

function same(a: Pos, b: Pos): boolean {
  return a.x === b.x && a.y === b.y;
}
