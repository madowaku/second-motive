# SECOND MOTIVE

> Save the CORE. Hide the reason behind your move.

**SECOND MOTIVE** is a two-player semi-cooperative tactical deduction game designed around human-vs-AI play.

You and your opponent must defend the same CORE from deterministic SHADE enemies. If the CORE falls, both players lose. If it survives eight rounds, the higher score wins.

The catch: each player also has a hidden mission. The strongest moves are the ones that serve two explanations at once: a public reason to defend the world, and a second motive you do not want your opponent to identify.

## Prototype target

The first playable vertical slice implements rules **v0.1.6**:

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

## Development

The browser prototype uses **Phaser + TypeScript + Vite**, with deterministic game rules kept outside the rendering scene.

Implementation work is developed through feature branches and pull requests.
