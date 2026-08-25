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
import { HTML_FILE, FLAT_FILE } from './config.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const BASE = 'https://brsconnect.fr/';

let html = readFileSync(path.join(ROOT, HTML_FILE), 'utf8');

// En préview, generate.mjs absolutise les références locales depuis la racine
// (« /assets/… », « /js/… ») : on les ramène à la forme relative pour que le
// reste du script (écrit pour la sortie racine) s'applique à l'identique.
html = html
  .replaceAll('"/assets/', '"assets/')
  .replaceAll(', /assets/', ', assets/')
  .replaceAll('"/js/', '"js/')
  .replaceAll("url('/assets/", "url('assets/")
  .replaceAll('url("/assets/', 'url("assets/');

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
// 2. CSS : generate.mjs inline déjà les trois feuilles minifiées dans un
//    <style> — vérifier sa présence, puis absolutiser ses url('assets/…').
// ---------------------------------------------------------------------------
if (!/<style>[\s\S]*?--font-sans[\s\S]*?<\/style>/.test(html)) {
  console.error('flatten.mjs : <style> inline (tokens/base/main) introuvable dans index.html — abandon.');
  process.exit(1);
}
html = html
  .replaceAll("url('assets/", `url('${BASE}assets/`)
  .replaceAll('url("assets/', `url("${BASE}assets/`);

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
//    (src, href, preload, favicon…), y compris les entrées suivantes des
//    srcset (préfixées d'une virgule, pas d'un guillemet).
// ---------------------------------------------------------------------------
html = html.replaceAll('"assets/', `"${BASE}assets/`);
html = html.replaceAll(', assets/', `, ${BASE}assets/`);

// ---------------------------------------------------------------------------
// 5. Garde-fous : aucune référence relative ne doit subsister.
// ---------------------------------------------------------------------------
const leftovers = html.match(/(?:src|href)="(?:assets\/|css\/|js\/)[^"]*"/g);
if (leftovers) {
  console.error('flatten.mjs : références relatives restantes — abandon.\n' + leftovers.join('\n'));
  process.exit(1);
}

const out = path.join(ROOT, FLAT_FILE);
writeFileSync(out, html);
console.log(`${FLAT_FILE} généré (${(html.length / 1024).toFixed(1)} Ko).`);
