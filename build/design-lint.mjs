// build/design-lint.mjs — règles d'usage du DESIGN-GUIDE qui n'avaient aucun contrôle (REV #15), appelé par validate.mjs.
// Ne décide rien : il verrouille l'état actuel. Une règle de design change dans le canvas « BRS Connect - Design »,
// puis ici ; les exceptions sont des listes d'autorisation commentées (aucune exception implicite).
//   - pas de style="…" inline (template et page générée) ;
//   - zéro gradient (aucune exception, y compris en masque) ;
//   - zéro emoji ;
//   - une seule famille (Inter) : font-family limité à Inter, aucune exception (pas de police mono) ;
//   - aucun :hover qui déplace, agrandit, ombre ou redimensionne (la couleur seule bouge) ;
//   - seules boucles : marquee partenaires et badge Qualifelec, chacune coupée sous prefers-reduced-motion ;
//   - rayons : jetons uniquement (--radius-none 0, --radius-image 20px), plus la barre du burger.
import { readFileSync } from 'node:fs';
import path from 'node:path';

export const ALLOW = {
  // Gradient : aucune exception (décision de Romain, 2026-10-16 : le fondu du marquee est retiré).
  gradient: [],
  // Boucles d'animation autorisées (DESIGN-GUIDE) : nom du @keyframes → sélecteurs à couper sous reduced-motion.
  loops: { 'marquee-scroll': ['.partner-marquee__track'], 'certif-spin': ['.certif-badge__ring'] },
  // Police mono : aucune exception (la règle `code` n'était jamais employée, décision de Romain, 2026-10-16).
  monoSelectors: [],
  // Rayons admis hors jetons : la barre du burger (2 px de haut, hors échelle de rayons).
  radiusLiteral: [{ selector: '.nav-toggle__bar', value: '2px' }],
};

const HOVER_FORBIDDEN = /^(transform|translate|scale|rotate|box-shadow|filter|margin(-[a-z]+)?|padding(-[a-z]+)?|top|right|bottom|left|width|height)$/;
const RADIUS_TOKENS = /^(var\(--radius-(none|sm|md|full|image)\)|calc\(var\(--radius-image\) \+ var\(--space-sm\)\)|0)$/;
const FONT_OK = /^(?:'Inter'|'Inter-fallback'|var\(--font-sans\))$/;
// Emoji : présentation emoji, pictogrammes à variation FE0F, symboles et dingbats (✓, ★…). ©, ®, ™ et les flèches restent permis.
const EMOJI = /[\p{Emoji_Presentation}☀-➿⭐⭕]|\p{Extended_Pictographic}️/u;

const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const norm = (s) => s.replace(/\s+/g, ' ').trim();

