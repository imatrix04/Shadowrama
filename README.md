# Shadowrama

Éditeur de diaporamas animés, construit comme une page web plutôt que comme un
fichier figé : blocs libres, mise en page en glisser-déposer, transitions et
animations d'entrée. Application de bureau (Electron + React + Vite).

## Démarrage

```bash
npm install
npm run dev       # mode développement (hot reload)
npm run build     # build de production (renderer + process Electron)
npm run dist      # build + packaging installateur (electron-builder)
```

## Vérifications

```bash
npm test          # tests unitaires (vitest)
npm run check     # types + lint + tests, comme l'intégration continue
```

Les tests couvrent la logique qui ne se voit pas à l'œil : historique
d'édition, presse-papiers, lecture d'un `.shma`, cycle de vie des médias. Ils
tournent sans DOM Electron et s'exécutent en quelques secondes. Le workflow
`.github/workflows/ci.yml` rejoue types, lint, tests et build à chaque
poussée.

## Format de projet

Un projet Shadowrama est un fichier `.shma` : une archive zip contenant
`manifest.json` (diapositives et blocs) et un dossier `media/` (images
embarquées en base64).

## Changelog

Dernière version : **0.19.0** (2026-09-09).

> **✦ Particules** *(Ultra Design)*
>
> Un champ de particules animé se pose derrière n'importe quel fond de diapositive. Quantité, vitesse, taille, couleurs, halo, style de particule, trajectoire, liens entre particules, réaction au curseur : tout se règle depuis l'onglet Arrière-plan. Huit ambiances prêtes à l'emploi (Poussière, Constellation, Neige, Bulles, Braises, Confettis, Nébuleuse, Étoiles) pour partir d'une base et l'ajuster.

> **✦ Carrousel** *(Ultra Design)*
>
> Nouveau type de bloc : plusieurs images qui défilent, à la main avec les flèches et les puces, ou toutes seules. Huit animations au choix, du défilement horizontal ou vertical au retournement 3D. Chaque vue se règle exactement comme un bloc image — cadrage, arrondi, forme personnalisée — et peut porter sa propre légende.

### Nouveautés
- Particules animées en arrière-plan de diapositive, réglables indépendamment du type de fond (couleur, dégradé ou image).
- Huit styles de particules : Point, Halo, Carré, Triangle, Étoile, Anneau, Trait, Croix.
- Sept trajectoires : Dérive, Flux dirigé, Montée, Chute, Tourbillon, Ondulation, Pulsation.
- Réglages fins des particules : quantité, vitesse, taille et variation de taille, opacité, halo, jusqu'à quatre couleurs tirées au sort.
- Réaction au curseur : repousser, attirer, grossir ou relier les particules, avec rayon d'influence et force réglables.
- Liens entre particules proches (effet constellation), avec portée, épaisseur et couleur au choix.
- Options de rendu des particules : fusion additive, scintillement, rotation des formes.
- Huit ambiances de particules prêtes à l'emploi : Poussière, Constellation, Neige, Bulles, Braises, Confettis, Nébuleuse, Étoiles.
- Nouveau bloc Carrousel : plusieurs images qui défilent manuellement (flèches et puces) ou automatiquement.
- Huit animations de carrousel : défilement horizontal et vertical dans les deux sens, fondu, zoom, retournement, empilement — avec durée et courbe réglables.
- Chaque vue d'un carrousel se règle comme un bloc image : image, description, cadrage, arrondi, forme personnalisée, plus une légende en surimpression.
- Réglages du carrousel : intervalle de défilement, boucle, pause au survol, affichage des flèches et des puces, couleur des commandes, arrondi et fond du cadre, zoom lent (Ken Burns).
- Import de plusieurs images d'un coup dans un carrousel, et réorganisation des vues par monter / descendre.

### Améliorations
- Le rendu d'une image — cadrage, arrondi, découpe en forme personnalisée — est désormais partagé entre le bloc image et les vues du carrousel : un réglage ajouté à l'un profite à l'autre.
- Les blocs réservés au mode Ultra Design n'apparaissent plus dans la palette quand il est coupé ; un bloc déjà posé reste dans le projet et s'affiche en version statique.
- Les images d'un carrousel sont prises en compte au nettoyage des médias à l'enregistrement, comme celles des blocs image et des fonds.

Historique complet : [CHANGELOG.md](CHANGELOG.md).
