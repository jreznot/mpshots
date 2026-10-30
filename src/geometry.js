// All layout happens on a logical 1920×1080 canvas.
// Output resolution is set separately (1920, 2560 or 3840 wide) and everything scales.
export const W = 1920;
export const H = 1080;
export const MARGIN = 100;

// IDE default UI font size at 100% scale. Used to estimate how large
// IDE text appears in the final slide.
export const IDE_FONT_PX = 13;

// Minimum logical size (at 1920 wide) we consider readable for IDE text,
// given that the Marketplace carousel shows slides scaled down.
export const MIN_IDE_TEXT_PX = 16;

/**
 * Window placement per layout. `rect` is the visible window area on the canvas.
 * `anchor` says which corner of the crop is pinned (the rest bleeds off-canvas).
 * `bleed` lists canvas edges the window runs off, so no border/radius is drawn there.
 */
export const LAYOUTS = {
  'text-left': {
    text: { x: MARGIN, width: 820 },
    window: { rect: { x: 992, y: 100, w: W - 992, h: H - 100 }, anchor: 'top-left', bleed: ['right', 'bottom'] },
  },
  'text-right': {
    text: { x: 1000, width: 820 },
    window: { rect: { x: 0, y: 100, w: 928, h: H - 100 }, anchor: 'top-right', bleed: ['left', 'bottom'] },
  },
  hero: {
    text: { x: 260, width: 1400, centered: true },
    window: { rect: { x: 160, y: 380, w: W - 320, h: H - 380 }, anchor: 'top-center', bleed: ['bottom'] },
  },
  window: {
    text: null,
    window: { rect: { x: MARGIN, y: MARGIN, w: W - 2 * MARGIN, h: H - MARGIN }, anchor: 'top-center', bleed: ['bottom'] },
  },
};

/**
 * Scale factor (logical px per source px) so the crop fills the window rect.
 * fill: cover the rect (overflow bleeds off-canvas); width/height: fit that dimension.
 */
export function computeZoom(crop, rect, fit = 'fill') {
  const zw = rect.w / crop.w;
  const zh = rect.h / crop.h;
  if (fit === 'width') return zw;
  if (fit === 'height') return zh;
  return Math.max(zw, zh);
}

/** Offset (logical px) of the scaled crop's top-left relative to the window rect. */
export function cropOffset(anchor, dispW, rectW) {
  if (anchor === 'top-right') return { x: rectW - dispW, y: 0 };
  if (anchor === 'top-center') return { x: (rectW - dispW) / 2, y: 0 };
  return { x: 0, y: 0 };
}
