/**
 * Reads the root VERSION file and writes it into all workspace package.json
 * files so every package stays in sync from a single source of truth.
 *
 * Usage: node scripts/sync-version.cjs
 * Hooked into: pnpm predev, build pipeline
 */
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const versionFile = path.join(rootDir, 'VERSION');

if (!fs.existsSync(versionFile)) {
  console.error('[sync-version] VERSION file not found at', versionFile);
  process.exit(1);
}

const version = fs.readFileSync(versionFile, 'utf8').trim();
if (!version) {
  console.error('[sync-version] VERSION file is empty');
  process.exit(1);
}

const pkgPaths = [
  'package.json',
  'layers/web/package.json',
  'layers/desktop/package.json',
  'layers/daemon/package.json',
  'packages/agent-core/package.json',
  'packages/core/package.json',
];

let changed = 0;
for (const relPath of pkgPaths) {
  const pkgPath = path.join(rootDir, relPath);
  if (!fs.existsSync(pkgPath)) {
    console.warn('[sync-version] Skipping missing:', relPath);
    continue;
  }
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  if (pkg.version !== version) {
    pkg.version = version;
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    console.log('[sync-version] Updated', relPath, '→', version);
    changed++;
  }
}

if (changed === 0) {
  console.log('[sync-version] All packages already at version', version);
}
