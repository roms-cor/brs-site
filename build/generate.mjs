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
// index.html
// ---------------------------------------------------------------------------
const ctx = { ...content, buildYear, buildDate, buildTimestamp };
let html = render(template, ctx);
html = html.replace('<!--JSONLD-->', buildJsonLd(content));
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
  'profils',
  'parcours',
  'equipe',
  'references',
  'benefices',
];

let llms = `# ${content.organization.name}\n\n`;
llms += `> ${content.meta.description}\n\n`;
llms += `Généré au build le ${buildDate}. Source de vérité : content/site-content.json.\n\n`;
llms += `## ${content.hero.title}\n\n${content.hero.lede}\n\n`;

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
}

llms += `## FAQ\n\n`;
for (const item of content.faq.items) {
  llms += `**${item.question}**\n${item.answer}\n\n`;
}

llms += `## Contact\n\n${content.organization.name}, réseau partenaire adossé à ${content.organization.parentOrganizationName}. Email : ${content.organization.email}. Téléphone : ${content.organization.phoneDisplay}. Zone : ${content.organization.areaServed}.\n`;

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
