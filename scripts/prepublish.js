/*
 * Compile before packaging, but tolerate a pruned (production-only) install.
 *
 * `vsce package` runs this hook, and packaging is normally done after
 * `npm prune --omit=dev` to keep the VSIX small — at which point `tsc` is gone.
 * If the compiler is unavailable we accept a pre-built `out/` instead of
 * failing the package step.
 */
const { existsSync } = require('fs');
const { join } = require('path');
const { spawnSync } = require('child_process');

const root = join(__dirname, '..');
const outEntry = join(root, 'out', 'extension.js');
const tsc = join(
  root,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'tsc.cmd' : 'tsc'
);

if (existsSync(tsc)) {
  // `shell: true` re-parses the command line, so the path -- which may contain
  // spaces -- has to be quoted or cmd.exe truncates it at the first space.
  const res = spawnSync(JSON.stringify(tsc), ['-p', './'], {
    cwd: root,
    stdio: 'inherit',
    shell: true
  });
  process.exit(res.status === null ? 1 : res.status);
}

if (existsSync(outEntry)) {
  console.log('[prepublish] typescript not installed; using existing out/ build.');
  process.exit(0);
}

console.error(
  '[prepublish] typescript is not installed and out/ is missing.\n' +
    '             Run `npm install && npm run compile` before packaging.'
);
process.exit(1);
