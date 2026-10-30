import sharp from 'sharp';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';

/**
 * Draws a labelled coordinate grid over a raw screenshot so authors can read off
 * crop and highlight rectangles in source pixels.
 */
export async function makeGrid(input, output, fonts, step = 100) {
  const { width, height } = await sharp(input).metadata();
  const kids = [];
  for (let x = 0; x <= width; x += step) {
    const major = x % (step * 5) === 0;
    kids.push(line({ left: x, top: 0, width: major ? 2 : 1, height }, major));
    kids.push(label(x + 4, 4, String(x)));
  }
  for (let y = step; y <= height; y += step) {
    const major = y % (step * 5) === 0;
    kids.push(line({ left: 0, top: y, width, height: major ? 2 : 1 }, major));
    kids.push(label(4, y + 4, String(y)));
  }
  const svg = await satori(
    { type: 'div', props: { style: { display: 'flex', position: 'relative', width, height }, children: kids } },
    { width, height, fonts },
  );
  const overlay = new Resvg(svg).render().asPng();
  await sharp(input).composite([{ input: overlay }]).png().toFile(output);
  return { width, height };
}

const line = (pos, major) => ({
  type: 'div',
  props: { style: { display: 'flex', position: 'absolute', ...pos, backgroundColor: major ? 'rgba(255,60,120,0.85)' : 'rgba(0,200,255,0.55)' } },
});
const label = (left, top, text) => ({
  type: 'div',
  props: {
    style: { display: 'flex', position: 'absolute', left, top, fontSize: 14, fontWeight: 700, color: '#fff', backgroundColor: 'rgba(0,0,0,0.7)', padding: '1px 4px', borderRadius: 3 },
    children: text,
  },
});
