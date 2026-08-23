# brs-site — pipeline de contenu

Ce dossier est le site déployé. Il a une **source de vérité
unique** pour le contenu, un **template** pour la structure/CSS, et une **chaîne
de build** (`npm run build`) qui génère tout le reste. Seule l'étape images
(`build/images.mjs`) dépend d'un paquet npm (sharp — [ADR-0002](docs/adr/0002-pipeline-images-sharp.md)) ;
`generate.mjs`, `validate.mjs` et `flatten.mjs` restent zéro-dépendance.

## Règle n°1

**Ne jamais éditer `index.html`, `index-flat.html`, `sitemap.xml`, `llms.txt` ou
`robots.txt` à la main.** Ces fichiers sont écrasés à chaque build
(`generate.mjs` pour les quatre premiers, `flatten.mjs` pour le flat). Toute
correction manuelle sera perdue au prochain build. Côté design, le canvas Claude
Design (« BRS Connect - Design ») est l'éditeur et la source de vérité depuis son
import du 2026-08-22 : toute évolution visuelle s'y décide d'abord, puis se reporte
dans `css/tokens.css` et `../brs-design/`. En cas d'écart entre canvas et code,
c'est le canvas qui a raison — mais rien de ce qui n'existe que dans le canvas
n'est en ligne tant que le report dans le code n'est pas fait.

## Éditer le contenu

1. Ouvrir `content/site-content.json` (toute la page y vit ; voir la carte
   des clés ci-dessous).
2. Modifier le texte voulu (hero, sections, FAQ, coordonnées, métadonnées…).
3. Régénérer (`npm ci` une fois au premier clone, pour sharp) :
   ```bash
   npm run build
   # = node build/images.mjs && node build/generate.mjs \
   #   && node build/validate.mjs && node build/flatten.mjs
   ```
4. Si `validate.mjs` échoue, lire le message — il pointe l'erreur exacte (token oublié,
   FAQ désynchronisée, fichier image manquant, contraste sous 4,5:1, etc.).
5. Prévisualiser : `python3 -m http.server 8000` puis ouvrir `http://localhost:8000/`.
6. Commit + push.

Le plus simple reste de demander la retouche en session Claude (« change le
titre de la section 04 en … ») : l'édition passe alors par le skill
copywriting, qui vérifie les claims — voir « Garde-fous » plus bas.

## Modifier une photo ou une icône

1. Déposer le nouveau fichier dans `assets/images/` (ou `assets/icons/`,
   `assets/images/references/` pour un logo client).
2. Changer le chemin dans la clé correspondante du JSON
   (ex. `hero.image`, `sections.equipe.visual.image`,
   `sections.references.logos[].image`).
3. Mettre à jour le texte alternatif voisin (`…Alt`), puis rebuilder :
   `build/images.mjs` (première étape de `npm run build`) régénère
   automatiquement les variantes responsives (`-640w.webp`), les logos WebP
   redimensionnés et le manifest `assets/images/image-dimensions.json` —
   les variantes se committent avec le reste (GitHub Pages ne génère rien).
   Pour un nouveau logo, ajouter son entrée (source → largeur cible) dans la
   table `LOGOS` de `build/images.mjs`.

Formats : SVG ou WebP de préférence (PNG accepté si besoin), poids raisonnable
(< 300 Ko), pas de nom avec espaces. Les visuels `brs-web-visuals-*` sont en
WebP qualité 80 (converti depuis les PNG source du canvas Claude Design) ;
si un schéma se dégrade visiblement à cette qualité (texte fin qui devient
flou), monter la qualité pour CE fichier via `QUALITY_OVERRIDES` dans
`build/images.mjs` plutôt que d'accepter la perte. `--force` régénère tout.

## Carte de la page → clés JSON

Dans l'ordre de la page, du haut vers le bas :

