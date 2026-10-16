// build/images-config.mjs — configuration du pipeline d'images, SANS dépendance (importée par images.mjs, qui a besoin
// de sharp, et par verify-images.mjs, qui n'en a pas besoin). Règle qualité (cf. README) : les visuels sortent en
// WebP q80 ; si un schéma se dégrade visiblement (texte fin flou), surcharger SA qualité dans QUALITY_OVERRIDES
// plutôt que d'accepter la perte partout.
import { readdirSync } from 'node:fs';
import path from 'node:path';

export const VISUALS_DIR = 'assets/images/brs-web-visuals';
export const VISUAL_WIDTH_SMALL = 640; // variante -640w pour les affichages ~566 px
// Variante 960w réservée aux visuels du chemin critique (héros, eager) :
// sur mobile DPR 1.75, 92vw ≈ 660 px device — sans elle le navigateur
// retombe sur la 1200w (46 Kio) pour l'image LCP.
export const VISUALS_960 = ['brs-web-visuals-image8'];
export const QUALITY_DEFAULT = 80;
export const QUALITY_OVERRIDES = {}; // ex. { 'brs-web-visuals-schema4': 88 }
export const LOGO_QUALITY = 82;

// Logos : { source → largeur cible WebP } (≈ 2× la taille d'affichage max).
export const LOGOS = {
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
export const FAVICON = {
  source: 'assets/logos/brs-logomark-square.png',
  out: 'assets/logos/brs-logomark-favicon.png',
  width: 48,
};

// Icône d'écran d'accueil iOS (180 px), même source que le favicon.
export const APPLE_TOUCH = {
  source: 'assets/logos/brs-logomark-square.png',
  out: 'assets/logos/brs-logomark-apple-touch.png',
  width: 180,
};

// Dossiers couverts par le manifest de dimensions (tout ce que le site sert).
export const MANIFEST_DIRS = [
  'assets/images/brs-web-visuals',
  'assets/images/references',
  'assets/images/partenaires',
  'assets/icons',
  'assets/logos',
];
export const MANIFEST_OUT = 'assets/images/image-dimensions.json';
// Quelle source, quels paramètres ont produit chaque sortie (le hash du source remplace les mtime, qu'un clone ou
// un `git checkout` remettent au hasard).
export const RECORD_OUT = 'assets/images/image-build.json';

// Toutes les sorties dérivées : { src, out, kind: 'webp' | 'png', width, quality }.
export function jobs(root) {
  const list = [];
  for (const png of readdirSync(path.join(root, VISUALS_DIR)).filter((f) => f.endsWith('.png')).sort()) {
    const base = png.replace(/\.png$/, '');
    const quality = QUALITY_OVERRIDES[base] ?? QUALITY_DEFAULT;
    list.push({ src: `${VISUALS_DIR}/${png}`, out: `${VISUALS_DIR}/${base}-640w.webp`, kind: 'webp', width: VISUAL_WIDTH_SMALL, quality });
    if (VISUALS_960.includes(base)) list.push({ src: `${VISUALS_DIR}/${png}`, out: `${VISUALS_DIR}/${base}-960w.webp`, kind: 'webp', width: 960, quality });
  }
  for (const [src, width] of Object.entries(LOGOS)) list.push({ src, out: src.replace(/\.(png|jpg)$/, '.webp'), kind: 'webp', width, quality: LOGO_QUALITY });
  list.push({ src: FAVICON.source, out: FAVICON.out, kind: 'png', width: FAVICON.width, quality: null });
  list.push({ src: APPLE_TOUCH.source, out: APPLE_TOUCH.out, kind: 'png', width: APPLE_TOUCH.width, quality: null });
  return list;
}

// Paramètres qui, s'ils changent, rendent une sortie périmée.
export const paramsOf = (j) => ({ kind: j.kind, width: j.width, quality: j.quality });
