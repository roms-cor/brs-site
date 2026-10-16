#!/usr/bin/env node
// build/verify-images.mjs — zéro dépendance (n'a pas besoin de sharp, donc tourne aussi quand node_modules est cassé).
// Vérifie que les sorties du pipeline d'images sont à jour sans les régénérer :
//   - chaque sortie existe ;
//   - le hash de sa source et ses paramètres (assets/images/image-build.json) sont ceux d'aujourd'hui ;
//   - chaque fichier du manifest de dimensions existe, et aucune image servie n'en est absente.
// --adopt : écrit image-build.json depuis l'état actuel du disque (amorçage, ou changement jugé à jour : à n'utiliser
// que si les sorties ont été relues). Sort en erreur au premier écart.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { jobs, paramsOf, MANIFEST_OUT, MANIFEST_DIRS, RECORD_OUT } from './images-config.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const sha = (rel) => createHash('sha256').update(readFileSync(path.join(ROOT, rel))).digest('hex');

if (process.argv.includes('--adopt')) {
  const record = {};
  for (const j of jobs(ROOT)) record[j.out] = { src: j.src, srcSha256: sha(j.src), ...paramsOf(j) };
  writeFileSync(path.join(ROOT, RECORD_OUT), JSON.stringify(record, null, 2) + '\n', 'utf8');
  console.log(`${RECORD_OUT} écrit depuis l'état actuel (${Object.keys(record).length} sorties).`);
  process.exit(0);
}

const errors = [];
const record = existsSync(path.join(ROOT, RECORD_OUT)) ? JSON.parse(readFileSync(path.join(ROOT, RECORD_OUT), 'utf8')) : null;
if (!record) errors.push(`${RECORD_OUT} absent : lancer node build/images.mjs (ou verify-images.mjs --adopt si les sorties sont à jour)`);
for (const j of jobs(ROOT)) {
  if (!existsSync(path.join(ROOT, j.src))) { errors.push(`source manquante : ${j.src}`); continue; }
  if (!existsSync(path.join(ROOT, j.out))) { errors.push(`sortie manquante : ${j.out} (images.mjs à rejouer ?)`); continue; }
  const r = record?.[j.out];
  if (record && !r) errors.push(`${j.out} : absent de ${RECORD_OUT}`);
  else if (r && (r.srcSha256 !== sha(j.src) || JSON.stringify({ kind: r.kind, width: r.width, quality: r.quality }) !== JSON.stringify(paramsOf(j)))) {
    errors.push(`${j.out} : périmée (source ou paramètres changés depuis sa génération) -> node build/images.mjs`);
  }
}
const manifest = JSON.parse(readFileSync(path.join(ROOT, MANIFEST_OUT), 'utf8'));
for (const k of Object.keys(manifest)) if (!existsSync(path.join(ROOT, k))) errors.push(`manifest : ${k} listé mais absent du disque`);
for (const dir of MANIFEST_DIRS) {
  for (const f of readdirSync(path.join(ROOT, dir))) {
    if (/\.(png|webp|jpg)$/.test(f) && !manifest[`${dir}/${f}`]) errors.push(`manifest : ${dir}/${f} présent sur le disque mais absent du manifest`);
  }
}
if (errors.length) { console.error('✗ images : ' + errors.length + ' écart(s)\n  ' + errors.join('\n  ')); process.exit(1); }
console.log('✓ images : sorties présentes, hash des sources et paramètres conformes à ' + RECORD_OUT + ', manifest complet.');
