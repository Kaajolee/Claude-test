#!/usr/bin/env node
// Drop raw Blender/Maya exports into /models-src/ then run `npm run optimize`.
// Each .glb/.gltf is compressed (Draco meshes, WebP textures, dedup, prune)
// and written to /public/models/ where the site loads them.
import { readdir, mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, basename, extname } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, 'models-src');
const OUT = join(ROOT, 'public/models');

async function main() {
  if (!existsSync(SRC)) {
    console.log(`No models-src/ directory. Create it and drop .glb files to optimize.`);
    return;
  }
  await mkdir(OUT, { recursive: true });

  const entries = await readdir(SRC);
  const models = entries.filter((f) =>
    ['.glb', '.gltf'].includes(extname(f).toLowerCase())
  );

  if (models.length === 0) {
    console.log(`No .glb/.gltf files in models-src/. Drop exports in and rerun.`);
    return;
  }

  let totalIn = 0;
  let totalOut = 0;

  for (const file of models) {
    const inPath = join(SRC, file);
    const outPath = join(OUT, basename(file, extname(file)) + '.glb');

    const inSize = (await stat(inPath)).size;
    totalIn += inSize;

    console.log(`\n→ ${file} (${fmtBytes(inSize)})`);
    await exec('npx', [
      'gltf-transform',
      'optimize',
      inPath,
      outPath,
      '--texture-compress', 'webp',
    ]);

    const outSize = (await stat(outPath)).size;
    totalOut += outSize;
    const ratio = (outSize / inSize) * 100;
    console.log(`  ↳ ${fmtBytes(outSize)}  (${ratio.toFixed(1)}% of original)`);
  }

  console.log(
    `\nDone. ${models.length} model(s): ${fmtBytes(totalIn)} → ${fmtBytes(totalOut)} ` +
    `(${((totalOut / totalIn) * 100).toFixed(1)}%)`
  );
}

function exec(cmd, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    proc.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} exited with ${code}`))
    );
  });
}

function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