| Ce que tu vois | Clé dans site-content.json |
|---|---|
| Onglet navigateur, description Google | `meta.title`, `meta.description` |
| Menu du header + bouton « Devenir partenaire » | `nav.primary[]`, `nav.ctaLabel` / `nav.ctaHref` |
| Hero — badge du haut | `hero.badge` |
| Hero — grand titre en 2 tons | `hero.titleMain` / `hero.titleEm` |
| Hero — paragraphe + 2 lignes cochées | `hero.lede`, `hero.points[]` |
| Hero — les 2 boutons | `hero.ctaPrimary(+Href)`, `hero.ctaSecondary(+Href)` |
| Hero — paragraphe d'appui au-dessus de la photo | `hero.visualLede` |
| Hero — photo + badge Qualifelec rotatif | `hero.image` + `hero.imageAlt`, `hero.certifBadge` (texte tournant, aussi utilisé par le badge d'ancrage) |
| Hero — marquee des 5 logos partenaires | `hero.partners[]` (image/alt) |
| 01 Bénéfices — titre + 4 cartes illustrées + 4 chips de repères en bas | `sections.capacites.title`, `.cards[]` (title/text/icon/image/imageAlt), `.tags[]` |
| Bande « Nos partenaires » — badge + phrase d'intro + 5 chips légendés + phrase de clôture | `sections.ancrage.eyebrow`, `.intro`, `.logos[]` (image/alt = légende), `.outro` |
| 02 Le problème — titre en 2 tons + photo + intro + 4 cartes | `sections.probleme.titleMain` / `.titleEm`, `.image(+Alt)`, `.lede`, `.cards[]` |
| 03 Le vrai choix (bande navy) — titre + photo encadrée + 2 cartes | `sections.insight.titleMain` / `.titleEm`, `.image(+Alt)`, `.ledes[]`, `.cards[]` |
| 04 La solution — titre + intro + 4 cartes + photo | `sections.solution.*`, `.image(+Alt)` (la carte mise en avant a `"accent": true`) |
| 05 Qui fait quoi — photo + 2 colonnes | `sections.roles.image(+Alt)`, `.partner.*`, `.network.*`, `.footnote` |
| 06 Parcours (bande grise) — photo + 4 étapes | `sections.parcours.image(+Alt)`, `.steps[]` (num/title/text) |
| 07 Qui sommes-nous — 2 écrans légendés + 3 cartes | `sections.equipe.screens[]` (image/alt/label/detail), `.cards[]` |
| 08 Références — photo + 4 faits + 8 logos | `sections.references.image(+Alt)`, `.facts[]` (client/detail), `.logos[]` |
| 09 Bénéfices concrets — 5 cartes + photo en 6e cellule | `sections.benefices.cards[]`, `.image(+Alt)` |
| 10 FAQ — 7 questions/réponses + schéma sticky | `faq.items[]` (question/answer, item 5 : `image`/`imageAlt`), `faq.image(+Alt)` |
| CTA final (bande navy pleine largeur, badge centré) | `contact.title`, `.lede`, `.ctaLabel(+Href)`, `.note` |
| Footer clair — taglines, segments, contact, liens légaux, copyright | `footer.*` (les clés `nav.footer` et `organization.social` ne sont plus rendues) |
| Coordonnées (partout) | `organization.email`, `.phoneDisplay` / `.phoneHref` |

## Éditer la structure ou le style visuel

Le style vit intégralement dans `css/tokens.css` (tokens sémantiques — source
unique de vérité visuelle, miroir documenté dans `../brs-design/`), `css/base.css`
(reset, police Inter, boutons) et `css/main.css` (composants, dans l'ordre de la
page). **Toute modification CSS nécessite un rebuild** : depuis l'optimisation
du chemin critique, `generate.mjs` minifie et inline les trois feuilles dans le
`<style>` de `index.html` (les fichiers `css/` restent la source d'édition,
plus des ressources servies). Le markup vit dans
`templates/index.template.html` (seul le bloc `<style media="print">` y reste) ;
après toute modification du template, régénérer comme ci-dessus.

## Ajouter un champ de contenu

1. Ajouter la clé dans `content/site-content.json`.
2. Référencer `{{le.chemin.vers.la.clé}}` dans `templates/index.template.html`
   (`{{{...}}}` avec triple accolade pour du HTML de confiance, ex. un path SVG).
3. Pour une liste répétée, utiliser `{{#each chemin.vers.tableau}} ... {{/each}}` ; à
   l'intérieur, `{{champ}}` référence les clés de l'élément courant, `{{this}}` la
   valeur elle-même si c'est un tableau de chaînes simples.
4. Pour un bloc conditionnel, `{{#if chemin.vers.booleen}} ... {{/if}}`.

## Ce que génère `generate.mjs`

| Fichier | Rôle |
| --- | --- |
| `index.html` | La page, avec JSON-LD (Organization, WebPage, FAQPage) injecté depuis la même donnée que la FAQ visible. |
| `sitemap.xml` | Une URL à ce stade (page unique), `lastmod` horodaté au build. |
| `llms.txt` | Digest markdown curaté pour crawlers IA (spec [llmstxt.org](https://llmstxt.org)). |
| `robots.txt` | Ouvert à tous les crawlers, référence `sitemap.xml`. |

## Ce que génère `flatten.mjs`

`index-flat.html` : dérivé autoportant de `index.html` (JS inliné — le CSS
l'est déjà par `generate.mjs` —, assets en URLs absolues sur `meta.domain`),
pour tout usage où la page doit vivre seule, hors de ce dossier. À lancer
après `generate.mjs` + `validate.mjs` ; le script sort en erreur s'il reste
une référence relative.

## Ce que génère `images.mjs`

Première étape du pipeline (seule dépendance npm : sharp) — idempotente, ne
régénère que ce dont la source a changé (`--force` pour tout refaire) :

| Sortie | Rôle |
| --- | --- |
| `brs-web-visuals-*-640w.webp` (+ `-960w` pour le héros) | Variantes responsives injectées en `srcset` par `generate.mjs`. |
| Logos partenaires/références en `.webp` redimensionnés | ~2× la taille d'affichage (spie 83 → 6,6 Kio, Qualifelec 46 → 2,3 Kio…). |
| `assets/logos/brs-logomark-favicon.png` (48 px) | Favicon léger. |
| `assets/images/image-dimensions.json` | Manifest consommé par `generate.mjs` pour le `srcset` et les `width`/`height` (anti-CLS). |

## Ce que vérifie `validate.mjs` (exit 1 si échec)

- Aucun token `{{...}}` non résolu dans les fichiers générés.
- Une seule balise `<link rel="canonical">`.
- JSON-LD syntaxiquement valide.
- FAQ visible === FAQ JSON-LD === `content.faq.items` (comparaison stricte, question par
  question).
- Aucun placeholder résiduel (`TODO`, `PLACEHOLDER`, `lorem ipsum`, tags de mail-merge
  GenPage type `(lead_company_name)`).
- Coordonnées (email, téléphone) du JSON-LD identiques à `content.organization`.
- Aucune chaîne de marque (`BRS Connect`, `Borne Recharge Service`) codée en dur dans
  `templates/index.template.html` hors des tokens `{{...}}`.
- `robots.txt` référence bien `sitemap.xml`.
- Le titre du hero apparaît dans le HTML statique généré (donc visible sans JavaScript,
  donc visible des crawlers).
- Tout fichier local référencé par `index.html` (`src`, `href`, `srcset`,
  `ogImage`, logo) existe sur disque — sinon Pages servirait des 404.
- Contraste WCAG 1.4.3 : les paires texte/fond déclarées (encres d'accent,
  CTA, corps de texte) tiennent 4,5:1 — verrou de l'arbitrage deux-bleus du
  2026-08-23 ([ADR-0003](docs/adr/0003-contraste-option-b.md)).

## Garde-fous

- **La FAQ visible = la FAQ du JSON-LD** : elles sortent de la même clé
  `faq.items`, impossible de les désynchroniser — mais toute retouche de FAQ
  change donc aussi ce que lisent les moteurs et les IA.
- **Les textes sont sous guardrails** (claims vérifiés, narrative
  anti-ubérisation, « Premier chantier ») : pour toute reformulation qui
  touche une promesse, un chiffre ou un positionnement, passer par une
  session Claude plutôt que d'éditer à la main — le skill copywriting
  applique la discipline de claims. Corriger une coquille à la main : oui.
  Réécrire le hero à la main : non.
- **Le canvas Claude Design fait foi sur le visuel** (import du 2026-08-22) :
  toute variante s'y essaie et s'y décide, puis la version retenue se reporte
  dans le code en session (`tokens.css`, JSON). Un écart entre canvas et code se
  résout dans le sens du canvas — et rien de ce qui n'existe que dans le canvas
  n'est en ligne tant qu'il n'est pas reporté.
- `foundations.json` (stratégie, dans `brs-connect-strategy/`) ne bouge que
  si le fond du message change — jamais pour une reformulation.

## Déploiement

GitHub Pages sur le domaine `brsconnect.fr` (fichier `CNAME`). Flux : éditer →
`npm run build` → commiter → pousser sur `main` ; Pages sert les fichiers
statiques commités (variantes d'images incluses), sans build côté serveur.
Contexte et décision : [ADR-0001](docs/adr/0001-connexion-github-pages.md).
Limites assumées de Pages : en-têtes HTTP non personnalisables (cache 10 min,
pas de HSTS/CSP) — non notés par Lighthouse ; si besoin un jour, passer le DNS
derrière Cloudflare (cf. `docs/plan-lighthouse-98.md`, annexe).
