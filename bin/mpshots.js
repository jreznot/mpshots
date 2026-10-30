#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { loadSpec, SpecError } from '../src/spec.js';
import { loadFonts, renderSlide } from '../src/render.js';
import { validate } from '../src/validate.js';
import { makeGrid } from '../src/grid.js';
import { contactSheet } from '../src/sheet.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const c = process.stdout.isTTY
  ? { red: (s) => `\x1b[31m${s}\x1b[0m`, yellow: (s) => `\x1b[33m${s}\x1b[0m`, green: (s) => `\x1b[32m${s}\x1b[0m`, dim: (s) => `\x1b[2m${s}\x1b[0m` }
  : { red: String, yellow: String, green: String, dim: String };

const HELP = `mpshots — compose JetBrains Marketplace screenshots from raw IDE captures

Usage
  mpshots init [dir]                 Create a shots.yaml spec to start from
  mpshots validate [spec]            Check sources, crops, legibility and copy length
  mpshots build [spec] [options]     Render slides to PNG + an index.html preview sheet
  mpshots grid <image> [-o out.png]  Overlay a pixel grid to read crop/highlight coordinates

Options
  --only <id>      Build a single slide (repeatable)
  --strict         Treat warnings as errors (useful in CI)
  --step <px>      Grid spacing for "grid" (default 100)
  -o, --out <path> Output file (grid) or directory (build)
  -h, --help
`;

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      only: { type: 'string', multiple: true },
      strict: { type: 'boolean' },
      step: { type: 'string' },
      out: { type: 'string', short: 'o' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  const [cmd, arg] = positionals;
  if (values.help || !cmd) return void console.log(HELP);

  switch (cmd) {
    case 'init': return init(arg ?? '.');
    case 'validate': return runValidate(arg ?? 'shots.yaml', values.strict);
    case 'build': return build(arg ?? 'shots.yaml', values);
    case 'grid': return grid(arg, values);
    default:
      console.error(`Unknown command "${cmd}"\n`);
      console.log(HELP);
      process.exitCode = 2;
  }
}

function init(dir) {
  const target = path.resolve(dir, 'shots.yaml');
  if (fs.existsSync(target)) {
    console.error(c.red(`${path.relative('.', target)} already exists`));
    process.exitCode = 1;
    return;
  }
  fs.mkdirSync(path.resolve(dir, 'screenshots'), { recursive: true });
  fs.copyFileSync(path.join(here, '../templates/shots.yaml'), target);
  console.log(`${c.green('Created')} ${path.relative('.', target) || 'shots.yaml'}`);
  console.log('Next: put raw IDE captures in screenshots/, run "mpshots grid screenshots/raw-1.png" to find crop coordinates, then "mpshots build".');
}

function report(issues) {
  for (const i of issues) {
    const tag = i.level === 'error' ? c.red('error') : c.yellow('warn ');
    console.log(`  ${tag} ${c.dim(`[${i.slide}]`)} ${i.msg}`);
  }
  const e = issues.filter((i) => i.level === 'error').length;
  const w = issues.length - e;
  return { e, w };
}

async function runValidate(specPath, strict) {
  const spec = loadSpec(specPath);
  console.log(`Validating ${spec.slides.length} slide(s) → ${spec.outWidth}×${(spec.outWidth * 9) / 16}`);
  const { e, w } = report(await validate(spec));
  console.log(e || w ? `${e} error(s), ${w} warning(s)` : c.green('All good.'));
  if (e || (strict && w)) process.exitCode = 1;
  return { e, w };
}

async function build(specPath, opts) {
  const spec = loadSpec(specPath);
  if (opts.out) spec.outDir = path.resolve(opts.out);
  const issues = await validate(spec);
  const { e, w } = report(issues);
  if (e || (opts.strict && w)) {
    console.error(c.red(`Not building: ${e} error(s)${opts.strict ? `, ${w} warning(s) in --strict mode` : ''}.`));
    process.exitCode = 1;
    return;
  }

  const slides = opts.only?.length ? spec.slides.filter((s) => opts.only.includes(s.id)) : spec.slides;
  if (!slides.length) throw new SpecError(`No slides match --only ${opts.only.join(', ')}`);

  fs.mkdirSync(spec.outDir, { recursive: true });
  const fonts = loadFonts(spec);
  const files = [];
  for (const s of slides) {
    const t0 = Date.now();
    const png = await renderSlide(spec, s, fonts);
    const name = `${String(s.index + 1).padStart(2, '0')}-${s.id}.png`;
    fs.writeFileSync(path.join(spec.outDir, name), png);
    files.push({ name, slide: s, bytes: png.length });
    console.log(`  ${c.green('✓')} ${name} ${c.dim(`${(png.length / 1024).toFixed(0)} KB · ${Date.now() - t0} ms`)}`);
  }
  if (!opts.only?.length) {
    fs.writeFileSync(path.join(spec.outDir, 'index.html'), contactSheet(spec, files, issues));
    console.log(`  ${c.green('✓')} index.html ${c.dim('(preview at Marketplace carousel size)')}`);
  }
  console.log(`Done → ${path.relative('.', spec.outDir) || '.'}`);
}

async function grid(input, opts) {
  if (!input) throw new SpecError('Usage: mpshots grid <image> [-o out.png] [--step 100]');
  const out = opts.out ?? input.replace(/(\.\w+)?$/, '.grid.png');
  const fakeSpec = { fonts: {} };
  const { width, height } = await makeGrid(input, out, loadFonts(fakeSpec), Number(opts.step ?? 100));
  console.log(`${c.green('Wrote')} ${out} (${width}×${height}). Read crop as [x, y, w, h] in these pixel coordinates.`);
}

main().catch((e) => {
  console.error(c.red(e instanceof SpecError ? e.message : e.stack || String(e)));
  process.exitCode = 1;
});
