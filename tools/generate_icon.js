/**
 * Draws the app icon from the SAME rig data the in-game astronaut is drawn
 * from (src/theme/astronaut.js), so the icon cannot drift from the character.
 *
 *   node tools/generate_icon.js sheet            the variants side by side, to compare
 *   node tools/generate_icon.js build [variant]  writes the icon files into assets/
 *
 * Variants: helmet | tile (the one shipped) | trail.
 *
 * Renders with headless Chrome - set CHROME_PATH if it is not in the usual
 * place. Nothing here runs in the app, and it adds no dependency.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const os = require('os');
const { loadSrc } = require('../tests/load.js');
const A = loadSrc('src/theme/astronaut.js');

const ROOT = path.join(__dirname, '..');
const ASSETS = path.join(ROOT, 'assets');
const HERE = fs.mkdtempSync(path.join(os.tmpdir(), 'spacewrite-icon-')); // scratch pages, never the repo
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const FONT = 'file:///' + path.join(ROOT, 'node_modules/@expo-google-fonts/orbitron/800ExtraBold/Orbitron_800ExtraBold.ttf').split(path.sep).join('/');

const kebab = (k) => k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
const el = (e, reflection) => {
  const { tag, ...attrs } = e;
  return `<${tag} ${Object.entries(attrs).map(([k, v]) => `${kebab(k)}="${v === 'REFLECTION' ? reflection : v}"`).join(' ')}/>`;
};

let clipId = 0;
const SKIP = ['glint']; // parked off the glass at rest
const part = (p, expr, reflection, pose = {}) => {
  if (SKIP.includes(p.key)) return '';
  const t = pose[p.key] || {};
  const { x, y } = p.box; const { x: ox, y: oy } = p.origin;
  let inner = '';
  if (p.clip) {
    const id = `clip${clipId++}`;
    inner += `<clipPath id="${id}"><rect x="0" y="0" width="${p.box.w}" height="${p.box.h}" rx="${p.radius}"/></clipPath>`;
    inner += `<rect x="0" y="0" width="${p.box.w}" height="${p.box.h}" rx="${p.radius}" fill="${p.fill}" stroke="${p.edge}" stroke-width="1.6"/>`;
    inner += `<g clip-path="url(#${id})">`;
  }
  (p.art || []).forEach((e) => { inner += el(e, reflection); });
  if (p.face === 'eyes') A.EYES[expr.eyes].forEach((e) => { inner += el(e, reflection); });
  if (p.face === 'mouth') A.MOUTHS[expr.mouth].forEach((e) => { inner += el(e, reflection); });
  (p.children || []).forEach((c) => { inner += part(c, expr, reflection, pose); });
  if (p.clip) inner += '</g>';
  return `<g transform="translate(${x + (t.x || 0)},${y + (t.y || 0)}) translate(${ox},${oy}) rotate(${t.rot || 0}) translate(${-ox},${-oy})">${inner}</g>`;
};

const HEAD = A.RIG.children.find((p) => p.key === 'head');
/** The helmet, in its own 68x74 box with the shell centred on (34, 41). */
const helmet = (reflection, pose) => {
  const flat = { ...HEAD, box: { ...HEAD.box, x: 0, y: 0 } };
  return part(flat, { eyes: 'open', mouth: 'smile' }, reflection, pose);
};

