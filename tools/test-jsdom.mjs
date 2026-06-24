#!/usr/bin/env node
// test-jsdom.mjs — Behavioral test of the INTEGRATED app (runtime + finance
// modules + socle logic) in jsdom. Validates that React mounts the integrated
// template, the finance domains appear in nav/home/signals, and clicking a
// finance domain mounts its module into the host (lifecycle). Chart.js is shimmed
// (canvas rendering needs a real browser); everything else is the real code.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const R = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const runtime = R('build/decompiled/assets/ce4718c1-7fbf-43aa-9b98-2744f1ff9285.js');
const reactJs = R('vendor/react.production.min.js');
const reactDomJs = R('vendor/react-dom.production.min.js');
const cbMod = R('build/modules/ecrin-cb.js');
const invMod = R('build/modules/ecrin-inv.js');
const xdc = R('build/integrated/x-dc.html');
const dcScript = R('src/socle/data-dc-script.js');

const errors = [];
const warns = [];

const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
<x-dc>${xdc}</x-dc>
<script type="text/x-dc" data-dc-script="">${dcScript}</script>
</body></html>`;

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  url: 'https://example.test/',
  beforeParse(window) {
    function Obs() { return { observe() {}, unobserve() {}, disconnect() {}, takeRecords() { return []; } }; }
    window.IntersectionObserver = Obs; window.ResizeObserver = Obs; window.MutationObserver = window.MutationObserver || Obs;
    window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
    window.scrollTo = () => {};
    // jsdom has no fetch; the runtime's boot() does a fire-and-forget
    // fetch(location.href) (an editor/streaming nicety it .catch()es). A real
    // browser has fetch, so shim a benign one so boot can reach the React mount.
    window.fetch = () => Promise.resolve({ ok: false, text: () => Promise.resolve('') });
    // Chart.js shim (real canvas rendering needs a browser; integration is what we test).
    function Chart() { return { destroy() {}, update() {}, resize() {}, data: { labels: [], datasets: [{}] }, options: {} }; }
    Chart.defaults = { font: {}, color: '', borderColor: '', plugins: { legend: { labels: {} }, tooltip: {} }, scales: { linear: { grid: {}, ticks: {}, border: {} }, category: { grid: {}, ticks: {}, border: {} } } };
    Chart.register = () => {}; Chart.getChart = () => null;
    window.Chart = Chart;
    // canvas getContext stub so any stray call doesn't throw hard.
    if (window.HTMLCanvasElement) window.HTMLCanvasElement.prototype.getContext = () => ({ canvas: {}, fillRect() {}, clearRect() {}, save() {}, restore() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, fill() {}, arc() {}, measureText: () => ({ width: 0 }), createLinearGradient: () => ({ addColorStop() {} }), setTransform() {}, translate() {}, scale() {} });
    const origErr = window.console.error.bind(window.console);
    window.console.error = (...a) => { errors.push(a.map(String).join(' ')); origErr(...a); };
    window.console.warn = (...a) => { warns.push(a.map(String).join(' ')); };
    window.addEventListener('error', (e) => errors.push('window.onerror: ' + (e.error && e.error.stack || e.message)));
    window.addEventListener('unhandledrejection', (e) => errors.push('unhandledrejection: ' + (e.reason && e.reason.message || e.reason)));
  },
});

const { window } = dom;
const { document } = window;

function injectScript(code, label) {
  try {
    const s = document.createElement('script');
    s.textContent = code;
    document.body.appendChild(s);
  } catch (e) { errors.push(`inject ${label}: ${e.message}`); }
}

const sleep = (ms) => new Promise((r) => window.setTimeout(r, ms));

// Rendered visible text only — excludes <script>/<style> source (which contains
// the modules' markup strings like "Julien"/"Repère" and would false-positive).
function visibleText() {
  const clone = document.body.cloneNode(true);
  clone.querySelectorAll('script,style').forEach((n) => n.remove());
  return clone.textContent || '';
}

// CSS-application proof without a renderer: a scoped stylesheet only styles the
// UI if its selectors actually match elements in the DOM. Parse the injected
// stylesheet and count how many distinct scoped selectors match real elements.
function scopedCoverage(key) {
  const styleEl = document.querySelector('style[data-ecrin="' + key + '"]');
  if (!styleEl) return { injected: false, matched: 0, total: 0 };
  const css = styleEl.textContent || '';
  const re = new RegExp('#' + key + '-root[^{,}]*(?=[,{])', 'g');
  const sels = [...new Set((css.match(re) || []).map((s) => s.trim()).filter((s) => s && !s.includes('@') && !s.includes('%')))];
  let matched = 0, total = 0;
  for (const s of sels) { try { total++; if (document.querySelectorAll(s).length > 0) matched++; } catch (e) {} }
  return { injected: true, matched, total };
}
function clickByText(target) {
  const want = target.toLowerCase();
  const cands = [...document.querySelectorAll('button')]
    .map((b) => ({ b, t: (b.textContent || '').trim() }))
    .filter((x) => x.t.toLowerCase().includes(want))
    .sort((a, c) => a.t.length - c.t.length);
  if (!cands.length) return false;
  cands[0].b.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  return true;
}

let pass = 0, fail = 0;
const check = (name, cond) => { if (cond) { pass++; console.log('  ✅ ' + name); } else { fail++; console.log('  ❌ ' + name); } };

async function main() {
  // Wait until the document has finished loading so the modules' inert
  // DOMContentLoaded handlers (init) never fire on their own — exactly as in the
  // real bundle, where the loader re-creates scripts AFTER DOMContentLoaded.
  await new Promise((r) => { if (document.readyState === 'complete') r(); else window.addEventListener('load', () => r()); });
  await sleep(10);

  // React/ReactDOM (real, bundled) -> modules define ECRIN_CB/INV -> runtime
  // (sees window.React, skips its CDN guard, boots + mounts React).
  injectScript(reactJs, 'react');
  injectScript(reactDomJs, 'react-dom');
  injectScript(cbMod, 'cb');
  injectScript(invMod, 'inv');
  injectScript(runtime, 'runtime');
  await sleep(50); await sleep(50); await sleep(50); // let React commit

  console.log('\n[1] Modules defined');
  check('window.ECRIN_CB present', !!window.ECRIN_CB && typeof window.ECRIN_CB.mount === 'function');
  check('window.ECRIN_INV present', !!window.ECRIN_INV && typeof window.ECRIN_INV.mount === 'function');
  check('ECRIN_CB import API: empty → loadExample → soldeMois 1521.21 → reset', (() => {
    try {
      const empty = window.ECRIN_CB.getSignals().ready === false;
      window.ECRIN_CB.loadExample();
      const ok = Math.abs(window.ECRIN_CB.getSignals().soldeMois - 1521.21) < 0.005;
      window.ECRIN_CB.reset(); // back to onboarding for the UI flow below
      return empty && ok;
    } catch { return false; }
  })());

  console.log('\n[2] Socle mounted with finance integrated');
  const txt = visibleText;
  check('React mounted (sidebar brand "Écrin")', /Écrin/.test(txt()));
  check('greeting present (Bonjour/Bonsoir/…)', /(Bonjour|Bonsoir|Bon après-midi|Bonne nuit)/.test(txt()));
  check('Finance nav: "Comptes & Budget"', /Comptes & Budget/.test(txt()));
  check('Finance nav: "Investissement"', /Investissement/.test(txt()));
  check('Home aggregates finance signals ("Tes finances")', /Tes finances/.test(txt()));
  check('Comptes signal is import CTA (not a fake solde)', /Importe tes relevés/.test(txt()) && !/Solde du mois/.test(txt()));
  check('Signal "Profil investisseur" present', /Profil investisseur/.test(txt()));
  check('Signal "Allocation cible" present', /Allocation cible/.test(txt()));
  check('Documents intact (Camille persona)', /Camille/.test(txt()));
  check('No "Repère" brand remnant', !/Repère/.test(txt()));
  check('No "Julien" persona remnant in DOM', !/Julien/.test(txt()));

  console.log('\n[3] Comptes & Budget → onboarding (import-first), then example → dashboard');
  const clickedCB = clickByText('Comptes & Budget');
  check('clicked Comptes & Budget nav', clickedCB);
  await sleep(80); await sleep(80);
  // No pre-filled dashboard: onboarding appears first.
  check('onboarding shown (import prompt)', /Pars de tes relevés|Importer un relevé/.test(visibleText()));
  check('dashboard NOT auto-mounted (no #overview yet)', !document.getElementById('overview'));
  // Load the example → dashboard mounts.
  check('clicked "découvrir avec un relevé d’exemple"', clickByText('découvrir'));
  await sleep(120); await sleep(120);
  const cbHost = document.getElementById('cb-host');
  check('#cb-host exists in DOM (dashboard mounted after example)', !!cbHost);
  check('#cb-host populated by module (tabs)', !!cbHost && /Aperçu|Transactions|Budget/.test(cbHost.textContent || ''));
  check('Comptes panels present (#overview)', !!document.getElementById('overview'));
  // CSS actually applies (scope root exists + scoped selectors match elements)
  check('CB scope root #cb-root exists', !!document.getElementById('cb-root'));
  const cbCov = scopedCoverage('cb');
  check('CB stylesheet injected in <head>', cbCov.injected);
  check(`CB scoped CSS matches real elements (${cbCov.matched}/${cbCov.total})`, cbCov.matched > 20);
  check('CB cards styled (#cb-root .card matches)', document.querySelectorAll('#cb-root .card').length > 0);

  console.log('\n[4] Navigate → Investissement mounts module');
  // back home then to inv (nav button always present in sidebar)
  const clickedINV = clickByText('Investissement');
  check('clicked Investissement nav', clickedINV);
  await sleep(60); await sleep(60);
  const invHost = document.getElementById('inv-host');
  check('#inv-host exists in DOM', !!invHost);
  check('#inv-host populated by module', !!invHost && (invHost.textContent || '').length > 200);
  check('INV scope root #inv-root exists', !!document.getElementById('inv-root'));
  const invCov = scopedCoverage('inv');
  check('INV stylesheet injected in <head>', invCov.injected);
  check(`INV scoped CSS matches real elements (${invCov.matched}/${invCov.total})`, invCov.matched > 50);

  console.log('\n[5] Back to documents (no regression)');
  clickByText('Accueil');
  await sleep(40);
  check('home still renders collections grid', /Tes collections/.test(txt()));

  console.log('\n[6] Console errors during run');
  const realErrors = errors.filter((e) => !/Could not parse CSS|Not implemented: HTMLCanvasElement|jsdom/.test(e));
  if (realErrors.length) { realErrors.slice(0, 12).forEach((e) => console.log('   ⚠ ' + e.slice(0, 200))); }
  check('no unexpected console errors', realErrors.length === 0);

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error('TEST HARNESS ERROR:', e); process.exit(2); });
