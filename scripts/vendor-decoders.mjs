#!/usr/bin/env node
// Copies the Draco + Basis (KTX2) decoders out of node_modules/three into
// /public so the loader doesn't depend on a third-party CDN. Wired up as a
// postinstall hook so it stays in sync with the installed three version.
import { copyFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC_BASE = join(ROOT, 'node_modules/three/examples/jsm/libs');
const OUT_BASE = join(ROOT, 'public');
const DIRS = ['draco', 'basis'];

async function copyDir(src, dest) {
  await mkdir(dest, { recursive: true });
  for (const entry of await readdir(src, { withFileTypes: true })) {
    const s = join(src, entry.name);
    const d = join(dest, entry.name);
    if (entry.isDirectory()) await copyDir(s, d);
    else await copyFile(s, d);
  }
}

async function main() {
  for (const dir of DIRS) {
    const src = join(SRC_BASE, dir);
    const dest = join(OUT_BASE, dir);
    if (!existsSync(src)) {
      console.warn(`[vendor-decoders] missing ${src}, skipping`);
      continue;
    }
    await copyDir(src, dest);
    console.log(`[vendor-decoders] ${dir}/ → public/${dir}/`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
