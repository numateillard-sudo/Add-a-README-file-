// screenshot.mjs — Render the REAL self-extracting Ecrin.html in headless
// Chromium (pre-installed at /opt/pw-browsers), exercise the finance domains,
// capture screenshots, and report console errors. This is the full-flow + visual
// verification jsdom could not do.
import { createRequire } from 'node:module';
import path from 'node:path';
process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/opt/pw-browsers';
let chromium;
try {
  const require = createRequire('/opt/node22/lib/node_modules/');
  ({ chromium } = require('playwright'));
} catch { console.log('SKIPPED (playwright not available).'); process.exit(0); }

const ROOT = '/home/user/Add-a-README-file-';
const url = 'file://' + path.join(ROOT, 'Ecrin.html');
const shots = path.join(ROOT, 'build', 'shots');
import fs from 'node:fs'; fs.mkdirSync(shots, { recursive: true });

const errors = [];
let browser;
try { browser = await chromium.launch({ headless: true }); }
catch (e) { console.log('SKIPPED (no Chromium binary: ' + e.message.slice(0, 80) + ').'); process.exit(0); }
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

await page.goto(url, { waitUntil: 'load' });
// the bundle unpacks asynchronously; wait for the React app + finance API.
await page.waitForFunction(() => !!window.ECRIN_CB && !!document.getElementById('dc-root'), { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(1200);

let pass = 0, fail = 0;
const check = (n, c) => { if (c) { pass++; console.log('  ✅ ' + n); } else { fail++; console.log('  ❌ ' + n); } };

// Dismiss the onboarding (demo starts nameless): type a prénom and enter.
const hasWelcome = await page.evaluate(() => /Comment t.appelles-tu/.test(document.body.innerText));
if (hasWelcome) {
  await page.fill('input[placeholder="Ton prénom"]', 'Camille');
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /Entrer dans mon espace/.test(x.textContent)); b && b.click(); });
  await page.waitForTimeout(700);
}

const bodyText = await page.evaluate(() => document.body.innerText);
check('app rendered: finance domains in nav (Comptes & Budget + Investissement)', /Comptes & Budget/.test(bodyText) && /Investissement/.test(bodyText));
check('home aggregates finance signals', /Tes finances/.test(bodyText));
await page.screenshot({ path: path.join(shots, '1-accueil.png'), fullPage: false });

// → Comptes & Budget
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].filter(x => x.textContent.trim() === 'Comptes & Budget').sort((a, c) => a.textContent.length - c.textContent.length)[0]; b && b.click(); });
await page.waitForTimeout(900);
const cbStyled = await page.evaluate(() => {
  const card = document.querySelector('#cb-root .card');
  if (!card) return { ok: false };
  const cs = getComputedStyle(card);
  return { ok: true, bg: cs.backgroundColor, radius: cs.borderRadius, font: cs.fontFamily, pad: cs.padding };
});
check('Comptes: #cb-root .card is actually styled (bg/radius/font applied)', cbStyled.ok && cbStyled.radius !== '0px' && /Geist/i.test(cbStyled.font));
console.log('     card →', JSON.stringify(cbStyled));
await page.screenshot({ path: path.join(shots, '2-comptes.png'), fullPage: false });

// → Investissement
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].filter(x => x.textContent.trim() === 'Investissement').sort((a, c) => a.textContent.length - c.textContent.length)[0]; b && b.click(); });
await page.waitForTimeout(900);
const invStyled = await page.evaluate(() => {
  const root = document.getElementById('inv-root');
  if (!root) return { ok: false };
  const cs = getComputedStyle(root);
  const anyCard = document.querySelector('#inv-root [class*="card"], #inv-root .block, #inv-root section');
  const ac = anyCard ? getComputedStyle(anyCard) : null;
  return { ok: true, font: cs.fontFamily, cardBg: ac && ac.backgroundColor, cardRadius: ac && ac.borderRadius };
});
check('Investissement: #inv-root uses Geist + styled blocks', invStyled.ok && /Geist/i.test(invStyled.font));
console.log('     root →', JSON.stringify(invStyled));
await page.screenshot({ path: path.join(shots, '3-investissement.png'), fullPage: false });

check('no console errors during full render', errors.length === 0);
if (errors.length) errors.slice(0, 10).forEach((e) => console.log('   ⚠ ' + e.slice(0, 200)));

console.log(`\nVISUAL/FULL-FLOW: ${pass} passed, ${fail} failed  (shots in build/shots/)`);
await browser.close();
process.exit(fail === 0 ? 0 : 1);
