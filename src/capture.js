import fs from 'node:fs';
import sharp from 'sharp';
import { LAYOUTS, W, IDE_FONT_PX, computeZoom, cropOffset } from './geometry.js';

const metaCache = new Map();

export async function sourceMeta(file) {
  if (metaCache.has(file)) return metaCache.get(file);
  if (!fs.existsSync(file)) return null;
  const m = await sharp(file).metadata();
  const meta = { width: m.width, height: m.height };
  metaCache.set(file, meta);
  return meta;
}

const EPS = 0.5;

/**
 * Work out where a screenshot lands for a given layout. Pure geometry, no pixels,
 * so the validator can use it without rendering.
 */
export function planWindow(shot, meta, layoutName, outWidth) {
  const layout = LAYOUTS[layoutName].window;
  const rect = layout.rect;
  const crop = shot.crop ?? { x: 0, y: 0, w: meta.width, h: meta.height };
  const zoom = computeZoom(crop, rect, shot.fit);
  const dispW = crop.w * zoom;
  const dispH = crop.h * zoom;
  const off = cropOffset(layout.anchor, dispW, rect.w);

  // Visible part of the scaled crop, clipped to the window rect.
  const left = Math.max(0, off.x);
  const right = Math.min(rect.w, off.x + dispW);
  const box = { x: rect.x + left, y: rect.y, w: right - left, h: Math.min(rect.h, dispH) };

  const overflowX = dispW > rect.w + EPS;
  const overflowY = dispH > rect.h + EPS;
  const bleed = new Set();
  for (const edge of layout.bleed) {
    if ((edge === 'bottom' && overflowY) || ((edge === 'left' || edge === 'right') && overflowX)) bleed.add(edge);
  }

  const originX = rect.x + off.x; // logical position of crop's (0,0)
  const originY = rect.y + off.y;
  const highlights = shot.highlight.map((r) => ({
    x: originX + (r.x - crop.x) * zoom,
    y: originY + (r.y - crop.y) * zoom,
    w: r.w * zoom,
    h: r.h * zoom,
  }));

  return {
    crop, zoom, box, bleed, highlights,
    // which source pixels are actually visible
    srcVisible: {
      x: crop.x + (box.x - originX) / zoom,
      y: crop.y + (box.y - originY) / zoom,
      w: box.w / zoom,
      h: box.h / zoom,
    },
    ...metrics(zoom, shot.uiScale, outWidth),
  };
}

export function planOverlay(ov, meta) {
  const crop = ov.crop ?? { x: 0, y: 0, w: meta.width, h: meta.height };
  const zoom = ov.width / crop.w;
  const box = { x: ov.x, y: ov.y, w: ov.width, h: crop.h * zoom };
  const highlights = ov.highlight.map((r) => ({
    x: box.x + (r.x - crop.x) * zoom, y: box.y + (r.y - crop.y) * zoom, w: r.w * zoom, h: r.h * zoom,
  }));
  return { crop, zoom, box, bleed: new Set(), highlights, srcVisible: crop, ...metrics(zoom, ov.uiScale) };
}

function metrics(zoom, uiScale, outWidth = W) {
  return {
    // output pixels per source pixel; > 1 means the screenshot is being upscaled (soft)
    upscale: zoom * (outWidth / W),
    // approximate rendered size of the IDE's default UI font, in logical px
    ideTextPx: IDE_FONT_PX * uiScale * zoom,
  };
}

/** Extract the visible source region, resample once to final output pixels, return a data URI. */
export async function renderPixels(file, plan, outWidth) {
  const k = outWidth / W;
  const s = plan.srcVisible;
  const meta = await sourceMeta(file);
  const ex = {
    left: clamp(Math.round(s.x), 0, meta.width - 1),
    top: clamp(Math.round(s.y), 0, meta.height - 1),
  };
  ex.width = clamp(Math.round(s.w), 1, meta.width - ex.left);
  ex.height = clamp(Math.round(s.h), 1, meta.height - ex.top);
  const buf = await sharp(file)
    .extract(ex)
    .resize(Math.round(plan.box.w * k), Math.round(plan.box.h * k), { fit: 'fill', kernel: 'lanczos3' })
    .png()
    .toBuffer();
  return `data:image/png;base64,${buf.toString('base64')}`;
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
