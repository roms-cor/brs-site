# brs-site — pipeline de contenu

Ce dossier est le site déployé. Il a une **source de vérité
unique** pour le contenu, un **template** pour la structure/CSS, et un **script de
build zéro-dépendance** qui génère tout le reste.

## Règle n°1

**Ne jamais éditer `index.html`, `sitemap.xml`, `llms.txt` ou `robots.txt` à la main.**
Ces quatre fichiers sont écrasés à chaque `node build/generate.mjs`. Toute correction
manuelle sera perdue au prochain build.

## Éditer le contenu

1. Ouvrir `content/site-content.json`.
2. Modifier le texte voulu (hero, sections, FAQ, coordonnées, métadonnées…).
3. Régénérer :
   ```bash
   node build/generate.mjs
   node build/validate.mjs
   ```
4. Si `validate.mjs` échoue, lire le message — il pointe l'erreur exacte (token oublié,
   FAQ désynchronisée, coordonnée qui ne correspond pas, etc.).
5. Prévisualiser : `python3 -m http.server 8000` puis ouvrir `http://localhost:8000/`.
6. Commit.

## Éditer la structure ou le style visuel

Le style vit intégralement dans `css/tokens.css` (tokens sémantiques — source
unique de vérité visuelle, miroir documenté dans `../brs-design/`), `css/base.css`
(reset, police Inter, boutons) et `css/main.css` (composants, dans l'ordre de la
page) : les modifier ne nécessite pas de rebuild. Le markup vit dans
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

## Déploiement

GitHub Pages sur le domaine `brsconnect.fr` (fichier `CNAME`). Flux : éditer →
générer → valider → commiter → pousser sur `main` ; Pages sert les fichiers
statiques commités, sans build côté serveur. Contexte et décision :
[ADR-0001](docs/adr/0001-connexion-github-pages.md).
