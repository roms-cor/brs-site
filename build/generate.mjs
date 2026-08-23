#!/usr/bin/env node
// build/generate.mjs — zéro dépendance npm.
// Lit content/site-content.json + templates/index.template.html,
// génère : index.html, sitemap.xml, llms.txt, robots.txt.
// Une seule règle : tout ce qui est éditorial vit dans content/site-content.json.
// Ne jamais éditer index.html à la main — il est écrasé à chaque build.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const content = JSON.parse(readFileSync(path.join(ROOT, 'content/site-content.json'), 'utf8'));
const template = readFileSync(path.join(ROOT, 'templates/index.template.html'), 'utf8');

const now = new Date();
const buildYear = String(now.getFullYear());
const buildDate = now.toISOString().slice(0, 10);
const buildTimestamp = `${now.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', year: 'numeric' })} à ${now.toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' })}`;

// ---------------------------------------------------------------------------
// Moteur de templating minimal : {{path.to.value}}, {{{raw.html}}},
// {{#each path}}...{{/each}}, {{#if path}}...{{/if}}. Pas de dépendance.
// ---------------------------------------------------------------------------
function get(obj, keyPath) {
  return keyPath.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
}

function render(str, ctx) {
  // 1. blocs {{#each path}}...{{/each}} (non imbriqués dans ce template)
  str = str.replace(/{{#each ([\w.]+)}}([\s\S]*?){{\/each}}/g, (_m, keyPath, inner) => {
    const arr = get(ctx, keyPath);
    if (!Array.isArray(arr)) return '';
    return arr
      .map((item) => {
        const itemCtx = item && typeof item === 'object' ? { ...item } : { this: item };
        return render(inner, itemCtx);
      })
      .join('');
  });
  // 2. blocs {{#if path}}...{{/if}}
  str = str.replace(/{{#if ([\w.]+)}}([\s\S]*?){{\/if}}/g, (_m, keyPath, inner) => {
    const val = get(ctx, keyPath);
    return val ? render(inner, ctx) : '';
  });
  // 3. sortie brute {{{path}}} (HTML de confiance, ex. SVG paths)
  str = str.replace(/{{{([\w.]+)}}}/g, (_m, keyPath) => {
    const val = get(ctx, keyPath);
    return val !== undefined ? String(val) : '';
  });
  // 4. sortie scalaire {{path}} (inclut {{this}})
  str = str.replace(/{{([\w.@]+)}}/g, (_m, keyPath) => {
    if (keyPath === 'this') return ctx.this !== undefined ? String(ctx.this) : '';
    const val = get(ctx, keyPath);
    return val !== undefined ? String(val) : '';
  });
  return str;
}

// ---------------------------------------------------------------------------
// JSON-LD — construit depuis EXACTEMENT la même donnée que le HTML visible
// (notamment faq.items), pour garantir que les deux ne peuvent pas diverger.
// ---------------------------------------------------------------------------
function buildJsonLd(c) {
  const pageUrl = c.meta.domain + c.meta.path;
  const graph = [
    {
      '@type': 'Organization',
      '@id': `${c.meta.domain}/#organization`,
      name: c.organization.name,
      url: `${c.meta.domain}/`,
      logo: `${c.meta.domain}/${c.organization.logo}`,
      email: c.organization.email,
      telephone: c.organization.phoneDisplay,
      areaServed: c.organization.areaServed,
      description: c.organization.description,
      parentOrganization: {
        '@type': 'Organization',
        name: c.organization.parentOrganizationName,
      },
    },
    {
      '@type': 'WebPage',
      '@id': `${pageUrl}#webpage`,
      url: pageUrl,
      name: c.meta.title,
      description: c.meta.description,
      inLanguage: 'fr-FR',
      about: { '@id': `${c.meta.domain}/#organization` },
      isPartOf: {
        '@type': 'WebSite',
        name: c.organization.name,
        url: `${c.meta.domain}/`,
      },
    },
    {
      '@type': 'FAQPage',
      '@id': `${pageUrl}#faq-schema`,
      mainEntity: c.faq.items.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.answer,
        },
      })),
    },
  ];
  const json = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, null, 2);
  return `<script type="application/ld+json">\n${json}\n</script>`;
}

// ---------------------------------------------------------------------------
// Images : srcset responsive des visuels + width/height manquants, depuis le
// manifest produit par build/images.mjs (lancé AVANT generate dans le
// pipeline : npm run build). Le moteur de template n'a pas de helpers, donc
// c'est une passe de post-traitement sur le HTML rendu.
// ---------------------------------------------------------------------------
const DIMENSIONS = JSON.parse(
  readFileSync(path.join(ROOT, 'assets/images/image-dimensions.json'), 'utf8')
);
// Les visuels s'affichent à ~566 px sur desktop (grille 2 colonnes) et
// pleine largeur sur mobile ; une seule constante, affinable à la mesure.
const VISUAL_SIZES = '(min-width: 720px) 566px, 92vw';

