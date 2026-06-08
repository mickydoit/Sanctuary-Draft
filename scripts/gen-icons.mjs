// Rasterises assets/img/app-icon.svg into the PNG sizes iOS / Android need.
// One-off tooling: `npm i sharp` then `node scripts/gen-icons.mjs`
// (sharp is not a project dependency; node_modules is gitignored.)
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'img');
const svg = readFileSync(join(dir, 'app-icon.svg'));

const TARGETS = [
  ['apple-touch-icon.png', 180], // iPhone home screen
  ['icon-192.png', 192],         // web manifest
  ['icon-512.png', 512],         // web manifest / install
];

for (const [name, size] of TARGETS) {
  await sharp(svg, { density: 384 })
    .resize(size, size)
    .flatten({ background: '#0c3b22' }) // belt-and-braces: no transparency for iOS
    .png()
    .toFile(join(dir, name));
  console.log(`wrote ${name} (${size}x${size})`);
}
