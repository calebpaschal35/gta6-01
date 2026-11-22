// Harborlight — entrypoint for make.fun gta6-01.
// Copies game/ and screenshots/ from this repository to the output directory
// and writes /output/dossier.json with buildDossier from vendor/makefun-game.ts.
// The output directory is a mount in the grader: it is created with mkdirSync
// only and never removed; its previous contents are cleared child by child.
import { mkdirSync, readdirSync, statSync, copyFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const REPO = dirname(fileURLToPath(import.meta.url));
const OUT = process.env.MAKEFUN_OUTPUT_DIR || '/output';

function clearChildren(dir: string): void {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    rmSync(p, { recursive: true, force: true });
  }
}

function copyTree(src: string, dest: string): void {
  mkdirSync(dest, { recursive: true });
  for (const name of readdirSync(src)) {
    const s = join(src, name);
    const d = join(dest, name);
    const st = statSync(s);
    if (st.isDirectory()) copyTree(s, d);
    else if (st.isFile()) copyFileSync(s, d);
  }
}

function main(): void {
  // Create the output directory if missing; never remove it.
  mkdirSync(OUT, { recursive: true });
  // Clear only the directory's children, never the directory itself.
  clearChildren(OUT);
  copyTree(join(REPO, 'game'), join(OUT, 'game'));
  const shots = join(REPO, 'screenshots');
  if (existsSync(shots)) copyTree(shots, join(OUT, 'screenshots'));
  const dossier = buildDossier(OUT, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 256 * 1024 },
    game_max_files: 993,
    game_max_bytes: 48 * 1024 * 1024,
    game_path_max_bytes: 1000,
  });
  writeFileSync(join(OUT, 'dossier.json'), dossier);
  const gameFiles = readdirSync(join(OUT, 'game')).length;
  console.log('Harborlight: wrote ' + gameFiles + ' top-level game entries and dossier.json (' + dossier.length + ' bytes) to ' + OUT);
}

main();
