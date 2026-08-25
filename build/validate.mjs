#!/usr/bin/env node
// build/validate.mjs — casse le build (exit 1) plutôt que de laisser passer
// une régression silencieuse. À lancer juste après generate.mjs.

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { PREVIEW, HTML_FILE } from './config.mjs';

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
    if (!html.includes(item.question)) {
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
    if (org.telephone !== content.organization.phoneDisplay) fail('Téléphone JSON-LD ≠ content.organization.phoneDisplay.');
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
  if (part && !html.includes(part)) fail(`Le titre du hero ("${part}") est absent du HTML statique généré.`);
}

// 10. Tout fichier local référencé par index.html (src, href, srcset) doit
//     exister sur disque — sinon le déploiement Pages servira des 404.
// (En préview les références sont absolutisées depuis la racine — « /assets/… » —
// mais désignent les mêmes fichiers du repo : on tolère le « / » de tête.)
const localRefs = new Set();
for (const m of html.matchAll(/(?:src|href)="\/?((?:assets|css|js)\/[^"]+)"/g)) localRefs.add(m[1]);
for (const m of html.matchAll(/srcset="([^"]+)"/g)) {
  for (const part of m[1].split(',')) {
    const url = part.trim().split(/\s+/)[0].replace(/^\//, '');
    if (/^(assets|css|js)\//.test(url)) localRefs.add(url);
  }
}
if (content.meta.ogImage) localRefs.add(content.meta.ogImage);
if (content.organization.logo) localRefs.add(content.organization.logo);
for (const ref of localRefs) {
  if (!existsSync(path.join(ROOT, ref))) fail(`Fichier référencé introuvable : ${ref}`);
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
