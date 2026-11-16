'use strict';
const path = require('node:path');
const { spawnSync } = require('node:child_process');
function hasDeveloperID(executable, packaged, run = spawnSync) {
  if (!packaged) return false;
  const bundle = path.dirname(path.dirname(path.dirname(executable)));
  const result = run('/usr/bin/codesign', ['-d', '--verbose=4', bundle], { encoding: 'utf8' });
  return result.status === 0 && /Authority=Developer ID Application:/.test(result.stderr || '');
}
module.exports = { hasDeveloperID };
