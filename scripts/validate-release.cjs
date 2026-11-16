const { version } = require('../package.json');
const ref = process.env.GITHUB_REF || '';
if (!/^\d+\.\d+\.\d+$/.test(version)) throw Error('Für stabile Releases eine Versionsnummer wie 1.0.1 verwenden.');
if (ref.startsWith('refs/tags/') && ref !== 'refs/tags/v' + version) throw Error('Git-Tag und package.json-Version stimmen nicht überein.');
console.log('Release-Version:', version);
