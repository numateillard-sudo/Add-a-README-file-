#!/usr/bin/env node
/* =========================================================================
   Coffre — e2e navigateur réel (Playwright + Chromium).
   Prouve, dans un vrai moteur de rendu, que :
     • la CSP stricte ne casse rien (zéro securitypolicyviolation, zéro erreur) ;
     • l'onboarding complet fonctionne (création → 12 mots → confirmation) ;
     • le CYCLE CRITIQUE chiffrement → enregistrement → rechargement →
       déverrouillage par mot de passe marche de bout en bout (mode fichier).
   Lancement :  node tests/e2e.mjs   (Chromium via l'install Playwright globale)
   ========================================================================= */
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = pathToFileURL(join(HERE, '..', 'coffre.html')).href;

// Playwright est installé globalement : on le résout depuis la racine npm -g.
const gRoot = execSync('npm root -g').toString().trim();
const require = createRequire(join(gRoot, 'x'));
const { chromium } = require('playwright');

const PW = 'cheval-agrafe-lune-batterie';     // mot de passe maître de test (≥ 8)
const genStrong = () => 'Licorne-Cobra7-Brasier!9-Zephyr';   // fort et unique pour l'audit
let failures = 0;
const ok  = (m) => console.log('  \x1b[32m✓\x1b[0m ' + m);
const bad = (m) => { console.log('  \x1b[31m✗ ' + m + '\x1b[0m'); failures++; };

const browser = await chromium.launch();
const ctx = await browser.newContext({ acceptDownloads: true });
const page = await ctx.newPage();

// On force le « mode fichier » (pas de File System Access en headless de toute façon)
// et on installe un capteur de violations CSP dès le tout début de chaque page.
await ctx.addInitScript(() => {
  try { delete window.showDirectoryPicker; } catch (e) {}
  window.__csp = [];
  document.addEventListener('securitypolicyviolation',
    e => window.__csp.push(e.violatedDirective + ' → ' + (e.blockedURI || '')));
});

const consoleErrors = [], pageErrors = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', e => pageErrors.push(e.message));

