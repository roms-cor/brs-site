# ADR-0004 : Mode préview, redirection de la racine et exposition du dépôt

**Statut :** Proposé (les faits et garde-fous du mode préview sont en place ; l'exposition du dépôt et le workflow restent à trancher par Roms)
**Date :** 2026-10-16
**Décideurs :** Roms

## Contexte

Depuis le 2026-08-24 le site tourne en **mode préview** (`PREVIEW = true`,
`build/config.mjs`) : la page complète sort dans `home/` (noindex), la racine n'est
jamais touchée par le build. Le 2026-10-15 la racine est devenue une **redirection
manuscrite** (commit 4c6127a) vers la page opérateur
`https://bornerecharge.fr/brs-connect/`, avec UTM, `noindex`.

Trois faits relevés par la revue de codebase du 2026-10-15 (projet Nifty REV) :

1. **GitHub Pages sert toute la racine du dépôt.** `https://brsconnect.fr/content/site-content.json`,
   `/templates/index.template.html`, `/build/generate.mjs`, `/docs/…`, `/README.md`,
   `/package.json` répondent 200 : toute la copy (garde-fous, FAQ, modèle de gain) est lisible
   alors que la racine redirige et que `/home/` est noindex. Les PNG et JPG sources non référencés
   (~4,2 à 4,6 Mo) sont déployés ; ils sont conservés comme sources de `images.mjs`. Aucun secret ni
   contenu stratégique trouvé : du détail interne. Le commentaire de `generate.mjs` (« rien du
   contenu ne fuite avant le go-live ») était faux ; il est corrigé.
2. **La bascule hors préview pouvait se faire par erreur** : `generate` et `validate` lisaient la même
   constante, donc `validate` ne pouvait pas détecter une bascule involontaire, et la racine manuscrite
   aurait été écrasée sans alerte.
3. **Aucun contrôle automatique** : le workflow de validation prévu par l'ADR-0001 n'a jamais été créé,
   la branche `main` n'est pas protégée.

## Décision

### Déjà en place (2026-10-16, fichiers du dépôt public non commités à la rédaction)

- **Mode préview** : `home/` noindex ; `sitemap.xml` vide (aucune URL indexable), `robots.txt` et
  `llms.txt` gelés et manuscrits, empreintes épinglées dans le dépôt privé (`tools/site-gele.sha256`).
- **Redirection de la racine** : manuscrite, `noindex`, UTM conservées ou ajoutées ; `validate.mjs`
  exige `noindex` sur la racine et sur `index-flat.html`, et refuse un sitemap qui liste une URL noindex.
- **Bascule go-live volontaire** : `PREVIEW = false` exige aussi `GO_LIVE=1` (`generate.mjs` et
  `validate.mjs` échouent sinon) ; `validate.mjs` échoue tant que `home/` existe ; hors préview le flat de
  la racine reçoit `noindex` (doublon complet de la page). Checklist dans `README.md` (« Go-live »).
- **Le build se teste lui-même** : `build/selftest.mjs` rejoue le build sur des copies altérées.

### À trancher par Roms

**A. Exposition du dépôt.** Options :

| Option | Pour | Contre |
|---|---|---|
| 1. Assumer l'exposition (retenue provisoirement, par défaut) | Aucun changement ; le dépôt est public de toute façon | Copy, garde-fous et sources lisibles sur le domaine de production avant le go-live |
| 2. Publier un sous-ensemble (branche `gh-pages` ou workflow de déploiement qui ne copie que `home/`, `assets/` utiles, fichiers racine) | Rien d'interne servi ; domaine propre | Un workflow de déploiement à maintenir ; la source reste lisible sur github.com (dépôt public) |

Le dépôt restant public sur github.com dans les deux cas, l'option 2 ne protège que le domaine de
production, pas le contenu : elle ne se justifie que si la copy ne doit pas être lisible sur brsconnect.fr
avant le go-live. Si l'option 2 est retenue : vérifier par `curl` (GET/HEAD) que les URLs ci-dessus renvoient
404 et que `/` et `/home/` répondent toujours.

**B. Workflow de validation.** Fichier proposé : `.github/workflows/validate.yml` (rejoue
`generate`, `validate`, `flatten`, vérifie que les fichiers générés commités sont identiques, contrôle les
images sans sharp, rejoue le selftest, cherche chemins locaux, clés et adresses email inattendues).
Décider aussi de la protection de `main` (exiger le contrôle vert avant fusion) : réglage côté dépôt public.

**C. Plugin tiers de la configuration partagée** (`.claude/settings.json` du dépôt privé :
marketplace `Egonex-AI/Understand-Anything` sans `ref` épinglé) : l'épingler à un commit ou le retirer
de la configuration partagée. Réglage de configuration, hors dépôt public.

## Conséquences

- Une bascule par erreur ou un oubli de `home/` au go-live échoue au build, pas en production.
- Les contrôles de `tools/check.sh` (dépôt privé) restent la barrière de départ ; le workflow, s'il est
  accepté, protège aussi les contributions qui ne passent pas par le dépôt privé.
- L'exposition (A) reste un risque accepté tant qu'elle n'est pas tranchée.