function postProcessImages(html) {
  return html.replace(/<img\b[^>]*>/g, (tag) => {
    const srcMatch = tag.match(/src="(assets\/[^"]+)"/);
    if (!srcMatch) return tag;
    const src = srcMatch[1];
    // 1. Visuels : les variantes -640w (et -960w si générée) entrent en srcset.
    if (/brs-web-visuals-[\w-]+\.webp$/.test(src) && !tag.includes('srcset=')) {
      const width = DIMENSIONS[src] ? DIMENSIONS[src].w : 1200;
      const candidates = [`${src.replace(/\.webp$/, '-640w.webp')} 640w`];
      const mid = src.replace(/\.webp$/, '-960w.webp');
      if (DIMENSIONS[mid]) candidates.push(`${mid} 960w`);
      candidates.push(`${src} ${width}w`);
      tag = tag.replace(
        `src="${src}"`,
        `src="${src}" srcset="${candidates.join(', ')}" sizes="${VISUAL_SIZES}"`
      );
    }
    // 2. Dimensions explicites pour tout <img> qui n'en a pas (CLS).
    if (!/\bwidth="/.test(tag) && DIMENSIONS[src]) {
      const { w, h } = DIMENSIONS[src];
      tag = tag.replace('<img ', `<img width="${w}" height="${h}" `);
    }
    return tag;
  });
}

// ---------------------------------------------------------------------------
// CSS : les trois feuilles sont minifiées et inlinées dans un <style> unique.
// Site une page + cache GitHub Pages de 10 min : des <link> séparés ne font
// que retarder le premier rendu (chaîne critique de 3 requêtes bloquantes).
// css/*.css restent la source d'édition ; seul le HTML généré change.
// ---------------------------------------------------------------------------
const CSS_FILES = ['css/tokens.css', 'css/base.css', 'css/main.css'];

function minifyCss(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')   // commentaires
    .replace(/\s+/g, ' ')               // espaces/retours multiples → un espace
    .replace(/\s*([{}>;,])\s*/g, '$1')  // espaces autour de la ponctuation sûre
    .replace(/:\s+/g, ':')              // espace APRÈS les deux-points seulement
    .replace(/;}/g, '}')                //  (l'espace avant reste : « .a :hover »
    .trim();                            //   est un sélecteur descendant valide)
}

function inlineCss(html) {
  const linkBlock = CSS_FILES.map((f) => `<link rel="stylesheet" href="${f}">`).join('\n');
  if (!html.includes(linkBlock)) {
    console.error('generate.mjs : bloc des <link rel="stylesheet"> introuvable dans le template — abandon.');
    process.exit(1);
  }
  const css = CSS_FILES.map((f) =>
    minifyCss(
      readFileSync(path.join(ROOT, f), 'utf8')
        // Les url() des feuilles étaient relatives à css/ ; inlinées dans le
        // document, elles deviennent relatives à la racine.
        .replaceAll("url('../assets/", "url('assets/")
        .replaceAll('url("../assets/', 'url("assets/')
    )
  ).join('\n');
  return html.replace(linkBlock, `<style>\n${css}\n</style>`);
}

// ---------------------------------------------------------------------------
// index.html
// ---------------------------------------------------------------------------
const ctx = { ...content, buildYear, buildDate, buildTimestamp };
let html = render(template, ctx);
html = html.replace('<!--JSONLD-->', buildJsonLd(content));
html = postProcessImages(html);
html = inlineCss(html);
writeFileSync(path.join(ROOT, 'index.html'), html, 'utf8');

