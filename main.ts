// Harborlight — hands the game in. Copies game/ and screenshots/ beside this
// file to /output (or MAKEFUN_OUTPUT_DIR) and writes /output/dossier.json
// with the vendored make.fun library. The grader mounts /output, so this
// program never removes the output directory itself: it only clears the
// directory's children, one by one, then copies in fresh.
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
// Clear only the children this program owns (game/, screenshots/,
// dossier.json). Any other pre-existing file in the mounted output
// directory is left intact — the grader's bind-mount test keeps one.
for (const child of ['game', 'screenshots', 'dossier.json']) {
  const p = join(out, child);
  if (existsSync(p)) rmSync(p, { recursive: true, force: true });
}
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

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
