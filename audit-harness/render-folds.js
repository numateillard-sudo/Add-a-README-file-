// Test navigateur réel (Chromium) du repli « niveau SECTION » + replis de bloc imbriqués.
// Prouve : compacité par défaut, têtes de section visibles, corps replié, accessibilité,
// navTo qui déplie la section cible, redimensionnement des charts à l'ouverture,
// scroll-spy intact, persistance, 0 erreur console.
const { chromium } = require('playwright-core');
const fs = require('fs'); const path = require('path');
function findChrome(){ const b=process.env.PLAYWRIGHT_BROWSERS_PATH||'/opt/pw-browsers'; for(const d of fs.readdirSync(b)){ if(d.startsWith('chromium-')){ const p=path.join(b,d,'chrome-linux','chrome'); if(fs.existsSync(p)) return p; } } throw new Error('no chromium'); }
const FILE = 'file://' + path.resolve(__dirname, '..', 'petit-livre-rouge-portefeuille.html');

(async () => {
  let pass=0, fail=0; const note=(ok,m)=>{ ok?pass++:(fail++,console.log('  ✗ '+m)); };
  const browser = await chromium.launch({ executablePath: findChrome(), headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 900 }, deviceScaleFactor: 1 });
  // Stub Chart.js (CDN bloqué ici) AVEC getChart().resize() pour exercer le chemin resize sans erreur.
  let resizeCalls = 0;
  await ctx.addInitScript(() => { const C=class{constructor(){}update(){}destroy(){}resize(){ (window.__resizeCalls=(window.__resizeCalls||0)+1); }}; C.getChart=()=>({resize(){ (window.__resizeCalls=(window.__resizeCalls||0)+1); }}); C.register=()=>{}; C.defaults={font:{},plugins:{},set(){}}; window.Chart=C; });
  const page = await ctx.newPage();
  const errors=[]; page.on('console',m=>{ if(m.type()==='error') errors.push(m.text()); }); page.on('pageerror',e=>errors.push('PAGEERROR: '+e.message));
  const wait = ms => page.waitForTimeout(ms);

  await page.goto(FILE, { waitUntil:'load' }); await wait(700);

  // ════ A. État par défaut : 5 replis de SECTION + 4 de bloc, tous repliés ════
  const sectionFolds = await page.locator('.lplr-fold.lplr-section').count();
  note(sectionFolds===5, 'A1. 5 replis de section créés (trouvé '+sectionFolds+')');
  const blockFolds = await page.locator('.lplr-fold:not(.lplr-section)').count();
  note(blockFolds===4, 'A2. 4 replis de bloc imbriqués (trouvé '+blockFolds+')');
  const openCount = await page.locator('.lplr-fold.lplr-open').count();
  note(openCount===0, 'A3. tout replié au 1er chargement (ouverts: '+openCount+')');

  // Les têtes de section restent VISIBLES (hors de tout .lplr-fold-inner)
  const headsOut = await page.evaluate(() => {
    const ids=['i-sec1','i-sec2','i-sec3','i-sec4'];
    return ids.every(id => { const h=document.querySelector('#'+id+' .section-head'); return h && !h.closest('.lplr-fold-inner'); });
  });
  note(headsOut, 'A4. les têtes (.section-head) restent visibles, hors repli');
  // Les 6 notions sont DANS le repli de section i-sec1 (donc repliées par défaut)
  const notionsFolded = await page.evaluate(() => {
    const f=document.querySelector('#i-sec1 .lplr-fold.lplr-section');
    if(!f) return false;
    const n=f.querySelectorAll('.notion-card').length;
    return n===6 && !f.classList.contains('lplr-open');
  });
  note(notionsFolded, 'A5. les 6 notion-card sont repliées dans la section (le plus gros gain)');

  // ════ B. Compacité mesurée : DÉFAUT << DÉPLOYÉ ════
  const defaultH = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.locator('.lplr-allbtn').click(); await wait(650);
  const deployedH = await page.evaluate(() => document.documentElement.scrollHeight);
  note(defaultH < deployedH * 0.7, 'B1. hauteur par défaut < 70% du déployé ('+defaultH+' vs '+deployedH+' px, −'+(100*(1-defaultH/deployedH)).toFixed(0)+'%)');
  const allOpen = await page.locator('.lplr-fold.lplr-open').count();
  note(allOpen===9, 'B2. « Tout déplier » ouvre les 9 replis (ouverts: '+allOpen+')');
  await page.locator('.lplr-allbtn').click(); await wait(550);
  const reClosed = await page.locator('.lplr-fold.lplr-open').count();
  note(reClosed===0, 'B3. « Tout replier » referme tout (ouverts: '+reClosed+')');

  // ════ C. Accessibilité (repli de section) ════
  const sb = page.locator('.lplr-section-btn').first();
  note(await sb.evaluate(el => el.tagName==='BUTTON'), 'C1. l\'en-tête de section est un <button>');
  note(await sb.getAttribute('aria-expanded')==='false', 'C2. aria-expanded=false par défaut');
  const ctrl = await sb.getAttribute('aria-controls');
  note(!!ctrl && (await page.locator('#'+ctrl).count())===1, 'C3. aria-controls pointe une région existante');
  await sb.focus(); await page.keyboard.press('Enter'); await wait(450);
  note(await sb.getAttribute('aria-expanded')==='true', 'C4. Entrée au clavier ouvre la section');

  // ════ D. navTo déplie la section contenant la cible ════
  await page.evaluate(() => navTo('i-sec3')); await wait(550);
  const sec3open = await page.evaluate(() => { const f=document.querySelector('#i-sec3 .lplr-fold.lplr-section'); return !!f && f.classList.contains('lplr-open'); });
  note(sec3open, 'D1. navTo(\'i-sec3\') déplie la section Allocation');

  // ════ E. Charts révélés dans une section ouverte → resize appelé, donut visible ════
  await page.evaluate(() => { window.__resizeCalls = 0; });
  await page.evaluate(() => navTo('i-sec2')); await wait(500);
  for (let s=1; s<=5; s++){ await page.locator('.qs-question[data-quiz-step="'+s+'"] .qq-opt[data-val="4"]').click(); await wait(520); }
  await wait(400);
  await page.evaluate(() => navTo('i-sec3')); await wait(650);
  const donutInOpenSection = await page.evaluate(() => {
    const c=document.getElementById('i-donut-chart'); if(!c) return false;
    const sec=c.closest('.lplr-fold.lplr-section'); return !!sec && sec.classList.contains('lplr-open');
  });
  note(donutInOpenSection, 'E1. le donut est dans la section Allocation, ouverte');
  resizeCalls = await page.evaluate(() => window.__resizeCalls || 0);
  note(resizeCalls > 0, 'E2. resize() appelé sur les charts à l\'ouverture de section ('+resizeCalls+'×)');

  // ════ F. Scroll-spy intact après repli (état déployé, sections hautes) ════
  await page.locator('.lplr-allbtn').click(); await wait(700); // tout déplier → sections hautes
  await page.evaluate(() => { const el=document.getElementById('i-sec3'); window.scrollTo(0, el.offsetTop + 300); });
  await wait(350);
  const activeStep = await page.locator('.step-btn.active').first().getAttribute('data-section').catch(()=>null);
  note(activeStep==='i-sec3', 'F1. scroll-spy : l\'étape active suit la section visible (i-sec3, trouvé '+activeStep+')');

  // ════ G. Persistance (schéma STATE.investor.folds existant) ════
  // referme tout, ouvre i-sec1, recharge → l\'état doit revenir ouvert
  await page.evaluate(() => { window.scrollTo(0,0); });
  await page.locator('.lplr-allbtn').click(); await wait(300); // re-replier d'abord si déployé
  // s'assurer que tout est replié
  const beforeOpen = await page.locator('.lplr-fold.lplr-open').count();
  if (beforeOpen > 0) { await page.locator('.lplr-allbtn').click(); await wait(300); }
  await page.locator('#i-sec1 .lplr-section-btn').first().click(); await wait(400);
  const wrote = await page.evaluate(() => (typeof STATE!=='undefined' && STATE.investor && STATE.investor.folds) ? STATE.investor.folds['sec-notions'] : '?');
  note(wrote===true, 'G1. ouverture i-sec1 écrite dans STATE.investor.folds (sec-notions)');
  await page.reload({ waitUntil:'load' }); await wait(750);
  const restored = await page.evaluate(() => (typeof STATE!=='undefined' && STATE.investor && STATE.investor.folds) ? STATE.investor.folds['sec-notions'] : '?');
  note(restored===true, 'G2. état restauré après rechargement (sec-notions=ouvert)');
  const reapplied = await page.evaluate(() => { const f=document.querySelector('#i-sec1 .lplr-fold.lplr-section'); return !!f && f.classList.contains('lplr-open'); });
  note(reapplied, 'G3. la section est ré-ouverte au boot d\'après la persistance');

  // ════ H. Aucune erreur console (hors échecs réseau CDN, bloqué dans ce bac à sable) ════
  const codeErrors = errors.filter(e => !/Failed to load resource|net::ERR/.test(e));
  note(codeErrors.length===0, 'H1. 0 erreur console code ('+codeErrors.join(' | ')+')');

  // capture d'écran de la pile compacte de têtes de section (état par défaut)
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload({ waitUntil:'load' }); await wait(600);
  await page.evaluate(() => window.scrollTo(0, document.getElementById('i-sec1').offsetTop - 120));
  await wait(300);
  await page.screenshot({ path: 'render-folds.png' }).catch(()=>{});

  await browser.close();
  console.log('\nRENDER FOLDS (sections): '+pass+' PASS / '+fail+' FAIL '+(fail?'✗':'✓'));
  process.exit(fail?1:0);
})().catch(e=>{ console.error('render-folds error:', e.message); process.exit(2); });
