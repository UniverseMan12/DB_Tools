const { version } = require('../package.json');
const ref = process.env.GITHUB_REF || '';
if (!/^\d+\.\d+\.\d+(-beta\.\d+)?$/.test(version)) throw Error('Versionsnummer wie 1.2.0 oder 1.2.0-beta.1 verwenden.');
if (ref.startsWith('refs/tags/') && ref !== 'refs/tags/v' + version) throw Error('Git-Tag und package.json-Version stimmen nicht überein.');
console.log('Release-Version:', version);
