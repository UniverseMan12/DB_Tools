'use strict';
// Sparkle ignores the hyphen suffix in SemVer. Use a numeric build version:
// patch * 1000 + beta iteration; stable occupies the final slot (999).
function macBuildVersion(version) {
  const match=/^(\d+)\.(\d+)\.(\d+)(?:-beta\.(\d+))?$/.exec(version);
  if(!match)throw Error('Nicht unterstützte Release-Version.');
  const [,major,minor,patch,beta]=match;
  if(beta!==undefined&&(+beta<1||+beta>998))throw Error('Beta-Nummer muss zwischen 1 und 998 liegen.');
  return `${+major}.${+minor}.${+patch*1000+(beta===undefined?999:+beta)}`;
}
module.exports={macBuildVersion};
