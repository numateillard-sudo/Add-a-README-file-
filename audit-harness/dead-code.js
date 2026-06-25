// Precise "declared but never referenced" analysis for top-level const/function names.
const fs = require('fs');
const path = require('path');
const FILE = process.env.LPLR_FILE || path.resolve(__dirname, '..', 'petit-livre-rouge-portefeuille.html');
const src = fs.readFileSync(FILE, 'utf8');

// Collect top-level (column<=2 indent) const/function NAMES that look like module-level decls.
const lines = src.split('\n');
const names = new Map(); // name -> declLine
lines.forEach((l, i) => {
  let m;
  if ((m = l.match(/^(?:const|let|var)\s+([A-Z][A-Z0-9_]+)\s*=/))) names.set(m[1], i + 1);        // SCREAMING consts
  else if ((m = l.match(/^function\s+([A-Za-z_$][\w$]*)\s*\(/))) names.set(m[1], i + 1);            // top-level functions
});

// Count references (whole-word) across the whole source, minus the declaration occurrence.
const dead = [];
for (const [name, line] of names) {
  const re = new RegExp('\\b' + name.replace(/[$]/g, '\\$') + '\\b', 'g');
  const total = (src.match(re) || []).length;
  if (total <= 1) dead.push({ name, line });
}
dead.sort((a, b) => a.line - b.line);
console.log('=== Top-level const(SCREAMING)/function declared but NEVER referenced elsewhere ===');
if (!dead.length) console.log('  none');
else dead.forEach(d => console.log('  ⚠ ' + d.name + '  (declared L' + d.line + ', 0 other refs)'));
console.log('\n(total module-level names scanned: ' + names.size + ')');
