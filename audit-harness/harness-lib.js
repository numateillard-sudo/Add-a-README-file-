// Shared harness loader: loads the HTML into jsdom with Chart.js + a few
// jsdom-missing globals (IntersectionObserver, matchMedia…) stubbed out.
// Exposes window + captured console/jsdom errors. Used by all verify scripts.
//
// Usage:  npm install jsdom   then   node verify.js
// The target file defaults to ../petit-livre-rouge-portefeuille.html (repo root);
// override with LPLR_FILE=/path/to/file.html
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const FILE = process.env.LPLR_FILE ||
  path.resolve(__dirname, '..', 'petit-livre-rouge-portefeuille.html');

function loadDoc() {
  let html = fs.readFileSync(FILE, 'utf8');
  html = html.replace(/<script src="https:\/\/cdn\.jsdelivr[^"]*"><\/script>/,
    `<script>
      window.IntersectionObserver = class { constructor(cb){ this.cb = cb; } observe(){} unobserve(){} disconnect(){} takeRecords(){ return []; } };
      window.ResizeObserver = class { observe(){} unobserve(){} disconnect(){} };
      if (!window.matchMedia) window.matchMedia = function(q){ return { matches:false, media:q, addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){}, dispatchEvent(){ return false; } }; };
      window.scrollTo = function(){};
      if (!window.requestAnimationFrame) window.requestAnimationFrame = function(cb){ return setTimeout(()=>cb(0), 0); };
      window.__charts = [];
      window.Chart = class {
        constructor(ctx, cfg){ this.ctx = ctx; this.config = cfg; this.data = cfg && cfg.data; this.options = cfg && cfg.options; window.__charts.push(this); }
        update(){} destroy(){ this.destroyed = true; } resize(){} getDatasetMeta(){ return { data: [] }; }
      };
      window.Chart.register = function(){};
      window.Chart.defaults = { font:{}, plugins:{}, set:function(){} };
    </script>`);

  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('error', (e) => errors.push(String(e)));
  virtualConsole.on('jsdomError', (e) => errors.push('jsdomError: ' + (e && e.message ? e.message : e)));

  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.test/', virtualConsole });
  const { window } = dom;

  if (window.HTMLCanvasElement) {
    window.HTMLCanvasElement.prototype.getContext = function(){
      return {
        canvas: this, clearRect(){}, fillRect(){}, beginPath(){}, arc(){}, fill(){}, stroke(){},
        moveTo(){}, lineTo(){}, closePath(){}, save(){}, restore(){}, translate(){}, rotate(){}, scale(){},
        measureText(){ return { width: 0 }; }, fillText(){},
        createLinearGradient(){ return { addColorStop(){} }; }, createRadialGradient(){ return { addColorStop(){} }; },
        setLineDash(){}, getImageData(){ return { data: [] }; }, putImageData(){}, drawImage(){},
        set fillStyle(v){}, get fillStyle(){return '#000';}, set strokeStyle(v){}, get strokeStyle(){return '#000';},
      };
    };
  }
  return { dom, window, errors };
}

module.exports = { loadDoc, FILE };
