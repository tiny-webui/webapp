#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const devDir = path.join(root, 'src', 'app', 'dev');
const stashDir = path.join(root, '.dev-pages.stash');
const marker = path.join(root, '.dev-pages-removed');

if (!fs.existsSync(stashDir)) {
  // Nothing to restore
  process.exit(0);
}

if (fs.existsSync(devDir)) {
  console.error('[restore-dev-routes] Destination already exists, aborting.');
  process.exit(1);
}

fs.renameSync(stashDir, devDir);
if (fs.existsSync(marker)) fs.unlinkSync(marker);
console.log('[restore-dev-routes] Restored dev pages.');
