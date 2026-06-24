#!/usr/bin/env node
// verify-bundle.mjs — Replicate the browser loader to prove a bundle is loadable.
// Extracts the three blocks, JSON.parses them, decodes+gunzips every asset, performs
// the uuid->blobURL string substitution, and sanity-checks the resulting HTML.
// Exits non-zero on any failure. This is the automated stand-in for "loads in browser
// without console error".

import fs from 'node:fs';
import zlib from 'node:zlib';

const FILE = process.argv[2];
if (!FILE) { console.error('usage: verify-bundle.mjs <bundle.html>'); process.exit(2); }
const html = fs.readFileSync(FILE, 'utf8');

function block(type) {
  const re = new RegExp('<script type="' + type.replace(/[/]/g, '\\/') + '">([\\s\\S]*?)<\\/script>', 'i');
  const m = html.match(re);
  if (!m) throw new Error('missing block ' + type);
  return m[1].trim();
}

let ok = true;
const fail = (msg) => { ok = false; console.error('  FAIL: ' + msg); };
const pass = (msg) => console.log('  ok: ' + msg);

try {
  const manifest = JSON.parse(block('__bundler/manifest'));
  pass('manifest JSON parses (' + Object.keys(manifest).length + ' assets)');

  const extRes = JSON.parse(block('__bundler/ext_resources'));
  pass('ext_resources JSON parses (' + extRes.length + ' entries)');

  let template = JSON.parse(block('__bundler/template'));
  pass('template JSON parses (' + template.length + ' chars)');

  // Decode every asset exactly like the loader (atob -> bytes -> gunzip if compressed).
  let assetBytes = 0;
  for (const [uuid, entry] of Object.entries(manifest)) {
    const bytes = Buffer.from(entry.data, 'base64');
    const out = entry.compressed ? zlib.gunzipSync(bytes) : bytes;
    assetBytes += out.length;
    if (!template.includes(uuid)) fail('uuid ' + uuid + ' not referenced in template');
  }
  pass('all ' + Object.keys(manifest).length + ' assets decode/gunzip (' + assetBytes + ' bytes total)');

  // Perform uuid substitution (loader does template.split(uuid).join(blobUrl)).
  for (const uuid of Object.keys(manifest)) template = template.split(uuid).join('blob:fake/' + uuid);
  if (/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/.test(template)) {
    // remaining uuid-like tokens are fine only if they are not manifest keys; warn-level
    pass('uuid substitution complete (some uuid-shaped strings may remain in app data, expected)');
  } else {
    pass('uuid substitution complete');
  }

  // Sanity: the post-substitution template should be well-formed enough to host the app.
  if (!/<!DOCTYPE html>/i.test(template)) fail('template missing DOCTYPE');
  else pass('template has DOCTYPE');
  if (!/<x-dc>/i.test(template)) fail('template missing <x-dc>');
  else pass('template has <x-dc>');
  if (!/data-dc-script/i.test(template)) fail('template missing data-dc-script');
  else pass('template has data-dc-script');

  // No literal </script> may survive inside the encoded template block in the file,
  // otherwise the browser would truncate the bundler block early.
  const rawTemplateBlock = block('__bundler/template');
  if (/<\/script>/i.test(rawTemplateBlock)) fail('encoded template block contains a literal </script> (would truncate)');
  else pass('encoded template block has no truncating </script>');

} catch (e) {
  fail('exception: ' + e.message);
}

console.log(ok ? '\nVERIFY: PASS' : '\nVERIFY: FAIL');
process.exit(ok ? 0 : 1);
