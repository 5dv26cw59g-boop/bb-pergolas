# Contexte projet — Site e-commerce B&B Pergolas

Document de passation. Tout ce qui suit vient de décisions déjà prises avec l'utilisateur
dans une conversation précédente — ne pas rouvrir ces points sans raison, juste les
appliquer.

## L'entreprise

**B&B Pergolas** — artisan familial à Cernay (68700), Haut-Rhin, Alsace. Fondé en 2016.
Fabrication 100 % française, spécialiste aluminium sur mesure.

- Téléphone : 06 15 36 75 04 — Email : bbpergolas@hotmail.com
- Site actuel (vitrine, à remplacer) : https://bbpergolas.com
- Produits réels de l'entreprise : pergolas (bioclimatiques et traditionnelles), carports,
  marquises, sas d'entrée, verrières, portails, clôtures, garde-corps
- Garantie annoncée : jusqu'à 20 ans selon les produits

## Objectif du projet

Un site e-commerce **from scratch** qui vend le **matériel uniquement** (pas la pose/
installation) à des particuliers **et** des professionnels, avec **paiement en ligne direct**
(pas un simple formulaire de devis).

La difficulté centrale, demandée explicitement en premier par l'utilisateur : le client
choisit les dimensions de son produit et **voit le prix s'ajuster en temps réel**, avant
paiement.

## Décisions déjà actées (ne pas rediscuter)

- **B2B / B2C** : même prix pour tout le monde. Seul l'affichage change : le professionnel
  voit le prix **HT en premier**, le particulier voit le **TTC en premier**. Pas de remise
  volume pour l'instant.
- **Prix stockés HT en base**, TTC calculé à l'affichage (`HT * (1 + tauxTVA)`).
- **Le calcul de prix doit être recalculé côté serveur avant tout paiement.** Ne jamais
  faire confiance à un prix envoyé par le client — c'est répété plusieurs fois dans la
  conversation d'origine, c'est un point de sécurité non négociable.
- Chaque produit a ses propres contraintes de dimensions (largeur/profondeur min-max,
  parfois une surface max globale) — une config hors limites doit être **refusée**, pas
  juste avertie.
- Chaque matériau a son propre prix au m² **par produit** (pas un prix aluminium global
  partagé entre tous les produits).

## Identité visuelle voulue

Deux registres différents ont été utilisés selon la page, **volontairement** :

