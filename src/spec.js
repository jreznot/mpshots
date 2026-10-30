import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { LAYOUTS } from './geometry.js';

export class SpecError extends Error {}

const OUTPUT_WIDTHS = [1920, 2560, 3840];

function toRect(v, where) {
  if (v == null) return null;
  if (Array.isArray(v) && v.length === 4 && v.every((n) => typeof n === 'number')) {
    const [x, y, w, h] = v;
    return { x, y, w, h };
  }
  if (typeof v === 'object' && ['x', 'y', 'w', 'h'].every((k) => typeof v[k] === 'number')) return { ...v };
  throw new SpecError(`${where}: expected [x, y, w, h] in source pixels`);
}

const asList = (v) => (v == null ? [] : Array.isArray(v) ? v.map(String) : [String(v)]);

function normalizeShot(raw, base, defaults, where) {
  if (!raw) return null;
  if (typeof raw === 'string') raw = { src: raw };
  if (!raw.src) throw new SpecError(`${where}: "src" is required`);
  return {
    src: path.resolve(base, raw.src),
    srcLabel: raw.src,
    crop: toRect(raw.crop, `${where}.crop`),
    highlight: raw.highlight == null ? [] : (Array.isArray(raw.highlight[0]) || typeof raw.highlight[0] === 'object'
      ? raw.highlight.map((r, i) => toRect(r, `${where}.highlight[${i}]`))
      : [toRect(raw.highlight, `${where}.highlight`)]),
    uiScale: Number(raw.uiScale ?? defaults.uiScale ?? 1),
    fit: raw.fit ?? 'fill',
  };
}

export function loadSpec(specPath) {
  const abs = path.resolve(specPath);
  if (!fs.existsSync(abs)) throw new SpecError(`Spec not found: ${specPath} (run "mpshots init" to create one)`);
  const base = path.dirname(abs);
  let doc;
  try {
    doc = YAML.parse(fs.readFileSync(abs, 'utf8'));
  } catch (e) {
    throw new SpecError(`Cannot parse ${specPath}: ${e.message}`);
  }
  if (!doc || typeof doc !== 'object') throw new SpecError('Spec is empty');

  const outWidth = Number(doc.output?.width ?? 1920);
  if (!OUTPUT_WIDTHS.includes(outWidth)) {
    throw new SpecError(`output.width must be one of ${OUTPUT_WIDTHS.join(', ')} (all 16:9)`);
  }
  const theme = doc.theme ?? 'dark';
  if (!['dark', 'light'].includes(theme)) throw new SpecError('theme must be "dark" or "light"');

  const brand = doc.brand ?? {};
  if (!brand.name) throw new SpecError('brand.name is required');
  const defaults = doc.defaults ?? {};

  if (!Array.isArray(doc.slides) || doc.slides.length === 0) throw new SpecError('slides: at least one slide is required');

  const slides = doc.slides.map((s, i) => {
    const where = `slides[${i}]`;
    const layout = s.layout ?? 'text-left';
    if (!LAYOUTS[layout]) throw new SpecError(`${where}.layout: unknown "${layout}" (use ${Object.keys(LAYOUTS).join(', ')})`);
    const screenshot = normalizeShot(s.screenshot, base, defaults, `${where}.screenshot`);
    if (!screenshot) throw new SpecError(`${where}.screenshot is required`);
    let overlay = null;
    if (s.overlay) {
      overlay = normalizeShot(s.overlay, base, defaults, `${where}.overlay`);
      overlay.x = Number(s.overlay.x ?? 1100);
      overlay.y = Number(s.overlay.y ?? 560);
      overlay.width = Number(s.overlay.width ?? 820);
    }
    return {
      index: i,
      id: String(s.id ?? `slide-${i + 1}`).replace(/[^a-z0-9-_]+/gi, '-'),
      layout,
      align: s.align ?? 'top',
      brand: s.brand ?? brand.name,
      headline: s.headline ?? '',
      body: asList(s.body),
      footnote: asList(s.footnote ?? defaults.footnote),
      screenshot,
      overlay,
    };
  });

  const resolveAsset = (p) => (p ? path.resolve(base, p) : null);
  return {
    file: abs,
    base,
    outWidth,
    theme,
    brand: {
      name: brand.name,
      logo: resolveAsset(brand.logo),
      accent: brand.accent ?? '#7B61FF',
    },
    fonts: {
      regular: resolveAsset(doc.fonts?.regular),
      semibold: resolveAsset(doc.fonts?.semibold),
      bold: resolveAsset(doc.fonts?.bold),
    },
    background: doc.background ? resolveAsset(doc.background) : null,
    outDir: path.resolve(base, doc.output?.dir ?? 'marketplace-screenshots'),
    slides,
  };
}
