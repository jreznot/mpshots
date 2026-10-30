// Generates fake "raw" IDE captures for trying mpshots without real screenshots.
// Not part of the CLI. Produces:
//   examples/screenshots/ide-1920.png    1920×1080, IDE at 125%  (uiScale 1.25)
//   examples/screenshots/ide-2560.png    2560×1440, IDE at 150%  (uiScale 1.5)
//   examples/screenshots/browser-2560.png 2560×1440 browser preview window at 150%
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const font = (pkg, w) => fs.readFileSync(require.resolve(`@fontsource/${pkg}/files/${pkg}-latin-${w}-normal.woff`));
const fonts = [
  { name: 'Inter', data: font('inter', 400), weight: 400 },
  { name: 'Inter', data: font('inter', 600), weight: 600 },
  { name: 'Mono', data: font('jetbrains-mono', 400), weight: 400 },
];

const h = (style, ...children) => {
  const k = children.flat().filter((x) => x != null && x !== false);
  return { type: 'div', props: { style: { display: 'flex', ...style }, children: k.length === 1 ? k[0] : k } };
};

const C = { bg: '#1E1F22', panel: '#2B2D30', line: '#393B40', text: '#DFE1E5', muted: '#868A91', sel: '#2E436E', blue: '#3574F0', kw: '#CF8E6D', fn: '#56A8F5', str: '#6AAB73', tag: '#D5B778', num: '#2AACB8' };

const TREE = [
  [0, 'Components', 'folder', 1], [1, 'Alert', 'comp', 0, '2'], [1, 'Badge', 'comp', 1, '5'],
  [2, 'Default', 'story'], [2, 'Clickable', 'story', 0, null, true], [2, 'Disabled', 'story'], [2, 'All Colors', 'story'],
  [2, 'All Colors Clickable', 'story'], [1, 'Banner', 'comp', 0, '9'], [1, 'Button', 'comp', 0, '8'],
  [1, 'Checkbox', 'comp', 0, '11'], [1, 'Combobox', 'comp', 0, '7'], [1, 'Dialog', 'comp', 0, '6'],
  [1, 'Notification', 'comp', 0, '5'], [1, 'Modal', 'comp', 0, '3'], [1, 'Popup', 'comp', 0, '4'],
  [1, 'Tooltip', 'comp', 0, '1'], [1, 'Toast', 'comp', 0, '7'], [0, 'Design tokens', 'folder'],
  [0, 'Navigation patterns', 'folder'], [0, 'Screen examples', 'folder'],
];

const CODE = [
  [['kw', 'import '], ['str', "'./Badge.css'"], ['t', ';']],
  [],
  [['kw', 'const '], ['t', 'COLOR_VARIANTS = [']],
  [['t', '  '], ['str', "'blue-secondary'"], ['t', ',']],
  [['t', '  '], ['str', "'blue'"], ['t', ',']],
  [['t', '  '], ['str', "'green-secondary'"], ['t', ',']],
  [['t', '  '], ['str', "'green'"], ['t', ',']],
  [['t', '  '], ['str', "'disabled'"], ['t', ',']],
  [['t', '];']],
  [],
  [['kw', 'export function '], ['fn', 'Badge'], ['t', '(props) {']],
  [['t', '  '], ['kw', 'const '], ['t', '{ text, color, disabled, onClick } = props;']],
  [['t', '  '], ['kw', 'const '], ['t', 'isClickable = !!onClick && !disabled;']],
  [],
  [['t', '  '], ['kw', 'return '], ['t', '(']],
  [['t', '    '], ['tag', '<span'], ['t', '\u00a0className={'], ['str', '`badge badge--${color}`'], ['t', '}']],
  [['t', '      role={isClickable ? '], ['str', "'button'"], ['t', ' : '], ['kw', 'undefined'], ['t', '}']],
  [['t', '      onClick={isClickable ? onClick : '], ['kw', 'undefined'], ['t', '}'], ['tag', '>']],
  [['t', '      {text}']],
  [['t', '    '], ['tag', '</span>']],
  [['t', '  );']],
  [['t', '}']],
  [],
  [['kw', 'export const '], ['t', 'BADGE_SIZE = '], ['num', '20'], ['t', ';']],
];

