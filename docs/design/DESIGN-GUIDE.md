# DESIGN-GUIDE — BRS Connect (brsconnect.fr)

Référence design permanente du site. Source de vérité des valeurs : `css/tokens.css` (ce guide donne les règles d'usage, pas un duplicata des tokens). Miroir complet documenté dans le projet design « BRS Connect - Design ».

> Importé du projet design le 2026-08-22. Historique : la conformance v3.1
> (2026-08-21) avait scindé `--primary` / `--primary-fill` pour le contraste
> des boutons ; l'arbitrage du 2026-08-22 (alignement canvas) revient au
> ciel `--primary` sous label blanc — écart de contraste assumé, échelle
> `--primary-fill` conservée en réserve dans `tokens.css`.

## Le look en une ligne

Une page blanche réglée par des filets de 1px, ponctuée de bandes navy plates, avec le bleu ciel réservé à l'action — du flat design au sens littéral.

## Couleur

- `--background` `#FFFFFF` : la page. `--secondary` `#2D2E83` (navy) : l'autorité — hero, bande insight, bande CTA. `--primary` `#36A9E1` (ciel) : **l'action** — boutons (label blanc), sourcils, clauses teintées, labels de liste, badges, point du badge, disque du badge Qualifelec. Écart de contraste assumé (2,65:1 sous blanc, arbitré le 2026-08-22).
- `--primary-fill` `#1A7DAD` : échelle de boutons assombrie de la v3.1, **en réserve** (non employée depuis l'arbitrage du 2026-08-22).
- Titres `#171844` (navy profond, jamais noir). Corps `#303030`. Liens et nav active `#1C5875` (`--link`).
- Badges d'icônes : `--accent` lilas, teinte tournée par position dans la grille (`--accent-badge-2/3/4`, oklch) ; les coches des colonnes de rôles suivent la même rotation.
- `--accent` `#8B8CD7` (lilas) : uniquement remplissage des badges d'icône sur sections claires. `--success` `#93BD21` : uniquement à 16 % derrière les icônes de bénéfices. `--danger` `#C0392B` : uniquement inputs invalides.
- Fonds colorés en plus du blanc : `--muted` `#F5F5F5` pour les bandes ancrage, rôles et références ; navy pour le hero, la bande insight et la bande CTA. Footer **clair**. Boutons primaires : label blanc sur `--primary` ciel.

## Typographie

- **Inter variable, self-hosted**, seule famille. Poids utilisés : 400 / 600 / 700 uniquement. Pas de Google Fonts, pas de serif, pas de display.
- Titres 700, tracking négatif (`-.04em` h1, `-.025em` h2), leading serré (1.04 / 1.25). Corps 400 à 1.7.
- Clamps fluides : h1 36→60px, h2 30→48px. Fixes : h3 20px, lede 18px, corps 16px, UI/cartes 14px, légal 12.8px. Eyebrows : 14px 600 uppercase `.16em`.
- `text-wrap: balance` sur les titres, `pretty` sur les paragraphes.

## Espacement et layout

- Échelle 4px (4/8/12/16/24/32/48/64/96). Grilles de cartes : gap **20px** (hors échelle, voulu). Sections : `clamp(4rem, …, 6rem)` vertical.
- Une colonne de contenu, max 1280px, gouttières 20 → 32 → 48px. Grilles 2/3/4 colonnes, repli 2 puis 1 à 900/640px.
- Seuls éléments fixes : header sticky (76px, z-50) et bouton retour-haut (44px, z-60).

## Fonds, bordures, rayons, ombres

- **Fonds plats uniquement.** Zéro gradient, zéro texture, zéro pattern. Le texte ne se pose jamais sur une photo.
- Signature du système : hairline `1px solid #D9D9D9` sur chaque carte, tuile, chip, étape, colonne ; `border-block` entre sections blanches consécutives. Sur navy : `rgba(255,255,255,.22)` (bordures de cartes `.16`).
- **Cartes carrées** — radius 0, non négociable. 6px : boutons, inputs, badges d'icône, toggle nav, retour-haut. 4px : focus rings. 999px : le point de statut 8px seul. **Exception images** : photos, screenshots, schémas → `--radius-image` 20px.
- Ombres : deux dans tout le système — `0 1px 2px rgba(0,0,0,.05)` (bouton ghost) et le `drop-shadow` du visuel hero. Rien d'autre. La profondeur vient des bordures et des bandes.

## Cartes et états

- Carte : blanche (ou 6 % blanc sur navy), padding 24px, hairline, carrée, **aucun état hover**. Rien ne se soulève, ne scale, ne s'éclaircit.
- Emphase unique : bordure `--primary` + ring 1px de la même couleur, une fois par grille au plus.
- Hover = changement de **couleur seulement**. Press assombrit. Focus : outline 2px `--ring` à 2px d'offset, radius 4px. Disabled : opacité 50 % + `not-allowed`.
- Transparence/blur : trois cas seulement — header sticky (95 % blanc + blur 8px, seul blur du site), blancs translucides sur navy (6–12 %), vert 16 % derrière les icônes bénéfices.

## Animation

- Un easing (`cubic-bezier(.4,0,.2,1)`), une durée (`.2s`) pour les couleurs. Une entrée : reveal au scroll (opacity + translateY 14px→0, 500ms, une fois, à 12 % de visibilité).
- **Rien ne boucle, ne rebondit, ne parallaxe** — exceptions assumées et documentées : le marquee partenaires du hero et le badge Qualifelec rotatif. Tout est coupé sous `prefers-reduced-motion`, smooth-scroll compris.

## Imagerie

- Froide et dominante bleue : schémas isométriques navy/ciel, screenshots du portail de supervision, photos de bornes en parkings et copropriétés. Pas de filtre chaud, pas de grain, pas de N&B, pas de personnes qui posent.
- Toute image porte `--radius-image` 20px. Traitement `.team-visual` : mat `--muted`, padding 12px, hairline, légende (icône service 44px + une phrase). Grilles média : images arrondies sans bordure, légende label + détail dessous.
- Logos références/partenaires : couleurs d'origine, max 30px de haut, boîte sans cadre, jamais en niveaux de gris, jamais de hover.

## Iconographie

1. **SVG inline 24×24 stroké** (défaut) : `fill="none"`, `stroke="currentColor"`, épaisseur 1.6–1.8, caps/joins ronds ; rendu à 20px dans un badge 44px (16px dans les boutons). La flèche `M4 12h16M13 5l7 7-7 7` marque chaque CTA. Un glyphe manquant s'écrit dans ce langage — jamais de librairie d'icônes.
2. **4 icônes PNG 44px de service** (`icon-etude/preparation/supervision/exploitation.png`) : les seules raster.
3. **Logo** : le logomark carré (`brs-logomark-square.png`, 40–44px, radius 6px) partout ; au footer sur chip blanc (pas de variante claire). Le SVG horizontal existe mais n'est pas utilisé.
- Marques pur-CSS à garder telles quelles : coche des listes de rôles (coin bordé `--primary` pivoté), chevron FAQ (coin 8px qui pivote), burger 3 barres.
- **Jamais** : emoji, glyphes unicode en guise d'icônes, icon fonts, styles filled/duotone, CDN d'icônes.

## Voix et copy (fr-FR)

- **Vouvoiement** strict. Typographie française : espace avant `: ; ? !`, guillemets « avec espaces ». Formats français : `+33 1 84 25 26 70`, `22 kW`, `48 bornes`.
- La marque dit **BRS Connect / BRS** en 3e personne pour décrire, **nous** seulement pour les engagements et les refus. Le lecteur est **vous**, sujet de la phrase le plus souvent : « Vous gardez le client. Vous fixez votre marge. »
- **Le geste signature** : titres en deux clauses — négation puis correction, la seconde teintée : « Le choix n'est pas de poser plus. *C'est de rester propriétaire de vos marchés.* »
- **Sentence case partout.** L'uppercase vient du CSS (eyebrows, labels), jamais du contenu. Majuscule aux choses nommées : *Premier chantier*, *Connect*.
- **Under-claiming assumé** : les limites se disent (« BRS Connect démarre : il n'y a pas encore de témoignages partenaires à afficher. »). Pas de superlatifs, pas de « leader », pas de pourcentages de croissance. Un chiffre est toujours attribué à un client nommé.
- FAQ : questions dans la voix du lecteur, soupçon compris ; réponses ouvrant sur le verdict (**Non.** / **À la prestation, projet par projet.**). Jamais « Excellente question ».
- Vocabulaire exact à préserver : `IRVE`, `exploitant`, `supervision`, `exploitation`, `télérelève`, `préconfiguration`, `bureau d'études (BE)`, `appel d'offres`, `cahier des charges`, `copropriété`, `bailleur social`, `accord-cadre`, `à la prestation`, `Premier chantier`, `Qualifelec`, `ADVENIR`, `TGBT`.
- **Deux CTA, partout, dans cet ordre** : « Échanger 15 min sur un projet » (primaire) puis « Devenir partenaire ». Lien sortant = mention en petit (« Ce lien ouvre le formulaire de contact de Borne Recharge Service. »).
- **Zéro emoji.**
