# SECOND MOTIVE — Rules v0.1.6

## Core fantasy

Two rivals defend the same CORE from a deterministic enemy while secretly pursuing different personal missions.

Every good move should admit two explanations:

1. a public reason: **I was defending the CORE**;
2. a second motive: **I was advancing my hidden mission**.

If the CORE is destroyed, both players lose immediately.

## Board

5×5 grid, columns A–E and rows 1–5.

- CORE: C3
- RUNEs: B2, D2, B4, D4
- PORTALs: A1, E1, E5, A5
- Human starts: B5, D5
- AI starts: B1, D1
- Initial SHADEs: A1 and E5

Players cannot enter the CORE or PORTAL spaces. SHADEs may stack with other SHADEs.

## Round structure

The game lasts 8 rounds.

- Odd rounds: HUMAN → AI → SHADE phase
- Even rounds: AI → HUMAN → SHADE phase
- Each player turn starts with 2 AP.

### Actions

- MOVE — 1 AP: move one unit one orthogonal space.
- NUDGE — 1 AP: move one adjacent SHADE one orthogonal space. The destination cannot be the CORE, a PORTAL, or a player unit.
- STRIKE — 2 AP: remove one adjacent SHADE.
- END TURN — voluntarily give up remaining AP.

## SHADE behavior

SHADE behavior is public and deterministic.

Each SHADE moves one space toward the CORE during the SHADE phase. When two routes reduce Manhattan distance, horizontal movement has priority over vertical movement.

If the next space is the CORE, the SHADE deals 1 damage and is removed.

If the next space contains a player unit, that unit is PUSHed one space away from the CORE and the SHADE occupies the vacated space. If a legal push is impossible, the unit returns to an available home start.

CORE HP starts at 3. At 0 HP both players lose.

## Reinforcements

After the SHADE phase, reinforcements emerge according to this schedule:

| Round | New SHADEs |
|---:|---:|
| 1 | 1 |
| 2 | 1 |
| 3 | 2 |
| 4 | 1 |
| 5 | 2 |
| 6 | 1 |
| 7 | 2 |
| 8 | 1 |

The starting reinforcement PORTAL is randomized. Subsequent spawns proceed clockwise through the four PORTALs. The Round 8 spawn has no gameplay effect after the final SHADE phase and may be omitted by the digital prototype.

## Secret missions

Each player receives one different mission. Both players know the six possible missions, but not the opponent's assigned mission.

### HUNTER
Defeat **5 SHADEs**.

### SHEPHERD
Successfully NUDGE a SHADE **4 times**.

### PILGRIM
End turns on **3 different RUNE spaces**.

### SENTINEL
End turns on **3 different spaces adjacent to the CORE**.

### INFILTRATOR
End turns on **3 different spaces in enemy territory**.

Enemy territory means the two rows nearest the opponent: rows 1–2 for HUMAN, rows 4–5 for AI.

### BAIT
From **3 different CORE-adjacent spaces**, end a turn standing on a deterministic SHADE route to the CORE. In addition, be **PUSHed at least once while CORE-adjacent** during the game.

## Deduction

### MID SUSPICION
After Round 4, both players secretly lock one guess for the opponent's mission.

- Correct: +1 point
- The guess cannot be changed.

### FINAL READ
After Round 8, if the CORE survives, both players secretly make one final guess.

- Correct: +2 points
- Correctly identifying the opponent also denies their VEIL bonus.

## Scoring

Only score if the CORE survives.

- MISSION: +4 if your secret mission is complete.
- VEIL: +4 if your mission is complete and the opponent's FINAL READ is wrong.
- MID SUSPICION: +1 for a correct Round 4 guess.
- FINAL READ: +2 for a correct final guess.

Maximum: **11 points**.

No points are awarded for public defensive contribution. Defending the world is required because a destroyed CORE makes all personal scoring worthless.

## v0.1.6 playtest thesis

The prototype succeeds when players repeatedly ask:

> Was that move necessary to save us, or was it for the other reason?

The most important reveal is not merely who won. It is the moment a past move becomes newly legible after the secret mission is shown.
