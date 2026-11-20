// NEON PALMS — entrypoint. Hands the game in: copies the static game/ folder and
// its screenshots to /output and writes the dossier the judge reads, using the
// kit's buildDossier so the file is byte for byte what the gate recomputes.
//
// Run it outside the grader with MAKEFUN_OUTPUT_DIR=out node main.ts.

import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// A stale /output from an earlier run would leave files the dossier never
// mentions, so clear the two folders this program owns before copying.
mkdirSync(out, { recursive: true });
for (const dir of ['game', 'screenshots']) {
  rmSync(join(out, dir), { recursive: true, force: true });
}

cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The scorer's caps, as the starter states them: a text budget for the dossier,
// four screenshots of at most 256 KiB, 993 files and 48 MiB of game files, and
// 1,000 bytes for any path under game/.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
