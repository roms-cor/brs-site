# ADR-0002 : Pipeline d'images sharp — première dépendance npm du repo

**Statut :** Accepté
**Date :** 2026-08-23
**Décideurs :** Roms (session Claude, plan « Objectif 98 »)

## Contexte

Le rapport PageSpeed Insights du 2026-08-23 chiffrait 380 à 470 Kio
d'économies d'images : visuels 1193×896 affichés à ~566 px sans `srcset`,
logos livrés à 768 px pour un affichage de 30 à 176 px (spie.png 83 Kio,
logo-qualifelec-irve.jpg 46 Kio pour 62 px, brs-logomark-square.png 36 Kio
pour 40 px). Ces images en concurrence avec la police sur le chemin critique
retardaient aussi le LCP mobile. Le repo était jusqu'ici **zéro dépendance
npm** — un principe documenté dans le README.

## Décision

Ajouter `build/images.mjs`, basé sur **sharp**, comme première étape du
pipeline officiel (`npm run build` : images → generate → validate → flatten,
l'étape images placée avant la génération du flat sur demande de Roms).

Le périmètre de la dépendance est strictement limité à cette étape :
`generate.mjs`, `validate.mjs` et `flatten.mjs` restent zéro-dépendance, et
les sorties (variantes `-640w`/`-960w`, logos WebP, favicon 48 px, manifest
`image-dimensions.json`) sont **committées** — GitHub Pages continue de
servir des fichiers statiques sans build serveur. Le script est idempotent
(comparaison de mtime, `--force` pour tout régénérer).

## Conséquences

- `npm ci` requis une fois par clone avant `npm run build`.
- ~400 Kio de moins au chargement initial ; `generate.mjs` consomme le
  manifest pour injecter `srcset`/`sizes` et les `width`/`height` manquants
  (anti-CLS) ; `validate.mjs` (contrôle n°10) vérifie l'existence de tout
  fichier référencé.
- Nouveau logo = une entrée dans la table `LOGOS` du script ; qualité par
  fichier surchargeable via `QUALITY_OVERRIDES` (règle README conservée).
