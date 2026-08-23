# ADR-0003 : Contraste — option B « deux bleus », amendement de l'arbitrage du 2026-08-22

**Statut :** Accepté
**Date :** 2026-08-23
**Décideurs :** Roms (validé en session, grilling Promptor du plan « Objectif 98 »)

## Contexte

L'arbitrage du 2026-08-22 (conformité au canvas « BRS Connect - Design »)
faisait passer les boutons primaires et les accents textuels au ciel
`--primary #36A9E1` sous label blanc — 2,65:1, sous le seuil 4,5:1 du critère
WCAG 1.4.3. Conséquence mesurée : accessibilité Lighthouse plafonnée à 96
(seul audit en échec : le contraste, 20 nœuds), incompatible avec l'objectif
« ≥ 98 partout » fixé le 2026-08-23.

Trois options ont été posées : (A) bascule complète sur l'échelle assombrie,
(B) correction chirurgicale limitée aux usages textuels, (C) maintien de
l'écart et renoncement au 98 en accessibilité. **Roms a choisi B.**

## Décision

Logique **deux bleus**, documentée dans `css/tokens.css` :

- le ciel `--primary #36A9E1` reste la teinte de marque partout où il est
  **décoratif** (icônes, filets, dots, bordures, badges non textuels) ;
- tout usage **textuel** passe aux encres conformes :
  - boutons primaires → échelle `--primary-fill` (#1A7DAD, blanc à 4,58:1),
    qui existait en réserve depuis la v3.1 ;
  - sourcils, `.em`, labels sur fonds clairs → `--accent-ink #17739F`
    (5,27:1 sur blanc, 4,83:1 sur `--muted` — le #1A7DAD passe sous 4,5:1
    sur fond muted, d'où le cran plus foncé) ;
  - accents sur bandes navy (hero, `numbered--dark`, `cta-band`,
    `role-col--solid`) → `--accent-ink-on-dark #4FB5E8` (5,0:1 sur
    `--secondary #2D2E83` ; le ciel n'y faisait que 4,32:1).

`validate.mjs` (contrôle n°11) casse le build si l'une des paires déclarées
repasse sous 4,5:1 — l'arbitrage est verrouillé dans le pipeline.

## Conséquences

- Accessibilité Lighthouse : 96 → 100 (audit contraste vert).
- Écart visuel limité aux teintes textuelles ; l'identité ciel est préservée
  sur le décoratif (vérifié par captures avant/après).
- **À reporter dans le canvas « BRS Connect - Design » et `../brs-design/`**
  pour que le canvas reste source de vérité ; d'ici ce report, le commentaire
  de `tokens.css` et le présent ADR font foi sur l'écart canvas/code.