// Règles `sélecteur{déclarations}` à plat (les @media et @keyframes sont traversés : leurs règles internes sont lues seules).
function rules(css) {
  const out = [];
  for (const m of strip(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const decls = m[2].split(';').map((d) => d.trim()).filter(Boolean).map((d) => {
      const i = d.indexOf(':');
      return i < 0 ? null : { prop: d.slice(0, i).trim().toLowerCase(), value: norm(d.slice(i + 1)) };
    }).filter(Boolean);
    out.push({ selectors: m[1].split(',').map(norm), decls });
  }
  return out;
}

// Contenu (accolades équilibrées) de chaque @media (prefers-reduced-motion:reduce).
function reducedMotionBlocks(css) {
  const t = strip(css), blocks = [];
  for (const m of t.matchAll(/@media[^{]*prefers-reduced-motion\s*:\s*reduce[^{]*\{/g)) {
    let depth = 1, i = m.index + m[0].length;
    const start = i;
    while (i < t.length && depth) { if (t[i] === '{') depth++; else if (t[i] === '}') depth--; i++; }
    blocks.push(t.slice(start, i - 1));
  }
  return blocks;
}

export function lintDesign({ root, html, template, content, fail }) {
  const files = ['css/tokens.css', 'css/base.css', 'css/main.css'];
  const css = Object.fromEntries(files.map((f) => [f, readFileSync(path.join(root, f), 'utf8')]));
  const tplCss = [...template.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');

  // 1. Pas de style inline.
  for (const [label, src] of [['templates/index.template.html', template], ['page générée', html]]) {
    if (/<[a-z][^>]*\sstyle\s*=/i.test(src)) fail(`Design : attribut style="…" inline dans ${label} (DESIGN-GUIDE : pas de style inline, tout passe par css/).`);
  }

  // 2. Zéro emoji (copy, template, CSS, page générée).
  const textes = { 'content/site-content.json': JSON.stringify(content), 'templates/index.template.html': template, 'page générée': html, ...css };
  for (const [label, src] of Object.entries(textes)) {
    const m = src.match(EMOJI);
    if (m) fail(`Design : emoji ou pictogramme « ${m[0]} » dans ${label} (DESIGN-GUIDE : zéro emoji).`);
  }

  const toutes = [...files.map((f) => [f, rules(css[f])]), ['templates/index.template.html (<style>)', rules(tplCss)]];
  for (const [label, rs] of toutes) {
    for (const r of rs) {
      for (const d of r.decls) {
        // 3. Zéro gradient.
        if (/gradient\(/i.test(d.value)) {
          const ok = ALLOW.gradient.some((a) => r.selectors.every((s) => s === a.selector) && a.props.includes(d.prop));
          if (!ok) fail(`Design : gradient dans ${label} (« ${r.selectors.join(', ')} » { ${d.prop} }) : aucun gradient (DESIGN-GUIDE).`);
        }
        // 4. Une seule famille.
        if (d.prop === 'font-family') {
          const v = d.value;
          const mono = v === 'var(--font-mono)' && r.selectors.every((s) => ALLOW.monoSelectors.includes(s));
          if (!FONT_OK.test(v) && !mono) fail(`Design : font-family « ${v} » dans ${label} (« ${r.selectors.join(', ')} ») : une seule famille (Inter ; var(--font-sans)).`);
        }
        if (d.prop === 'font' && d.value !== 'inherit') fail(`Design : raccourci font « ${d.value} » dans ${label} : écrire font-family: var(--font-sans) (une seule famille).`);
        // 5. Hover immobile.
        if (r.selectors.some((s) => s.includes(':hover')) && HOVER_FORBIDDEN.test(d.prop)) {
          fail(`Design : « ${d.prop} » dans un :hover (${label}, « ${r.selectors.join(', ')} ») : un hover ne déplace, n'agrandit ni n'ombre (la couleur seule change).`);
        }
        // 7. Rayons.
        if (d.prop === 'border-radius' && !RADIUS_TOKENS.test(d.value)) {
          const ok = ALLOW.radiusLiteral.some((a) => a.value === d.value && r.selectors.every((s) => s.startsWith(a.selector)));
          if (!ok) fail(`Design : border-radius « ${d.value} » dans ${label} (« ${r.selectors.join(', ')} ») : jetons --radius-* uniquement.`);
        }
      }
    }
  }

  // 4 bis. Polices déclarées : Inter seulement ; --font-sans commence par Inter.
  for (const m of strip(css['css/base.css']).matchAll(/@font-face\s*\{([^}]*)\}/g)) {
    const fam = m[1].match(/font-family\s*:\s*([^;]+)/)?.[1].trim();
    if (!/^'Inter(-fallback)?'$/.test(fam || '')) fail(`Design : @font-face « ${fam} » : seule la famille Inter est autorisée.`);
  }
  if (!/--font-sans:\s*'Inter'/.test(css['css/tokens.css'])) fail('Design : --font-sans doit commencer par \'Inter\' dans css/tokens.css.');

  // 6. Boucles : @keyframes et animations infinies limités à la liste, chacune coupée sous reduced-motion.
  const toutCss = files.map((f) => strip(css[f])).join('\n');
  for (const m of toutCss.matchAll(/@keyframes\s+([\w-]+)/g)) {
    if (!(m[1] in ALLOW.loops)) fail(`Design : @keyframes « ${m[1]} » hors liste (seules boucles : marquee partenaires, badge Qualifelec).`);
  }
  const rm = files.flatMap((f) => reducedMotionBlocks(css[f])).flatMap((b) => rules(b));
  const infinies = [];
  for (const f of files) for (const r of rules(css[f])) for (const d of r.decls) {
    if (!/^animation(-name)?$/.test(d.prop) || d.value === 'none') continue;
    const nom = Object.keys(ALLOW.loops).find((n) => d.value.includes(n));
    if (/\binfinite\b/.test(d.value) && !nom) fail(`Design : animation infinie « ${d.value} » (${f}, « ${r.selectors.join(', ')} ») hors liste.`);
    if (nom) infinies.push({ nom, selectors: r.selectors, f });
  }
  for (const [nom, sels] of Object.entries(ALLOW.loops)) {
    if (!infinies.some((i) => i.nom === nom)) continue;
    for (const s of sels) {
      const coupee = rm.some((r) => r.selectors.includes(s) && r.decls.some((d) => d.prop === 'animation' && d.value === 'none'));
      if (!coupee) fail(`Design : la boucle « ${nom} » (${s}) n'est pas coupée (animation:none) dans un @media (prefers-reduced-motion:reduce) propre.`);
    }
  }

  // 7 bis. Les jetons de rayon portent les valeurs du DESIGN-GUIDE.
  const tk = css['css/tokens.css'];
  if (!/--radius-none:\s*0\s*;/.test(tk)) fail('Design : --radius-none doit valoir 0 (cartes à angles droits).');
  if (!/--radius-image:\s*20px\s*;/.test(tk)) fail('Design : --radius-image doit valoir 20px (images).');
}
