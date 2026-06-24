#!/usr/bin/env node
/* =========================================================================
   Coffre — harness de tests, lançable d'une commande :  node tests/run.mjs
   Trois garanties, sans aucune dépendance externe (le pacte vaut aussi ici) :
     1. SYNTAXE   — le <script> du coffre passe `node --check`.
     2. ZÉRO RÉSEAU — échoue si un appel réseau / une URL externe apparaît.
     3. CRYPTO    — l'enveloppe (AES-GCM 256 + PBKDF2) est extraite du fichier
                    lui-même (entre les marqueurs crypto) et testée pour de vrai :
                    round-trip mot de passe, round-trip phrase, rejet d'un mauvais
                    secret, et absence de tout secret en clair.
   ========================================================================= */
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const HERE = dirname(fileURLToPath(import.meta.url));
const FILE = join(HERE, '..', 'coffre.html');
const html = readFileSync(FILE, 'utf8');

let failures = 0;
const ok   = (m) => console.log('  \x1b[32m✓\x1b[0m ' + m);
const bad  = (m) => { console.log('  \x1b[31m✗ ' + m + '\x1b[0m'); failures++; };
async function section(title, fn){ console.log('\n\x1b[1m' + title + '\x1b[0m'); try{ await fn(); }catch(e){ bad(title + ' a levé : ' + (e && e.stack || e)); } }

/* ---------- 1. SYNTAXE ---------- */
await section('1. Syntaxe du script (node --check)', () => {
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  assert.ok(scripts.length >= 1, 'aucun <script> trouvé');
  const dir = mkdtempSync(join(tmpdir(), 'coffre-'));
  scripts.forEach((src, i) => {
    const p = join(dir, 'script' + i + '.js');
    writeFileSync(p, src);
    execFileSync(process.execPath, ['--check', p]);   // jette si erreur de syntaxe
    ok('script #' + i + ' (' + src.length + ' caractères) : syntaxe valide');
  });
});

