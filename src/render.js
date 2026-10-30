import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import { LAYOUTS, W, H, MARGIN } from './geometry.js';
import { sourceMeta, planWindow, planOverlay, renderPixels } from './capture.js';

const require = createRequire(import.meta.url);

// ---------- fonts ----------
function interFile(weight) {
  return require.resolve(`@fontsource/inter/files/inter-latin-${weight}-normal.woff`);
}

export function loadFonts(spec) {
  const pick = (custom, weight) => fs.readFileSync(custom ?? interFile(weight));
  return [
    { name: 'Sans', data: pick(spec.fonts.regular, 400), weight: 400, style: 'normal' },
    { name: 'Sans', data: pick(spec.fonts.semibold, 600), weight: 600, style: 'normal' },
    { name: 'Sans', data: pick(spec.fonts.bold, 700), weight: 700, style: 'normal' },
  ];
}

// ---------- tiny element helper for satori ----------
function h(style, ...children) {
  const kids = children.flat().filter((c) => c != null && c !== false && c !== '');
  return { type: 'div', props: { style: { display: 'flex', ...style }, children: kids.length === 1 ? kids[0] : kids } };
}
const img = (src, width, height, style = {}) => ({ type: 'img', props: { src, width, height, style } });

// ---------- theme ----------
function palette(theme, accent) {
  const rgb = hexToRgb(accent);
  const a = (alpha) => `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
  if (theme === 'light') {
    return {
      base: 'linear-gradient(160deg, #F7F7FA 0%, #ECECF2 100%)',
      tintA: `radial-gradient(circle at 0% 100%, ${a(0.22)} 0%, rgba(255,255,255,0) 55%)`,
      tintB: `radial-gradient(circle at 100% 0%, ${a(0.10)} 0%, rgba(255,255,255,0) 45%)`,
      brand: '#111114', headline: '#0E0E12', body: 'rgba(14,14,18,0.82)', foot: 'rgba(14,14,18,0.5)',
      frame: 'rgba(0,0,0,0.14)', shadow: { color: '#141428', opacity: 0.3, dy: 24, blur: 70 }, accent,
    };
  }
  return {
    base: 'linear-gradient(160deg, #0E0D14 0%, #050507 55%, #000000 100%)',
    tintA: `radial-gradient(circle at 0% 100%, ${a(0.30)} 0%, rgba(0,0,0,0) 55%)`,
    tintB: `radial-gradient(circle at 100% 0%, ${a(0.12)} 0%, rgba(0,0,0,0) 40%)`,
    brand: '#FFFFFF', headline: '#FFFFFF', body: 'rgba(255,255,255,0.9)', foot: 'rgba(255,255,255,0.5)',
    frame: 'rgba(255,255,255,0.14)', shadow: { color: '#000000', opacity: 0.65, dy: 30, blur: 90 }, accent,
  };
}

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return { r: 123, g: 97, b: 255 };
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function fileDataUri(file) {
  const ext = path.extname(file).toLowerCase();
  const mime = ext === '.svg' ? 'image/svg+xml' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
  return `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
}

