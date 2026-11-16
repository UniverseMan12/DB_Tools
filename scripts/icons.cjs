const sharp = require('sharp');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
(async () => {
  fs.mkdirSync('build/icon.iconset', { recursive: true });
  for (const s of [16, 32, 128, 256, 512]) for (const scale of [1, 2]) await sharp('app/logo.svg').resize(s * scale).png().toFile(`build/icon.iconset/icon_${s}x${s}${scale === 2 ? '@2x' : ''}.png`);
  execFileSync('/usr/bin/iconutil', ['-c', 'icns', 'build/icon.iconset', '-o', 'build/icon.icns']);
  await sharp('app/logo.svg').png().toFile('build/logo.png');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="680" height="440"><rect width="680" height="440" fill="#f2f2f2"/><rect width="680" height="115" fill="#353535"/><text x="340" y="58" text-anchor="middle" font-family="Helvetica,Arial" font-size="30" font-weight="700" fill="#efefef">DB Tools</text><text x="340" y="85" text-anchor="middle" font-family="Helvetica,Arial" font-size="13" fill="#c3c3c3">Präzise planen. Mehr rausholen.</text><text x="340" y="235" text-anchor="middle" font-family="Helvetica,Arial" font-size="44" fill="#838383">→</text><text x="340" y="355" text-anchor="middle" font-family="Helvetica,Arial" font-size="16" fill="#434343">DB Tools in den Programme-Ordner ziehen.</text><text x="340" y="382" text-anchor="middle" font-family="Helvetica,Arial" font-size="12" fill="#878787">Danach aus „Programme“ öffnen.</text></svg>`;
  await sharp(Buffer.from(svg)).png().toFile('build/dmg-background.png');
})();