function icon(kind, s) {
  const col = kind === 'folder' ? '#D9789A' : kind === 'comp' ? '#5C8DF6' : '#4FBF9F';
  return h({ width: 14 * s, height: 14 * s, border: `${1.5 * s}px solid ${col}`, borderRadius: kind === 'story' ? 2 * s : 3 * s, marginRight: 8 * s });
}

function ide(W, H, s) {
  const fs13 = 13 * s;
  const titleH = 40 * s;
  const stripeW = 40 * s;
  const panelW = 380 * s;
  const rowH = 26 * s;
  const statusH = 24 * s;

  const titleBar = h(
    { height: titleH, alignItems: 'center', backgroundColor: C.panel, borderBottom: `1px solid ${C.line}`, paddingLeft: 14 * s, fontSize: fs13, color: C.text },
    ['#FF5F57', '#FEBC2E', '#28C840'].map((c) => h({ width: 12 * s, height: 12 * s, borderRadius: 6 * s, backgroundColor: c, marginRight: 8 * s })),
    h({ marginLeft: 20 * s, width: 20 * s, height: 20 * s, borderRadius: 4 * s, backgroundColor: '#B455C9', color: '#fff', fontSize: 10 * s, fontWeight: 600, alignItems: 'center', justifyContent: 'center' }, 'DS'),
    h({ marginLeft: 8 * s, fontWeight: 600 }, 'design-system'),
    h({ marginLeft: 26 * s, color: C.muted }, 'main'),
  );

  const stripe = h(
    { width: stripeW, flexDirection: 'column', alignItems: 'center', paddingTop: 10 * s, backgroundColor: C.panel, borderRight: `1px solid ${C.line}` },
    [0, 1, 2, 3, 4].map((i) => h({ width: 22 * s, height: 22 * s, borderRadius: 5 * s, marginBottom: 14 * s, backgroundColor: i === 0 ? C.blue : 'transparent', border: i === 0 ? 'none' : `${1.5 * s}px solid ${C.muted}` })),
  );

  const tree = TREE.map(([depth, label, kind, open, count, selected]) =>
    h(
      { height: rowH, alignItems: 'center', paddingLeft: (12 + depth * 18) * s, backgroundColor: selected ? C.sel : 'transparent', borderRadius: 4 * s, marginLeft: 6 * s, marginRight: 6 * s, fontSize: fs13, color: C.text },
      h({ width: 14 * s, color: C.muted, fontSize: 15 * s, transform: open ? 'rotate(90deg)' : 'none', justifyContent: 'center' }, kind === 'story' ? ' ' : '›'),
      icon(kind, s),
      h({}, label),
      count ? h({ marginLeft: 6 * s, color: C.muted }, count) : null,
    ),
  );

  const panel = h(
    { width: panelW, flexDirection: 'column', backgroundColor: C.bg, borderRight: `1px solid ${C.line}` },
    h({ height: 38 * s, alignItems: 'center', paddingLeft: 14 * s, fontSize: fs13, color: C.text, fontWeight: 600 },
      'Storybook Connect',
      h({ marginLeft: 14 * s, padding: `${3 * s}px ${8 * s}px`, borderRadius: 4 * s, backgroundColor: '#2E436E', fontWeight: 400 }, 'Stories'),
      h({ marginLeft: 10 * s, fontWeight: 400, color: C.muted }, 'Console')),
    h({ height: 32 * s, alignItems: 'center', paddingLeft: 14 * s, fontSize: fs13, color: C.text },
      h({ width: 7 * s, height: 7 * s, borderRadius: 4 * s, backgroundColor: '#5FB865', marginRight: 8 * s }), 'localhost:6006',
      h({ marginLeft: 'auto', marginRight: 14 * s, color: C.muted }, 'Skills: 2/2')),
    h({ height: 28 * s, margin: `${4 * s}px ${12 * s}px ${8 * s}px`, border: `1px solid ${C.line}`, borderRadius: 5 * s }),
    h({ flexDirection: 'column' }, tree),
  );

  const tabs = h(
    { height: 38 * s, alignItems: 'center', borderBottom: `1px solid ${C.line}`, fontSize: fs13, color: C.text, paddingLeft: 8 * s },
    h({ padding: `${5 * s}px ${10 * s}px`, borderRadius: 5 * s, backgroundColor: '#2E436E' }, 'Badge.jsx  ×'),
    h({ marginLeft: 12 * s, color: C.muted }, 'Badge.stories.jsx'),
    h({ marginLeft: 18 * s, color: C.muted }, 'README.md'),
    h({ marginLeft: 18 * s, color: C.muted }, 'index.css'),
  );

  const color = { kw: C.kw, fn: C.fn, str: C.str, tag: C.tag, num: C.num, t: C.text };
  const lineH = 21 * s;
  const code = CODE.map((tokens, i) =>
    h(
      { height: lineH, alignItems: 'center', fontFamily: 'Mono', fontSize: fs13, backgroundColor: i === 10 ? '#26282E' : 'transparent' },
      h({ width: 54 * s, justifyContent: 'flex-end', paddingRight: 20 * s, color: '#4B5059' }, String(i + 1)),
      h({ paddingLeft: ((tokens[0]?.[1].match(/^ */)[0].length) || 0) * 7.8 * s }),
      tokens.map(([k, txt]) => h({ color: color[k], whiteSpace: 'pre' }, txt.replace(/^ +/, ''))).filter((_, j) => tokens[j][1].trim() !== ''),
    ),
  );

  const editor = h({ flexGrow: 1, flexDirection: 'column', backgroundColor: C.bg }, tabs, h({ flexDirection: 'column', paddingTop: 8 * s }, code));

  const status = h(
    { height: statusH, alignItems: 'center', paddingLeft: 14 * s, fontSize: 12 * s, color: C.muted, backgroundColor: C.panel, borderTop: `1px solid ${C.line}` },
    'design-system › src › ui › components › Badge › Badge.jsx',
    h({ marginLeft: 'auto', marginRight: 14 * s }, '11:17   LF   UTF-8   2 spaces'),
  );

  return h(
    { width: W, height: H, flexDirection: 'column', backgroundColor: C.bg, fontFamily: 'Inter' },
    titleBar,
    h({ flexGrow: 1 }, stripe, panel, editor),
    status,
  );
}

