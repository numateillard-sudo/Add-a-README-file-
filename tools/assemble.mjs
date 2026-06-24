#!/usr/bin/env node
// assemble.mjs — Stitch the integrated artifact into build/staged/, ready for
// rebundle.mjs. Steps:
//   1. Read the pristine decompiled socle (template.html, manifest.json, x-dc.html).
//   2. Build the integrated <x-dc> markup (finance nav + home signals + tiles +
//      full-width domain hosts) by anchored string insertion into the original.
//   3. Register Chart.js + both finance modules as compressed manifest assets.
//   4. Patch the template <head> to load them (chart -> cb -> inv -> runtime), set
//      <title>, splice the integrated <x-dc> and the integrated data-dc-script.
//   5. Write build/staged/{template.html, manifest.json, assets/*}.
//
// Loading the modules as awaited <script src> BEFORE the runtime guarantees
// window.ECRIN_CB/INV (and Chart) exist before React mounts, so the home screen
// shows finance signals on first paint.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEC = path.join(ROOT, 'build', 'decompiled');
const STAGE = path.join(ROOT, 'build', 'staged');
const STAGE_ASSETS = path.join(STAGE, 'assets');
fs.rmSync(STAGE, { recursive: true, force: true });
fs.mkdirSync(STAGE_ASSETS, { recursive: true });

const RUNTIME_UUID = 'ce4718c1-7fbf-43aa-9b98-2744f1ff9285';
const REACT_UUID = '11110001-7eac-4000-9a10-726561637400';
const REACTDOM_UUID = '22220002-7eac-4d0a-9a10-726561637464';
const CHART_UUID = 'aaaa0001-c4a4-4710-9a10-274401cf4410';
const CB_UUID = 'bbbb0002-c0b0-4d01-9a10-636f6d70744d';
const INV_UUID = 'cccc0003-1e50-4a01-9a10-696e76657374';

// ── 1. Read sources ───────────────────────────────────────────────
const template = fs.readFileSync(path.join(DEC, 'template.html'), 'utf8');
const meta = JSON.parse(fs.readFileSync(path.join(DEC, 'manifest.json'), 'utf8'));
let xdc = fs.readFileSync(path.join(DEC, 'x-dc.html'), 'utf8');
const dcScript = fs.readFileSync(path.join(ROOT, 'src', 'socle', 'data-dc-script.js'), 'utf8');
const cbModule = fs.readFileSync(path.join(ROOT, 'build', 'modules', 'ecrin-cb.js'), 'utf8');
const invModule = fs.readFileSync(path.join(ROOT, 'build', 'modules', 'ecrin-inv.js'), 'utf8');
const chartJs = fs.readFileSync(path.join(ROOT, 'vendor', 'chart.umd.js'), 'utf8');
const reactJs = fs.readFileSync(path.join(ROOT, 'vendor', 'react.production.min.js'), 'utf8');
const reactDomJs = fs.readFileSync(path.join(ROOT, 'vendor', 'react-dom.production.min.js'), 'utf8');

// Anchored replace that fails loudly if the anchor is missing/ambiguous.
function must(src, find, repl, label) {
  const i = src.indexOf(find);
  if (i < 0) throw new Error('assemble: anchor not found -> ' + label);
  if (src.indexOf(find, i + 1) >= 0) throw new Error('assemble: anchor ambiguous -> ' + label);
  return src.slice(0, i) + repl + src.slice(i + find.length);
}

// ── 2. Integrated <x-dc> ──────────────────────────────────────────
const FIN_NAV = `    <div style="font-family:'Geist Mono',monospace;font-size:9px;letter-spacing:.16em;text-transform:uppercase;color:#a79e8f;padding:18px 12px 9px">Finance</div>
    <sc-for list="{{ finNav }}" as="f" hint-placeholder-count="2">
      <button onclick="{{ f.open }}" style="{{ f.btnStyle }}" style-hover="background:rgba(30,26,18,.07);color:#211d17">{{ f.iconEl }}<span style="flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{ f.label }}</span></button>
    </sc-for>

`;

