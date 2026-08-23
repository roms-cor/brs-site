# Plan d'action — Lighthouse ≥ 98 partout, navigation IA 3/3

Établi le 2026-08-23 sur la base du rapport PageSpeed Insights du 23/08/2026 08:53
(Lighthouse 13.4.1) et de l'état du repo à ce commit. Brief validé en session
(grilling Promptor) : correction de contraste **chirurgicale** (option B),
script d'images **intégré au pipeline de build** avant `flatten.mjs`.

## 1. Situation et cibles

| Catégorie | Mobile | Desktop | Cible |
|---|---|---|---|
| Performances | **93** | 100 | ≥ 98 |
| Accessibilité | **96** | **96** | ≥ 98 (visé : 100) |
| Bonnes pratiques | 100 | 100 | 100 |
| SEO | 100 | 100 | 100 |
| Navigation agentique | **2/3** | **2/3** | 3/3 |

Contraintes structurantes :

- **GitHub Pages** (CNAME) : aucun en-tête HTTP personnalisable. Le cache de
  10 min, l'absence de HSTS/CSP/COOP/XFO sont **imposés par l'hébergeur** —
  et **non notés** par Lighthouse, donc sans impact sur les cibles. Voir
  l'annexe Cloudflare (§9) si un jour ces points doivent être traités.
- **Pipeline existant** : `content/site-content.json` →
  `generate.mjs` (zéro dépendance) → `validate.mjs` → `flatten.mjs`.
  `index.html`, `index-flat.html`, `sitemap.xml`, `llms.txt`, `robots.txt`
  sont générés, jamais édités à la main.
- **Canvas Claude Design = source de vérité visuelle** : tout changement de
  teinte décidé ici doit être reporté dans le canvas et `../brs-design`.
- **Variance Lighthouse** : ±2–3 points sur mobile d'un run à l'autre. La
  recette (§8) vise donc un médian local à 99–100 pour garantir ≥ 98 sur PSI.

## 2. Diagnostic — ce qui coûte réellement des points

| Symptôme (rapport) | Cause identifiée dans le code | Lot |
|---|---|---|
| LCP mobile 2,9 s, dont **2 400 ms de « délai d'affichage »** sur `.hero-alt__lede` (du texte, TTFB 0 ms) | Repaint tardif du texte à l'arrivée d'Inter (`font-display:swap`, `base.css:11-20`) : la police (48 Kio) arrive tard car elle partage la bande passante 4G simulée avec des images eager surdimensionnées du héros — badge Qualifelec **46 Kio pour 62 px** (`logo-qualifelec-irve.jpg`), logo header **36 Kio pour 40 px** (`brs-logomark-square.png`), image héro 46 Kio. Le swap re-rend le plus gros bloc de texte → nouvelle entrée LCP à ~2,9 s. Le héros ne porte **pas** de `data-reveal` (vérifié) : l'animation de reveal n'est pas en cause. | 1 + 2 |
| Requêtes bloquantes 300 ms (3 CSS en chaîne, 15,5 Kio) | `tokens.css` + `base.css` + `main.css` en trois `<link>` séquencés dans le template (`index.template.html:33-35`) | 1 |
| Speed Index mobile 4,3 s | Conséquence des deux lignes ci-dessus | 1 + 2 |
| « Améliorer l'affichage des images » : 380–470 Kio d'économies | Visuels 1193×896 affichés à ~566 px sans `srcset` ; logos PNG/JPG livrés à 768 px pour un affichage 30–176 px | 2 |
| Accessibilité 96 : **seul l'audit de contraste échoue** | Écart assumé documenté dans `tokens.css` (arbitrage 2026-08-22) : `--primary #36A9E1` sous blanc = 2,65:1 sur les CTA ; sourcils/`.em` en `--primary` sur fonds clairs et navy | 3 |
| Navigation agentique 2/3 : « llms.txt ne contient pas de liens » | Le bloc llms.txt de `generate.mjs:139-206` produit un digest Markdown sans aucun lien — la spec llmstxt.org exige des listes de liens | 4 |
| CLS desktop 0,012 (non bloquant) | Logos partenaires/références sans `width`/`height` (`partner-chip`, `ref-chip` dans le template) | 2 |
| CSS non minifié (6 Kio, non noté) | CSS servi tel quel | 1 |

