// Splices the forked draw function and the certificate data into the ThreeUI
// certificate variant. Idempotent: re-running restores from the pristine
// extraction before applying, so the fork can be regenerated at any time.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const TARGET = path.join(root, 'src/shaders/3d-paper/sources/3d-paper-certificate.html');
const PRISTINE = path.join(root, 'tools/fork/3d-paper-certificate.pristine.html');
const FORK = path.join(root, 'tools/fork/certificate-draw.js');
const DATA = path.join(root, 'src/certificates/certificates.data.json');

// Always fork from a pristine copy so repeated runs cannot compound edits.
if (!fs.existsSync(PRISTINE)) {
  fs.copyFileSync(TARGET, PRISTINE);
  console.log('saved pristine copy of the certificate variant');
}

let src = fs.readFileSync(PRISTINE, 'utf8');
const certs = JSON.parse(fs.readFileSync(DATA, 'utf8').replace(/^\uFEFF/, ''));
const fork = fs.readFileSync(FORK, 'utf8');

let applied = 0;
function replaceOnce(haystack, needle, replacement, label) {
  const first = haystack.indexOf(needle);
  if (first === -1) throw new Error(`anchor not found: ${label}`);
  if (haystack.indexOf(needle, first + 1) !== -1) {
    throw new Error(`anchor is not unique: ${label}`);
  }
  applied++;
  console.log(`  patched ${label}`);
  return haystack.slice(0, first) + replacement + haystack.slice(first + needle.length);
}

// The original drawOld() runs from its signature to the blank line before
// makeCertTexture(), so both can be swapped in one splice.
const drawStart = src.indexOf('/* ---- 01 · OLD STYLE · paper');
const drawEnd = src.indexOf('function makeCertTexture(){');
if (drawStart === -1 || drawEnd === -1 || drawEnd < drawStart) {
  throw new Error('could not locate the drawOld() block');
}
src =
  src.slice(0, drawStart) +
  '/* ---- 01 · CERTIFICATE · paper (forked: real scans, see tools/fork) --- */\n' +
  fork +
  '\n' +
  src.slice(drawEnd);
applied++;
console.log('  patched drawOld() -> drawCert()');

// Parameterise the texture builder so it can render any certificate.
src = replaceOnce(
  src,
  'function makeCertTexture(){',
  'function makeCertTexture(idx){\n  idx = idx|0;',
  'makeCertTexture(idx)'
);
src = replaceOnce(src, '  drawOld(ctx);', '  drawCert(ctx, idx);', 'makeCertTexture() body');

// Preload the scans before the first texture is built.
src = replaceOnce(
  src,
  'const tex = makeCertTexture();',
  'const certTex = [];\nlet tex = null;',
  'texture list'
);
src = replaceOnce(
  src,
  '  const t2 = makeCertTexture();\n  tex.dispose(); mat.map = t2; mat.needsUpdate = true;',
  [
    '  loadCertImages().then(()=>{',
    '    certTex.forEach(t=>t.dispose()); certTex.length = 0;',
    '    for(let i=0;i<CERTS.length;i++) certTex.push(makeCertTexture(i));',
    '    const t2 = certTex.length ? certTex[0] : makeCertTexture(0);',
    '    if(tex) tex.dispose();',
    '    mat.map = t2; mat.needsUpdate = true; curCert = 0;',
  ].join('\n'),
  'boot() texture swap'
);
// boot() becomes async: it now waits for the scans to decode first.
src = replaceOnce(
  src,
  '  frame();\n}',
  '  frame();\n  });\n}',
  'boot() async tail'
);

// Page through certificates: every whole turn of the sheet advances one.
src = replaceOnce(
  src,
  '  group.updateMatrixWorld();',
  [
    '  // one full turn of the sheet = one certificate',
    '  if(certTex.length > 1){',
    '    const n  = certTex.length;',
    '    const ci = ((Math.round(dragYaw/(Math.PI*2)) % n) + n) % n;',
    '    if(ci !== curCert){ curCert = ci; mat.map = certTex[ci]; mat.needsUpdate = true; }',
    '  }',
    '  group.updateMatrixWorld();',
  ].join('\n'),
  'turn -> certificate paging'
);

// Personalise the copy that the upstream variant shipped with.
src = replaceOnce(
  src,
  '<h1>NOCTURNE</h1>',
  '<h1>AAYUSH</h1>',
  'background wordmark'
);
src = replaceOnce(
  src,
  '<div id="hint"><b>Drag</b> to turn it<span class="ptr"> &nbsp;·&nbsp; <b>Hover</b> to light it</span></div>',
  '<div id="hint"><b>Drag</b> to turn it<span class="ptr"> &nbsp;·&nbsp; <b>Hover</b> to light it &nbsp;·&nbsp; keep turning for more</span></div>',
  'hint copy'
);

// Inject the certificate records just before the app script runs.
const appScript = src.lastIndexOf('<script>');
if (appScript === -1) throw new Error('could not locate the app script tag');
const payload = JSON.stringify(certs).replace(/</g, '\\u003c');
src =
  src.slice(0, appScript) +
  '<script>window.__CERTS__ = ' + payload + ';</script>\n' +
  src.slice(appScript);
applied++;
console.log(`  injected ${certs.length} certificate records (${Math.round(payload.length / 1024)} KB)`);

fs.writeFileSync(TARGET, src, 'utf8');
console.log(`\napplied ${applied} patches -> ${path.relative(root, TARGET)}`);
console.log(`size ${Math.round(PRISTINE.length / 1024)} KB -> ${Math.round(src.length / 1024)} KB`);
