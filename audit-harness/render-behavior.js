// Real-browser behavior test (Chromium via playwright-core).
//   npm install playwright-core   (Chromium déjà présent sous PLAYWRIGHT_BROWSERS_PATH)
//   node render-behavior.js
// Vérifie, AVEC le repli niveau section : (1) entrée compacte, aucun profil figé,
// l'ouverture de l'étape Profil révèle la question 1 ; (2) quiz complété rend le profil
// en session (allocation visible une fois la section ouverte) ; (3) au rechargement,
// on revient au questionnaire (profil null, résultat non auto-affiché).
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
  await ctx.addInitScript(() => { const C=class{constructor(){}update(){}destroy(){}resize(){}}; C.getChart=()=>({resize(){}}); C.register=()=>{}; C.defaults={font:{},plugins:{},set(){}}; window.Chart=C; });
  const page = await ctx.newPage();
  const wait = ms => page.waitForTimeout(ms);

  // (1) premier chargement : entrée compacte, aucun profil figé
  await page.goto(FILE, { waitUntil: 'load' }); await wait(600);
  note((await page.evaluate(() => STATE.investor.profile)) === null, '1. aucun profil figé au 1er chargement (null)');
  const profilFoldClosed = await page.evaluate(() => { const f=document.querySelector('#i-sec2 .lplr-fold.lplr-section'); return !!f && !f.classList.contains('lplr-open'); });
  note(profilFoldClosed, '1. le questionnaire est replié par défaut (entrée compacte)');
  // ouvrir l'étape Profil → la question 1 devient réellement visible
  await page.evaluate(() => navTo('i-sec2')); await wait(550);
  note(await page.locator('.qs-question[data-quiz-step="1"]').first().isVisible(), '1. ouvrir l\'étape Profil révèle la question 1');

  // (2) compléter le quiz (tout D -> Offensif) -> rendu en session
  for (let s = 1; s <= 5; s++) { await page.locator(`.qs-question[data-quiz-step="${s}"] .qq-opt[data-val="4"]`).click(); await wait(550); }
  await wait(400);
  note((await page.evaluate(() => STATE.investor.profile && STATE.investor.profile.key)) === 'offensif', '2. quiz complété -> profil offensif en session');
  // ouvrir l'allocation → portefeuille visible
  await page.evaluate(() => navTo('i-sec3')); await wait(600);
  note(await page.locator('#i-portfolio-content').first().isVisible(), '2. portefeuille affiché une fois la section Allocation ouverte');

  // (3) rechargement -> retour au questionnaire (profil non figé)
  await page.reload({ waitUntil: 'load' }); await wait(800);
  note((await page.evaluate(() => STATE.investor.profile)) === null, '3. profil NON ré-affiché au rechargement (null)');
  note((await page.evaluate(() => STATE.investor.quiz.currentStep)) === 1, '3. quiz revenu à l\'étape 1 au rechargement');
  note(!(await page.locator('#qs-result').first().isVisible()), '3. carte résultat NON auto-affichée au rechargement');

  await browser.close();
  console.log(`\nRENDER BEHAVIOR: ${pass} PASS / ${fail} FAIL ` + (fail ? '✗' : '✓'));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('render-behavior error:', e.message); process.exit(2); });
