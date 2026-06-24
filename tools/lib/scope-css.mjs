// scope-css.mjs — Scope a tool's stylesheet to a root container so it cannot
// leak onto the socle (or the sibling tool) and vice-versa.
//
// Transforms every rule:
//   body / html / :root            -> #root
//   *                              -> #root *
//   .card / #id / h1 / .a .b       -> #root .card  (descendant)
// Inside @media/@supports the inner rules are prefixed the same way; @keyframes
// blocks are left structurally intact but their NAME is namespaced (prefix-)
// and every animation/animation-name reference is rewritten to match, so two
// tools defining "@keyframes pulse" differently never clash in the shared <head>.
//
// Uses postcss (build-time dependency only — the shipped artifact has none).

import postcss from 'postcss';

const KEYFRAME_ATRULES = new Set(['keyframes', '-webkit-keyframes', '-moz-keyframes', '-o-keyframes']);

// Split a selector list on top-level commas (ignore commas inside (), [], "").
function splitSelectorList(sel) {
  const out = [];
  let depth = 0, str = null, cur = '';
  for (let i = 0; i < sel.length; i++) {
    const c = sel[i];
    if (str) { if (c === str && sel[i - 1] !== '\\') str = null; cur += c; continue; }
    if (c === '"' || c === "'") { str = c; cur += c; continue; }
    if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
    if (c === ',' && depth === 0) { out.push(cur); cur = ''; }
    else cur += c;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

function prefixOneSelector(sel, root) {
  let s = sel.trim();
  if (!s) return s;
  // Leading html/body/:root element becomes the root itself (keeping any
  // attached class/attr/pseudo and the rest of the combinator chain).
  const lead = s.match(/^(html|body|:root)\b/i);
  if (lead) {
    const rest = s.slice(lead[0].length);
    // `body` -> `#root`; `body.x` -> `#root.x`; `body .x` -> `#root .x`
    return root + rest;
  }
  // Everything else is nested under the root via a descendant combinator.
  return root + ' ' + s;
}

function prefixSelectorList(selector, root) {
  return splitSelectorList(selector).map((s) => prefixOneSelector(s, root)).join(', ');
}

/**
 * @param {string} css   raw stylesheet text
 * @param {string} root  scope selector, e.g. "#cb-root"
 * @param {string} kfPrefix keyframe-name namespace, e.g. "cb-"
 */
export function scopeCss(css, root, kfPrefix) {
  const ast = postcss.parse(css);

  // 1) Collect + rename @keyframes names.
  const renamed = new Map();
  ast.walkAtRules((at) => {
    if (KEYFRAME_ATRULES.has(at.name.toLowerCase())) {
      const oldName = at.params.trim();
      if (!renamed.has(oldName)) renamed.set(oldName, kfPrefix + oldName);
      at.params = renamed.get(oldName);
    }
  });

  // 2) Rewrite animation-name references (in `animation` shorthand and
  //    `animation-name`). A keyframe name appears as a whole token.
  if (renamed.size) {
    const names = [...renamed.keys()].sort((a, b) => b.length - a.length);
    const re = new RegExp('\\b(' + names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b', 'g');
    ast.walkDecls(/^(-\w+-)?animation(-name)?$/i, (decl) => {
      decl.value = decl.value.replace(re, (m) => renamed.get(m) || m);
    });
  }

  // 3) Prefix selectors of every style rule, except those inside @keyframes
  //    (their "selectors" are keyframe stops like 0%/from/to).
  ast.walkRules((rule) => {
    const p = rule.parent;
    if (p && p.type === 'atrule' && KEYFRAME_ATRULES.has(p.name.toLowerCase())) return;
    rule.selector = prefixSelectorList(rule.selector, root);
  });

  return ast.toString();
}
