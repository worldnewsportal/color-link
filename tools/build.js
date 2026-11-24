#!/usr/bin/env node
/**
 * build.js - copies the web app into the Capacitor webDir (public/).
 * No bundler, no dependencies: the game ships as plain ES modules.
 */
import { cp, mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public');

async function main() {
  if (existsSync(out)) await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });

  for (const item of ['index.html', 'src', 'styles', 'assets']) {
    const from = join(root, item);
    if (!existsSync(from)) continue;
    await cp(from, join(out, item), { recursive: true });
  }

  // the game must always run without a network connection
  const index = await readFile(join(out, 'index.html'), 'utf8');
  const offline = index.replace(
    '</head>',
    '  <meta http-equiv="Content-Security-Policy" content="default-src \'self\' data: blob:; style-src \'self\' \'unsafe-inline\'; script-src \'self\'; media-src \'self\' data: blob:; connect-src \'self\'">\n</head>'
  );
  await writeFile(join(out, 'index.html'), offline);

  console.log('✔ web app built into', out);
}

main().catch((err) => {
  console.error('build failed:', err);
  process.exit(1);
});
