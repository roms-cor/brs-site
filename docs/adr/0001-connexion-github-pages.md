# ADR-0001 : Connexion de brs-site à GitHub et publication via GitHub Pages

**Statut :** Proposé
**Date :** 2026-08-05
**Décideurs :** Roms

## Contexte

`brs-site/` est le seul dossier déployé du projet BRS Connect (landing page statique,
zéro dépendance npm, build zéro-dépendance via `node build/generate.mjs`). Il n'a
jusqu'ici jamais été versionné correctement :

- `brs-site/` compte **0 fichier suivi par Git**. Le dépôt Git existant à la racine du
  monorepo (`brs-connect/`, 2 commits) suit une structure de fichiers antérieure à la
  réorganisation du 2026-08-05 (`assets/`, `css/`, `index.html` directement à la racine)
  qui n'existe plus sur le disque — cet historique est orphelin vis-à-vis du contenu
  actuel de `brs-site/`.
- Le `.gitignore` racine contient une règle `build/` qui, appliquée telle quelle,
  ignorerait silencieusement `brs-site/build/generate.mjs` et `validate.mjs` — qui sont
  les **scripts source** du pipeline de contenu, pas des artefacts de build.
- Un précédent workflow GitHub Actions de déploiement avait déjà été tenté puis retiré
  (dernier commit : « Retire le workflow GitHub Actions cassé (site/ inexistant,
  deploy.yml orphelin) »).
- Le dépôt cible `roms-cor/brsconnect-website` n'existe pas encore côté GitHub (404 à la
  vérification).
- Le fichier `brs-site/CNAME` contient actuellement `bornerecharge.pro`, qui n'est pas le
  domaine final retenu.
- Le build produit des fichiers statiques commités (`index.html`, `sitemap.xml`,
  `llms.txt`, `robots.txt`) — le README documente déjà un flux « éditer le JSON → générer
  localement → valider → commiter », sans étape de build côté serveur.

Cette décision couvre uniquement la connexion de `brs-site/` à GitHub et sa publication.
Le monorepo racine (`brs-design/`, `brs-connect-strategy/`) reste hors périmètre et
continue de vivre localement uniquement.

## Décision

1. **Un dépôt Git indépendant** est initialisé directement dans `brs-site/` (nouveau
   `.git`, historique propre — il n'existe rien à préserver puisque `brs-site/` n'a
   jamais été commité). Il est poussé vers `roms-cor/brsconnect-website`.
2. Le dépôt est **public**, condition nécessaire pour utiliser GitHub Pages avec un
   domaine personnalisé sur le plan gratuit ; le contenu (landing page HTML/CSS/JS) ne
   contient de toute façon aucun secret et est déjà visible via le navigateur.
3. **GitHub Pages** est configuré en mode « Deploy from branch » → `main` → `/ (root)`.
   Aucune étape de build ni de déploiement en CI : les fichiers générés sont commités
   directement, comme documenté dans `brs-site/README.md`.
4. Un **workflow GitHub Actions de validation** (`.github/workflows/validate.yml`) tourne
   à chaque push et pull request sur `main` : il exécute `node build/validate.mjs` pour
   bloquer toute régression (token non résolu, FAQ désynchronisée, JSON-LD invalide,
   etc.) avant qu'elle n'atteigne la production. Il ne construit ni ne déploie rien —
   seule la validation est automatisée.
5. Le domaine final est **`connect.bornerecharge.services`** (sous-domaine). Le fichier
   `CNAME` est corrigé pour contenir cette valeur (au lieu de `bornerecharge.pro`). Côté
   DNS, un enregistrement **CNAME** doit être créé chez le registrar de
   `bornerecharge.services` : `connect` → `roms-cor.github.io`. C'est une action hors
   périmètre Git/GitHub, à mener manuellement par l'utilisateur.
6. Avant le premier commit, deux corrections sont appliquées :
   - `.gitignore` de `brs-site/` : la règle `build/` héritée du monorepo est retirée ou
     réécrite pour ne cibler que d'éventuels artefacts futurs (`node_modules/`,
     `dist/`), jamais `build/*.mjs`.
   - `CNAME` : contenu remplacé par `connect.bornerecharge.services`.

## Options considérées

### Option A : Dépôt indépendant dans `brs-site/` (retenue)