1. **Pages vitrine (accueil, catégories)** : identité propre à B&B Pergolas —
   - Couleurs : anthracite `#2A2E29`/`#2B2E2C` (RAL 7016, la teinte alu la plus vendue),
     pierre/stone `#E7E4D9`, vert forêt `#3E4A38` (clin d'œil Vosges/Alsace), rouille
     `#A24E2A` en accent. Volontairement différent du cliché "fond crème + terracotta".
   - Typographie : **Space Grotesk** (titres, technique) + **Source Serif 4** (corps de
     texte, chaleureux/artisanal) — un mélange inversé par rapport à l'habitude pour éviter
     un rendu "généré par IA".
   - Motif récurrent : les **cotes techniques** (lignes de dimension façon plan
     d'architecte) apparaissent en surimpression sur les photos et dans le configurateur —
     logique puisque le sur-mesure est le cœur du métier.

2. **Fiche produit détaillée** (`fiche-produit-bioclimatique.html`) : l'utilisateur a
   explicitement demandé de **reproduire la mise en page de Pergolux**
   (https://pergolux.fr/products/pergola), avec une palette **anthracite / blanc / noir**
   beaucoup plus neutre et "SaaS e-commerce" que le reste du site. C'est un choix assumé et
   différent du reste — ne pas "corriger" vers l'identité artisanale sur cette page sans
   demander.
   - Police : Inter (neutre, volontairement).
   - Structure copiée du modèle Pergolux : galerie photo à gauche, config à droite (sticky),
     swatches couleur, grille de tailles standard (pas de slider continu ici), toggle
     Autoportée/Adossée avec petites icônes SVG, **diagramme de plan cliquable par côté**
     pour ajouter un store vertical (clic sur une zone du schéma = store ajouté sur ce
     côté, prix au mètre linéaire selon la longueur du côté), options confort (LED,
     motorisation, lampe chauffante avec stepper de quantité), panneau de prix sticky,
     bandeau de réassurance, puis onglets : Description / Informations techniques /
     Livraison / Montage / Permis de construire & Réglementation / Garantie.
   - Détail logique important : en mode "Adossée", le côté "haut" du diagramme (qui
     représente le mur) est désactivé — on ne peut pas y mettre de store.

## Photos utilisées

Les photos viennent du vrai site https://bbpergolas.com (hotlinkées pour l'instant,
**à héberger soi-même avant mise en production** — ne pas dépendre de l'ancien site).
Correspondance retenue :
- Pergola bioclimatique (lames orientables) → `l-jour-2.jpeg`, `l-jour.jpeg.webp`,
  `l-nuit.jpeg.webp` (version nuit avec LED)
- Pergola classique (toile rétractable) → `pergolas-toile-retractable-hautrhin-03.jpg`
- Véranda / verrière (vitrage) → `vitre.jpeg.webp`, `vitrre2.jpeg.webp`
- Carport → `CAPING-CARPORT.jpeg.webp`
- Sas d'entrée → `SAS.jpeg.webp`
- Portail → `portail-aluminium-thann-bbpergolas-11.jpg.webp`
- Garde-corps → `gardecorps_bbpergolas_thann.png.webp`

Aucune de ces images n'a été vérifiée visuellement une par une (pas de rendu image direct
disponible pendant la conversation) — à valider avec l'utilisateur si le rendu final ne
correspond pas au bon produit.

## Fichiers déjà produits (prototypes HTML statiques, sans backend)

Tous dans un seul dossier, à ouvrir directement dans un navigateur pour prévisualiser :

1. **`configurateur.html`** — premier prototype du configurateur (toggle Pergola/Véranda,
   sliders largeur/profondeur, matériau, options, dessin SVG schématique avec cotes,
   panneau de prix live). Le modèle de prix (`PRICING`) est en haut du `<script>`.

2. **`catalogue-types.ts`** — **référence du modèle de données**, pas branché sur une UI.
   Types TypeScript : `Produit`, `Materiau`, `ContrainteDimensions`, `OptionProduit`,
   `ConfigurationClient`, `ResultatPrix`. Contient aussi `calculerPrix()`, la fonction de
   calcul de référence à réimplémenter **côté serveur** en production. C'est la structure
   à suivre pour concevoir le vrai schéma de base de données (Prisma/PostgreSQL ou
   équivalent).

3. **`page-produit.html`** — page produit générique **pilotée par les données** : un
   tableau `CATALOGUE` en haut du script contient plusieurs produits (2 pergolas + 1
   véranda), chacun avec ses matériaux/contraintes/options. Un sélecteur permet de changer
   de produit et toute l'UI (sliders, matériaux, options, limites) se met à jour seule.
   Contient une réimplémentation JS de `calculerPrix()` fidèle à celle de
   `catalogue-types.ts`. Gère aussi le toggle Particulier/Professionnel (HT/TTC).

4. **`accueil.html`** — page d'accueil du site vitrine. Hero avec photo + annotation
   technique en surimpression, barre de stats (2016, 100% français, 20 ans garantie),
   section "Trois façons de couvrir votre extérieur" (3 cartes : Pergola Classique /
   Pergola Bioclimatique — mise en avant / Véranda — inspirée de la page collection
   Pergolux mais avec nos vraies gammes), section "Et pour le reste de votre extérieur"
   (carports, portails, sas, garde-corps), section histoire/process en 3 étapes, footer
   avec vraies coordonnées. Les prix "à partir de" affichés sur les 3 cartes sont calculés
   à partir du moteur de prix (pas inventés au hasard).

5. **`fiche-produit-bioclimatique.html`** — fiche produit détaillée pour LA pergola
   bioclimatique spécifiquement (voir section identité visuelle ci-dessus). Contient son
   propre objet `PRODUCT` et sa propre fonction `update()`/calcul de prix, pas encore
   unifiée avec `page-produit.html` ou `catalogue-types.ts` — **à fusionner** dans un vrai
   projet (actuellement 3 implémentations JS différentes du même calcul de prix, ce qui est
   voulu pour prototyper vite mais pas pour la prod).

## État réel : ce qui est prototype vs ce qui manque pour la production

Ce qui existe = des fichiers HTML statiques autonomes, sans build, sans backend, sans base
de données, sans vrai panier, sans paiement. Utile pour valider le design et l'UX avec
l'utilisateur, pas déployable tel quel.

Ce qui manque pour un vrai site :
- Un vrai projet avec build (Next.js suggéré précédemment, mais pas figé)
- Une base de données pour stocker produits/prix/commandes (le schéma
  `catalogue-types.ts` sert de point de départ)
- Le moteur de prix unifié (une seule implémentation, pas trois), exécuté **côté serveur**
- Intégration Stripe pour le paiement, avec recalcul serveur du prix avant création de la
  session de paiement
- Hébergement des images en propre (actuellement hotlinkées vers bbpergolas.com)
- Un vrai panier / gestion de commande

## Prochaines étapes à discuter avec l'utilisateur

Ne pas décider seul, mais ce sont les points ouverts en suspens à la fin de la conversation
d'origine :
- Faut-il que la Véranda ait son propre configurateur/logique séparée, ou rester une 3ᵉ
  entrée dans le même système que les pergolas ? (techniquement déjà prête dans
  `page-produit.html` sous l'id `veranda-panorama`)
- Fusionner les 3 implémentations du moteur de prix en une seule avant d'aller plus loin
- Décider du stack définitif (Next.js + Stripe + DB) et migrer les prototypes HTML vers de
  vrais composants
