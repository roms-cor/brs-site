#!/usr/bin/env node
// build/flatten.mjs — zéro dépendance npm.
// Dérive index-flat.html depuis index.html : CSS (tokens/base/main) et JS
// inlinés, assets réécrits en URLs absolues https://brsconnect.fr/.
// Un seul fichier autonome, aucun asset local requis (connexion internet
// nécessaire pour images et polices).
// Ne jamais éditer index-flat.html à la main — il est écrasé à chaque build.
// Ordre du pipeline : node build/generate.mjs && node build/validate.mjs && node build/flatten.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const BASE = 'https://brsconnect.fr/';

let html = readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// ---------------------------------------------------------------------------
// 1. Bannière : signaler que ce fichier est un dérivé flat, généré au build.
// ---------------------------------------------------------------------------
const generatedBanner = '<!-- ============================================================\n     GÉNÉRÉ AU BUILD';
if (!html.includes(generatedBanner)) {
  console.error('flatten.mjs : bannière « GÉNÉRÉ AU BUILD » introuvable dans index.html — abandon.');
  process.exit(1);
}
const flatBanner = `<!-- ============================================================
     VERSION FLAT AUTONOME — un seul fichier, aucun asset local requis.
     CSS (tokens/base/main) et JS inlinés ; images et polices chargées
     depuis ${BASE} (connexion internet nécessaire).
     Dérivée de index.html — GÉNÉRÉ AU BUILD, ne pas éditer à la main.
     Régénérer via : node build/generate.mjs && node build/flatten.mjs
     ============================================================ -->
`;
html = html.replace(generatedBanner, flatBanner + generatedBanner);

// ---------------------------------------------------------------------------
// 2. CSS : remplacer les trois <link rel="stylesheet"> par un <style> unique.
//    Les url('../assets/…') des feuilles deviennent absolues.
// ---------------------------------------------------------------------------
const cssFiles = ['css/tokens.css', 'css/base.css', 'css/main.css'];
const inlinedCss = cssFiles
  .map((f) => {
    const css = readFileSync(path.join(ROOT, f), 'utf8')
      .replaceAll("url('../assets/", `url('${BASE}assets/`)
      .replaceAll('url("../assets/', `url("${BASE}assets/`);
    return `/* ==================== ${f} ==================== */\n${css}`;
  })
  .join('\n');

const linkBlock = cssFiles.map((f) => `<link rel="stylesheet" href="${f}">`).join('\n');
if (!html.includes(linkBlock)) {
  console.error('flatten.mjs : bloc des <link rel="stylesheet"> introuvable dans index.html — abandon.');
  process.exit(1);
}
html = html.replace(linkBlock, `<style>\n${inlinedCss}\n</style>`);

// ---------------------------------------------------------------------------
// 3. JS : inliner js/main.js à la place du <script src>. Sans risque :
//    main.js gère lui-même document.readyState.
// ---------------------------------------------------------------------------
const scriptTag = '<script src="js/main.js" defer></script>';
if (!html.includes(scriptTag)) {
  console.error('flatten.mjs : <script src="js/main.js"> introuvable dans index.html — abandon.');
  process.exit(1);
}
const js = readFileSync(path.join(ROOT, 'js/main.js'), 'utf8');
html = html.replace(scriptTag, `<script>\n${js}\n</script>`);

// ---------------------------------------------------------------------------
// 4. Assets : toutes les références relatives "assets/…" deviennent absolues
//    (src, href, preload, favicon…).
// ---------------------------------------------------------------------------
html = html.replaceAll('"assets/', `"${BASE}assets/`);

// ---------------------------------------------------------------------------
// 5. Garde-fous : aucune référence relative ne doit subsister.
// ---------------------------------------------------------------------------
const leftovers = html.match(/(?:src|href)="(?:assets\/|css\/|js\/)[^"]*"/g);
if (leftovers) {
  console.error('flatten.mjs : références relatives restantes — abandon.\n' + leftovers.join('\n'));
  process.exit(1);
}

const out = path.join(ROOT, 'index-flat.html');
writeFileSync(out, html);
console.log(`index-flat.html généré (${(html.length / 1024).toFixed(1)} Ko).`);
