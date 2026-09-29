// One-off extractor: unpacks the ThreeUI 3d-paper source bundle into the project
// and verifies each file against the SHA-256 declared in the bundle.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const BUNDLE = 'C:/Users/aaayu/.local/share/opencode/tool-output/tool_0edc8fcea0016L55yQxI9EJaxo';
const bundle = JSON.parse(fs.readFileSync(BUNDLE, 'utf8'));

for (const file of bundle.files) {
  const outPath = path.resolve(file.path);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, file.code, 'utf8');

  const actual = crypto.createHash('sha256').update(file.code, 'utf8').digest('hex');
  const match = actual === file.sha256 ? 'OK  ' : 'FAIL';
  console.log(`${match} ${file.path}  (${file.code.length} chars)`);
  if (match === 'FAIL') {
    console.log(`     expected ${file.sha256}`);
    console.log(`     actual   ${actual}`);
  }
}
