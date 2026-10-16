#!/usr/bin/env node
// build/images.mjs — SEULE étape du pipeline avec une dépendance npm (sharp),
// périmètre acté dans docs/adr/0002-pipeline-images-sharp.md. Les trois autres
// scripts (generate/validate/flatten) restent zéro-dépendance.
//
// Rôle : produire les variantes d'images que le HTML référence, plus le
// manifest de dimensions consommé par generate.mjs (srcset + width/height).
// Les sorties sont COMMITTÉES : GitHub Pages ne génère rien au déploiement.
//
// Idempotent : une sortie n'est régénérée que si le hash (sha256) de sa source ou ses paramètres (largeur,
// qualité) ont changé depuis assets/images/image-build.json — plus de dépendance aux mtime, que `git clone`,
// `git checkout` ou une copie remettent au hasard. Une sortie présente mais sans entrée au registre est adoptée
// telle quelle (amorçage). `--force` régénère tout. Un changement de version de sharp ne régénère rien :
// comparer à l'œil (`--force` puis `git diff --stat assets/`) avant d'accepter.
// Configuration (logos, qualités, tailles) : build/images-config.mjs. Contrôle sans sharp : build/verify-images.mjs.
// Ordre du pipeline : images → generate → validate → flatten (npm run build).

import { readdirSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';
import { jobs, paramsOf, MANIFEST_DIRS, MANIFEST_OUT, RECORD_OUT } from './images-config.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const FORCE = process.argv.includes('--force');
const abs = (rel) => path.join(ROOT, rel);
const sha = (rel) => createHash('sha256').update(readFileSync(abs(rel))).digest('hex');

const record = existsSync(abs(RECORD_OUT)) ? JSON.parse(readFileSync(abs(RECORD_OUT), 'utf8')) : {};
const next = {};
let generated = 0;
let skipped = 0;
let adopted = 0;

for (const j of jobs(ROOT)) {
  if (!existsSync(abs(j.src))) throw new Error(`Source manquante : ${j.src}`);
  const srcSha256 = sha(j.src);
  const entry = { src: j.src, srcSha256, ...paramsOf(j) };
  const known = record[j.out];
  const same = known && known.srcSha256 === srcSha256 && JSON.stringify({ kind: known.kind, width: known.width, quality: known.quality }) === JSON.stringify(paramsOf(j));
  const fresh = existsSync(abs(j.out)) && !FORCE && (same || !known);
  if (fresh) { known ? skipped++ : adopted++; next[j.out] = entry; continue; }
  const img = sharp(abs(j.src)).resize({ width: j.width, withoutEnlargement: j.kind === 'webp' });
  await (j.kind === 'webp' ? img.webp({ quality: j.quality }) : img.png()).toFile(abs(j.out));
  generated++;
  next[j.out] = entry;
  console.log(`  ✓ ${j.out} (${j.width}w, ${j.kind === 'webp' ? 'q' + j.quality : 'png'})`);
}
writeFileSync(abs(RECORD_OUT), JSON.stringify(next, null, 2) + '\n', 'utf8');

// Manifest des dimensions réelles — consommé par generate.mjs pour le
// srcset des visuels et les width/height des <img> qui n'en ont pas.
const manifest = {};
for (const dir of MANIFEST_DIRS) {
  for (const f of readdirSync(abs(dir)).sort()) {
    if (!/\.(png|webp|jpg)$/.test(f)) continue; // les SVG sont dimensionnés par le CSS
    const rel = `${dir}/${f}`;
    const meta = await sharp(abs(rel)).metadata();
    manifest[rel] = { w: meta.width, h: meta.height };
  }
}
writeFileSync(abs(MANIFEST_OUT), JSON.stringify(manifest, null, 2) + '\n', 'utf8');

console.log(`Images OK : ${generated} générée(s), ${skipped} à jour, ${adopted} adoptée(s), manifest ${MANIFEST_OUT} (${Object.keys(manifest).length} entrées).`);
