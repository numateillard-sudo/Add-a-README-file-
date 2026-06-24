#!/usr/bin/env node
/* =========================================================================
   Coffre — e2e du déverrouillage par PASSKEY (WebAuthn + extension PRF).
   WebAuthn exige une vraie origine : on sert coffre.html sur http://localhost et
   on branche un authentificateur virtuel CDP avec PRF. On prouve le cycle complet :
   création du coffre → activation d'une passkey → verrouillage → réouverture par
   la passkey (sans mot de passe), le tout sans réseau et sans violation CSP.
   Lancement :  node tests/passkey.mjs
   ========================================================================= */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { execSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(HERE, '..', 'coffre.html'));
const gRoot = execSync('npm root -g').toString().trim();
const require = createRequire(join(gRoot, 'x'));
const { chromium } = require('playwright');

const PW = 'cheval-agrafe-lune-batterie';
let failures = 0;
const ok = (m) => console.log('  \x1b[32m✓\x1b[0m ' + m);
const bad = (m) => { console.log('  \x1b[31m✗ ' + m + '\x1b[0m'); failures++; };

const srv = createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(html); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const origin = 'http://localhost:' + srv.address().port + '/';

const browser = await chromium.launch();
const ctx = await browser.newContext({ acceptDownloads: true });
await ctx.addInitScript(() => {
  try { delete window.showDirectoryPicker; } catch (e) {}     // force le mode fichier
  window.__csp = [];
  document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective + ' → ' + (e.blockedURI || '')));
});
const page = await ctx.newPage();
page.on('download', d => d.saveAs(join(HERE, 'pk-vault-tmp.json')).catch(() => {}));
const pageErrors = [];
page.on('pageerror', e => pageErrors.push(e.message));

// authentificateur virtuel avec PRF
const cdp = await ctx.newCDPSession(page);
await cdp.send('WebAuthn.enable');
await cdp.send('WebAuthn.addVirtualAuthenticator', { options: {
  protocol: 'ctap2', transport: 'internal',
  hasResidentKey: true, hasUserVerification: true, hasPrf: true,
  isUserVerified: true, automaticPresenceSimulation: true,
}});

try {
  console.log('\n\x1b[1m1. Création du coffre (origine localhost)\x1b[0m');
  await page.goto(origin);
  await page.waitForSelector('#s-location.active', { timeout: 8000 });
  await page.click('#b-create');
  await page.waitForSelector('#s-password.active');
  await page.fill('#pw1', PW); await page.fill('#pw2', PW);
  await page.click('#pw-next');
  await page.waitForSelector('#s-recovery.active');
  const words = await page.$$eval('#phrase .w span', els => els.map(e => e.textContent.trim()));
  await page.check('#rec-ack'); await page.click('#rec-finish');
  await page.waitForSelector('#s-confirm.active');
  for (const inp of await page.$$('#confirm-fields input')) { const p = +(await inp.getAttribute('data-pos')); await inp.fill(words[p]); }
  await page.click('#confirm-create');
  await page.waitForSelector('#app-view', { state: 'visible', timeout: 8000 });
  ok('coffre créé et ouvert');

  console.log('\n\x1b[1m2. Activation de la passkey\x1b[0m');
  await page.click('#open-security');
  await page.waitForSelector('#sec-passkey', { state: 'visible', timeout: 6000 });
  ok('section passkey visible (origine sécurisée détectée)');
  await page.click('#pk-add');
  await page.waitForSelector('#pk-remove', { state: 'visible', timeout: 8000 });
  ok('passkey enregistrée (DEK emballée via secret PRF)');
  const hasWa = await page.evaluate(() => {
    // accès indirect : on relit l'état via l'UI (App est encapsulé) → présence du bouton retirer
    return !document.querySelector('#pk-remove').offsetParent ? false : true;
  });
  if (hasWa) ok('état « passkey active » reflété dans l’UI');

  console.log('\n\x1b[1m3. Verrouillage puis réouverture PAR la passkey\x1b[0m');
  await page.click('#lock-now');
  await page.waitForSelector('#s-locked.active', { timeout: 6000 });
  if (await page.isVisible('#unlock-passkey')) ok('bouton « Déverrouiller avec ma passkey » proposé'); else bad('bouton passkey absent sur l’écran verrouillé');
  await page.click('#unlock-passkey');
  await page.waitForSelector('#app-view', { state: 'visible', timeout: 8000 });
  ok('coffre rouvert AVEC la passkey, sans mot de passe — cycle complet VERT');

  console.log('\n\x1b[1m4. Le mot de passe reste une porte valide (la passkey ne remplace rien)\x1b[0m');
  await page.click('#lock-now');
  await page.waitForSelector('#s-locked.active');
  await page.fill('#unlock-pw', PW);
  await page.click('#unlock-btn');
  await page.waitForSelector('#app-view', { state: 'visible', timeout: 8000 });
  ok('le mot de passe ouvre toujours le coffre (passkey = en complément)');

  console.log('\n\x1b[1m5. CSP & erreurs\x1b[0m');
  const csp = await page.evaluate(() => window.__csp || []);
  if (csp.length) csp.forEach(v => bad('violation CSP : ' + v)); else ok('aucune violation CSP');
  if (pageErrors.length) pageErrors.forEach(e => bad('erreur JS : ' + e)); else ok('aucune erreur JS non gérée');

} catch (e) {
  bad('parcours interrompu : ' + (e && e.message || e));
} finally {
  await browser.close();
  srv.close();
}

console.log('');
if (failures) { console.log('\x1b[31m\x1b[1m' + failures + ' échec(s) passkey.\x1b[0m'); process.exit(1); }
console.log('\x1b[32m\x1b[1mPasskey e2e vert.\x1b[0m');
