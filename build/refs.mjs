// build/refs.mjs — contrôle des références d'une page HTML générée (partagé par validate.mjs et flatten.mjs).
// Vérifie que chaque fichier local référencé existe sur disque (src, href, srcset, url() des <style> et des
// attributs style) et que chaque ancre interne href="#x" a son id="x". Les références peuvent être relatives,
// absolutisées depuis la racine (« /assets/… », mode préview) ou absolues sur le domaine (page flat).
import { existsSync } from 'node:fs';
import path from 'node:path';

const LOCAL = /^(assets|css|js)\//;

// Chemin local d'une référence, ou null si elle ne vise pas un fichier du dépôt (lien externe, data:, ancre…).
export function localPath(ref, domain) {
  let u = ref.trim();
  if (u.startsWith(domain + '/')) u = u.slice(domain.length);
  u = u.replace(/^\.\.\//, '').replace(/^\//, '').replace(/[?#].*$/, '');
  return LOCAL.test(u) ? u : null;
}

export function collectRefs(html, domain) {
  const refs = new Set();
  const add = (r) => { const p = localPath(r, domain); if (p) refs.add(p); };
  for (const m of html.matchAll(/(?:src|href)="([^"]+)"/g)) add(m[1]);
  for (const m of html.matchAll(/srcset="([^"]+)"/g)) for (const part of m[1].split(',')) add(part.trim().split(/\s+/)[0]);
  for (const m of html.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g)) if (!m[2].startsWith('data:') && !m[2].startsWith('#')) add(m[2]);
  return refs;
}

export function checkHtmlRefs(html, { root, domain, label, fail }) {
  for (const ref of collectRefs(html, domain)) {
    if (!existsSync(path.join(root, ref))) fail(`${label} : fichier référencé introuvable : ${ref}`);
  }
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  for (const m of html.matchAll(/href="#([^"]+)"/g)) {
    if (!ids.has(m[1])) fail(`${label} : ancre interne #${m[1]} sans élément id="${m[1]}"`);
  }
}