/* ---------- 2. ZÉRO RÉSEAU ---------- */
await section('2. Souveraineté — aucun appel réseau ni ressource externe', () => {
  // Chaque motif est un « puits » réseau interdit. On ignore le scheme-completion
  // ('https://'+u) et le test /^https?:\/\// car ils ne chargent rien : ils ne
  // font que normaliser un lien que l'UTILISATEUR ouvre dans son propre onglet.
  const sinks = [
    [/\bfetch\s*\(/,                       'appel fetch()'],
    [/\bXMLHttpRequest\b/,                 'XMLHttpRequest'],
    [/\bnew\s+WebSocket\b/,                'WebSocket'],
    [/\bnew\s+EventSource\b/,              'EventSource (SSE)'],
    [/navigator\s*\.\s*sendBeacon/,        'navigator.sendBeacon'],
    [/\bimportScripts\s*\(/,               'importScripts()'],
    [/<script[^>]+\bsrc\s*=/i,             '<script src> externe'],
    [/<link\b[^>]*\bhref\s*=/i,            '<link href> externe'],
    [/<img[^>]+\bsrc\s*=\s*["']https?:/i,  '<img> distante'],
    [/@import\b/,                          '@import CSS'],
    [/url\(\s*["']?https?:/i,              'url(http…) en CSS'],
    [/(?:src|href)\s*=\s*["']https?:\/\//i,'attribut src/href absolu (http)'],
    [/\bintegrity\s*=\s*["']/i,            'balise avec integrity (sous-ressource distante)'],
  ];
  let clean = true;
  for(const [re, label] of sinks){
    const m = html.match(re);
    if(m){ clean = false; bad('motif réseau détecté → ' + label + ' : « ' + m[0].slice(0,60) + ' »'); }
  }
  if(clean) ok('aucun puits réseau : 0 fetch/XHR/WebSocket/CDN/ressource externe');
  // garde-fou positif : la CSP doit verrouiller le réseau
  assert.match(html, /Content-Security-Policy/i, 'CSP absente');
  assert.match(html, /connect-src\s+'none'/, "connect-src 'none' absent de la CSP");
  ok("CSP présente avec connect-src 'none' (le réseau est fermé par défaut)");
});

/* ---------- 3. CRYPTO (extraite du fichier, exécutée pour de vrai) ---------- */
await section('3. Enveloppe cryptographique (extraite de coffre.html)', async () => {
  const m = html.match(/\/\*<crypto>\*\/([\s\S]*?)\/\*<\/crypto>\*\//);
  assert.ok(m, 'marqueurs /*<crypto>*/ introuvables dans coffre.html');
  const cryptoSrc = m[1];
  // On évalue le bloc tel quel (il n'utilise que des globaux présents dans Node 20+ :
  // crypto.subtle, getRandomValues, TextEncoder/Decoder, btoa/atob) et on récupère l'API.
  const factory = new Function(cryptoSrc + '\n;return { createVault, openVault, normPhrase, ITER };');
  const C = factory();
  assert.equal(C.ITER, 600000, 'ITER attendu à 600000 (OWASP)');
  ok('bloc crypto évalué — ITER = ' + C.ITER + ' (PBKDF2, OWASP)');

  const password = 'cheval-agrafe-lune-batterie';
  const phrase   = 'licorne abeille cobra dragon écureuil fableau';  // peu importe le contenu

  const { vault, dek, payload } = await C.createVault(password, phrase);
  assert.deepEqual(payload, { modules: {} }, 'payload initial inattendu');
  assert.equal(vault.cipher, 'AES-GCM-256');
  assert.equal(vault.kdf.iterations, 600000);
  ok('création : vault format ' + vault.format + ', ' + vault.cipher + ', PBKDF2 ' + vault.kdf.iterations);

  // (a) aucun secret en clair dans le fichier vault
  const serialized = JSON.stringify(vault);
  assert.ok(!serialized.includes(password), 'le mot de passe FUITE en clair dans le vault !');
  assert.ok(!serialized.includes(C.normPhrase(phrase)), 'la phrase FUITE en clair dans le vault !');
  assert.ok(!serialized.includes('"modules"'), 'le payload n\'est pas chiffré (modules en clair) !');
  ok('confidentialité : ni mot de passe, ni phrase, ni payload lisibles dans le vault');

  // (b) round-trip par mot de passe
  const byPwd = await C.openVault(vault, password, 'pwd');
  assert.deepEqual(byPwd.payload, { modules: {} });
  ok('déverrouillage par mot de passe : round-trip OK');

  // (c) round-trip par phrase de récupération (normalisée)
  const byRec = await C.openVault(vault, '  ' + phrase.toUpperCase() + '  ', 'rec');
  assert.deepEqual(byRec.payload, { modules: {} });
  ok('déverrouillage par phrase (insensible casse/espaces) : round-trip OK');

  // (d) un mauvais secret est rejeté proprement (BAD_SECRET), pas un crash
  await assert.rejects(() => C.openVault(vault, password + 'x', 'pwd'), e => e.code === 'BAD_SECRET',
    'un mauvais mot de passe devrait lever BAD_SECRET');
  ok('mauvais mot de passe : rejeté avec le code BAD_SECRET');

  // (e) deux coffres successifs ne partagent ni sel ni IV (aléa correct)
  const second = await C.createVault(password, phrase);
  assert.notEqual(second.vault.pwd.salt, vault.pwd.salt, 'sel mot de passe non aléatoire !');
  assert.notEqual(second.vault.data.iv, vault.data.iv, 'IV de données non aléatoire !');
  ok('aléa : sels et IV distincts entre deux coffres');
});

/* ---------- 4. AUDIT DES ACCÈS (fonctions pures extraites) ---------- */
await section('4. Force & audit des mots de passe (extraits de coffre.html)', () => {
  const m = html.match(/\/\*<pure>\*\/([\s\S]*?)\/\*<\/pure>\*\//);
  assert.ok(m, 'marqueurs pure introuvables');
  const C = new Function(m[1] + '\n;return { pwScore, pwEntropyBits, auditPasswords, genPassword };')();

  // jauge honnête : les classiques sont déclassés, le costaud est reconnu
  assert.equal(C.pwScore('password'), 1, '« password » devrait être très faible');
  assert.equal(C.pwScore('azerty'),   1, '« azerty » devrait être très faible');
  assert.equal(C.pwScore('aaaaaaaaaaaa'), 1, 'répétition devrait être très faible');
  assert.ok(C.pwScore('Tomate7!') <= 3, 'un mot+chiffre court reste moyen au mieux');
  assert.equal(C.pwScore(C.genPassword(20)), 5, 'un mot de passe généré (20) doit être excellent');
  assert.ok(C.pwEntropyBits('aA1!aA1!aA1!') > C.pwEntropyBits('aaaa'), 'entropie croissante avec la variété/longueur');
  ok('jauge : faibles déclassés, générés notés excellents, entropie cohérente');

  // audit : faibles + réutilisés correctement repérés
  const items = [
    { id:'1', title:'Gmail',  fields:{ password:'Sun-licorne-cobra-42xZ' } },  // fort, unique
    { id:'2', title:'Banque', fields:{ password:'azerty' } },                  // faible
    { id:'3', title:'Forum',  fields:{ password:'reseau123' } },               // réutilisé…
    { id:'4', title:'Boutique', fields:{ password:'reseau123' } },             // …avec celui-ci
    { id:'5', title:'Sans pw', fields:{ username:'x' } },                      // ignoré (pas de pw)
  ];
  const a = C.auditPasswords(items);
  assert.equal(a.withPw, 4, '4 accès ont un mot de passe');
  assert.ok(a.weak.some(w=>w.id==='2'), 'la Banque (azerty) doit être faible');
  assert.equal(a.reused.length, 1, 'un seul groupe réutilisé');
  assert.equal(a.reusedIds.size, 2, 'deux accès partagent le même mot de passe');
  assert.ok(a.reusedIds.has('3') && a.reusedIds.has('4'), 'Forum et Boutique sont le doublon');
  ok('audit : 1 faible repéré, doublon « reseau123 » (Forum+Boutique) détecté');
});

/* ---------- 5. CONTRASTE (WCAG 2.2 AA) sur le design system ---------- */
await section('5. Contraste des couleurs (WCAG 2.2 AA)', () => {
  const tok = (name) => { const m = html.match(new RegExp('--'+name+':\\s*(#[0-9A-Fa-f]{6})')); assert.ok(m, 'token --'+name+' introuvable'); return m[1]; };
  const rgb = (h) => [1,3,5].map(i => parseInt(h.slice(i,i+2),16));
  const lin = (v) => { v/=255; return v<=0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); };
  const lum = (h) => { const c = rgb(h).map(lin); return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2]; };
  const ratio = (a,b) => { const la=lum(a), lb=lum(b); const hi=Math.max(la,lb), lo=Math.min(la,lb); return (hi+0.05)/(lo+0.05); };
  const base = '#0A0F13', card = '#16222B';                 // fonds réels de l'app
  const text = tok('text'), muted = tok('muted'), muted2 = tok('muted-2');
  const check = (label, fg, bg, min) => { const r = ratio(fg,bg); if (r >= min) ok(label+' : '+r.toFixed(2)+':1 (≥ '+min+')'); else bad(label+' : '+r.toFixed(2)+':1 < '+min); };
  // texte normal : seuil AA 4.5:1, sur les deux fonds principaux
  check('texte principal / fond',  text,   base, 4.5);
  check('texte principal / carte', text,   card, 4.5);
  check('texte discret / fond',    muted,  base, 4.5);
  check('texte discret / carte',   muted,  card, 4.5);
  check('méta (muted-2) / fond',   muted2, base, 4.5);
  check('méta (muted-2) / carte',  muted2, card, 4.5);
  // accents (texte large / éléments d'UI) : seuil AA 3:1
  check('laiton vif / carte',      tok('brass-bright'), card, 3);
  check('danger / carte',          tok('danger'),       card, 3);
  check('succès / carte',          tok('ok'),           card, 3);
});

/* ---------- bilan ---------- */
console.log('');
if(failures){ console.log('\x1b[31m\x1b[1m' + failures + ' test(s) en échec.\x1b[0m'); process.exit(1); }
console.log('\x1b[32m\x1b[1mTout est vert.\x1b[0m');
