import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../server.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'docs');
const { readState } = await createApp(path.join(root, 'workspace'));
const state = await readState();
await fs.mkdir(out, { recursive: true });
for (const name of ['app.js', 'style.css', 'prism.js', 'prism-LICENSE.txt']) {
  await fs.copyFile(path.join(root, 'public', name), path.join(out, name));
}
let html = await fs.readFile(path.join(root, 'public/index.html'), 'utf8');
html = html.replace('<head>', '<head><meta name="atlas-mode" content="public">')
  .replaceAll('href="/', 'href="./').replaceAll('src="/', 'src="./');
await fs.writeFile(path.join(out, 'index.html'), html);
await fs.writeFile(path.join(out, 'state.json'), JSON.stringify(state));
await fs.writeFile(path.join(out, '.nojekyll'), '');
await fs.cp(path.join(root, 'workspace/assets'), path.join(out, 'assets'), { recursive: true });
console.log(`Published snapshot: ${state.draft.length} drafts, ${state.confirmed.length} confirmed nodes → docs/`);
