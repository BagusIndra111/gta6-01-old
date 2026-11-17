// SOLMAR CITY — dossier builder (make.fun entrypoint).
//
// Copies the game's static files and the screenshots into ./output, then
// asks the make.fun library to validate them and write dossier.json.
// Run from the repo root:  node main.ts
// The grader runs this in a sandbox with Node 22 and stdlib only.

import { copyFile, mkdir, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildDossier } from './vendor/makefun-game.ts';

const TEXT_CAP = 163840;
const SHOT_MAX_BYTES = 262144;
const GAME_MAX_FILES = 993;
const GAME_MAX_BYTES = 50331648;

async function copyTree(srcDir, dstDir) {
  await mkdir(dstDir, { recursive: true });
  const entries = await readdir(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const from = path.join(srcDir, entry.name);
    const to = path.join(dstDir, entry.name);
    if (entry.isDirectory()) await copyTree(from, to);
    else if (entry.isFile()) await copyFile(from, to);
  }
}

async function main() {
  const root = process.cwd();
  const outDir = path.join(root, 'output');

  await copyTree(path.join(root, 'game'), path.join(outDir, 'game'));
  await copyTree(path.join(root, 'screenshots'), path.join(outDir, 'screenshots'));

  // buildDossier returns the dossier as raw JSON bytes (a Uint8Array) —
  // write those bytes out verbatim, do not JSON.stringify the array.
  const dossierBytes = await buildDossier(outDir, {
    text_max_bytes: TEXT_CAP,
    screenshots: { max: 4, max_bytes: SHOT_MAX_BYTES },
    game_max_files: GAME_MAX_FILES,
    game_max_bytes: GAME_MAX_BYTES,
    game_path_max_bytes: 1000,
  });

  const dossierPath = path.join(outDir, 'dossier.json');
  await writeFile(dossierPath, dossierBytes);

  const dossier = JSON.parse(new TextDecoder().decode(dossierBytes));
  console.log('SOLMAR CITY dossier written to ' + dossierPath);
  console.log('dossier bytes: ' + dossierBytes.length + '  schema: ' + dossier.schema);
  console.log('images: ' + dossier.images.length + '  text bytes: ' + new TextEncoder().encode(dossier.text).length);
}

await main();
