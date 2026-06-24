#!/usr/bin/env node
// rebundle.mjs — Reassemble the self-extracting bundle from build/decompiled/.
//
// Inverse of debundle.mjs. Reads:
//   build/decompiled/manifest.json   (asset metadata: mime, compressed, file)
//   build/decompiled/assets/*        (asset bytes)
//   build/decompiled/template.html   (HTML template string)
// and rewrites the three <script type="__bundler/*"> blocks inside the original
// shell (src/Tout_au_meme_endroit.html), preserving the loader/head/body verbatim.
//
// CRITICAL: the template is stored as a JSON string inside a <script> element.
// JSON.stringify does NOT escape '/', so a literal "</script>" inside the template
// (the app's own <script> tags) would prematurely close the bundler block. We
// neutralize "</script" -> "<\/script" — valid JSON ("\/" parses back to "/"),
// and the HTML tokenizer no longer sees a closing tag. The original encoder used
// the equivalent "</script>" form.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const SHELL = process.argv[2] || path.join(ROOT, 'src', 'Tout_au_meme_endroit.html');
const DECOMP = process.argv[3] || path.join(ROOT, 'build', 'decompiled');
const OUTPUT = process.argv[4] || path.join(ROOT, 'build', 'Ecrin.html');

const meta = JSON.parse(fs.readFileSync(path.join(DECOMP, 'manifest.json'), 'utf8'));
const templateHtml = fs.readFileSync(path.join(DECOMP, 'template.html'), 'utf8');

// Rebuild the manifest: re-gzip compressed assets, base64-encode all.
const manifest = {};
for (const [uuid, info] of Object.entries(meta.assets)) {
  const bytes = fs.readFileSync(path.join(DECOMP, info.file));
  const stored = info.compressed ? zlib.gzipSync(bytes, { level: 9 }) : bytes;
  manifest[uuid] = {
    mime: info.mime,
    compressed: !!info.compressed,
    data: stored.toString('base64'),
  };
}
const manifestJson = JSON.stringify(manifest);
const extResJson = JSON.stringify(meta.extResources || []);

// Encode the template as a JSON string, then make it <script>-safe.
const templateJson = JSON.stringify(templateHtml).replace(/<\/script/gi, '<\\/script');

// Splice the three blocks into the original shell, preserving everything else.
const shell = fs.readFileSync(SHELL, 'utf8');
const manifestOpen = '<script type="__bundler/manifest">';
const tplOpen = '<script type="__bundler/template">';

const idxManifest = shell.indexOf(manifestOpen);
if (idxManifest < 0) throw new Error('shell: manifest block not found');
const idxTpl = shell.indexOf(tplOpen);
if (idxTpl < 0) throw new Error('shell: template block not found');
const idxTplClose = shell.indexOf('</script>', idxTpl);
if (idxTplClose < 0) throw new Error('shell: template close not found');

const prefix = shell.slice(0, idxManifest);
const suffix = shell.slice(idxTplClose + '</script>'.length);

const out =
  prefix +
  manifestOpen + '\n' + manifestJson + '\n  </script>\n\n' +
  '  <script type="__bundler/ext_resources">\n' + extResJson + '\n  </script>\n\n' +
  tplOpen + '\n' + templateJson + '\n  </script>' +
  suffix;

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, out);

console.log(`Rebundled -> ${OUTPUT}`);
console.log(`  manifest assets: ${Object.keys(manifest).length}`);
console.log(`  manifest JSON:   ${manifestJson.length} chars`);
console.log(`  template JSON:   ${templateJson.length} chars`);
console.log(`  total size:      ${out.length} bytes`);
