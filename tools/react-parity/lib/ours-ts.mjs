// Transpiles the HR site's src/lib/** to CommonJS in a temp dir (TypeScript from frontend/hr-web/node_modules) and
// returns a loader, so our site formulas run in the same process as the reference.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const WEB = path.resolve(here, '../../../frontend/hr-web');
const SRC = path.join(WEB, 'src/lib');

export function buildOurs() {
  const require = createRequire(import.meta.url);
  const ts = require(path.join(WEB, 'node_modules/typescript'));
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'ariba-react-parity-'));
  fs.writeFileSync(path.join(out, 'package.json'), '{"type":"commonjs"}');
  (function walk(d) {
    for (const f of fs.readdirSync(d)) {
      const p = path.join(d, f);
      if (fs.statSync(p).isDirectory()) { walk(p); continue; }
      if (!/\.tsx?$/.test(f)) continue;
      const code = fs.readFileSync(p, 'utf8').replace(/from "@\/lib\//g, 'from "' + out + '/');
      const js = ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
      const o = path.join(out, path.relative(SRC, p)).replace(/\.tsx?$/, '.js');
      fs.mkdirSync(path.dirname(o), { recursive: true });
      fs.writeFileSync(o, js);
    }
  })(SRC);
  const req = createRequire(path.join(out, 'index.js'));
  return (mod) => { const f = path.join(out, mod + '.js'); return fs.existsSync(f) ? req(f) : null; };
}
