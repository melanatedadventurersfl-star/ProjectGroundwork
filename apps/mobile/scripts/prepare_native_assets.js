const fs = require('node:fs');
const path = require('node:path');

const assetsDir = path.resolve(__dirname, '..', 'assets');
const source = path.join(assetsDir, 'ma-splash-icon.png');
const target = path.join(assetsDir, 'ma-app-icon.png');

if (!fs.existsSync(source)) {
  throw new Error(`Missing native asset source: ${source}`);
}

const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const sourceBytes = fs.readFileSync(source);

if (sourceBytes.length < 12 || !sourceBytes.subarray(0, 8).equals(pngSignature)) {
  throw new Error('ma-splash-icon.png is not a valid PNG source.');
}

// EAS build images do not guarantee Python/pip. Keep native asset preparation
// dependency-free so npm ci can always materialize a known-good launcher icon.
fs.copyFileSync(source, target);
console.log(`Prepared native app icon from ${path.basename(source)} (${sourceBytes.length} bytes).`);
