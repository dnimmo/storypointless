import sharp from 'sharp';
import { mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const branding = path.join(root, 'branding');
const out = path.join(root, 'public');

await mkdir(out, { recursive: true });

async function svgToPng(srcSvg, dstPng, width, height) {
  await sharp(srcSvg)
    .resize(width, height, { fit: 'contain', background: { r: 11, g: 12, b: 15, alpha: 1 } })
    .png()
    .toFile(dstPng);
  console.log(`  ✓ ${path.relative(root, dstPng)}  (${width}×${height})`);
}

console.log('Building image assets…');

// SVG favicon — pass-through so modern browsers can use it directly.
await copyFile(path.join(branding, 'icon.svg'), path.join(out, 'favicon.svg'));
console.log(`  ✓ ${path.relative(root, path.join(out, 'favicon.svg'))}`);

// Apple touch icon — iOS homescreen / various platforms still want PNG.
await svgToPng(path.join(branding, 'icon.svg'), path.join(out, 'apple-touch-icon.png'), 180, 180);

// OG share image — 1200×630 is the standard size for Twitter/Facebook/LinkedIn link previews.
await svgToPng(path.join(branding, 'og.svg'), path.join(out, 'og.png'), 1200, 630);

console.log('Done.');
