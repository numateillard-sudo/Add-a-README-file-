// Structural scan: duplicate declarations, inline-handler resolution, dead DOM wiring.
const fs = require('fs');
const { loadDoc, FILE } = require('./harness-lib');
const src = fs.readFileSync(FILE, 'utf8');
const lines = src.split('\n');

// Only scan inside <script> blocks for declarations.
function scriptRanges() {
  const ranges = []; let start = -1;
  lines.forEach((l, i) => {
    if (/<script(\s|>)/.test(l) && !/src=/.test(l)) start = i + 1;
    else if (/<\/script>/.test(l) && start >= 0) { ranges.push([start, i]); start = -1; }
  });
  return ranges;
}
const ranges = scriptRanges();
const inScript = (i) => ranges.some(([a, b]) => i >= a && i <= b);

// ── 1. Duplicate top-level function / const / let / var declarations ──
const decl = {};
lines.forEach((l, i) => {
  if (!inScript(i)) return;
  let m;
  const re = /^\s*(?:function\s+([A-Za-z_$][\w$]*)|(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=)/;
  if ((m = l.match(re))) {
    const name = m[1] || m[2];
    (decl[name] = decl[name] || []).push(i + 1);
  }
});
const dups = Object.entries(decl).filter(([n, ls]) => ls.length > 1);
console.log('=== 1. DUPLICATE declarations (function/const/let/var, any indent) ===');
if (!dups.length) console.log('  none ✓');
else dups.forEach(([n, ls]) => console.log('  ⚠ ' + n + ' declared ' + ls.length + '× at lines ' + ls.join(', ')));

// ── 2. Inline onclick / on* handlers resolve to a defined global function ──
const defined = new Set(Object.keys(decl));
// also collect "window.fn =" and assignment-style
lines.forEach((l, i) => { if (inScript(i)) { const m = l.match(/^\s*([A-Za-z_$][\w$]*)\s*=\s*function/); if (m) defined.add(m[1]); } });
const handlerCalls = new Set();
const reH = /on(?:click|change|input|keydown|submit)\s*=\s*"([^"]*)"/g;
let mm;
while ((mm = reH.exec(src))) {
  const body = mm[1];
  const re2 = /([A-Za-z_$][\w$]*)\s*\(/g; let m2;
  while ((m2 = re2.exec(body))) handlerCalls.add(m2[1]);
}
const KNOWN_GLOBALS = new Set(['navTo','switchMode','resetAllData','quizReset','resetQuiz','applyLever']);
const missingHandlers = [...handlerCalls].filter(fn => !defined.has(fn) && !KNOWN_GLOBALS.has(fn));
console.log('\n=== 2. Inline on*="fn()" handlers without a global function def ===');
console.log('  handlers referenced: ' + [...handlerCalls].sort().join(', '));
if (!missingHandlers.length) console.log('  all resolve ✓');
else missingHandlers.forEach(fn => console.log('  ✗ MISSING: ' + fn));

// ── 3. Dead DOM wiring: getElementById('x') with no id="x" in the rendered DOM ──
const { window } = loadDoc();
const doc = window.document;
const idRefs = new Set();
const reId = /getElementById\(\s*['"]([^'"]+)['"]\s*\)/g; let m3;
while ((m3 = reId.exec(src))) idRefs.add(m3[1]);
const deadReads = [...idRefs].filter(id => !doc.getElementById(id));
console.log('\n=== 3. getElementById ids with NO matching element in DOM (dead reads) ===');
console.log('  distinct ids referenced via getElementById: ' + idRefs.size);
if (!deadReads.length) console.log('  none ✓');
else { console.log('  ' + deadReads.length + ' dead id reference(s):'); deadReads.sort().forEach(id => console.log('    ✗ ' + id)); }

// ── 4. Duplicate HTML ids (DOM) ──
const seen = {};
doc.querySelectorAll('[id]').forEach(el => seen[el.id] = (seen[el.id] || 0) + 1);
const dupIds = Object.entries(seen).filter(([, n]) => n > 1);
console.log('\n=== 4. Duplicate HTML ids ===');
console.log(dupIds.length ? dupIds.map(([id, n]) => '  ⚠ ' + id + ' ×' + n).join('\n') : '  none ✓');
