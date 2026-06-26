// Mesure la hauteur de page (scrollHeight) — preuve de l'allègement « niveau section ».
// Compare, à contenu identique : DÉFAUT (sections repliées) vs TOUT DÉPLIÉ.
const { chromium } = require('playwright-core');
const fs = require('fs'); const path = require('path');
function findChrome(){ const b=process.env.PLAYWRIGHT_BROWSERS_PATH||'/opt/pw-browsers'; for(const d of fs.readdirSync(b)){ if(d.startsWith('chromium-')){ const p=path.join(b,d,'chrome-linux','chrome'); if(fs.existsSync(p)) return p; } } throw new Error('no chromium'); }
const FILE = 'file://' + path.resolve(__dirname, '..', 'petit-livre-rouge-portefeuille.html');

const H = () => document.documentElement.scrollHeight;

(async () => {
  const browser = await chromium.launch({ executablePath: findChrome(), headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 900 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { const C=class{constructor(){}update(){}destroy(){}resize(){}}; C.getChart=()=>({resize(){}}); C.register=()=>{}; C.defaults={font:{},plugins:{},set(){}}; window.Chart=C; });
  const page = await ctx.newPage();
  await page.goto(FILE, { waitUntil:'load' }); await page.waitForTimeout(700);

  const VP = 900;
  const screens = px => (px / VP).toFixed(1);

  // 1) DÉFAUT — sections repliées, 1er chargement (aucun profil)
  const defaultH = await page.evaluate(H);

  // 2) TOUT DÉPLIÉ — même contenu, tout ouvert (≈ ancien comportement « tout visible »)
  await page.locator('.lplr-allbtn').click(); await page.waitForTimeout(500);
  const deployedH = await page.evaluate(H);

  // 3) Profil complété (révèle l'allocation) — d'abord ouvrir le quiz, répondre, puis re-replier
  await page.locator('.lplr-allbtn').click(); await page.waitForTimeout(400); // tout replier
  await page.evaluate(() => navTo('i-sec2')); await page.waitForTimeout(450);
  for (let s=1; s<=5; s++){ await page.locator('.qs-question[data-quiz-step="'+s+'"] .qq-opt[data-val="4"]').click(); await page.waitForTimeout(520); }
  await page.waitForTimeout(500);
  const profileFoldedH = await page.evaluate(H);

  // 4) Profil complété + tout déplié
  await page.locator('.lplr-allbtn').click(); await page.waitForTimeout(700);
  const profileDeployedH = await page.evaluate(H);

  await browser.close();

  const pct = (a, b) => (100 * (1 - a / b)).toFixed(0);
  console.log('\n──────── HAUTEUR DE PAGE (viewport 1180×900) ────────');
  console.log('1er chargement (aucun profil) :');
  console.log('  • DÉFAUT  (sections repliées) : ' + defaultH + ' px  (' + screens(defaultH) + ' écrans)');
  console.log('  • DÉPLOYÉ (tout ouvert)       : ' + deployedH + ' px  (' + screens(deployedH) + ' écrans)');
  console.log('  → repli = −' + pct(defaultH, deployedH) + ' % de hauteur');
  console.log('Profil complété (allocation révélée) :');
  console.log('  • DÉFAUT  (sections repliées) : ' + profileFoldedH + ' px  (' + screens(profileFoldedH) + ' écrans)');
  console.log('  • DÉPLOYÉ (tout ouvert)       : ' + profileDeployedH + ' px  (' + screens(profileDeployedH) + ' écrans)');
  console.log('  → repli = −' + pct(profileFoldedH, profileDeployedH) + ' % de hauteur');
  console.log('─────────────────────────────────────────────────────');
})().catch(e=>{ console.error('measure error:', e.message); process.exit(2); });
