#!/usr/bin/env node
// build/validate.mjs — casse le build (exit 1) plutôt que de laisser passer
// une régression silencieuse. À lancer juste après generate.mjs.

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { PREVIEW, HTML_FILE, PAGE_PATH } from './config.mjs';
import { checkHtmlRefs } from './refs.mjs';
import { lintDesign } from './design-lint.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const errors = [];
const warn = (msg) => console.warn(`⚠ ${msg}`);
const fail = (msg) => errors.push(msg);

function req(file) {
  const p = path.join(ROOT, file);
  if (!existsSync(p)) {
    fail(`Fichier manquant : ${file} (lancer generate.mjs avant validate.mjs)`);
    return '';
  }
  return readFileSync(p, 'utf8');
}

const html = req(HTML_FILE);
// Texte « visible » du HTML pour comparer au contenu source : entités décodées, espaces insécables et apostrophes courbes (typographie
// française ajoutée à la génération) ramenés à l'espace simple.
const plain = (h) => h.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/\u00a0/g, ' ').replace(/\u2019/g, "'");
const visible = plain(html);
const sitemap = req('sitemap.xml');
const llms = req('llms.txt');
const robots = req('robots.txt');
const template = req('templates/index.template.html');
const content = JSON.parse(req('content/site-content.json'));

// 1. Aucun token {{...}} non résolu dans la sortie générée.
const unresolvedHtml = html.match(/{{[^}]*}}/g);
if (unresolvedHtml) fail(`Tokens non résolus dans ${HTML_FILE} : ${unresolvedHtml.slice(0, 5).join(', ')}`);
const unresolvedSitemap = sitemap.match(/{{[^}]*}}/g);
if (unresolvedSitemap) fail(`Tokens non résolus dans sitemap.xml : ${unresolvedSitemap.join(', ')}`);
const unresolvedLlms = llms.match(/{{[^}]*}}/g);
if (unresolvedLlms) fail(`Tokens non résolus dans llms.txt : ${unresolvedLlms.join(', ')}`);

// 2. Canonical présent, une seule fois.
const canonicalMatches = html.match(/<link rel="canonical" href="([^"]+)">/g) || [];
if (canonicalMatches.length === 0) fail('Aucune balise <link rel="canonical"> trouvée.');
if (canonicalMatches.length > 1) fail(`Plusieurs balises canonical trouvées (${canonicalMatches.length}) — une seule attendue.`);

// 2 ter. Le canonical vise EXACTEMENT l'URL servie (domaine + chemin de la page), pas seulement « un chemin plausible ».
{
  const m = canonicalMatches.length === 1 && canonicalMatches[0].match(/href="([^"]+)"/);
  const attendu = content.meta.domain + PAGE_PATH;
  if (m && m[1] !== attendu) fail(`Canonical ${m[1]} ≠ ${attendu} (meta.domain + chemin de la page).`);
}

// 2 bis. Mode préview : la page en chantier ne doit jamais être indexable,
//        et son canonical doit suivre l'URL réellement servie (/home/).
if (PREVIEW) {
  if (!html.includes('<meta name="robots" content="noindex">')) {
    fail(`Mode préview : <meta name="robots" content="noindex"> absent de ${HTML_FILE}.`);
  }
  if (canonicalMatches.length === 1 && !canonicalMatches[0].includes('/home/')) {
    fail(`Mode préview : le canonical devrait pointer vers /home/ (trouvé : ${canonicalMatches[0]}).`);
  }
}

// 3. JSON-LD présent et syntaxiquement valide.
const ldMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
let ld = null;
if (!ldMatch) {
  fail('Aucun bloc JSON-LD trouvé dans index.html.');
} else {
  try {
    ld = JSON.parse(ldMatch[1]);
  } catch (e) {
    fail(`JSON-LD invalide : ${e.message}`);
  }
}

// 4. FAQ visible === FAQ JSON-LD === content.faq.items (même source, donc
//    ne DOIT jamais diverger — sinon le générateur ou le template a un bug).
if (ld) {
  const faqBlock = ld['@graph']?.find((n) => n['@type'] === 'FAQPage');
  const ldQuestions = faqBlock?.mainEntity ?? [];
  if (ldQuestions.length !== content.faq.items.length) {
    fail(`FAQPage JSON-LD a ${ldQuestions.length} question(s), content.faq.items en a ${content.faq.items.length}.`);
  } else {
    content.faq.items.forEach((item, i) => {
      const ldItem = ldQuestions[i];
      if (ldItem.name !== item.question || ldItem.acceptedAnswer.text !== item.answer) {
        fail(`FAQPage JSON-LD diverge du contenu source à l'index ${i} ("${item.question}").`);
      }
    });
  }
  // Chaque question doit aussi apparaître dans le HTML visible (accordéon).
  for (const item of content.faq.items) {
    if (!visible.includes(item.question)) {
      fail(`Question FAQ absente du HTML visible : "${item.question}"`);
    }
  }
}

