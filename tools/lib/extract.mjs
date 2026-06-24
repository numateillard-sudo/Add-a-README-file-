// extract.mjs — Pull the three reusable parts out of a standalone tool HTML:
//   css    : every <style> block (head + body), in document order
//   markup : the <body> inner HTML with <script>/<style> stripped
//   js     : every INLINE <script> block (CDN <script src=...> dropped), in order
//
// Robustness note: a tool's JS may embed literal "</body>" or "<script>" inside
// a string (e.g. an "export to standalone HTML" feature). So we extract <script>
// and <style> from the WHOLE document first (their </script>/</style> delimiters
// are clean), strip them, and only THEN slice out <body>…</body> — by which point
// any string-embedded </body> has been removed along with its <script>. The tool's
// logic itself is copied VERBATIM; only packaging surgery happens in build.mjs.

const STYLE_RE = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
const SCRIPT_RE = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;

export function extractParts(html, opts = {}) {
  const styles = [];
  const scripts = [];
  let m;

  STYLE_RE.lastIndex = 0;
  while ((m = STYLE_RE.exec(html))) styles.push(m[1]);

  SCRIPT_RE.lastIndex = 0;
  while ((m = SCRIPT_RE.exec(html))) {
    const attrs = m[1] || '';
    if (/\bsrc\s*=/.test(attrs)) continue; // external (e.g. Chart.js CDN) — dropped, bundled separately
    scripts.push(m[2]);
  }

  // Strip all <script>/<style> from the document, THEN take the body.
  const stripped = html.replace(SCRIPT_RE, '').replace(STYLE_RE, '');
  const bm = stripped.match(/<body\b[^>]*>([\s\S]*)<\/body>/i); // greedy → real (last) </body>
  let markup = bm ? bm[1] : stripped;

  if (opts.emptyIds) {
    for (const id of opts.emptyIds) markup = emptyDivById(markup, id);
  }

  return { css: styles.join('\n'), markup: markup.trim(), js: scripts.join('\n;\n') };
}

// Empty the inner HTML of <div id="ID" ...> … </div> via a balanced <div>/</div>
// scan (the container ships ~1.6 MB of pre-rendered content the JS regenerates).
function emptyDivById(html, id) {
  const openRe = new RegExp('<div[^>]*\\bid="' + id + '"[^>]*>', 'i');
  const om = html.match(openRe);
  if (!om) return html;
  const openEnd = om.index + om[0].length;
  let depth = 1;
  const tagRe = /<\/?div\b[^>]*>/gi;
  tagRe.lastIndex = openEnd;
  let t, closeAt = -1;
  while ((t = tagRe.exec(html))) {
    if (t[0][1] === '/') depth--; else depth++;
    if (depth === 0) { closeAt = t.index; break; }
  }
  if (closeAt < 0) return html;
  return html.slice(0, openEnd) + html.slice(closeAt);
}
