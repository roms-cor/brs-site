#!/usr/bin/env node
// build/flatten.mjs — zéro dépendance npm.
// Dérive index-flat.html depuis index.html : CSS et JS inlinés, assets en
// URLs absolues (meta.domain de site-content.json). À lancer après
// generate.mjs + validate.mjs. Ne jamais éditer index-flat.html à la main.
// Casse le build (exit 1) s'il reste une référence relative après passage.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const content = JSON.parse(readFileSync(path.join(ROOT, 'content/site-content.json'), 'utf8'));
const domain = (content.meta && content.meta.domain || '').replace(/\/$/, '');
if (!/^https:\/\//.test(domain)) {
  console.error('flatten.mjs : meta.domain absent ou invalide dans site-content.json');
  process.exit(1);
}

let html = readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// --- 1. CSS : les <link rel="stylesheet"> deviennent un seul bloc <style>.
// Les url(...) relatives des feuilles (fonts) passent en absolu au passage.
const cssFiles = [];
html = html.replace(/<link rel="stylesheet" href="(css\/[\w.-]+\.css)">\n?/g, (_m, file) => {
  cssFiles.push(file);
  return '';
});
if (cssFiles.length === 0) {
  console.error('flatten.mjs : aucune feuille <link rel="stylesheet" href="css/…"> trouvée dans index.html');
  process.exit(1);
}
const css = cssFiles
  .map((file) => readFileSync(path.join(ROOT, file), 'utf8'))
  .join('\n')
  .replace(/url\((['"]?)\.\.\/(assets\/[^'")]+)\1\)/g, `url($1${domain}/$2$1)`);
html = html.replace('</title>', `</title>\n<style>\n${css}\n</style>`);

// --- 2. JS : le <script defer> devient un <script> inline en fin de <body>
// (même moment d'exécution : après le parse du document).
const jsFiles = [];
html = html.replace(/<script src="(js\/[\w.-]+\.js)" defer><\/script>\n?/g, (_m, file) => {
  jsFiles.push(file);
  return '';
});
const js = jsFiles.map((file) => readFileSync(path.join(ROOT, file), 'utf8')).join('\n');
if (js.includes('</script')) {
  console.error('flatten.mjs : le JS contient "</script" — inline impossible sans échappement');
  process.exit(1);
}
if (js) html = html.replace('</body>', `<script>\n${js}\n</script>\n</body>`);

// --- 3. Assets : toute référence relative src/href passe en URL absolue.
html = html.replace(/(src|href)="(assets\/[^"]+)"/g, `$1="${domain}/$2"`);

// --- 4. Garde-fou : plus aucune référence relative ne doit subsister.
const residues = [
  ...html.matchAll(/(?:src|href)="(?!https?:|mailto:|tel:|#|data:)[^"]+"/g),
  ...html.matchAll(/url\((['"]?)\.\.\//g),
].map((m) => m[0]);
if (residues.length) {
  console.error('flatten.mjs : références relatives résiduelles :');
  for (const r of [...new Set(residues)]) console.error(`  - ${r}`);
  process.exit(1);
}

writeFileSync(path.join(ROOT, 'index-flat.html'), html);
console.log('Flatten OK :');
console.log(`  - index-flat.html (${cssFiles.length} CSS + ${jsFiles.length} JS inlinés, assets sur ${domain})`);