try {
  /* ---------- onboarding ---------- */
  console.log('\n\x1b[1m1. Onboarding complet (mode fichier)\x1b[0m');
  await page.goto(PAGE);
  await page.waitForSelector('#s-location.active', { timeout: 8000 });
  ok('écran d\'accueil affiché (mode fichier détecté)');

  const dl = page.waitForEvent('download');   // armé avant de déclencher l'écriture
  await page.click('#b-create');
  await page.waitForSelector('#s-password.active');
  await page.fill('#pw1', PW);
  await page.fill('#pw2', PW);
  await page.click('#pw-next');

  await page.waitForSelector('#s-recovery.active');
  const words = await page.$$eval('#phrase .w span', els => els.map(e => e.textContent.trim()));
  if (words.length !== 12) bad('12 mots attendus, obtenu ' + words.length); else ok('12 mots de secours générés');
  await page.check('#rec-ack');
  await page.click('#rec-finish');

  await page.waitForSelector('#s-confirm.active');
  const inputs = await page.$$('#confirm-fields input');
  for (const inp of inputs) { const p = +(await inp.getAttribute('data-pos')); await inp.fill(words[p]); }
  ok('confirmation des ' + inputs.length + ' mots demandés');
  await page.click('#confirm-create');

  await page.waitForSelector('#app-view', { state: 'visible', timeout: 8000 });
  const saved = await dl;                      // l'écriture chiffrée a bien produit un fichier
  const vaultDir = mkdtempSync(join(tmpdir(), 'coffre-vault-'));
  const vaultPath = join(vaultDir, 'coffre.vault.json');
  await saved.saveAs(vaultPath);
  ok('coffre créé et écrit (fichier chiffré « ' + saved.suggestedFilename() +' »)');

  const mods = await page.$$eval('#soon-modules .mod', els => els.length);
  if (mods < 4) bad('modules attendus sur l\'accueil, obtenu ' + mods); else ok(mods + ' modules rendus sur l\'accueil');
  await page.screenshot({ path: join(HERE, 'screen-home.png') });
  ok('capture accueil → tests/screen-home.png');

  /* ---------- cycle critique : reload + déverrouillage ---------- */
  console.log('\n\x1b[1m2. Cycle chiffrement → save → reload → déverrouillage\x1b[0m');
  await page.goto(PAGE);                        // session neuve : clés effacées
  await page.waitForSelector('#s-location.active');
  await page.setInputFiles('#file-open', vaultPath);   // recharge le coffre écrit plus haut
  await page.waitForSelector('#s-locked.active', { timeout: 8000 });
  ok('coffre rechargé depuis le fichier → écran verrouillé');

  // mauvais mot de passe d'abord : doit être refusé proprement
  await page.fill('#unlock-pw', PW + 'x');
  await page.click('#unlock-btn');
  await page.waitForFunction(() => /incorrect/i.test(document.querySelector('#unlock-err')?.textContent || ''), null, { timeout: 5000 });
  ok('mauvais mot de passe refusé sans planter');

  // bon mot de passe : le coffre s'ouvre → cycle complet prouvé
  await page.fill('#unlock-pw', PW);
  await page.click('#unlock-btn');
  await page.waitForSelector('#app-view', { state: 'visible', timeout: 8000 });
  ok('bon mot de passe → coffre rouvert : cycle chiffrement→save→reload→unlock VERT');
  await page.screenshot({ path: join(HERE, 'screen-unlocked.png') });
  ok('capture coffre ouvert → tests/screen-unlocked.png');

  /* ---------- module Mots de passe : audit faibles / réutilisés ---------- */
  console.log('\n\x1b[1m3. Module Mots de passe — audit (navigateur réel)\x1b[0m');
  const addAccess = async (title, pw) => {
    await page.click('#cl-new');
    await page.waitForSelector('#ce-title', { state: 'visible' });
    await page.fill('#ce-title', title);
    await page.fill('#ce-fields .secret-row input', pw);
    await page.click('#ce-save');
    await page.waitForSelector('#cl-new', { state: 'visible' });
  };
  await page.click('#soon-modules >> text=Mots de passe');
  await page.waitForSelector('#cl-new', { state: 'visible', timeout: 8000 });
  ok('module Mots de passe ouvert');
  await addAccess('Gmail',  'azerty');        // faible + réutilisé
  await addAccess('Banque', 'azerty');        // réutilisé avec le précédent
  await addAccess('Forum',  genStrong());     // fort + unique
  ok('3 accès créés (2 faibles/réutilisés, 1 fort)');

  const chips = await page.$$eval('#cl-header .pwa-chip .n', els => els.map(e => e.textContent.trim()));
  const tags  = await page.$$eval('#cl-header .pwa-tag', els => els.map(e => e.textContent.trim()));
  const rows  = await page.$$('#cl-header .pwa-row');
  if (rows.length >= 2) ok('audit : ' + rows.length + ' accès signalés (chips ' + chips.join('/') + ')');
  else bad('audit : ' + rows.length + ' lignes signalées, attendu ≥ 2');
  if (tags.includes('Réutilisé')) ok('étiquette « Réutilisé » présente'); else bad('« Réutilisé » manquant');
  if (tags.includes('Faible'))    ok('étiquette « Faible » présente');    else bad('« Faible » manquant');
  await page.screenshot({ path: join(HERE, 'screen-passwords.png') });
  ok('capture audit accès → tests/screen-passwords.png');

  /* ---------- CSP & erreurs ---------- */
  console.log('\n\x1b[1m4. CSP stricte & propreté console\x1b[0m');
  const csp = await page.evaluate(() => window.__csp || []);
  if (csp.length) csp.forEach(v => bad('violation CSP : ' + v)); else ok('aucune violation CSP pendant tout le parcours');
  if (pageErrors.length) pageErrors.forEach(e => bad('erreur JS : ' + e)); else ok('aucune erreur JS non gérée');
  if (consoleErrors.length) consoleErrors.forEach(e => bad('console.error : ' + e)); else ok('aucune console.error');

} catch (e) {
  bad('parcours interrompu : ' + (e && e.message || e));
} finally {
  await browser.close();
}

console.log('');
if (failures) { console.log('\x1b[31m\x1b[1m' + failures + ' échec(s) e2e.\x1b[0m'); process.exit(1); }
console.log('\x1b[32m\x1b[1mE2E vert.\x1b[0m');