/** Deterministic stars: the same sky every build. */
const stars = (seed, count, size) => {
  let s = seed;
  const rnd = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
  let out = '';
  for (let i = 0; i < count; i++) {
    const x = rnd() * size, y = rnd() * size, r = 2 + rnd() * 5, o = 0.35 + rnd() * 0.6;
    out += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="#FFFFFF" opacity="${o.toFixed(2)}"/>`;
  }
  return out;
};
const twinkle = (x, y, r, o = 0.95) =>
  `<path d="M${x},${y - r} Q${x},${y} ${x + r},${y} Q${x},${y} ${x},${y + r} Q${x},${y} ${x - r},${y} Q${x},${y} ${x},${y - r} Z" fill="#FFFFFF" opacity="${o}"/>`;

const background = (glowAt = [512, 560]) => `
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0B0822"/><stop offset="0.55" stop-color="#1D1250"/><stop offset="1" stop-color="#3B1F93"/>
    </linearGradient>
    <radialGradient id="glow" cx="${glowAt[0]}" cy="${glowAt[1]}" r="520" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#8E6BFF" stop-opacity="0.85"/><stop offset="0.55" stop-color="#7C5CFF" stop-opacity="0.28"/><stop offset="1" stop-color="#7C5CFF" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#sky)"/>
  <rect width="1024" height="1024" fill="url(#glow)"/>
  ${stars(7, 26, 1024)}
  ${twinkle(168, 196, 34)}${twinkle(868, 268, 24, 0.85)}${twinkle(836, 852, 18, 0.7)}`;

/** The helmet placed with its shell centred on (cx, cy), `d` pixels across. */
const placed = (cx, cy, d, tilt, reflection = '#CFC4FF') => {
  const k = d / 58; // the shell is 58 units across
  return `<g transform="translate(${cx},${cy}) rotate(${tilt}) scale(${k}) translate(-34,-41)">${helmet(reflection, { antenna: { rot: 10 } })}</g>`;
};

const tile = (x, y, size, rot, letter) => `
  <g transform="translate(${x},${y}) rotate(${rot})">
    <rect x="${-size / 2}" y="${-size / 2 + size * 0.07}" width="${size}" height="${size}" rx="${size * 0.22}" fill="#0B0822" opacity="0.45"/>
    <rect x="${-size / 2}" y="${-size / 2}" width="${size}" height="${size}" rx="${size * 0.22}" fill="#F4F3FF" stroke="#A9AFD2" stroke-width="${size * 0.03}"/>
    <rect x="${-size / 2 + size * 0.06}" y="${size / 2 - size * 0.2}" width="${size * 0.88}" height="${size * 0.14}" rx="${size * 0.07}" fill="#D8DBEF"/>
    <text x="0" y="${size * 0.2}" text-anchor="middle" font-family="Orbitron" font-weight="800" font-size="${size * 0.62}" fill="#141836">${letter}</text>
  </g>`;

const trail = `
  <path d="M96,930 C250,880 240,700 400,690 S 610,860 760,760 S 900,470 960,420" fill="none" stroke="#4ADEDE" stroke-width="54" stroke-linecap="round" opacity="0.22"/>
  <path d="M96,930 C250,880 240,700 400,690 S 610,860 760,760 S 900,470 960,420" fill="none" stroke="#4ADEDE" stroke-width="22" stroke-linecap="round" opacity="0.95"/>`;

// Each variant: the sky behind, the artwork in front, and where the artwork's
// middle is - the Android foreground is the same artwork, shrunk about that point.
const PARTS = {
  // Just him: the boldest read at home-screen size.
  helmet: { glow: [512, 560], fg: () => placed(512, 560, 640, -8), mid: [512, 520] },
  // With a letter tile, so it says "word game" before it is opened.
  tile: { glow: [470, 520], fg: () => `${placed(470, 520, 590, -10)}${tile(770, 790, 300, 12, 'S')}`, mid: [547, 530] },
  // Riding the swipe trail you draw across the board.
  trail: { glow: [512, 560], fg: () => `${trail}${placed(512, 540, 610, -8)}`, mid: [512, 520] },
};
const VARIANTS = Object.fromEntries(Object.entries(PARTS).map(([name, v]) => [name, () => `${background(v.glow)}${v.fg()}`]));

const wrap = (inner, size = 1024) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024"><style>@font-face{font-family:Orbitron;font-weight:800;src:url('${FONT}')}</style>${inner}</svg>`;

const shoot = (html, out, w, h, transparent) => {
  const page = path.join(HERE, path.basename(out).replace(/\.png$/, '.html'));
  fs.writeFileSync(page, html);
  execFileSync(CHROME, [
    '--headless=new', '--mute-audio', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
    '--allow-file-access-from-files', '--virtual-time-budget=4000',
    ...(transparent ? ['--default-background-color=00000000'] : []),
    `--screenshot=${out}`, `--window-size=${w},${h}`, 'file:///' + page.split(path.sep).join('/'),
  ], { stdio: 'ignore' });
};
const page = (svg, bg = 'transparent') => `<!doctype html><html><body style="margin:0;background:${bg};overflow:hidden">${svg}</body></html>`;

const mode = process.argv[2];
if (mode === 'sheet') {
  const cells = Object.entries(VARIANTS).map(([name, make]) => `
    <div style="text-align:center;color:#ccd;font:14px sans-serif">
      <div style="width:300px;height:300px;border-radius:67px;overflow:hidden">${wrap(make(), 300)}</div>
      <div style="display:flex;gap:14px;justify-content:center;align-items:center;margin-top:14px">
        <div style="width:60px;height:60px;border-radius:13px;overflow:hidden">${wrap(make(), 60)}</div>
        <div style="width:60px;height:60px;border-radius:50%;overflow:hidden">${wrap(make(), 60)}</div>
        <div style="width:29px;height:29px;border-radius:6px;overflow:hidden">${wrap(make(), 29)}</div>
      </div>
      <p>${name}</p>
    </div>`).join('');
  shoot(`<!doctype html><html><body style="margin:0;background:#2b2b33;display:flex;gap:30px;padding:30px">${cells}</body></html>`,
    path.join(HERE, 'sheet.png'), 3 * 330 + 30, 470, false);
  console.log('wrote', path.join(HERE, 'sheet.png'));
}

if (mode === 'build') {
  const name = process.argv[3] || 'tile';
  const make = VARIANTS[name];
  if (!make) throw new Error(`unknown variant "${name}" - one of ${Object.keys(VARIANTS).join(', ')}`);
  const out = ASSETS;
  // The full icon: square, edge to edge, no transparency - the OS cuts the corners.
  shoot(page(wrap(make()), '#0B0822'), path.join(out, 'icon.png'), 1024, 1024, false);
  // Android adaptive icon: a background the launcher can crop and slide, and
  // a foreground kept inside the central 66% that every mask shape leaves alone.
  const v = PARTS[name];
  shoot(page(wrap(background([512, 512]))), path.join(out, 'adaptive-background.png'), 1024, 1024, false);
  shoot(page(wrap(`<g transform="translate(512,512) scale(0.54) translate(${-v.mid[0]},${-v.mid[1]})">${v.fg()}</g>`)),
    path.join(out, 'adaptive-icon.png'), 1024, 1024, true);
  // What a round launcher mask would leave of it, to check nothing is cut.
  shoot(`<!doctype html><html><body style="margin:0;background:#2b2b33;display:flex;gap:24px;padding:24px">
    ${['50%', '30%', '12%'].map((r) => `<div style="width:300px;height:300px;border-radius:${r};overflow:hidden;position:relative">
      <div style="position:absolute;left:-75px;top:-75px;width:450px;height:450px">${wrap(background([512, 512]) + `<g transform="translate(512,512) scale(0.54) translate(${-v.mid[0]},${-v.mid[1]})">${v.fg()}</g>`, 450)}</div></div>`).join('')}
    </body></html>`, path.join(HERE, 'adaptive-preview.png'), 3 * 324 + 24, 348, false);
  // The browser-tab icon: the same picture, drawn small.
  shoot(page(wrap(make(), 196), '#0B0822'), path.join(out, 'favicon.png'), 196, 196, false);
  // Splash: the helmet alone, large, on the splash screen's own flat colour.
  shoot(page(wrap(placed(512, 560, 760, -8))), path.join(out, 'splash-icon.png'), 1024, 1024, true);
  console.log(`wrote the "${name}" icon set to assets/ (mask preview: ${path.join(HERE, 'adaptive-preview.png')})`);
}
