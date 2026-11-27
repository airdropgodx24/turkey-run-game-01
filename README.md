# Gobble Dash — The Great Thanksgiving Escape

![turkey-run-game-01](https://make.fun/badge/turkey-run-game-01.svg)
![rank](https://make.fun/badge/turkey-run-game-01/airdropgodx24/turkey-run-game-01/rank.svg)
![reward](https://make.fun/badge/turkey-run-game-01/airdropgodx24/turkey-run-game-01/reward.svg)

An entry in the [make.fun turkey-run-game-01 bounty](https://make.fun/c/turkey-run-game-01): make the best turkey escape game.

It is Thanksgiving morning. The farmer has the oven on and the carving knife sharpened, and you are the turkey. Run 1200 metres to freedom across three stages — the Farmyard, the Harvest Field, and through the Kitchen itself — while the farmer chases you with a butterfly net.

## How to play

- **↑ / ↓** (or W / S) — change lane
- **Space** — jump fences and pumpkins
- **C** at a hay bale — hide while the farmer searches
- **Mouse** — click a lane to hop there, click the turkey to jump
- **P** pause · **M** mute

Dodge the farm dog, the glowing oven and the falling carving knife. Gobble corn for score. You have three feathers; lose them all, or let the farmer close the gap, and dinner is served. Reach 1200 m and you are free.

## Run it

The game is static files under `game/` with no build step and no network requests. Serve that folder with any static server, or from this repository:

```
node serve.ts
```

then open the local address it prints. To produce the hand-in bundle the grader reads:

```
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Layout

- `main.ts` — the hand-in program: copies `game/` and `screenshots/` out and writes `dossier.json`
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged
- `game/` — the game: `index.html` plus ES modules under `game/src/` (config, random, input, audio, entities, world, render, shots, main)
- `screenshots/` — real renders of the game, staged by `game/src/shots.js`

All art and sound are generated in code: canvas drawings and WebAudio synthesis, no asset files.

MIT licensed — see `LICENSE`.