function browser(W, H, s) {
  const items = ['Alert', 'Badge', '  Default', '  Clickable', '  Disabled', '  All Colors', 'Banner', 'Button', 'Checkbox', 'Combobox', 'Dialog'];
  return h(
    { width: W, height: H, flexDirection: 'column', backgroundColor: '#1B1C1F', fontFamily: 'Inter', color: C.text, fontSize: 14 * s },
    h({ height: 44 * s, alignItems: 'center', paddingLeft: 14 * s, backgroundColor: '#2A2B2F', borderBottom: `1px solid ${C.line}` },
      ['#FF5F57', '#FEBC2E', '#28C840'].map((c) => h({ width: 12 * s, height: 12 * s, borderRadius: 6 * s, backgroundColor: c, marginRight: 8 * s })),
      h({ marginLeft: 30 * s, flexGrow: 1, marginRight: 200 * s, height: 28 * s, borderRadius: 6 * s, backgroundColor: '#1B1C1F', alignItems: 'center', justifyContent: 'center', color: C.muted }, 'localhost:6006')),
    h({ flexGrow: 1 },
      h({ width: 300 * s, flexDirection: 'column', padding: 12 * s, borderRight: `1px solid ${C.line}` },
        h({ color: C.muted, fontSize: 12 * s, letterSpacing: 1, marginBottom: 10 * s }, 'COMPONENTS'),
        items.map((t) => h({ height: 30 * s, alignItems: 'center', paddingLeft: (t.startsWith('  ') ? 26 : 8) * s, borderRadius: 4 * s, backgroundColor: t.trim() === 'Clickable' ? '#0B69E3' : 'transparent', fontWeight: t.trim() === 'Clickable' ? 600 : 400 }, t.trim()))),
      h({ flexGrow: 1, padding: 40 * s },
        h({ height: 26 * s, padding: `0 ${12 * s}px`, borderRadius: 13 * s, backgroundColor: '#2F7DF6', color: '#fff', alignItems: 'center', fontSize: 13 * s, fontWeight: 600 }, 'Clickable'))),
  );
}

async function out(tree, W, H, name) {
  const svg = await satori(tree, { width: W, height: H, fonts });
  const dir = path.join(here, 'screenshots');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), new Resvg(svg).render().asPng());
  console.log('mock:', name);
}

await out(ide(1920, 1080, 1.25), 1920, 1080, 'ide-1920.png');
await out(ide(2560, 1440, 1.5), 2560, 1440, 'ide-2560.png');
await out(browser(2560, 1440, 1.5), 2560, 1440, 'browser-2560.png');
