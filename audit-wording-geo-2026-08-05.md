# Audit wording + GEO/SEO : brs-site (BRS Connect)

Périmètre analysé : `content/site-content.json` (source de vérité), `index.html`,
`llms.txt`, `robots.txt`, `sitemap.xml`, `templates/index.template.html`,
`build/generate.mjs`, `build/validate.mjs`. Méthode : grille d'audit
agency-geo-pipeline + repérage des tics d'écriture IA sur le wording.

Note préalable : le `README.md` du dépôt trace déjà une checklist « Points à
brancher avant mise en production » (CNAME provisoire, formulaire qui n'envoie
rien, lien confidentialité en `#`, coordonnées d'en-tête factices, plaquette à
produire). Ces points ne sont pas re-listés ici : ils sont déjà identifiés et
ne demandent pas un audit supplémentaire. Ce rapport se concentre sur ce qui
n'est pas encore tracé.

## 1. Points solides (avec preuve)

| Point | Preuve |
| --- | --- |
| FAQ visible et FAQPage JSON-LD strictement identiques | Sortent du même tableau `faq.items` ; `validate.mjs` compare question par question et passe. |
| Aucun `aggregateRating` ni faux avis | Recherche négative sur `aggregateRating`/`review` dans `index.html`, alors que le risque « self-serving reviews » relevé dans le playbook GEO n'existe pas ici. |
| Volume de texte visible sans JS : ~11 000 caractères | Mesuré sur `index.html` (texte extrait hors `<script>`/`<style>`), largement au-dessus du seuil de référence de 3 000 caractères. |
| Tous les assets référencés existent | 16/16 chemins (icônes, images, logos) présents sur disque, vérifié par script. |
| Une seule balise canonical, JSON-LD syntaxiquement valide dans le build actuel | `grep` sur `index.html` : un seul `rel="canonical"` ; `validate.mjs` confirme un JSON-LD parsable. |
| Wording sans surcharge promotionnelle | Recherche négative sur un lexique IA typique (vibrant, riche, au cœur de, incontournable, sur mesure, façonner, paysage...) : aucune occurrence. Le texte reste concret et technique (TGBT, note de calcul, télérelève). |
| Honnêteté sur le stade de lancement | Le texte assume explicitement l'absence de témoignages partenaires (« Un lancement honnête », section équipe) plutôt que de les simuler. |

## 2. Constats (sévérité)

**1. [Bloquant] La source de vérité a un domaine vide : le prochain build casse tout, et `validate.mjs` ne le voit pas.**
Preuve : `content/site-content.json:4` contient `"domain": "https://"` (pas
d'hôte). `generate.mjs` construit toutes les URLs absolues à partir de ce champ
(`c.meta.domain + '/#organization'`, etc.). Rebuild à blanc sur une copie
temporaire : le canonical devient `<link rel="canonical" href="https:///">`,
les `@id` JSON-LD deviennent `https:///#organization`, le sitemap contient
`<loc>https:///</loc>`, et `robots.txt` référence `Sitemap: https:///sitemap.xml`.
`validate.mjs` a quand même affiché « Validation OK » : il vérifie la syntaxe
et la cohérence interne, mais pas la forme du domaine. Le fichier généré sur
disque est aujourd'hui correct (modifié à 07:56) parce qu'il a été produit
avant que `content/site-content.json` soit modifié (08:11), mais le prochain
`node build/generate.mjs` écrasera ce bon état par des URLs cassées tant que
le champ n'est pas restauré.

**2. [Important] `validate.mjs` a un angle mort sur la forme du domaine.**
Conséquence directe du point 1 : le validateur qui est censé « casser le
build » avant qu'une erreur parte en production ne couvre pas ce cas précis.
C'est le genre de trou que la philosophie du pipeline (« un validateur qui
casse le build vaut mieux que cent consignes ») est censée éliminer.

**3. [Mineur, à ajouter à la checklist README] Icônes réseaux sociaux en `href=""`.**
Preuve : `templates/index.template.html:734-736`, Facebook, Twitter/X et
Instagram pointent vers `href=""`. C'est la même catégorie que les points déjà
trackés (lien confidentialité en `#`), mais ces trois-là ne sont pas nommés
dans la checklist actuelle du `README.md`. Autre nuance : contrairement au
lien confidentialité (dans le contenu), ceux-ci sont codés en dur dans le
template. Dupliquer ce template pour un autre client emporterait ces
placeholders sans que personne y pense.

