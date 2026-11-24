#!/usr/bin/env node
/**
 * check.js - static sanity check of the project (no dependencies).
 * Verifies the file layout, that every import resolves and that the level
 * catalogue is structurally valid.
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let errors = 0;
let checked = 0;

function fail(msg) { console.error('✖', msg); errors++; }

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir)) {
    const p = join(dir, entry);
    const s = await stat(p);
    if (s.isDirectory()) out.push(...await walk(p));
    else out.push(p);
  }
  return out;
}

async function main() {
  const required = [
    'index.html', 'package.json', 'capacitor.config.json', 'README.md',
    'src/main.js', 'src/core/game.js', 'src/core/board.js', 'src/core/path-engine.js',
    'src/core/level-manager.js', 'src/core/input-manager.js', 'src/core/renderer.js',
    'src/ui/main-menu.js', 'src/ui/gameplay-screen.js', 'src/ui/level-selection.js',
    'src/ui/settings-screen.js', 'src/ui/statistics-screen.js', 'src/ui/dialogs.js',
    'src/data/levels.js', 'src/systems/storage.js', 'src/systems/audio.js',
    'src/systems/localization.js', 'src/systems/progression.js', 'src/systems/hints.js',
    'styles/main.css', 'styles/game.css', 'styles/components.css',
  ];
  for (const f of required) if (!existsSync(join(root, f))) fail(`missing file: ${f}`);

  // resolve every relative import
  const files = (await walk(join(root, 'src'))).filter((f) => f.endsWith('.js'));
  for (const file of files) {
    const code = await readFile(file, 'utf8');
    const re = /from\s+['"](\.[^'"]+)['"]/g;
    let m;
    while ((m = re.exec(code))) {
      checked++;
      const target = resolve(dirname(file), m[1]);
      if (!existsSync(target)) fail(`unresolved import ${m[1]} in ${file.replace(root, '')}`);
    }
  }

  // level catalogue validation
  const levelsSrc = await readFile(join(root, 'src/data/levels.js'), 'utf8');
  const match = levelsSrc.match(/export const LEVELS = (\[[\s\S]*?\]);/);
  if (!match) fail('could not parse LEVELS from src/data/levels.js');
  else {
    const LEVELS = JSON.parse(match[1]);
    if (LEVELS.length < 30) fail(`expected at least 30 levels, found ${LEVELS.length}`);
    const seen = new Set();
    for (const lv of LEVELS) {
      const tag = `level ${lv.id}`;
      if (seen.has(lv.id)) fail(`${tag}: duplicate id`);
      seen.add(lv.id);
      if (!lv.pairs.length) fail(`${tag}: no pairs`);
      if (lv.pairs.length !== lv.colors.length) fail(`${tag}: colour count mismatch`);
      if (lv.solution.length !== lv.pairs.length) fail(`${tag}: solution mismatch`);
      const used = new Set();
      lv.solution.forEach((path, i) => {
        path.forEach(([c, r]) => {
          if (c < 0 || c >= lv.cols || r < 0 || r >= lv.rows) fail(`${tag}: cell out of bounds`);
          const key = `${c},${r}`;
          if (used.has(key)) fail(`${tag}: crossing at ${key}`);
          used.add(key);
        });
        for (let k = 0; k < path.length - 1; k++) {
          const [c1, r1] = path[k]; const [c2, r2] = path[k + 1];
          if (Math.abs(c1 - c2) + Math.abs(r1 - r2) !== 1) fail(`${tag}: gap in solution`);
        }
        const [a, b] = lv.pairs[i];
        const s = path[0]; const e = path[path.length - 1];
        const ok = (s[0] === a[0] && s[1] === a[1] && e[0] === b[0] && e[1] === b[1])
          || (s[0] === b[0] && s[1] === b[1] && e[0] === a[0] && e[1] === a[1]);
        if (!ok) fail(`${tag}: solution does not match its endpoints`);
      });
    }
    console.log(`✔ ${LEVELS.length} levels checked`);
  }

  console.log(`✔ ${checked} imports resolved`);
  if (errors) {
    console.error(`\n${errors} problem(s) found`);
    process.exit(1);
  }
  console.log('✔ all checks passed');
}

main().catch((e) => { console.error(e); process.exit(1); });
