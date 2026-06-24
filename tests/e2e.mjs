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
  // À partir d'ici, on garde une copie de CHAQUE écriture chiffrée : la dernière
  // servira au test de persistance multi-modules en fin de parcours.
  let latestVault = vaultPath, dlN = 0;
  page.on('download', async d => { try { const p = join(vaultDir, 'v' + (++dlN) + '.json'); await d.saveAs(p); latestVault = p; } catch (e) {} });

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

  /* ---------- palette ⌘K : recherche transverse, sans fuite de secret ---------- */
  console.log('\n\x1b[1m4. Recherche globale ⌘K (navigateur réel)\x1b[0m');
  await page.keyboard.press('Control+K');
  await page.waitForSelector('#cmdk-back.show', { timeout: 5000 });
  ok('palette ouverte au clavier (Ctrl+K)');
  // un mot de passe stocké ne doit JAMAIS être indexé / retrouvable
  await page.fill('#cmdk-input', 'azerty');
  await page.waitForFunction(() => document.querySelector('#cmdk-results .cmdk-empty') ||
    ![...document.querySelectorAll('#cmdk-results .ci-t')].length, null, { timeout: 4000 });
  const leak = await page.$('#cmdk-results .cmdk-item');
  if (leak) bad('un mot de passe (azerty) ressort dans la recherche — fuite !'); else ok('les mots de passe ne sont pas indexés (recherche « azerty » : vide)');
  // recherche transverse normale → navigation directe
  await page.fill('#cmdk-input', 'Banque');
  await page.waitForFunction(() => [...document.querySelectorAll('#cmdk-results .ci-t')].some(e => /Banque/.test(e.textContent)), null, { timeout: 4000 });
  ok('résultat « Banque » trouvé');
  await page.screenshot({ path: join(HERE, 'screen-cmdk.png') });
  await page.keyboard.press('Enter');
  await page.waitForSelector('#ce-title', { state: 'visible', timeout: 5000 });
  const navTitle = await page.inputValue('#ce-title');
  if (navTitle === 'Banque') ok('Entrée → ouverture directe de l’accès « Banque »'); else bad('navigation palette inattendue : ' + navTitle);

  /* ---------- accessibilité : noms accessibles sur les contrôles visibles ---------- */
  console.log('\n\x1b[1m5. Accessibilité — noms accessibles (WCAG 4.1.2)\x1b[0m');
  const scanNames = async (where) => page.evaluate(() => {
    const visible = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
    const name = el => {
      const a = el.getAttribute('aria-label'); if (a && a.trim()) return a.trim();
      const lb = el.getAttribute('aria-labelledby'); if (lb) { const t = lb.split(/\s+/).map(id => (document.getElementById(id)||{}).textContent||'').join(' ').trim(); if (t) return t; }
      const wrap = el.closest('label'); if (wrap) { const t = wrap.textContent.replace(el.value||'', '').trim(); if (t) return t; }
      if (el.id) { const l = document.querySelector('label[for="'+CSS.escape(el.id)+'"]'); if (l && l.textContent.trim()) return l.textContent.trim(); }
      const txt = (el.textContent||'').trim(); if (txt) return txt;
      const ti = el.getAttribute('title'); if (ti && ti.trim()) return ti.trim();
      // NB : le placeholder seul ne compte PAS comme nom accessible (WCAG).
      return '';
    };
    const sel = 'button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=option]';
    return [...document.querySelectorAll(sel)].filter(visible).filter(el => !name(el))
      .map(el => (el.tagName.toLowerCase() + (el.id ? '#'+el.id : '') + (el.className ? '.'+String(el.className).split(' ')[0] : '')));
  });
  // navigation par la palette (« Aller à … »)
  const goTo = async (label) => {
    await page.keyboard.press('Control+K');
    await page.waitForSelector('#cmdk-back.show');
    await page.fill('#cmdk-input', label);
    await page.waitForFunction(l => [...document.querySelectorAll('#cmdk-results .ci-t')].some(e => e.textContent.trim() === l), label, { timeout: 4000 });
    await page.click(`#cmdk-results .cmdk-item:has(.ci-t:text-is("${label}"))`);
  };
  // revenir à l'accueil depuis l'éditeur ouvert en section 4
  await page.click('#ce-cancel');
  await page.waitForSelector('#cl-back', { state: 'visible' });
  await page.click('#cl-back');
  await page.waitForSelector('#mod-files', { state: 'visible' });

  const views = [
    ['accueil', null],
    ['Mes documents', '#docs-search'],
    ['Mes finances', '#fin-new-account'],
    ['Sécurité & sauvegarde', '#do-export'],
    ['Échéances & rappels', '#dl-back'],
    ['Mots de passe', '#cl-new'],
  ];
  let nameless = await scanNames('accueil');
  for (const [label, anchor] of views.slice(1)) {
    await goTo(label);
    if (anchor) await page.waitForSelector(anchor, { state: 'visible', timeout: 6000 });
    const found = await scanNames(label);
    nameless = [...new Set([...nameless, ...found])];
  }
  // éditeur d'accès (boutons icônes : révéler/copier/générer)
  await page.click('#cl-new');
  await page.waitForSelector('#ce-fields .secret-row', { state: 'visible' });
  nameless = [...new Set([...nameless, ...await scanNames('éditeur')])];

  if (nameless.length) bad('contrôles sans nom accessible : ' + nameless.join(', '));
  else ok('tous les contrôles visibles ont un nom accessible (6 vues + éditeur)');

  /* ---------- Santé : carte d'urgence imprimable ---------- */
  console.log('\n\x1b[1m6. Santé — carte d’urgence imprimable\x1b[0m');
  // (réutilise goTo défini plus haut)
  await page.keyboard.press('Control+K');
  await page.waitForSelector('#cmdk-back.show');
  await page.fill('#cmdk-input', 'Santé');
  await page.waitForFunction(() => [...document.querySelectorAll('#cmdk-results .ci-t')].some(e => e.textContent.trim() === 'Santé'), null, { timeout: 4000 });
  await page.click('#cmdk-results .cmdk-item:has(.ci-t:text-is("Santé"))');
  await page.waitForSelector('#emerg-edit-btn', { state: 'visible', timeout: 6000 });
  await page.click('#emerg-edit-btn');
  await page.waitForSelector('#em-blood', { state: 'visible' });
  await page.fill('#em-blood', 'O+');
  await page.fill('#em-allergies', 'Pénicilline');
  await page.fill('#em-contactName', 'Marie');
  await page.fill('#em-contactPhone', '06 12 34 56 78');
  await page.click('#em-save');
  await page.waitForSelector('#emerg-print', { state: 'visible', timeout: 5000 });
  ok('carte d’urgence remplie et enregistrée');
  const telHref = await page.getAttribute('#emerg-card a[href^="tel:"]', 'href');
  if (telHref === 'tel:0612345678') ok('téléphone cliquable (' + telHref + ')'); else bad('lien tel inattendu : ' + telHref);
  const popP = ctx.waitForEvent('page');
  await page.click('#emerg-print');
  const printPage = await popP;
  await printPage.waitForLoadState('domcontentloaded').catch(() => {});
  const ptxt = await printPage.evaluate(() => document.body ? document.body.innerText : '').catch(() => '');
  if (/O\+/.test(ptxt) && /Marie/.test(ptxt)) ok('feuille imprimable générée (groupe sanguin + contact présents)');
  else bad('feuille imprimable : contenu = ' + ptxt.slice(0, 80));
  await printPage.close();
  await page.screenshot({ path: join(HERE, 'screen-emergency.png') });

  /* ---------- Documents : copier / appeler un numéro ---------- */
  console.log('\n\x1b[1m7. Documents — copier un numéro, appeler un téléphone\x1b[0m');
  await goTo('Mes documents');
  await page.waitForSelector('#docs-new-btn', { state: 'visible' });
  await page.click('#docs-new-btn');
  await page.waitForSelector('#f-title', { state: 'visible' });
  await page.fill('#f-title', 'Assurance auto');
  await page.click('#reveal-kv');
  await page.waitForSelector('#f-kv .kv-row .v', { state: 'visible' });
  await page.fill('#f-kv .kv-row .k', 'Assistance');
  await page.fill('#f-kv .kv-row .v', '0800 123 456');
  if (await page.isVisible('#f-kv .kv-row [data-act=call]')) ok('téléphone détecté → bouton « Appeler » proposé'); else bad('bouton appeler manquant pour un téléphone');
  if (await page.$('#f-kv .kv-row [data-act=copy]')) ok('bouton « Copier » présent sur chaque info (copier un numéro d’un geste)'); else bad('bouton copier manquant');
  await page.fill('#f-kv .kv-row .v', 'REF-ABC-2024');
  if (await page.isHidden('#f-kv .kv-row [data-act=call]')) ok('valeur non-téléphone → pas de bouton appeler'); else bad('bouton appeler affiché à tort');
  // vue « à compléter » : une fiche sans info ni date est signalée et filtrable
  await page.click('#f-cancel');
  await page.waitForSelector('#docs-new-btn', { state: 'visible' });
  await page.click('#docs-new-btn');
  await page.fill('#f-title', 'Bail appartement');     // ni info ni date → à compléter
  await page.click('#f-save');
  await page.waitForSelector('#docs-cats', { state: 'visible' });
  if (await page.locator('#docs-cats button:has-text("À compléter")').count()) {
    ok('filtre « À compléter » proposé pour une fiche incomplète');
    await page.click('#docs-cats button:has-text("À compléter")');
    const shown = await page.$$eval('#docs-list .frow', e => e.length);
    if (shown >= 1) ok('filtre « À compléter » appliqué (' + shown + ' fiche)'); else bad('filtre à compléter : liste vide');
  } else bad('filtre « À compléter » manquant');

  /* ---------- Patrimoine : inventaire imprimable pour l'assureur ---------- */
  console.log('\n\x1b[1m7b. Patrimoine — inventaire imprimable\x1b[0m');
  await goTo('Patrimoine & biens');
  await page.waitForSelector('#cl-new', { state: 'visible' });
  await page.click('#cl-new');
  await page.waitForSelector('#ce-fields input', { state: 'visible' });
  await page.fill('#ce-title', 'Vélo de route');
  const aFields = await page.$$('#ce-fields input');   // ordre : valeur, série, acquis, où, assurance
  await aFields[0].fill('1200');
  await aFields[1].fill('SN-XYZ-9');
  await aFields[4].fill('MAIF n°777');
  await page.click('#ce-save');
  await page.waitForSelector('#assets-print', { state: 'visible', timeout: 5000 });
  const totalTxt = await page.textContent('#cl-header .ch-big');
  if (/1\s?200/.test(totalTxt)) ok('valeur totale du patrimoine affichée (' + totalTxt.trim() + ')'); else bad('total patrimoine inattendu : ' + totalTxt);
  const invP = ctx.waitForEvent('page');
  await page.click('#assets-print');
  const inv = await invP;
  await inv.waitForLoadState('domcontentloaded').catch(() => {});
  const invTxt = await inv.evaluate(() => document.body ? document.body.innerText : '').catch(() => '');
  if (/SN-XYZ-9/.test(invTxt) && /MAIF/.test(invTxt) && /Inventaire/i.test(invTxt)) ok('inventaire imprimable généré (désignation, n° de série, assurance, total)');
  else bad('inventaire imprimable : contenu = ' + invTxt.slice(0, 90));
  await inv.close();

  /* ---------- CSP & erreurs ---------- */
  console.log('\n\x1b[1m8. CSP stricte & propreté console\x1b[0m');
  const csp = await page.evaluate(() => window.__csp || []);
  if (csp.length) csp.forEach(v => bad('violation CSP : ' + v)); else ok('aucune violation CSP pendant tout le parcours');
  if (pageErrors.length) pageErrors.forEach(e => bad('erreur JS : ' + e)); else ok('aucune erreur JS non gérée');
  if (consoleErrors.length) consoleErrors.forEach(e => bad('console.error : ' + e)); else ok('aucune console.error');

  /* ---------- persistance multi-modules après reload ---------- */
  console.log('\n\x1b[1m9. Zéro perte — persistance multi-modules après reload\x1b[0m');
  await page.waitForTimeout(500);                 // laisse la dernière écriture se vider
  await page.goto(PAGE);
  await page.waitForSelector('#s-location.active');
  await page.setInputFiles('#file-open', latestVault);
  await page.waitForSelector('#s-locked.active');
  await page.fill('#unlock-pw', PW);
  await page.click('#unlock-btn');
  await page.waitForSelector('#app-view', { state: 'visible', timeout: 8000 });
  ok('dernier coffre rechargé et rouvert');
  await goTo('Mots de passe');
  await page.waitForSelector('#cl-list', { state: 'visible' });
  const pwRows = await page.$$eval('#cl-list .frow', els => els.length);
  if (pwRows >= 3) ok('Mots de passe : ' + pwRows + ' accès intacts après reload'); else bad('Mots de passe : ' + pwRows + ' accès (attendu ≥ 3)');
  await goTo('Santé');
  await page.waitForSelector('#emerg-card', { state: 'visible' });
  const blood = await page.textContent('#emerg-card');
  if (/O\+/.test(blood) && /Marie/.test(blood)) ok('Santé : carte d’urgence intacte (groupe + contact)'); else bad('Santé : carte d’urgence perdue après reload');

} catch (e) {
  bad('parcours interrompu : ' + (e && e.message || e));
} finally {
  await browser.close();
}

console.log('');
if (failures) { console.log('\x1b[31m\x1b[1m' + failures + ' échec(s) e2e.\x1b[0m'); process.exit(1); }
console.log('\x1b[32m\x1b[1mE2E vert.\x1b[0m');