**4. [Mineur] Pas de dimensions déclarées pour `og:image`.**
Preuve : aucune balise `og:image:width` / `og:image:height` dans `index.html`,
alors que `og:image` pointe vers `assets/images/hero-photo.png`. Sans
déclaration, certains services de prévisualisation (LinkedIn notamment)
recadrent moins bien l'image.

**5. [Mineur] Pas de `dateModified` dans les blocs JSON-LD.**
Preuve : recherche négative sur `dateModified`/`datePublished` dans
`index.html`. Le sitemap est bien horodaté au build (`lastmod`), mais les
schémas `Organization`/`WebPage` ne portent aucun signal de fraîcheur.

## 3. Wording : analyse de style

Le texte est globalement sobre et concret : peu de superlatifs, pas
d'emphase artificielle sur la « portée » ou l'« héritage », pas de rallonge
en « -ant » systématique, pas de gras mécanique. Un seul procédé revient assez
souvent pour devenir reconnaissable :

**Le cadrage par la négative avant la version positive**, répété dans 5
sections sur 10 :

| Section | Extrait |
| --- | --- |
| Hero | « Le but n'est pas de vous remplacer, mais de vous permettre d'aller plus loin sans tout construire seul. » |
| Problème (02) | « Ce n'est pas une question de capacité à installer, mais de continuité, de conformité et de moyens mobilisables. » |
| Insight (03) | « Le marché n'a pas seulement besoin de plus d'installateurs, mais d'installateurs capables d'intervenir avec un socle crédible... » |
| Solution (04) | « Ce n'est ni une franchise, ni un programme à paliers, ni un abonnement SaaS. » |
| Équipe (07) | « BRS Connect n'essaie pas de vendre une théorie. Ces capacités existent déjà chez Borne Recharge Service. » |

Pris isolément, chacun de ces exemples est un choix de style défendable : le
contraste négatif/positif clarifie une nuance commerciale réelle (pas de
remplacement, pas de franchise). Mais répété cinq fois sur dix sections, il
devient une formule plutôt qu'un effet voulu une fois. Deux options, à
trancher plutôt qu'à trancher pour vous :

- **Garder tel quel** si ce rythme est une signature assumée de la marque
  (défendable pour un one-shot, surtout si personne d'autre n'a relu le texte
  en continu et remarqué la répétition).
- **Varier 2 à 3 occurrences** (probablement Insight et Équipe, les moins
  chargées en information factuelle propre à la négation) pour que l'effet
  reste frappant là où il sert le plus, sans réécrire le fond, juste la
  charpente de la phrase.

Aucune reformulation n'a été appliquée : ce rapport ne fait que signaler le
motif, conformément à ce qui a été convenu.

## 4. Point structurel

La couche de contenu unique (`site-content.json` → build → `index.html` /
`llms.txt` / `sitemap.xml` / `robots.txt`) est une bonne architecture sur le
papier : une donnée d'identité, un seul emplacement, génération au build. Mais
le constat n°1 montre qu'elle est aujourd'hui fragile en pratique : le champ
qui porte l'identité du domaine peut être vidé sans qu'aucun garde-fou ne le
signale, et le fichier généré actuellement en ligne survit seulement parce
que personne n'a relancé le build depuis la modification. Séparément, les
placeholders `href=""` et `href="#"` vivent à deux endroits différents (le
contenu pour un lien, le template pour trois autres), ce qui veut dire que
« corriger tous les placeholders » demande de regarder à deux couches, pas
une seule. Si ce template doit un jour être dupliqué pour un autre client
(logique déjà en place chez byab-website), ces deux points (validateur
incomplet, placeholders à deux niveaux) sont ce qui échapperait à une
duplication propre par couche contenu.

## 5. Options

**Option A : correctif minimal (~10 min).**
Restaurer `meta.domain`, rebuild, valider. Ne touche pas au wording ni au
validateur. Coût faible, mais le trou dans `validate.mjs` reste ouvert : rien
n'empêche que le domaine soit vidé une deuxième fois sans que personne ne s'en
aperçoive avant un rebuild malheureux.