const FIN_SIGNALS = `            <sc-if value="{{ hasFinSig }}" hint-placeholder-val="{{ false }}">
              <div style="margin-bottom:30px">
                <div style="display:flex;align-items:center;gap:9px;margin-bottom:13px">{{ walletIcon }}<span style="font-weight:600;font-size:15px">Tes finances</span></div>
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(186px,1fr));gap:12px">
                  <sc-for list="{{ finSig }}" as="f" hint-placeholder-count="3">
                    <button onclick="{{ f.open }}" style="text-align:left;background:#ffffff;border:1px solid rgba(30,26,18,.1);border-left:3px solid;border-left-color:{{ f.accent }};border-radius:12px;padding:14px 15px;cursor:pointer;color:#211d17" style-hover="background:#faf7f0">
                      <div style="display:flex;align-items:center;gap:8px;margin-bottom:9px"><div style="width:29px;height:29px;border-radius:9px;display:grid;place-items:center;background:{{ f.accentSoft }}">{{ f.iconEl }}</div><span style="font-family:'Geist Mono',monospace;font-size:8.5px;letter-spacing:.12em;text-transform:uppercase;color:#948c7e;line-height:1.3">{{ f.label }}</span></div>
                      <div style="font-size:19px;font-weight:700;letter-spacing:-.02em;color:{{ f.tone }}">{{ f.value }}</div>
                      <sc-if value="{{ f.hasSub }}" hint-placeholder-val="{{ false }}"><div style="font-size:11.5px;color:#6e675b;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{ f.sub }}</div></sc-if>
                    </button>
                  </sc-for>
                </div>
              </div>
            </sc-if>

`;

const FIN_TILES = `            <div style="font-family:'Geist Mono',monospace;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:#a79e8f;margin-bottom:14px">Tes finances</div>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px;margin-bottom:36px">
              <sc-for list="{{ finGrid }}" as="g" hint-placeholder-count="2">
                <button onclick="{{ g.open }}" style="position:relative;text-align:left;background:#ffffff;border:1px solid rgba(30,26,18,.1);border-radius:12px;padding:18px;cursor:pointer;color:#211d17;overflow:hidden" style-hover="border-color:{{ g.border }};background:#faf7f0">
                  <div style="position:absolute;inset:0;background:radial-gradient(140px 90px at 100% 0%, {{ g.soft }}, transparent 70%);pointer-events:none"></div>
                  <div style="width:42px;height:42px;border-radius:12px;display:grid;place-items:center;background:{{ g.soft }};margin-bottom:14px;position:relative">{{ g.iconEl }}</div>
                  <div style="font-weight:600;font-size:15.5px;position:relative">{{ g.label }}</div>
                  <div style="font-size:12.5px;color:#6e675b;margin-top:3px;position:relative">{{ g.desc }}</div>
                </button>
              </sc-for>
            </div>

`;

const FIN_VIEW = (flag, host) => `      <sc-if value="{{ ${flag} }}" hint-placeholder-val="{{ false }}">
        <div style="max-width:1180px;margin:0 auto;padding:26px 26px 80px;animation:ecrRise .36s ease both">
          <button onclick="{{ gotoHome }}" style="display:inline-flex;align-items:center;gap:6px;background:none;border:0;color:#6e675b;cursor:pointer;font-size:13.5px;padding:0;margin-bottom:16px" style-hover="color:#211d17">{{ backIcon }}Accueil</button>
          <div style="display:flex;align-items:center;gap:14px;margin-bottom:22px">
            <div style="width:50px;height:50px;border-radius:14px;display:grid;place-items:center;flex:none;background:{{ finMeta.soft }}">{{ finMeta.iconEl }}</div>
            <div style="flex:1;min-width:0"><div style="font-size:27px;font-weight:800;letter-spacing:-.03em;line-height:1.05">{{ finMeta.label }}</div><div style="color:#6e675b;font-size:14px;margin-top:2px">{{ finMeta.desc }}</div></div>
          </div>
          <div id="${host}"></div>
        </div>
      </sc-if>`;

const FIN_VIEWS = FIN_VIEW('isCB', 'cb-host') + '\n' + FIN_VIEW('isInv', 'inv-host');

// A) sidebar finance nav
xdc = must(xdc, '    <div style="margin-top:auto">', FIN_NAV + '    <div style="margin-top:auto">', 'sidebar margin-top:auto');
// B) home finance signals (before the stats grid)
xdc = must(xdc, '            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:13px;margin-bottom:34px">', FIN_SIGNALS + '            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:13px;margin-bottom:34px">', 'home stats grid');
// C) home finance tiles (before "Récemment ajoutés")
xdc = must(xdc, '            <sc-if value="{{ hasRecent }}" hint-placeholder-val="{{ true }}">', FIN_TILES + '            <sc-if value="{{ hasRecent }}" hint-placeholder-val="{{ true }}">', 'home recent block');
// D) wrap the 980px document column in a showDocArea gate
xdc = must(xdc, '      <div style="max-width:980px;margin:0 auto;padding:36px 26px 90px">', '      <sc-if value="{{ showDocArea }}">\n      <div style="max-width:980px;margin:0 auto;padding:36px 26px 90px">', '980px container open');
// E) close the gate after the column, then mount full-width finance views
xdc = must(xdc,
  '      </div>\n    </div>\n  </div>\n\n  <sc-if value="{{ showForm }}" hint-placeholder-val="{{ false }}">',
  '      </div>\n      </sc-if>\n\n' + FIN_VIEWS + '\n\n    </div>\n  </div>\n\n  <sc-if value="{{ showForm }}" hint-placeholder-val="{{ false }}">',
  'content/modal transition');