// ---------- shadows ----------
// resvg's blur filter is very slow on large areas (seconds per shadow), so soft
// shadows and glows are pre-rendered with sharp and embedded as one image layer.
async function shadowLayer(items, outWidth) {
  if (!items.length) return null;
  const k = outWidth / W;
  const ow = outWidth;
  const oh = Math.round(H * k);
  const layers = [];
  for (const it of items) {
    const rect = `<rect x="${(it.x + (it.dx ?? 0)) * k}" y="${(it.y + (it.dy ?? 0)) * k}" width="${it.w * k}" height="${it.h * k}" rx="${(it.radius ?? 0) * k}" ${it.stroke
      ? `fill="none" stroke="${it.color}" stroke-opacity="${it.opacity}" stroke-width="${it.stroke * k}"`
      : `fill="${it.color}" fill-opacity="${it.opacity}"`}/>`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${ow}" height="${oh}">${rect}</svg>`;
    const blurred = await sharp(Buffer.from(svg)).blur(Math.max(0.3, (it.blur / 2) * k)).png().toBuffer();
    layers.push({ input: blurred, blend: 'over' });
  }
  const buf = await sharp({ create: { width: ow, height: oh, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(layers)
    .png()
    .toBuffer();
  return `data:image/png;base64,${buf.toString('base64')}`;
}

// ---------- pieces ----------
function windowFrame(plan, dataUri, pal, radius = 14) {
  const { box, bleed } = plan;
  const border = `1px solid ${pal.frame}`;
  const r = (a, b) => (bleed.has(a) || bleed.has(b) ? 0 : radius);
  return h(
    {
      position: 'absolute', left: box.x, top: box.y, width: box.w, height: box.h,
      overflow: 'hidden',
      borderTop: border,
      borderLeft: bleed.has('left') ? 'none' : border,
      borderRight: bleed.has('right') ? 'none' : border,
      borderBottom: bleed.has('bottom') ? 'none' : border,
      borderTopLeftRadius: r('top', 'left'),
      borderTopRightRadius: r('top', 'right'),
      borderBottomLeftRadius: r('bottom', 'left'),
      borderBottomRightRadius: r('bottom', 'right'),
      backgroundColor: '#1E1F22',
    },
    img(dataUri, box.w, box.h, { width: box.w, height: box.h }),
  );
}

function highlightBoxes(highlights, pal) {
  return highlights.map((r) =>
    h({
      position: 'absolute', left: r.x - 6, top: r.y - 6, width: r.w + 12, height: r.h + 12,
      border: `3px solid ${pal.accent}`, borderRadius: 10,
    }),
  );
}

function brandRow(spec, slide, pal, centered) {
  const logo = spec.brand.logo && fs.existsSync(spec.brand.logo)
    ? img(fileDataUri(spec.brand.logo), 56, 56, { width: 56, height: 56, marginRight: 14 })
    : null;
  return h(
    { alignItems: 'center', justifyContent: centered ? 'center' : 'flex-start' },
    logo,
    h({ fontSize: 40, fontWeight: 600, color: pal.brand, letterSpacing: -0.4 }, slide.brand),
  );
}

function textBlock(spec, slide, pal, t) {
  const centered = !!t.centered;
  const align = centered ? 'center' : 'left';
  return h(
    { flexDirection: 'column', width: t.width, alignItems: centered ? 'center' : 'flex-start' },
    brandRow(spec, slide, pal, centered),
    slide.headline && h(
      { marginTop: centered ? 28 : 34, fontSize: centered ? 64 : 68, fontWeight: 700, lineHeight: 1.12, letterSpacing: -1.2, color: pal.headline, textAlign: align, width: t.width, justifyContent: centered ? 'center' : 'flex-start' },
      slide.headline,
    ),
    slide.body.length > 0 && h(
      { flexDirection: 'column', marginTop: centered ? 18 : 48, width: t.width },
      slide.body.map((p, i) =>
        h({ fontSize: centered ? 32 : 38, lineHeight: 1.36, color: pal.body, marginTop: i ? 22 : 0, textAlign: align, width: t.width, justifyContent: centered ? 'center' : 'flex-start' }, p),
      ),
    ),
  );
}

function footnote(slide, pal, t) {
  if (!slide.footnote.length || t.centered) return null;
  return h(
    { position: 'absolute', left: t.x, bottom: MARGIN, width: t.width, flexDirection: 'column' },
    slide.footnote.map((f, i) => h({ fontSize: 30, lineHeight: 1.3, color: pal.foot, marginTop: i ? 18 : 0 }, f)),
  );
}

// ---------- slide ----------
export async function planSlide(spec, slide) {
  const meta = await sourceMeta(slide.screenshot.src);
  if (!meta) throw new Error(`Screenshot not found: ${slide.screenshot.srcLabel}`);
  const win = planWindow(slide.screenshot, meta, slide.layout, spec.outWidth);
  let ov = null;
  if (slide.overlay) {
    const ometa = await sourceMeta(slide.overlay.src);
    if (!ometa) throw new Error(`Overlay screenshot not found: ${slide.overlay.srcLabel}`);
    ov = planOverlay(slide.overlay, ometa);
    ov.upscale = ov.zoom * (spec.outWidth / W);
  }
  return { meta, win, ov };
}

export async function renderSlide(spec, slide, fonts) {
  const pal = palette(spec.theme, spec.brand.accent);
  const layout = LAYOUTS[slide.layout];
  const { win, ov } = await planSlide(spec, slide);

  const layers = [
    h({ position: 'absolute', left: 0, top: 0, width: W, height: H, backgroundImage: pal.base }),
    spec.background
      ? img(fileDataUri(spec.background), W, H, { position: 'absolute', left: 0, top: 0, width: W, height: H, objectFit: 'cover' })
      : h({ position: 'absolute', left: 0, top: 0, width: W, height: H, backgroundImage: pal.tintA }),
    !spec.background && h({ position: 'absolute', left: 0, top: 0, width: W, height: H, backgroundImage: pal.tintB }),
  ];

  const t = layout.text;
  if (t) {
    const centeredV = slide.align === 'center' && !t.centered;
    layers.push(
      h(
        {
          position: 'absolute', left: t.x, top: t.centered ? 92 : MARGIN, width: t.width,
          height: t.centered ? 260 : H - 2 * MARGIN,
          flexDirection: 'column', justifyContent: centeredV ? 'center' : 'flex-start',
        },
        textBlock(spec, slide, pal, t),
      ),
      footnote(slide, pal, t),
    );
  }

  const glow = (r) => ({ x: r.x - 6, y: r.y - 6, w: r.w + 12, h: r.h + 12, radius: 10, color: pal.accent, opacity: 0.9, stroke: 10, blur: 24 });
  const sh = (b) => ({ ...b, radius: 14, color: pal.shadow.color, opacity: pal.shadow.opacity, dy: pal.shadow.dy, blur: pal.shadow.blur });
  const full = (uri) => uri && img(uri, W, H, { position: 'absolute', left: 0, top: 0, width: W, height: H });
  layers.push(full(await shadowLayer([sh(win.box)], spec.outWidth)));
  layers.push(windowFrame(win, await renderPixels(slide.screenshot.src, win, spec.outWidth), pal));
  layers.push(full(await shadowLayer(win.highlights.map(glow), spec.outWidth)));
  layers.push(...highlightBoxes(win.highlights, pal));
  if (ov) {
    layers.push(full(await shadowLayer([sh(ov.box)], spec.outWidth)));
    layers.push(windowFrame(ov, await renderPixels(slide.overlay.src, ov, spec.outWidth), pal, 12));
    layers.push(full(await shadowLayer(ov.highlights.map(glow), spec.outWidth)));
    layers.push(...highlightBoxes(ov.highlights, pal));
  }

  const tree = h({ position: 'relative', width: W, height: H, fontFamily: 'Sans', overflow: 'hidden' }, layers);
  const svg = await satori(tree, { width: W, height: H, fonts });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: spec.outWidth }, font: { loadSystemFonts: false } })
    .render()
    .asPng();
  return sharp(png).png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
}
