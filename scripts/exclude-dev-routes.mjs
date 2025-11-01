#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const devDir = path.join(root, 'src', 'app', 'dev');
const stashDir = path.join(root, '.dev-pages.stash');
const marker = path.join(root, '.dev-pages-removed');

if (!fs.existsSync(devDir)) {
  // Nothing to do
  process.exit(0);
}

if (fs.existsSync(stashDir)) {
  if (!fs.existsSync(devDir)) {
    // Previous run likely failed before restore; allow continuing.
    console.log('[exclude-dev-routes] Dev pages already stashed, continuing.');
    if (!fs.existsSync(marker)) {
      fs.writeFileSync(marker, new Date().toISOString());
    }
    process.exit(0);
  }
  console.error('[exclude-dev-routes] stash directory already exists while dev directory still present; aborting to avoid overwriting.');
  process.exit(1);
}

fs.renameSync(devDir, stashDir);
fs.writeFileSync(marker, new Date().toISOString());
console.log('[exclude-dev-routes] Moved dev pages out of src/app.');