// F) brand copy: unify every remaining "Repère" mention to "Écrin".
if (!xdc.includes('Repère')) throw new Error('assemble: expected at least one "Repère" to unify');
xdc = xdc.split('Repère').join('Écrin');

// G) drop external font preconnect/stylesheet hints — Geist is bundled as woff2
//    assets, so the artifact must reference NO external host (100% offline).
xdc = xdc.replace(/\s*<link\b[^>]*\b(?:preconnect|fonts\.(?:googleapis|gstatic)\.com)[^>]*>/gi, '');

fs.mkdirSync(path.join(ROOT, 'build', 'integrated'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'build', 'integrated', 'x-dc.html'), xdc);

// ── 3. Register new compressed assets ─────────────────────────────
const newAssets = [
  [REACT_UUID, reactJs], [REACTDOM_UUID, reactDomJs],
  [CHART_UUID, chartJs], [CB_UUID, cbModule], [INV_UUID, invModule],
];
for (const [uuid, src] of newAssets) {
  fs.writeFileSync(path.join(STAGE_ASSETS, uuid + '.js'), src);
  meta.assets[uuid] = { mime: 'text/javascript', compressed: true, file: 'assets/' + uuid + '.js' };
}
// copy pristine socle assets
for (const [uuid, info] of Object.entries(meta.assets)) {
  if (newAssets.some(([u]) => u === uuid)) continue;
  fs.copyFileSync(path.join(DEC, info.file), path.join(STAGE_ASSETS, path.basename(info.file)));
}
// Patch the runtime: its boot() does a fire-and-forget fetch(location.href) for
// the editor/streaming bridge, which logs a console error on file:// (scheme not
// supported). Skip it on file:// → clean console, behavior unchanged on http(s).
{
  const rt = meta.assets[RUNTIME_UUID];
  let src = fs.readFileSync(path.join(DEC, rt.file), 'utf8');
  const before = src;
  src = src.replace('fetch(location.href).then(', '(location.protocol==="file:"?Promise.reject(new Error("skip-file-fetch")):fetch(location.href)).then(');
  if (src === before) throw new Error('assemble: runtime fetch anchor not found (boot patch)');
  fs.writeFileSync(path.join(STAGE_ASSETS, path.basename(rt.file)), src);
}
fs.writeFileSync(path.join(STAGE, 'manifest.json'), JSON.stringify(meta, null, 2));

// ── 4. Patch the template ─────────────────────────────────────────
let tpl = template;

// 4a) head: load react -> react-dom -> chart -> cb -> inv -> runtime (awaited,
// in order), set <title>. React/ReactDOM bundled locally so the runtime's
// loadReactUmd() short-circuits its unpkg CDN fetch (true offline artifact).
const headInject = `<title>Écrin — Tout au même endroit</title>
<script src="${REACT_UUID}"></script>
<script src="${REACTDOM_UUID}"></script>
<script src="${CHART_UUID}"></script>
<script src="${CB_UUID}"></script>
<script src="${INV_UUID}"></script>
<script src="${RUNTIME_UUID}"></script>`;
tpl = must(tpl, `<script src="${RUNTIME_UUID}"></script>`, headInject, 'head runtime script');

// 4b) replace <x-dc> inner with the integrated markup.
tpl = tpl.replace(/<x-dc>[\s\S]*?<\/x-dc>/i, () => '<x-dc>' + xdc + '</x-dc>');

// 4c) replace the data-dc-script inner with the integrated logic.
tpl = tpl.replace(/(<script type="text\/x-dc" data-dc-script="">)[\s\S]*?(<\/script>)/i, () => '<script type="text/x-dc" data-dc-script="">' + dcScript + '</script>');

fs.writeFileSync(path.join(STAGE, 'template.html'), tpl);

console.log('staged ->', STAGE);
console.log('  assets:', Object.keys(meta.assets).length, '(socle + chart + cb + inv)');
console.log('  chart.umd.js:', chartJs.length, 'bytes');
console.log('  cb module   :', cbModule.length, 'bytes');
console.log('  inv module  :', invModule.length, 'bytes');
console.log('  template    :', tpl.length, 'chars');
console.log('  x-dc        :', xdc.length, 'chars (finance markup spliced)');
