#!/usr/bin/env node
// debundle.mjs — Decompress the "Tout au même endroit" bundle into editable sources.
//
// The bundle (src/Tout_au_meme_endroit.html) is a self-extracting artifact:
//   <script type="__bundler/manifest">     JSON { uuid: { data:<base64>, compressed:bool, mime } }
//   <script type="__bundler/ext_resources"> JSON [ { uuid, id } ]
//   <script type="__bundler/template">      JSON "<html string with uuid placeholders>"
// Compressed assets are gzip-then-base64. This script reverses that and writes:
//   build/decompiled/manifest.json          (metadata only: mime + compressed + filename, NO base64)
//   build/decompiled/assets/<uuid>.<ext>    (decompressed asset bytes)
//   build/decompiled/template.html          (the decoded HTML template string)
//   build/decompiled/data-dc-script.js      (the app logic lifted from <script data-dc-script>)
//
// Re-bundling is done by tools/rebundle.mjs which consumes exactly these outputs.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const INPUT = process.argv[2] || path.join(ROOT, 'src', 'Tout_au_meme_endroit.html');
const OUTDIR = process.argv[3] || path.join(ROOT, 'build', 'decompiled');
const ASSETDIR = path.join(OUTDIR, 'assets');

fs.mkdirSync(ASSETDIR, { recursive: true });

const html = fs.readFileSync(INPUT, 'utf8');

// Extract the inner text of a <script type="..."> block. The blocks are large
// single lines, so a non-greedy match between the exact open/close tags is safe.
function extractScript(type) {
  const re = new RegExp(
    '<script type="' + type.replace(/[/]/g, '\\/') + '">([\\s\\S]*?)<\\/script>',
    'i'
  );
  const m = html.match(re);
  if (!m) throw new Error('Missing <script type="' + type + '">');
  return m[1];
}

const manifestRaw = extractScript('__bundler/manifest').trim();
const extResRaw = extractScript('__bundler/ext_resources').trim();
const templateRaw = extractScript('__bundler/template').trim();

const manifest = JSON.parse(manifestRaw);
const extResources = JSON.parse(extResRaw);
const template = JSON.parse(templateRaw); // a JSON-encoded HTML string

const mimeExt = {
  'text/javascript': 'js',
  'application/javascript': 'js',
  'text/css': 'css',
  'font/woff2': 'woff2',
  'font/woff': 'woff',
  'font/ttf': 'ttf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/svg+xml': 'svg',
  'application/json': 'json',
  'text/html': 'html',
};

const metaOut = { assets: {}, extResources };

for (const [uuid, entry] of Object.entries(manifest)) {
  const bytes = Buffer.from(entry.data, 'base64');
  const out = entry.compressed ? zlib.gunzipSync(bytes) : bytes;
  const ext = mimeExt[entry.mime] || 'bin';
  const fname = `${uuid}.${ext}`;
  fs.writeFileSync(path.join(ASSETDIR, fname), out);
  metaOut.assets[uuid] = {
    mime: entry.mime,
    compressed: !!entry.compressed,
    file: `assets/${fname}`,
    bytes: out.length,
  };
  console.log(`asset ${uuid}  ${entry.mime}  ${entry.compressed ? 'gz' : 'raw'}  ${out.length} bytes -> ${fname}`);
}

fs.writeFileSync(path.join(OUTDIR, 'manifest.json'), JSON.stringify(metaOut, null, 2));
fs.writeFileSync(path.join(OUTDIR, 'template.html'), template);
console.log(`template.html  ${template.length} chars`);
console.log(`ext_resources: ${JSON.stringify(extResources)}`);

// Lift the app logic from <script data-dc-script> so it can be edited as plain JS.
const dcMatch = template.match(/<script\b[^>]*\bdata-dc-script\b[^>]*>([\s\S]*?)<\/script>/i);
if (dcMatch) {
  fs.writeFileSync(path.join(OUTDIR, 'data-dc-script.js'), dcMatch[1]);
  console.log(`data-dc-script.js  ${dcMatch[1].length} chars`);
} else {
  console.log('WARN: no <script data-dc-script> found in template');
}

// Also lift the <x-dc> template markup block for reference.
const xdcMatch = template.match(/<x-dc>([\s\S]*?)<\/x-dc>/i);
if (xdcMatch) {
  fs.writeFileSync(path.join(OUTDIR, 'x-dc.html'), xdcMatch[1]);
  console.log(`x-dc.html  ${xdcMatch[1].length} chars`);
}

console.log('\nDONE. Sources in', OUTDIR);