// 5. Aucun placeholder résiduel en production. Le contrôle vise le contenu
//    éditorial : les <style> inlinés sont exclus (« input::placeholder » est
//    du CSS légitime, pas un texte oublié).
const htmlSansStyles = html.replace(/<style[\s\S]*?<\/style>/g, '');
const placeholderPatterns = [/lorem ipsum/i, /\bTODO\b/, /\bPLACEHOLDER\b/i, /\bXXX\b/, /\(lead_company_name\)/];
for (const re of placeholderPatterns) {
  if (re.test(htmlSansStyles)) fail(`Placeholder résiduel détecté dans index.html (pattern ${re}).`);
}

// 6. Pas de coordonnée factice : le JSON-LD Organization doit correspondre
//    exactement aux coordonnées déclarées dans content.organization.
if (ld) {
  const org = ld['@graph']?.find((n) => n['@type'] === 'Organization');
  if (org) {
    if (org.email !== content.organization.email) fail('Email JSON-LD ≠ content.organization.email.');
    if (org.telephone !== content.organization.phoneHref) fail('Téléphone JSON-LD ≠ content.organization.phoneHref (format international).');
  }
}

// 7. Chaîne de marque en dur dans le TEMPLATE, hors couche contenu.
//    On retire tous les tokens {{...}}/{{{...}}} puis on cherche si le nom
//    de l'organisation ou de la société mère apparaît quand même en dur.
const templateWithoutTokens = template.replace(/{{{[^}]*}}}/g, '').replace(/{{[^}]*}}/g, '');
for (const brand of [content.organization.name, content.organization.parentOrganizationName]) {
  if (templateWithoutTokens.includes(brand)) {
    fail(`Chaîne de marque "${brand}" en dur dans le template, hors couche contenu (devrait être un token {{...}}).`);
  }
}

// 8. robots.txt référence bien le sitemap généré.
if (!robots.includes('sitemap.xml')) fail('robots.txt ne référence pas sitemap.xml.');

// 9. Le texte du hero doit exister tel quel dans le HTML statique généré
//    (sans JS) — sinon il n'existe pas pour les crawlers.
for (const part of [content.hero.titleMain, content.hero.titleEm]) {
  if (part && !visible.includes(part)) fail(`Le titre du hero ("${part}") est absent du HTML statique généré.`);
}

// 10. Tout fichier local référencé par index.html (src, href, srcset) doit
//     exister sur disque — sinon le déploiement Pages servira des 404.
// (En préview les références sont absolutisées depuis la racine — « /assets/… » —
// mais désignent les mêmes fichiers du repo : on tolère le « / » de tête.)
// Couvre aussi les url() des <style> inlinés (polices, fonds) et les ancres internes (href="#x" ↔ id="x").
checkHtmlRefs(html, { root: ROOT, domain: content.meta.domain, label: HTML_FILE, fail });
for (const ref of [content.meta.ogImage, content.organization.logo]) {
  if (ref && !existsSync(path.join(ROOT, ref))) fail(`Fichier référencé introuvable : ${ref}`);
}

