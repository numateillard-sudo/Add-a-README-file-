// Real-browser behavior test (Chromium via playwright-core).
//   npm install playwright-core   (Chromium déjà présent sous PLAYWRIGHT_BROWSERS_PATH)
//   node render-behavior.js
// Vérifie : (1) premier chargement = questionnaire ; (2) quiz complété rend le profil
// en session ; (3) au rechargement, on revient au questionnaire (pas un profil figé).
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

function findChrome() {
  if (process.env.LPLR_CHROME) return process.env.LPLR_CHROME;
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  for (const d of fs.readdirSync(base)) {
    if (d.startsWith('chromium-')) {
      const p = path.join(base, d, 'chrome-linux', 'chrome');
      if (fs.existsSync(p)) return p;
    }
  }
  throw new Error('Chromium introuvable sous ' + base);
}
const FILE = 'file://' + path.resolve(__dirname, '..', 'petit-livre-rouge-portefeuille.html');

(async () => {
  let pass = 0, fail = 0; const note = (ok, m) => { ok ? pass++ : (fail++, console.log('  ✗ ' + m)); };
  const browser = await chromium.launch({ executablePath: findChrome(), headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  await ctx.addInitScript(() => { window.Chart = class { constructor(){} update(){} destroy(){} resize(){} }; window.Chart.register=()=>{}; window.Chart.defaults={font:{},plugins:{},set(){}}; });
  const page = await ctx.newPage();

  // (1) premier chargement
  await page.goto(FILE, { waitUntil: 'load' }); await page.waitForTimeout(500);
  note(await page.locator('#i-portfolio-empty').first().isVisible(), '1. invite quiz visible au 1er chargement');
  note(!(await page.locator('#i-portfolio-content').first().isVisible()), '1. portefeuille NON affiché au 1er chargement');
  note(await page.locator('.qs-question[data-quiz-step="1"]').first().isVisible(), '1. question 1 visible');

  // (2) compléter le quiz (tout D -> Offensif) -> rendu en session
  for (let s = 1; s <= 5; s++) { await page.locator(`.qs-question[data-quiz-step="${s}"] .qq-opt[data-val="4"]`).click(); await page.waitForTimeout(550); }
  await page.waitForTimeout(400);
  note((await page.evaluate(() => STATE.investor.profile && STATE.investor.profile.key)) === 'offensif', '2. quiz complété -> profil offensif en session');
  note(await page.locator('#i-portfolio-content').first().isVisible(), '2. portefeuille affiché après quiz');

  // (3) rechargement -> retour au questionnaire
  await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(800);
  note((await page.evaluate(() => STATE.investor.profile)) === null, '3. profil NON ré-affiché au rechargement (null)');
  note(await page.locator('.qs-question[data-quiz-step="1"]').first().isVisible(), '3. questions affichées au rechargement');
  note(!(await page.locator('#qs-result').first().isVisible()), '3. carte résultat NON auto-affichée au rechargement');

  await browser.close();
  console.log(`\nRENDER BEHAVIOR: ${pass} PASS / ${fail} FAIL ` + (fail ? '✗' : '✓'));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('render-behavior error:', e.message); process.exit(2); });