// ---------------------------------------------------------------------------
// sitemap.xml — une seule URL à ce stade (page unique), horodatée au build.
// ---------------------------------------------------------------------------
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${content.meta.domain}${content.meta.path}</loc>
    <lastmod>${buildDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`;
writeFileSync(path.join(ROOT, 'sitemap.xml'), sitemap, 'utf8');

// ---------------------------------------------------------------------------
// llms.txt — digest markdown curaté, généré depuis la même source (spec
// llms.txt : https://llmstxt.org). Pari asymétrique : coût de génération
// nul, adoption non confirmée par les moteurs IA à ce jour — on le garde
// sans surinvestir dessus (cf. references/geo-playbook.md).
// ---------------------------------------------------------------------------
function toMarkdownParagraphs(strs) {
  return strs.map((s) => s).join('\n\n');
}

const sectionOrder = [
  'capacites',
  'probleme',
  'insight',
  'solution',
  'roles',
  'parcours',
  'equipe',
  'references',
  'benefices',
];

// Ancre réelle de chaque section dans le HTML (les clés de contenu ne
// correspondent pas toutes aux ids : insight vit dans #solution, solution
// dans #offre — vérifié dans templates/index.template.html).
const sectionAnchors = {
  capacites: 'capacites',
  probleme: 'probleme',
  insight: 'solution',
  solution: 'offre',
  roles: 'roles',
  parcours: 'parcours',
  equipe: 'equipe',
  references: 'references',
  benefices: 'benefices',
};

let llms = `# ${content.organization.name}\n\n`;
llms += `> ${content.meta.description}\n\n`;
llms += `Généré au build le ${buildDate}. Source de vérité : content/site-content.json.\n\n`;
llms += `## ${[content.hero.titleMain, content.hero.titleEm].filter(Boolean).join(' ')}\n\n${content.hero.lede}\n\n`;
if (Array.isArray(content.hero.points) && content.hero.points.length) {
  llms += content.hero.points.map((p) => `- ${p}`).join('\n') + '\n\n';
}
if (content.hero.visualLede) llms += `${content.hero.visualLede}\n\n`;

// Liste de liens de navigation — requise par la spec llmstxt.org (le fichier
// doit contenir des liens Markdown) ; libellés et résumés repris de la copy
// des sections, aucune formulation nouvelle.
llms += `## Sections\n\n`;
for (const key of sectionOrder) {
  const s = content.sections[key];
  if (!s) continue;
  const title = s.title || [s.titleMain, s.titleEm].filter(Boolean).join(' ');
  const summarySource = s.lede || (Array.isArray(s.ledes) ? s.ledes[0] : '') || '';
  const summary = summarySource.split(/(?<=\.)\s/)[0];
  llms += `- [${title}](${content.meta.domain}/#${sectionAnchors[key]})${summary ? ` : ${summary}` : ''}\n`;
}
llms += `- [FAQ](${content.meta.domain}/#faq)\n`;
llms += `- [Contact](${content.meta.domain}/#contact)\n\n`;

for (const key of sectionOrder) {
  const s = content.sections[key];
  if (!s) continue;
  const title = s.title || [s.titleMain, s.titleEm].filter(Boolean).join(' ');
  llms += `## ${title}\n\n`;
  if (s.lede) llms += `${s.lede}\n\n`;
  if (Array.isArray(s.ledes)) llms += `${toMarkdownParagraphs(s.ledes)}\n\n`;
  const items = s.cards || s.steps || [];
  for (const item of items) {
    if (item.title && item.text) {
      llms += `- **${item.title}** — ${item.text}\n`;
    }
  }
  if (items.length) llms += `\n`;
  // Colonnes de rôles (section « qui fait quoi ») : listes sans titre/texte.
  for (const col of [s.partner, s.network]) {
    if (col && Array.isArray(col.items)) {
      llms += `### ${col.label}\n\n`;
      for (const line of col.items) llms += `- ${line}\n`;
      llms += `\n`;
    }
  }
  // Faits chiffrés (section références).
  if (Array.isArray(s.facts) && s.facts.length) {
    if (s.factsLabel) llms += `### ${s.factsLabel}\n\n`;
    for (const f of s.facts) llms += `- **${f.client}** — ${f.detail}\n`;
    llms += `\n`;
  }
}

llms += `## FAQ\n\n`;
for (const item of content.faq.items) {
  llms += `**${item.question}**\n${item.answer}\n\n`;
}

llms += `## Contact\n\n${content.organization.name}, réseau partenaire adossé à ${content.organization.parentOrganizationName}. Email : ${content.organization.email}. Téléphone : ${content.organization.phoneDisplay}. Zone : ${content.organization.areaServed}.\n\n`;

llms += `## Ressources\n\n`;
llms += `- [Page complète](${content.meta.domain}/)\n`;
llms += `- [Plan du site](${content.meta.domain}/sitemap.xml)\n`;
llms += `- [Borne Recharge Service](https://bornerecharge.fr/) : opérateur IRVE auquel le réseau est adossé.\n`;

writeFileSync(path.join(ROOT, 'llms.txt'), llms, 'utf8');

// ---------------------------------------------------------------------------
// robots.txt — ouvert aux crawlers classiques et IA, référence sitemap + llms.
// ---------------------------------------------------------------------------
const robots = `User-agent: *
Allow: /

Sitemap: ${content.meta.domain}/sitemap.xml
`;
writeFileSync(path.join(ROOT, 'robots.txt'), robots, 'utf8');

console.log('Build OK :');
console.log('  - index.html');
console.log('  - sitemap.xml');
console.log('  - llms.txt');
console.log('  - robots.txt');