Le reste du rapport (cache 10 min, en-têtes sécurité, ybug, vieux JS ybug) est
**non noté** et traité en hygiène (§7) ou annexe (§9).

---

## 3. Lot 1 — Chemin critique du rendu (Perf mobile 93 → ≥ 98)

### 1.1 Inliner le CSS minifié au build

- `generate.mjs` : nouvelle étape qui lit les trois feuilles, les minifie
  (suppression commentaires + espaces — un minifieur regex ~15 lignes suffit
  pour ce CSS, zéro dépendance préservée) et remplace le bloc des trois
  `<link rel="stylesheet">` par un unique `<style>` dans `index.html`.
- Justification : site une page, cache GitHub Pages de 10 min → la mise en
  cache des feuilles séparées n'apporte rien ; l'inline supprime en une fois
  les 300 ms de blocage, la chaîne critique de 452 ms et les 6 Kio de
  minification.
- **Impact induit** : `flatten.mjs` cherche littéralement le bloc des trois
  `<link>` (`flatten.mjs:52-56`) et abandonne s'il ne le trouve pas. Son
  étape 2 devient inutile (CSS déjà inline) — la retirer et adapter le
  garde-fou. Les deux scripts se modifient dans le même commit, pipeline
  rejoué de bout en bout.
- Les fichiers `css/*.css` restent la source (édition, canvas) ; seul le
  HTML généré change.

### 1.2 Neutraliser le repaint de police (le fix LCP principal)

- Conserver `font-display:swap` mais ajouter une `@font-face` de repli à
  métriques compensées (`local(Arial)` avec `size-adjust`, `ascent-override`,
  `descent-override`, `line-gap-override` calés sur Inter) pour que le swap
  ne change pas la géométrie du texte → plus de nouvelle entrée LCP au swap.
- Mesurer (§8). **Porte de décision** : si le LCP mobile reste > 2 s en local,
  basculer `font-display:optional` (le texte reste en police système au
  premier chargement lent — compromis à constater visuellement).
- Le `preload` de la police existe déjà (`index.template.html:31`) : y ajouter
  `fetchpriority="high"`.

### 1.3 Prioriser l'image LCP desktop

- `index.template.html:216` (image héro) : ajouter `fetchpriority="high"`
  (recommandation explicite du rapport desktop, garde `loading="eager"`).

Gains attendus lot 1 : LCP mobile ~2,9 s → ~1,2–1,5 s ; SI 4,3 s → ~2,5 s
(le solde vient du lot 2). Perf mobile attendue : 97–100.

## 4. Lot 2 — Pipeline d'images `build/images.mjs` (perf + 380–470 Kio)

### 2.1 Le script et son intégration

- Nouveau `build/images.mjs`, basé sur **sharp** (bibliothèque de référence,
  utilisée par Next.js/Astro). C'est la **première dépendance npm du repo** :
  `package.json` à la racine avec `sharp` en devDependency, `npm ci` documenté
  dans le README. `generate.mjs`/`validate.mjs`/`flatten.mjs` restent
  zéro-dépendance.
- **Pipeline officiel** (décision de session — le script entre dans le
  pipeline, avant le flat) :
  ```bash
  node build/generate.mjs && node build/validate.mjs \
    && node build/images.mjs && node build/flatten.mjs
  ```
  exposé en `npm run build` pour ne plus taper la séquence. `images.mjs` est
  **idempotent** : il saute toute variante déjà à jour (mtime source ≤ mtime
  sortie), donc un build sans nouvelle image coûte ~0 s.
- Les variantes générées sont **committées** : GitHub Pages sert des fichiers
  statiques, rien ne se génère au déploiement.

### 2.2 Ce que le script produit

