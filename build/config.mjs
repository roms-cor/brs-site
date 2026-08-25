#!/usr/bin/env node
// build/config.mjs — interrupteur préview / live du pipeline.
//
// PREVIEW = true (mode coming soon, depuis 2026-08-25) :
//   - la page générée sort dans home/ (index.html + index-flat.html) et la
//     racine (index.html coming soon, index-flat.html neutralisé) n'est
//     JAMAIS touchée par le build ;
//   - la page générée reçoit <meta name="robots" content="noindex"> et son
//     canonical pointe vers /home/ ;
//   - sitemap.xml, robots.txt et llms.txt sont GELÉS : generate.mjs ne les
//     réécrit pas (les versions commitées, minimales, restent en ligne).
//
// PREVIEW = false (go-live) :
//   - la page générée reprend la racine (index.html, index-flat.html),
//     sans noindex, canonical sur / ;
//   - sitemap.xml, robots.txt et llms.txt sont régénérés depuis le contenu.
//
// Pour remettre le site en ligne : passer PREVIEW à false, `npm run build`,
// vérifier, commit + push. Rien d'autre à changer.
export const PREVIEW = true;

// Dossier de sortie de la page générée, relatif à la racine du repo.
export const OUT_DIR = PREVIEW ? 'home' : '.';

// Chemin public de la page (canonical, JSON-LD).
export const PAGE_PATH = PREVIEW ? '/home/' : '/';

// Fichiers générés, relatifs à la racine du repo.
export const HTML_FILE = PREVIEW ? 'home/index.html' : 'index.html';
export const FLAT_FILE = PREVIEW ? 'home/index-flat.html' : 'index-flat.html';
