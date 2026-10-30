import { sourceMeta } from './capture.js';
import { planSlide } from './render.js';
import { MIN_IDE_TEXT_PX } from './geometry.js';

const MIN_SOURCE = { width: 1920, height: 1080 };
const HEADLINE_MAX = 60;
const BODY_MAX = 240;

const inside = (r, m) => r.x >= 0 && r.y >= 0 && r.x + r.w <= m.width && r.y + r.h <= m.height;

/** Returns [{level: 'error'|'warn', slide, msg}] */
export async function validate(spec) {
  const out = [];
  const err = (slide, msg) => out.push({ level: 'error', slide, msg });
  const warn = (slide, msg) => out.push({ level: 'warn', slide, msg });

  const ids = new Set();
  for (const s of spec.slides) {
    const tag = `${s.index + 1}:${s.id}`;
    if (ids.has(s.id)) err(tag, `duplicate slide id "${s.id}"`);
    ids.add(s.id);

    for (const [label, shot] of [['screenshot', s.screenshot], ['overlay', s.overlay]]) {
      if (!shot) continue;
      const m = await sourceMeta(shot.src);
      if (!m) { err(tag, `${label}: file not found: ${shot.srcLabel}`); continue; }
      if (label === 'screenshot' && (m.width < MIN_SOURCE.width || m.height < MIN_SOURCE.height)) {
        warn(tag, `${label}: source is ${m.width}×${m.height}; capture at least 1920×1080 (2560×1440 or Retina is better)`);
      }
      if (shot.crop && !inside(shot.crop, m)) err(tag, `${label}.crop ${JSON.stringify(shot.crop)} is outside the ${m.width}×${m.height} image`);
      shot.highlight.forEach((r, i) => {
        if (!inside(r, m)) err(tag, `${label}.highlight[${i}] is outside the image`);
      });
    }
    if (out.some((o) => o.level === 'error' && o.slide === tag)) continue;

    const { win, ov } = await planSlide(spec, s);
    for (const [label, p] of [['screenshot', win], ['overlay', ov]]) {
      if (!p) continue;
      if (p.upscale > 1.05) {
        warn(tag, `${label} is upscaled ${p.upscale.toFixed(2)}× and will look soft — crop a larger area, use a 2560×1440 capture, or lower output.width`);
      }
      if (p.ideTextPx < MIN_IDE_TEXT_PX) {
        warn(tag, `${label}: IDE text renders at ~${p.ideTextPx.toFixed(1)}px (min ${MIN_IDE_TEXT_PX}px) — crop tighter or capture with a larger IDE zoom (set uiScale accordingly)`);
      }
    }
    for (const r of win.highlights) {
      if (r.x < win.box.x || r.y < win.box.y || r.x + r.w > win.box.x + win.box.w || r.y + r.h > win.box.y + win.box.h) {
        warn(tag, 'a highlight falls outside the visible part of the window');
      }
    }

    if (s.layout !== 'window' && !s.headline) warn(tag, 'no headline — every slide should say what it shows');
    if (s.headline.length > HEADLINE_MAX) warn(tag, `headline is ${s.headline.length} chars (aim for ≤ ${HEADLINE_MAX})`);
    const bodyLen = s.body.join(' ').length;
    if (bodyLen > BODY_MAX) warn(tag, `body text is ${bodyLen} chars (aim for ≤ ${BODY_MAX}); slides are viewed small`);
    if (s.layout === 'hero' && s.body.length > 1) warn(tag, 'hero layout shows only one short body line well');
  }
  return out;
}