**Option B : correctif + durcissement du validateur (~30-45 min).**
Option A, plus une vérification dans `validate.mjs` que `meta.domain` a la
forme `https://<hôte>` (pas vide, pas juste le protocole), et une vérification
`href=""` / `href="#"` en dehors des ancres internes (`#probleme`, `#top`,
etc.) comme signal au minimum « Important ». Ferme le trou identifié au
point 2.

**Option C : B, plus faire remonter les placeholders du template vers le contenu.**
Rendre `footer.legalLinks` et les icônes sociales pilotables depuis
`site-content.json` (avec `{{#if}}` pour omettre le lien plutôt que de simuler
un `#`), pour qu'un futur client dupliqué n'hérite pas de placeholders cachés
dans le template. Plus de travail, seulement justifié si ce template a vocation
à être réutilisé pour d'autres réseaux/clients.

**Avis tranché.** B maintenant : le coût est faible et ferme un vrai risque
(le prochain rebuild aveugle). C n'est pas urgent tant que `brs-site` reste un
site unique et non dupliqué. À proposer en option plutôt qu'en fait accompli,
puisque toute la logique de duplication par couche contenu, si elle doit
exister, mérite d'être décidée en connaissance de cause plutôt que résolue en
passant ici.

## 6. Reverse-prompt : prêt à coller (à valider avant tout envoi à un agent)

```
Contexte : brs-site est un site statique généré depuis content/site-content.json
via build/generate.mjs. Règle absolue du projet : ne jamais éditer index.html,
sitemap.xml, llms.txt ou robots.txt à la main, tout passe par le JSON puis
`node build/generate.mjs`.

Objectif de cette tâche : corriger un bug de configuration identifié par audit,
sans toucher au wording ni au design (déjà validés, ne pas réécrire) :

1. Dans content/site-content.json, meta.domain vaut actuellement "https://"
   (pas d'hôte). Le restaurer à la valeur réelle du domaine de production
   (à confirmer : brsconnect.fr, cohérent avec le fichier CNAME à la racine
   de brs-site/). Format attendu : "https://brsconnect.fr" (sans slash final,
   generate.mjs concatène déjà meta.path après).

2. Dans build/validate.mjs, ajouter une vérification qui fait échouer le
   build (exit 1) si :
   - meta.domain est vide, égal à "https://" seul, ou ne matche pas
     /^https:\/\/[a-z0-9.-]+\.[a-z]{2,}$/i
   - une balise <a href=""> ou <a href="#"> existe dans index.html généré,
     sauf les ancres internes valides du type href="#nom-de-section"
     (à whitelister explicitement, pas par défaut)

3. Ne pas toucher : le wording de content/site-content.json (déjà validé,
   sauf si une correction de style spécifique est demandée séparément), la
   structure de templates/index.template.html, les CSS.

Garde-fous (contraintes issues de l'audit) :
- Ne pas introduire de placeholder (pas de faux numéro, pas de fausse date).
- Si la vraie valeur du domaine n'est pas certaine, laisser une valeur vide
  ET faire échouer le validateur explicitement plutôt que de deviner une URL.

Étapes de validation à exécuter et à coller en retour, dans l'ordre :
1. node build/generate.mjs
2. node build/validate.mjs (doit sortir en 0 ET la nouvelle vérification
   de domaine/href doit être visible dans le message de succès, pas juste
   un "Validation OK" générique : lister explicitement les checks passés)
3. grep -n "https:///" index.html sitemap.xml robots.txt (ne doit rien
   retourner)
4. grep -n 'href=""' index.html (ne doit rien retourner, hors whitelist
   d'ancres internes documentée)
5. Proposer un message de commit conventionnel, ex :
   fix(brs-site): restore domain config and harden validator against empty domain/placeholder hrefs
```

Ce prompt ne fait rien seul : il est à relire, ajuster si besoin, puis coller
à l'agent de code de ton choix (Replit Agent / Claude Code) une fois que tu as
tranché sur l'Option A/B/C ci-dessus et confirmé la vraie valeur du domaine.
