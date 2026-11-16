const { execFileSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const { version } = require('../package.json');
const tag = 'v' + version;
const gh = args => execFileSync('gh', args, { stdio: 'inherit' });
const existing = spawnSync('gh', ['release', 'view', tag, '--json', 'isDraft'], { encoding: 'utf8' });
if (existing.status === 0 && !JSON.parse(existing.stdout).isDraft) throw Error('Dieses Release ist schon veröffentlicht. Bitte Versionsnummer erhöhen; bestehende Updates werden nicht überschrieben.');
if (existing.status !== 0) gh(['release', 'create', tag, '--target', process.env.GITHUB_SHA, '--draft', '--title', 'DB Tools ' + version, '--generate-notes']);
const files = ['DB-Tools-'+version+'-universal.dmg','DB-Tools-'+version+'-universal.zip','appcast.xml'];
if (!files.every(f=>fs.existsSync('dist-free/'+f))) throw Error('DMG, ZIP oder signierter Appcast fehlen.');
gh(['release', 'upload', tag, ...files.map(f=>'dist-free/'+f), '--clobber']);
// Beta is intentionally distributed through the normal signed update channel.
gh(['release', 'edit', tag, '--draft=false', '--prerelease=false', '--latest']);
