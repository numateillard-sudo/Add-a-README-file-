// Real-browser test of the "légèreté" fold layer (Chromium via playwright-core).
const { chromium } = require('playwright-core');
const fs = require('fs'); const path = require('path');
function findChrome(){ const b=process.env.PLAYWRIGHT_BROWSERS_PATH||'/opt/pw-browsers'; for(const d of fs.readdirSync(b)){ if(d.startsWith('chromium-')){ const p=path.join(b,d,'chrome-linux','chrome'); if(fs.existsSync(p)) return p; } } throw new Error('no chromium'); }
const FILE = 'file://' + path.resolve(__dirname, '..', 'petit-livre-rouge-portefeuille.html');

(async () => {
  let pass=0, fail=0; const note=(ok,m)=>{ ok?pass++:(fail++,console.log('  ✗ '+m)); };
  const browser = await chromium.launch({ executablePath: findChrome(), headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 1400 }, deviceScaleFactor: 2 });
  // Chart stub (CDN bloqué ici) AVEC getChart, pour exercer le chemin resize sans erreur.
  await ctx.addInitScript(() => { const C=class{constructor(){}update(){}destroy(){}resize(){}}; C.getChart=()=>({resize(){}}); C.register=()=>{}; C.defaults={font:{},plugins:{},set(){}}; window.Chart=C; });
  const page = await ctx.newPage();
  const errors=[]; page.on('console',m=>{ if(m.type()==='error') errors.push(m.text()); }); page.on('pageerror',e=>errors.push('PAGEERROR: '+e.message));

  await page.goto(FILE, { waitUntil:'load' }); await page.waitForTimeout(700);

  // 1) Les 4 replis existent, repliés par défaut, contenu présent dans le DOM
  const foldCount = await page.locator('.lplr-fold').count();
  note(foldCount===4, '1. 4 replis créés (trouvé '+foldCount+')');
  const openCount = await page.locator('.lplr-fold.lplr-open').count();
  note(openCount===0, '1. tous repliés au 1er chargement (ouverts: '+openCount+')');
  const concretInDom = await page.locator('.lplr-fold .concrete-box-rich').count();
  note(concretInDom===1, '1. contenu "Concrètement" conservé dans le DOM (plié)');
  const faqInDom = await page.locator('.lplr-fold .faq-block').count();
  note(faqInDom===1, '1. contenu FAQ conservé dans le DOM (plié)');

  // 2) Accessibilité : button + aria-expanded + aria-controls
  const btn0 = page.locator('.lplr-fold-btn').first();
  note((await btn0.getAttribute('aria-expanded'))==='false', '2. aria-expanded=false par défaut');
  const ctrl = await btn0.getAttribute('aria-controls');
  note(!!ctrl && (await page.locator('#'+ctrl).count())===1, '2. aria-controls pointe une région existante');
  note((await page.locator('.lplr-allbtn').count())===1, '2. bouton « Tout déplier » présent');
  note((await page.locator('.lplr-progress-fill').count())===1, '2. barre de progression présente');

  // 3) Compléter le quiz pour révéler i-sec3, puis ouvrir le repli "Concrètement"
  for(let s=1;s<=5;s++){ await page.locator('.qs-question[data-quiz-step="'+s+'"] .qq-opt[data-val="4"]').click(); await page.waitForTimeout(540); }
  await page.waitForTimeout(500);
  const concretFold = page.locator('.lplr-fold:has(.concrete-box-rich)');
  // état replié = source de vérité via la classe (isVisible() de Playwright ne voit pas le clip overflow)
  note(await concretFold.evaluate(el => !el.classList.contains('lplr-open')), '3. "Concrètement" replié (classe) après quiz');
  // clic clavier : focus + Enter
  await concretFold.locator('.lplr-fold-btn').focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(450);
  note(await concretFold.locator('.lplr-fold-btn').getAttribute('aria-expanded')==='true', '3. Entrée au clavier ouvre le repli (aria-expanded=true)');
  note(await concretFold.locator('.cs-timeline').first().isVisible()===true, '3. contenu du pas-à-pas visible une fois ouvert');

  // 4) Le donut (graphique essentiel) n'est PAS dans un repli et reste rendu
  const donutInFold = await page.locator('.lplr-fold #i-donut-chart').count();
  note(donutInFold===0, '4. le donut (essentiel) n\'est pas plié');

  // 5) Persistance : recharger -> l'état du repli "concret" est mémorisé
  const beforeReload = await page.evaluate(() => (typeof STATE!=="undefined" && STATE.investor && STATE.investor.folds) ? STATE.investor.folds.concret : '?');
  note(beforeReload===true, '5. état "concret=ouvert" écrit dans STATE.investor.folds');
  await page.reload({ waitUntil:'load' }); await page.waitForTimeout(700);
  const afterReload = await page.evaluate(() => (typeof STATE!=="undefined" && STATE.investor && STATE.investor.folds) ? STATE.investor.folds.concret : '?');
  note(afterReload===true, '5. état restauré après rechargement (concret=ouvert)');
  const concretOpenAfter = await page.locator('.lplr-fold:has(.concrete-box-rich)').evaluate(el => el.classList.contains('lplr-open')).catch(()=>false);
  note(concretOpenAfter===true, '5. le repli est ré-appliqué ouvert au boot (même masqué)');

  // 6) Aucune erreur console (hors échecs réseau du CDN Chart.js, bloqué dans ce bac à sable)
  const codeErrors = errors.filter(e => !/Failed to load resource|net::ERR/.test(e));
  note(codeErrors.length===0, '6. 0 erreur console code ('+codeErrors.join(' | ')+')');

  // screenshot de l'allocation (avec replis compacts) — re-compléter le quiz pour révéler
  for(let s=1;s<=5;s++){ await page.locator('.qs-question[data-quiz-step="'+s+'"] .qq-opt[data-val="4"]').click().catch(()=>{}); await page.waitForTimeout(520); }
  await page.waitForTimeout(500);
  await page.locator('.lplr-fold:has(.concrete-box-rich)').scrollIntoViewIfNeeded().catch(()=>{});
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'render-folds.png' }).catch(()=>{});

  await browser.close();
  console.log('\nRENDER FOLDS: '+pass+' PASS / '+fail+' FAIL '+(fail?'✗':'✓'));
  process.exit(fail?1:0);
})().catch(e=>{ console.error('render-folds error:', e.message); process.exit(2); });
