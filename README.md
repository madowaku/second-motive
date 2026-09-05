# SECOND MOTIVE

> Save the CORE. Hide the reason behind your move.

**SECOND MOTIVE** is a two-player semi-cooperative tactical deduction game designed around human-vs-AI play.

You and your opponent must defend the same CORE from deterministic SHADE enemies. If the CORE falls, both players lose. If it survives eight rounds, the higher score wins.

The catch: each player also has a hidden mission. The strongest moves are the ones that serve two explanations at once: a public reason to defend the world, and a second motive you do not want your opponent to identify.

## Playable prototype

The browser vertical slice implements rules **v0.1.6** with the **v0.1.7 Grant Demo presentation patch**.

Core rules:

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

Grant Demo additions:

- first match fixes HUMAN = HUNTER and AI = BAIT
- deterministic portal offset for a repeatable opening
- three-step first-play briefing
- visible SHADE next-step forecasts
- AI actions shown one step at a time
- all six motive candidates available from the HUD
- FINAL READ remembers the player's MID theory
- REVEAL surfaces actual BAIT positions and PUSH evidence recorded during play
- `PLAY ANOTHER MOTIVE` switches to the normal random-objective game

The demo is designed around one specific success signal: after REVEAL, an earlier AI move should become newly legible.

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

- `src/game.ts` — deterministic game rules, secret objectives, scoring, opponent AI, Grant Demo mode, reveal evidence
- `src/scene.ts` — Phaser board renderer, SHADE forecasts, evidence-cell highlighting
- `src/main.ts` — DOM HUD, onboarding, player input, deduction dialogs, AI pacing, reveal flow
- `docs/rules-v0.1.6.md` — locked prototype rules
- `docs/playtest.md` — human playtest protocol and watch list
- `docs/grant-demo-v0.1.7.md` — Grant Demo scope and thesis

Gameplay state remains outside the Phaser scene so rendering and presentation can evolve without becoming the rules source of truth.
