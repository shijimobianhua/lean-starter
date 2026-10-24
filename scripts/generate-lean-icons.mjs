import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Keep the selected source artwork unchanged. All app icons are proportional
// raster reductions of this master; this script never redraws its lettering.
// Use purpose: 'any' by default. Only advertise a maskable variant after
// checking the actual installer's safe-area cropping; never crop the master.
const masterUrl = new URL('../design/lean-icon-master.png', import.meta.url);
const source = await fs.readFile(masterUrl);
const sourceUrl = `data:image/png;base64,${source.toString('base64')}`;
const browser = await chromium.launch({ ...(process.env.PLAYWRIGHT_CHANNEL ? {channel:process.env.PLAYWRIGHT_CHANNEL} : {}), headless: true });
try {
  const page = await browser.newPage();
  for (const size of [180, 192, 512]) {
    const result = await page.evaluate(async ({ sourceUrl, size }) => {
      const image = new Image();
      image.src = sourceUrl;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('A 2D canvas context is required.');
      context.fillStyle = '#f6f3ea';
      context.fillRect(0, 0, size, size);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      const scale = Math.min(size / image.width, size / image.height);
      const width = image.width * scale;
      const height = image.height * scale;
      context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
      return {
        url: canvas.toDataURL('image/png'),
        masterWidth: image.width,
        masterHeight: image.height,
      };
    }, { sourceUrl, size });
    const png = Buffer.from(result.url.split(',')[1], 'base64');
    if (png.readUInt32BE(16) !== size || png.readUInt32BE(20) !== size) {
      throw new Error(`Unexpected PNG dimensions for ${size}px icon.`);
    }
    const output = fileURLToPath(new URL(`../public/lean-icon-${size}.png`, import.meta.url));
    await fs.writeFile(output, png);
    console.log(`${output}: ${size}x${size}; master ${result.masterWidth}x${result.masterHeight}`);
  }
  await page.close();
} finally {
  await browser.close();
}
