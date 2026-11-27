// Gobble Dash — The Great Thanksgiving Escape (turkey-run-game-01 entry, Node 22, stdlib only).
//
// The game lives in game/ as plain static files a desktop browser plays offline. This program
// hands it in: it copies game/ and screenshots/ from beside this file into the output directory
// (/output in the grader, MAKEFUN_OUTPUT_DIR elsewhere) and writes dossier.json there with the
// vendored make.fun library, so the judge reads exactly the files this repository ships.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Fail loudly rather than hand in an empty game if the repository is incomplete.
if (!existsSync(join(repoRoot, 'game', 'index.html'))) {
  throw new Error('game/index.html is missing: nothing to hand in');
}

mkdirSync(outDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outDir, 'game'), { recursive: true });
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
const shotsDir = join(repoRoot, 'screenshots');
if (existsSync(shotsDir)) {
  cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });
}

// The scorer's caps, mirrored so a local run refuses what the gate would refuse: at most 4
// screenshots of 256 KiB each, at most 993 entries and 48 MiB under game/, no game/ path over
// 1000 bytes, and a dossier text of at most 160 KiB.
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