// 11. Contraste WCAG 1.4.3 : les paires texte/fond déclarées ci-dessous
//     doivent tenir 4,5:1. Casse le build si une retouche de tokens.css
//     repasse sous le seuil (verrou de l'arbitrage du 2026-08-23, cf.
//     docs/adr/0003-contraste-option-b.md).
const tokensCss = req('css/tokens.css');
function tokenHex(name) {
  const m = tokensCss.match(new RegExp(`${name}:\\s*(#[0-9A-Fa-f]{6})`));
  if (!m) fail(`Token couleur introuvable dans css/tokens.css : ${name}`);
  return m ? m[1] : '#000000';
}
function luminance(hex) {
  const c = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function ratio(fg, bg) {
  const [a, b] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}
const contrastPairs = [
  ['--accent-ink', '--background'],            // sourcils, .em, labels / blanc
  ['--accent-ink', '--muted'],                 // idem / fonds atténués
  ['--accent-ink-on-dark', '--secondary'],     // accents / bandes navy
  ['--primary-fill-foreground', '--primary-fill'],           // CTA primaire
  ['--primary-fill-foreground', '--primary-fill-hover'],     // CTA hover
  ['--primary-fill-pressed-foreground', '--primary-fill-pressed'],
  ['--foreground', '--background'],            // titres / fond de page
  ['--muted-foreground', '--background'],      // corps de texte / fond
  ['--muted-foreground', '--muted'],           // corps de texte / fonds atténués
];
for (const [fgName, bgName] of contrastPairs) {
  const r = ratio(tokenHex(fgName), tokenHex(bgName));
  if (r < 4.5) {
    fail(`Contraste insuffisant ${fgName} sur ${bgName} : ${r.toFixed(2)}:1 (< 4,5:1).`);
  }
}

// 11 bis. CSS mort : toute classe définie dans css/*.css est employée par le template, le JS ou le contenu.
//     Réserve documentée (utilitaires conservés volontairement) : visually-hidden.
{
  const CSS_RESERVE = new Set(['visually-hidden']);
  const css = ['css/tokens.css', 'css/base.css', 'css/main.css'].map(req).join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/url\([^)]*\)|"[^"]*"|'[^']*'/g, '');
  const defined = new Set([...css.matchAll(/\.([A-Za-z_][\w-]*)/g)].map((m) => m[1]));
  const body = template.replace(/<style media="print">[\s\S]*?<\/style>/, '').replace(/{{[#/][^}]*}}/g, ' ');
  const used = new Set();
  for (const m of body.matchAll(/class="([^"]*)"/g)) m[1].split(/\s+/).filter(Boolean).forEach((c) => used.add(c));
  const hay = req('js/main.js') + JSON.stringify(content);
  for (const c of [...defined].sort()) {
    if (!used.has(c) && !CSS_RESERVE.has(c) && !hay.includes(c)) fail(`CSS mort : la classe .${c} est définie mais jamais employée (la supprimer, ou la lister dans la réserve de validate.mjs).`);
  }
  for (const c of [...used].sort()) {
    if (!/[{}]/.test(c) && !defined.has(c)) fail(`Classe sans règle CSS : ${c} (employée dans le template).`);
  }
}

// 11 ter. Règles d'usage du DESIGN-GUIDE (style inline, gradient, emoji, famille, hover, boucles, rayons) : voir build/design-lint.mjs.
lintDesign({ root: ROOT, html, template, content, fail });

// 12. Bascule préview / go-live : le mode « go-live » doit être voulu deux fois (constante + GO_LIVE=1), home/ ne doit
//     plus exister, et sitemap / robots / llms doivent dire la même chose que le mode.
const domain = content.meta.domain;
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (PREVIEW) {
  // Aucune URL noindex dans le sitemap : la racine redirige (noindex) et /home/ est noindex.
  for (const noindexUrl of [`${domain}/`, `${domain}/home/`]) {
    if (locs.includes(noindexUrl)) fail(`Mode préview : sitemap.xml liste ${noindexUrl}, page noindex (Search Console : « URL soumise marquée noindex »).`);
  }
  // La racine est une redirection écrite à la main : noindex obligatoire, jamais la page générée.
  const root = req('index.html');
  if (!/<meta name="robots" content="noindex">/.test(root)) fail('Mode préview : la racine index.html (redirection manuscrite) doit porter <meta name="robots" content="noindex">.');
  if (root.includes('application/ld+json')) fail('Mode préview : la racine index.html ressemble à la page générée (JSON-LD présent) ; elle devrait être la redirection manuscrite.');
  const rootFlat = req('index-flat.html');
  if (!/<meta name="robots" content="noindex">/.test(rootFlat)) fail('Mode préview : index-flat.html à la racine doit être noindex.');
} else {
  if (process.env.GO_LIVE !== '1') fail('PREVIEW = false sans GO_LIVE=1 : la bascule hors préview doit être confirmée (GO_LIVE=1 npm run build).');
  if (existsSync(path.join(ROOT, 'home'))) fail('Hors préview : le dossier home/ existe encore (page en chantier toujours en ligne) : le supprimer.');
  const attendu = `${domain}${PAGE_PATH}`;
  if (!locs.includes(attendu)) fail(`Hors préview : sitemap.xml ne liste pas ${attendu}.`);
  if (!robots.includes(`${domain}/sitemap.xml`)) fail(`Hors préview : robots.txt ne référence pas ${domain}/sitemap.xml.`);
  if (/Disallow:\s*\/\s*$/m.test(robots)) fail('Hors préview : robots.txt interdit tout le site.');
  if (!llms.includes(domain)) fail(`Hors préview : llms.txt ne mentionne pas ${domain}.`);
  if (html.includes('<meta name="robots" content="noindex">')) fail('Hors préview : la page publiée porte encore noindex.');
  // REV #28 : le widget Ybug charge un script tiers (widget.ybug.io) dès l'ouverture, sans consentement, et les pages légales
  // de l'opérateur ne le citent pas : il ne part pas en production tant qu'une décision écrite n'a pas dit autre chose.
  if (content.meta.feedbackWidget) fail('Hors préview : meta.feedbackWidget vaut true (widget Ybug, script tiers sans consentement) ; le passer à false avant le go-live (tâche REV #28).');
  if (/ybug/i.test(html)) fail('Hors préview : la page publiée charge encore Ybug.');
}

// ---------------------------------------------------------------------------
if (errors.length) {
  console.error(`\n✗ Validation échouée (${errors.length} erreur(s)) :\n`);
  errors.forEach((e, i) => console.error(`  ${i + 1}. ${e}`));
  console.error('');
  process.exit(1);
}

console.log('✓ Validation OK : tokens résolus, canonical unique, JSON-LD valide,');
console.log('  FAQ visible = FAQ JSON-LD = content source, aucun placeholder,');
console.log("  aucune chaîne de marque en dur hors couche contenu.");
