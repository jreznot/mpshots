const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

/** A static preview page: each slide at roughly the size the Marketplace carousel shows it. */
export function contactSheet(spec, files, issues) {
  const byslide = (s) => issues.filter((i) => i.slide === `${s.index + 1}:${s.id}`);
  const cards = files.map(({ name, slide, bytes }) => {
    const notes = byslide(slide)
      .map((i) => `<li class="${i.level}">${esc(i.msg)}</li>`)
      .join('');
    return `<figure>
  <a href="${esc(name)}"><img src="${esc(name)}" alt="${esc(slide.headline || slide.id)}"></a>
  <figcaption><b>${esc(name)}</b> · ${slide.layout} · ${(bytes / 1024).toFixed(0)} KB${notes ? `<ul>${notes}</ul>` : ''}</figcaption>
</figure>`;
  });
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(spec.brand.name)} · Marketplace screenshots</title>
<style>
  :root { color-scheme: light dark; --bg:#f4f4f6; --fg:#16161a; --muted:#6b6b76; --card:#fff; }
  @media (prefers-color-scheme: dark) { :root { --bg:#141417; --fg:#ececf1; --muted:#9a9aa6; --card:#1d1d22; } }
  body { margin:0; background:var(--bg); color:var(--fg); font:15px/1.5 system-ui, sans-serif; }
  main { max-width: 880px; margin: 0 auto; padding: 32px 16px 64px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  p { color: var(--muted); margin: 0 0 28px; }
  figure { margin: 0 0 36px; background: var(--card); border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,.12); }
  img { display:block; width: 100%; max-width: 800px; margin: 0 auto; }
  figcaption { padding: 10px 14px; color: var(--muted); font-size: 13px; }
  figcaption b { color: var(--fg); }
  ul { margin: 6px 0 0; padding-left: 18px; }
  li.warn { color: #c98a00; } li.error { color: #e5484d; }
</style></head>
<body><main>
<h1>${esc(spec.brand.name)}</h1>
<p>${files.length} slides · ${spec.outWidth}×${(spec.outWidth * 9) / 16} · shown at ~800px wide, about how the Marketplace carousel displays them. If IDE text is hard to read here, it's hard to read there.</p>
${cards.join('\n')}
</main></body></html>`;
}
