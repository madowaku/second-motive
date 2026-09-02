# SECOND MOTIVE

> Save the CORE. Hide the reason behind your move.

**SECOND MOTIVE** is a two-player semi-cooperative tactical deduction game designed around human-vs-AI play.

You and your opponent must defend the same CORE from deterministic SHADE enemies. If the CORE falls, both players lose. If it survives eight rounds, the higher score wins.

The catch: each player also has a hidden mission. The strongest moves are the ones that serve two explanations at once: a public reason to defend the world, and a second motive you do not want your opponent to identify.

## Playable prototype

The browser vertical slice implements rules **v0.1.6**:

- 5×5 tactical board
- 2 player units per side
- deterministic shared SHADE enemy
- 8 rounds, 2 AP per player turn
- MOVE / NUDGE / STRIKE actions
- CORE HP 3 and shared-loss condition
- six hidden objectives: HUNTER, SHEPHERD, PILGRIM, SENTINEL, INFILTRATOR, BAIT
- Round 4 MID SUSPICION
- Round 8 FINAL READ
- scoring: MISSION 4 / VEIL 4 / MID 1 / FINAL 2
- opponent AI that pursues its own hidden objective while reacting to CORE danger

## Run locally

```bash
npm install
npm run dev
```

Production smoke build:

```bash
npm run build
```

## Architecture

The prototype uses **Phaser + TypeScript + Vite**.

- `src/game.ts` — deterministic game rules, secret objectives, scoring, and opponent AI
- `src/scene.ts` — Phaser board renderer and click surface
- `src/main.ts` — DOM HUD, player input, deduction dialogs, and game flow
- `docs/rules-v0.1.6.md` — locked prototype rules
- `docs/playtest.md` — human playtest protocol and watch list

Gameplay state is kept outside the Phaser scene so rendering and presentation can evolve without becoming the rules source of truth.