| Dimension | Évaluation |
|---|---|
| Complexité | Faible — `git init`, remote, push, activer Pages |
| Coût | Aucun (repo public, plan gratuit) |
| Scalabilité | Suffisante — site statique, trafic marketing |
| Familiarité équipe | Élevée — flux Git standard, un seul repo à gérer côté site |

**Pour :** correspond exactement à ce que documente déjà le README (« brs-site est le
seul dossier déployé ») ; aucun historique à migrer puisque rien n'était suivi ; la plus
simple à mettre en place et à maintenir pour un usage solo.
**Contre :** l'historique Git du site est déconnecté de celui du monorepo
(design/stratégie) — mais ce lien n'a jamais existé, donc rien n'est perdu.

### Option B : Monorepo unique + `git subtree push`

| Dimension | Évaluation |
|---|---|
| Complexité | Moyenne — nécessite de maîtriser `git subtree` |
| Coût | Aucun |
| Scalabilité | Suffisante |
| Familiarité équipe | Faible — commande peu utilisée au quotidien |

**Pour :** garde un historique Git unique couvrant site, design et stratégie.
**Contre :** ajoute une étape manuelle à chaque publication ; mélange dans un même
historique des commits marketing/stratégie qui resteront de toute façon locaux avec des
commits de site qui deviennent publics — risque de fuite accidentelle de contenu interne
si l'extraction est mal maîtrisée.

### Option C : Monorepo + déploiement CI automatisé

| Dimension | Évaluation |
|---|---|
| Complexité | Élevée — clé de déploiement, secrets GitHub, workflow de build |
| Coût | Aucun (Actions gratuites pour repo public) |
| Scalabilité | Suffisante, mais sur-dimensionnée |
| Familiarité équipe | Moyenne |

**Pour :** découple totalement source privée et publication publique.
**Contre :** complexité disproportionnée pour un site qui n'est pas encore en cadence de
publication continue ; ajoute une surface d'attaque (clé de déploiement) pour un gain
marginal par rapport à l'option A.

## Analyse des compromis

Le facteur décisif est que `brs-site/` n'a **aucun historique Git existant** à préserver
— les options B et C n'apportent donc aucun bénéfice réel (rien à garder connecté) tout
en ajoutant de la complexité opérationnelle. L'option A est la seule qui ne demande
aucune abstraction Git avancée et qui correspond au modèle mental déjà documenté dans le
projet (« brs-site est le seul dossier déployé »). Le seul coût réel est l'absence de
lien d'historique entre le site et les dossiers `brs-design/`/`brs-connect-strategy/`,
qui n'a jamais existé de toute façon.

## Conséquences

- Plus facile : publier une mise à jour du site (`edit JSON → generate → validate →
  commit → push` → Pages se met à jour automatiquement).
- Plus facile : auditer ce qui est public, puisque le repo GitHub contient exactement
  et uniquement ce qui est déployé.
- Plus difficile : faire remonter un changement de `brs-design/` (tokens, logos) dans
  `brs-site/` reste un geste manuel de copie — déjà le cas aujourd'hui, non modifié par
  cette décision.
- À revisiter : si `brs-connect` (monorepo) doit un jour être sauvegardé sur GitHub pour
  d'autres raisons (backup multi-machines), ce sera un second dépôt (privé), sans lien
  avec celui-ci.
- Risque résiduel : le dépôt Git racine du monorepo reste dans un état incohérent
  (historique orphelin sur d'anciens chemins) — non traité par cette décision, à nettoyer
  séparément si besoin (ex. `git rm -r --cached` des chemins fantômes).

## Actions

1. [ ] Corriger `brs-site/CNAME` → `connect.bornerecharge.services`
2. [ ] Ajouter/corriger `brs-site/.gitignore` (retirer le piège `build/`)
3. [ ] `git init` dans `brs-site/`, premier commit
4. [ ] Créer le dépôt public `roms-cor/brsconnect-website` sur GitHub
5. [ ] `git remote add origin` + push initial sur `main`
6. [ ] Activer GitHub Pages : Settings → Pages → Deploy from branch → `main` → `/root`
7. [ ] Ajouter `.github/workflows/validate.yml` (exécute `node build/validate.mjs` sur
       push/PR vers `main`)
8. [ ] Créer l'enregistrement DNS CNAME chez le registrar de `bornerecharge.services` :
       `connect` → `roms-cor.github.io` (action utilisateur, hors Git)
9. [ ] Une fois le DNS propagé, activer « Enforce HTTPS » dans les paramètres Pages
