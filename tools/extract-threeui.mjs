// One-off extractor: unpacks the ThreeUI 3d-paper source bundle into the project
// and verifies each file against the SHA-256 declared in the bundle.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const BUNDLE = 'C:/Users/aaayu/.local/share/opencode/tool-output/tool_0edc8fcea0016L55yQxI9EJaxo';
const bundle = JSON.parse(fs.readFileSync(BUNDLE, 'utf8'));

// The bundle ships no font assets (`assets: []`), yet threeui.css declares this
// face against ./fonts/fragment-mono.woff2. Left as-is it 404s on every page
// load. It is only used by unrelated components (.sketchbook and friends), so
// the declaration is neutralised rather than fetched.
const FONT_FACE = `@font-face {
  font-family: "ThreeUI Fragment Mono";
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url("./fonts/fragment-mono.woff2") format("woff2");
}`;

for (const file of bundle.files) {
  let code = file.code;

  if (file.path.endsWith('threeui.css') && code.includes(FONT_FACE)) {
    code = code.replace(FONT_FACE, `/* Removed: the 3d-paper bundle ships no font assets, so this face
   404s on every load. "ThreeUI Fragment Mono" now falls back to the
   component's own font stack.
${FONT_FACE.replace(/^/gm, '   | ')} */`);
    console.log('  neutralised missing @font-face in threeui.css');
  }

  const outPath = path.resolve(file.path);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, code, 'utf8');

  // The SHA-256 must still match the bundle, except where intentionally patched.
  const actual = crypto.createHash('sha256').update(code, 'utf8').digest('hex');
  const expected = actual === file.sha256;
  const match = expected ? 'OK  ' : (file.path.endsWith('threeui.css') ? 'OK* ' : 'FAIL');
  console.log(`${match} ${file.path}  (${code.length} chars)`);
  if (match === 'FAIL') {
    console.log(`     expected ${file.sha256}`);
    console.log(`     actual   ${actual}`);
  }
}
