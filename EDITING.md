# Éditer la landing en 2 minutes

**La seule source de vérité est `content/site-content.json`.** Tout le texte
visible de la page y vit ; toutes les images y sont référencées par chemin.
On n'édite jamais `index.html` (écrasé à chaque build), jamais le canvas
Claude Design (bac à sable visuel, il ne fait pas foi).

## Modifier un texte

1. Ouvrir `content/site-content.json`, trouver la clé (carte ci-dessous).
2. Modifier la valeur.
3. Rebuilder :

```bash
node build/generate.mjs && node build/validate.mjs
```

Si `validate.mjs` râle, il dit exactement quoi corriger. Prévisualiser avec
`python3 -m http.server 8000`, puis commit + push.

Le plus simple reste de demander la retouche en session Claude (« change le
titre de la section 04 en … ») : l'édition passe alors par le skill
copywriting, qui vérifie les claims — voir « Garde-fous » plus bas.

## Modifier une photo ou une icône

1. Déposer le nouveau fichier dans `assets/images/` (ou `assets/icons/`,
   `assets/images/references/` pour un logo client).
2. Changer le chemin dans la clé correspondante du JSON
   (ex. `hero.image`, `sections.equipe.visual.image`,
   `sections.references.logos[].image`).
3. Mettre à jour le texte alternatif voisin (`…Alt`), puis rebuilder.

Formats : SVG ou PNG, poids raisonnable (< 300 Ko), pas de nom avec espaces.

## Carte de la page → clés JSON

Dans l'ordre de la page, du haut vers le bas :

| Ce que tu vois | Clé dans site-content.json |
|---|---|
| Onglet navigateur, description Google | `meta.title`, `meta.description` |
| Menu du header + bouton « Devenir partenaire » | `nav.primary[]`, `nav.ctaLabel` / `nav.ctaHref` |
| Hero — badge du haut | `hero.badge` |
| Hero — grand titre | `hero.title` |
| Hero — paragraphe | `hero.lede` |
| Hero — les 2 boutons | `hero.ctaPrimary(+Href)`, `hero.ctaSecondary(+Href)` |
| Hero — visuel Control Room | `hero.image` + `hero.imageAlt` |
| Bande de repères sous le hero (4 chips) | `sections.capacites.tags[]` |
| 01 Bénéfices — titre + 4 cartes | `sections.capacites.title`, `.cards[]` (title/text/icon) |
| Bande « Nos partenaires » | `sections.ancrage.eyebrow`, `.tags[]` |
| 02 Le problème — titre en 2 tons + intro + 4 cartes | `sections.probleme.titleMain` / `.titleEm`, `.lede`, `.cards[]` |
| 03 Le vrai choix (bande navy) — titre + 2 paragraphes + 2 cartes | `sections.insight.titleMain` / `.titleEm`, `.ledes[]`, `.cards[]` |
| 04 La solution — titre + intro + 4 cartes | `sections.solution.*` (la carte mise en avant a `"accent": true`) |
| 05 Qui fait quoi — 2 colonnes | `sections.roles.partner.*`, `.network.*`, `.footnote` |
| 06 Parcours (bande grise) — 4 étapes | `sections.parcours.steps[]` (num/title/text) |
| 07 Qui sommes-nous — 3 cartes + schéma | `sections.equipe.cards[]`, `.visual.image(+Alt)`, `.visual.captionText` |
| 08 Références — 8 logos + 4 faits | `sections.references.logos[]`, `.facts[]` (client/detail) |
| 09 Bénéfices concrets — 5 cartes | `sections.benefices.cards[]` |
| 10 FAQ — 7 questions/réponses | `faq.items[]` (question/answer) |
| CTA final (panneau navy) | `contact.title`, `.lede`, `.ctaLabel(+Href)`, `.note` |
| Footer — taglines, segments, liens légaux | `footer.*` |
| Coordonnées (partout) | `organization.email`, `.phoneDisplay` / `.phoneHref` |

Le style (couleurs, typo Inter, espacements) ne se règle pas ici : il vit
dans `css/tokens.css` — voir `../brs-design/design-system.md`.

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
- **Le canvas Claude Design est un bac à sable** : on y essaie une variante
  visuellement, puis on reporte la version retenue dans le JSON en session.
  Rien de ce qui n'existe que dans le canvas n'est en ligne.
- `foundations.json` (stratégie, dans `brs-connect-strategy/`) ne bouge que
  si le fond du message change — jamais pour une reformulation.
