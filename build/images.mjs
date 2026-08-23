#!/usr/bin/env node
// build/images.mjs — SEULE étape du pipeline avec une dépendance npm (sharp),
// périmètre acté dans docs/adr/0002-pipeline-images-sharp.md. Les trois autres
// scripts (generate/validate/flatten) restent zéro-dépendance.
//
// Rôle : produire les variantes d'images que le HTML référence, plus le
// manifest de dimensions consommé par generate.mjs (srcset + width/height).
// Les sorties sont COMMITTÉES : GitHub Pages ne génère rien au déploiement.
//
// Idempotent : une variante n'est régénérée que si sa source est plus récente.
// `node build/images.mjs --force` régénère tout.
// Ordre du pipeline : images → generate → validate → flatten (npm run build).

import { readdirSync, statSync, existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const FORCE = process.argv.includes('--force');

// ---------------------------------------------------------------------------
// Configuration. Règle qualité (cf. README) : les visuels sortent en WebP q80 ;
// si un schéma se dégrade visiblement (texte fin flou), surcharger SA qualité
// dans QUALITY_OVERRIDES plutôt que d'accepter la perte partout.
// ---------------------------------------------------------------------------
const VISUALS_DIR = 'assets/images/brs-web-visuals';
const VISUAL_WIDTH_SMALL = 640; // variante -640w pour les affichages ~566 px
// Variante 960w réservée aux visuels du chemin critique (héros, eager) :
// sur mobile DPR 1.75, 92vw ≈ 660 px device — sans elle le navigateur
// retombe sur la 1200w (46 Kio) pour l'image LCP.
const VISUALS_960 = ['brs-web-visuals-image8'];
const QUALITY_DEFAULT = 80;
const QUALITY_OVERRIDES = {}; // ex. { 'brs-web-visuals-schema4': 88 }

// Logos : { source → largeur cible WebP } (≈ 2× la taille d'affichage max).
const LOGOS = {
  'assets/images/references/spie.png': 400,
  'assets/images/references/neolia.png': 400,
  'assets/images/references/gendarmerie.png': 400,
  'assets/images/references/ipsen.png': 400,
  'assets/images/references/somfy.png': 400,
  'assets/images/references/equans.png': 400,
  'assets/images/references/thonon.png': 400,
  'assets/images/references/seine-saint-denis-habitat.png': 400,
  'assets/images/partenaires/logo-advenir.png': 350,
  'assets/images/partenaires/logo-logivolt.png': 350,
  'assets/images/partenaires/logo-symphonics.png': 350,
  'assets/images/partenaires/logo-vertigo.png': 350,
  'assets/images/partenaires/logo-qualifelec-irve.jpg': 124,
  'assets/logos/brs-logomark-square.png': 80,
};

// Favicon dédié (PNG : compat maximale des onglets), 48 px.
const FAVICON = {
  source: 'assets/logos/brs-logomark-square.png',
  out: 'assets/logos/brs-logomark-favicon.png',
  width: 48,
};

// Dossiers couverts par le manifest de dimensions (tout ce que le site sert).
const MANIFEST_DIRS = [
  'assets/images/brs-web-visuals',
  'assets/images/references',
  'assets/images/partenaires',
  'assets/icons',
  'assets/logos',
];
const MANIFEST_OUT = 'assets/images/image-dimensions.json';

// ---------------------------------------------------------------------------
const abs = (rel) => path.join(ROOT, rel);
const stale = (srcRel, outRel) =>
  FORCE || !existsSync(abs(outRel)) || statSync(abs(srcRel)).mtimeMs > statSync(abs(outRel)).mtimeMs;

let generated = 0;
let skipped = 0;

async function toWebp(srcRel, outRel, width, quality) {
  if (!existsSync(abs(srcRel))) throw new Error(`Source manquante : ${srcRel}`);
  if (!stale(srcRel, outRel)) { skipped++; return; }
  await sharp(abs(srcRel))
    .resize({ width, withoutEnlargement: true })
    .webp({ quality })
    .toFile(abs(outRel));
  generated++;
  console.log(`  ✓ ${outRel} (${width}w, q${quality})`);
}

// 1. Visuels : variante -640w.webp depuis chaque PNG source du canvas
//    (+ -960w.webp pour les visuels listés dans VISUALS_960).
const visualPngs = readdirSync(abs(VISUALS_DIR)).filter((f) => f.endsWith('.png'));
for (const png of visualPngs) {
  const base = png.replace(/\.png$/, '');
  const quality = QUALITY_OVERRIDES[base] ?? QUALITY_DEFAULT;
  await toWebp(
    `${VISUALS_DIR}/${png}`,
    `${VISUALS_DIR}/${base}-640w.webp`,
    VISUAL_WIDTH_SMALL,
    quality
  );
  if (VISUALS_960.includes(base)) {
    await toWebp(`${VISUALS_DIR}/${png}`, `${VISUALS_DIR}/${base}-960w.webp`, 960, quality);
  }
}

// 2. Logos : WebP redimensionné à côté de la source (la source reste committée).
for (const [srcRel, width] of Object.entries(LOGOS)) {
  const outRel = srcRel.replace(/\.(png|jpg)$/, '.webp');
  await toWebp(srcRel, outRel, width, 82);
}

// 3. Favicon PNG 48 px.
if (stale(FAVICON.source, FAVICON.out)) {
  await sharp(abs(FAVICON.source)).resize({ width: FAVICON.width }).png().toFile(abs(FAVICON.out));
  generated++;
  console.log(`  ✓ ${FAVICON.out} (${FAVICON.width}w, png)`);
} else skipped++;

// 4. Manifest des dimensions réelles — consommé par generate.mjs pour le
//    srcset des visuels et les width/height des <img> qui n'en ont pas.
const manifest = {};
for (const dir of MANIFEST_DIRS) {
  for (const f of readdirSync(abs(dir)).sort()) {
    if (!/\.(png|webp|jpg|svg)$/.test(f)) continue;
    const rel = `${dir}/${f}`;
    if (f.endsWith('.svg')) continue; // les SVG sont dimensionnés par le CSS
    const meta = await sharp(abs(rel)).metadata();
    manifest[rel] = { w: meta.width, h: meta.height };
  }
}
writeFileSync(abs(MANIFEST_OUT), JSON.stringify(manifest, null, 2) + '\n', 'utf8');

console.log(`Images OK : ${generated} générée(s), ${skipped} à jour, manifest ${MANIFEST_OUT} (${Object.keys(manifest).length} entrées).`);