| Source | Variantes | Usage |
|---|---|---|
| `brs-web-visuals-*.png` (sources canvas, 1200×896) | WebP q80 en **640w** et **1200w** (`-640w.webp` + le fichier actuel) | `srcset` des visuels affichés à ~566 px |
| Logos références (`spie.png` 83 Kio, `neolia.png` 65 Kio, etc.) | WebP ~400 px de large (≈ 2× l'affichage) | grille références |
| Logos partenaires (`logo-symphonics`, `logo-logivolt`, `logo-advenir`, `logo-vertigo`) | WebP ~350 px | marquee + grille |
| `logo-qualifelec-irve.jpg` (768×768, 46 Kio) | WebP **124 px** (~3 Kio) | badge 62 px |
| `brs-logomark-square.png` (270×270, 36 Kio) | WebP 80 px (header/footer) + PNG 48 px (favicon) | logo + favicon |
| — | `assets/images/image-dimensions.json` : dimensions réelles de chaque fichier | passe HTML de 2.3 |

Règle README conservée : si un schéma se dégrade à q80, monter la qualité de
ce fichier plutôt qu'accepter la perte.

### 2.3 Injection `srcset` + `width`/`height` dans le HTML généré

- Le moteur de template minimal n'a pas de helpers → ajouter dans
  `generate.mjs` une **passe de post-traitement** du HTML rendu :
  - tout `<img>` de visuel (convention `brs-web-visuals-…`, `width="1200"`)
    reçoit `srcset="…-640w.webp 640w, … 1200w"` et
    `sizes="(min-width: 720px) 566px, 92vw"` (valeur affinée à la mesure) ;
  - tout `<img>` **sans** `width`/`height` (logos chips) les reçoit depuis
    `image-dimensions.json` → règle le CLS 0,012 desktop et l'audit
    « dimensions explicites ».
- `content/site-content.json` : mettre à jour les chemins dont l'extension
  change (logos PNG/JPG → WebP). Les textes `…Alt` ne bougent pas.
- Le JSON-LD et le `og:image` continuent de pointer des fichiers existants
  (vérifié par `validate.mjs`).

Gains attendus lot 2 : ~400 Kio de moins au chargement initial ; la bande
passante libérée fait arriver la police plus tôt (renforce 1.2) ; CLS desktop
→ 0.

## 5. Lot 3 — Contraste, option B chirurgicale (A11y 96 → 100)

Principe validé : le ciel `#36A9E1` **reste partout où il est décoratif**
(icônes, filets, dots, badges non textuels) ; seuls les usages **textuels**
flaggés basculent sur des teintes conformes. L'arbitrage du 2026-08-22 est
**amendé, pas annulé** : le bloc « ÉCART ASSUMÉ » de `tokens.css` est réécrit
avec la date du jour et la logique deux-bleus (décoratif ciel / texte foncé).

### 3.1 Fonds clairs (`#FFFFFF` et `--muted #F5F5F5`)

- **CTA primaires** (`.btn-pill--primary`, `base.css:130-143`) : bascule sur
  l'échelle en réserve `--primary-fill` — `#1A7DAD` (4,58:1 sous blanc),
  hover `#17739F`, pressed `#1C5875`. Elle existe déjà dans `tokens.css:34-38`
  précisément pour ce cas.
- **Sourcils** (`.eyebrow`, `main.css:97`), **`.em`** (`main.css:118`),
  **`.cta-band .eyebrow`** (`main.css:747`) : nouveau token
  `--accent-ink: #17739F` (5,26:1 sous blanc, ≥ 4,5:1 sur `#F5F5F5` — le
  `#1A7DAD` passe sous 4,5:1 sur fond muted, d'où le cran plus foncé).

### 3.2 Sections sombres (navy `--secondary #2D2E83`)

- Le rapport flagge aussi `.numbered--dark .eyebrow`/`.em` et le hero.
  Ne **pas** corriger à l'estime : les ratios exacts dépendent des fonds réels
  (aplats, dégradés). L'implémentation énumère chaque paire flaggée, calcule
  le ratio, et éclaircit le ciel juste ce qu'il faut (token
  `--accent-ink-on-dark`, cible ≥ 4,5:1 sur `#2D2E83` — de l'ordre de
  `#6FC1EA`, valeur finale fixée par le calcul).

### 3.3 Verrou anti-régression dans `validate.mjs`

- Ajouter au validateur un contrôle WCAG : liste déclarée des paires
  (token texte / token fond), calcul de luminance relative (~20 lignes,
  zéro dépendance), **échec du build** si une paire repasse sous 4,5:1.
  Toute retouche future des tokens est ainsi couverte.

### 3.4 Resynchronisation design

- Reporter les nouvelles teintes dans le canvas « BRS Connect - Design » et
  `../brs-design` (hors de ce repo — tâche de suivi listée en §10). Jusqu'au
  report, le commentaire de `tokens.css` fait foi sur l'écart canvas/code.

## 6. Lot 4 — llms.txt conforme (navigation IA 2/3 → 3/3)

- L'audit échoue sur un seul point : « Le fichier ne semble pas contenir de
  liens ». Le bloc llms.txt de `generate.mjs` (lignes 139-206) ajoute deux
  sections de liens Markdown conformes à la spec llmstxt.org :
  - `## Sections` : un lien par section vers son ancre réelle —
    `- [Titre](https://brsconnect.fr/#ancre) : résumé d'une ligne` (map
    statique clé → ancre dans `generate.mjs`, alignée sur `sectionOrder`,
    FAQ et contact inclus) ;
  - `## Ressources` : sitemap.xml, robots.txt, et le site de l'opérateur
    parent (bornerecharge.fr) en lien externe.
- Les URLs sont construites depuis `content.meta.domain` : rien en dur.

## 7. Lot 5 — Hygiène non notée (incluse car quasi gratuite)

- **ybug** : le widget (13 Kio tiers, seul « ancien JavaScript » du rapport)
  passe derrière un booléen `meta.feedbackWidget` dans `site-content.json`
  (`{{#if}}` autour du snippet, `index.template.html:646-654`). Défaut :
  activé. Le couper avant la mise en prod définitive devient un simple
  changement de JSON.
- **Favicon** : pointer le PNG 48 px généré au lot 2 (au lieu du 270 px de
  36 Kio).

## 8. Lot 6 — Mesure et recette

- **Avant tout changement** : figer la référence — 3 runs Lighthouse locaux
  mobile + desktop (Chromium est préinstallé dans l'environnement de
  session) : `python3 -m http.server 8000` puis
  `npx lighthouse http://localhost:8000 …`, médiane retenue.
- **Après chaque lot** : re-run local ; le lot n'est clos que si aucun score
  ne régresse.
- **Recette finale** (après merge + déploiement Pages) : PageSpeed Insights
  sur https://brsconnect.fr, 3 runs espacés, médiane.

Critères d'acceptation :

| Critère | Seuil |
|---|---|
| Perf mobile (médiane PSI) | ≥ 98 |
| Perf desktop | 100 |
| Accessibilité (audit contraste **passé**) | 100 |
| Bonnes pratiques / SEO | 100 (non-régression) |
| Navigation agentique | 3/3 |
| `npm run build` (4 étapes) | vert, garde-fous `flatten` et contraste inclus |
| Écart visuel | limité aux teintes textuelles actées (captures avant/après) |

## 9. Annexe — si un jour les en-têtes deviennent un sujet

Hors périmètre (non noté, impossible sur GitHub Pages). Si le domaine passe
derrière Cloudflare (DNS proxifié, gratuit) : `Cache-Control: max-age=31536000,
immutable` sur `/assets/*` (les variantes étant nommées par le build, le
versionnement est naturel), HSTS progressif (`max-age` court d'abord), CSP en
`Report-Only` avant application, `X-Frame-Options: DENY`. Aucun changement de
repo requis.

## 10. Séquencement, efforts, risques

Ordre : **référence de mesure (§8) → Lot 2 → Lot 1 → Lot 3 → Lot 4 → Lot 5 →
recette**. Le lot 2 passe en premier car il conditionne le gain réel du lot 1
(bande passante de la police) et fournit `image-dimensions.json` à la passe
HTML. Lots 3-4-5 sont indépendants entre eux.

| Lot | Effort estimé | Risque principal | Garde-fou |
|---|---|---|---|
| 2 Images | ~½ journée | Chemins/extensions désynchronisés entre JSON, template et fichiers | `validate.mjs` vérifie l'existence des fichiers référencés ; build de bout en bout |
| 1 Chemin critique | ~2 h | `flatten.mjs` casse (garde-fou du bloc `<link>`) ; métriques de repli de police mal calées | Modification conjointe des deux scripts + pipeline complet ; porte de décision `swap`→`optional` sur mesure |
| 3 Contraste | ~2 h | Régression visuelle perçue ; désync canvas | Périmètre strictement textuel, captures avant/après, contrôle contraste dans `validate.mjs`, tâche de report canvas |
| 4 llms.txt | ~½ h | — | Re-test PSI agentique |
| 5 Hygiène | ~½ h | — | — |

Tâches de suivi hors repo : report des teintes dans le canvas Claude Design et
`../brs-design` ; (optionnel) décision ybug avant prod définitive.
