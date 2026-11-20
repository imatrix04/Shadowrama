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

Dernière version : **1.2.0** (2026-11-19).

**Des panneaux plus clairs et plus intuitifs** — Les panneaux de l'éditeur ont été refaits pour qu'on trouve ce qu'on cherche sans défiler. Effets : une grille d'icônes, un clic active l'effet et affiche ses réglages, un second clic le désactive. Mouvement et Transition : des cartes avec une mini-animation, la durée se règle en secondes et le délai peut aller jusqu'à 10 s. Diapositives : de grandes vignettes avec numéro, actions au survol et repère de glisser-déposer. Clic droit sur un bloc : trois onglets (Contenu, Style, Animation) et une barre d'ordre et de suppression toujours visible.

> **✦ Verre dépoli (glassmorphism)** *(Ultra Design)*
>
> Un nouvel effet floute ce qui se trouve derrière un bloc, avec une teinte translucide et un liseré lumineux. Cinq préréglages (Givré, Cristal, Fumé, Aurore, Liquide), puis des réglages fins : flou, saturation, opacité, liseré, grain de givre, dégradé de teinte et arrondi. Il peut être statique, ou réagir à la souris (reflet qui suit le curseur, inclinaison 3D, flou renforcé au survol) et se doter d'un balayage lumineux automatique.

> **✦ Un mode Ultra Design animé** *(Ultra Design)*
>
> Activer ou désactiver le mode Ultra Design déclenche maintenant une vraie transition : une onde d'énergie part du bouton et balaie la fenêtre, avec anneaux, étincelles et un bandeau de confirmation. À la désactivation, l'onde se résorbe vers le bouton. Les onglets Ultra jaillissent à leur apparition, et les blocs Carrousel et Page web portent un style à part avec une pastille Ultra. Les animations respectent le réglage « réduire les animations » de Windows.

> **✦ Particules : ambiances lisibles et images** *(Ultra Design)*
>
> Les ambiances de particules sont présentées en mini-scènes animées, enfin lisibles quel que soit leur coloris. Les réglages sont rangés par thème (forme et couleurs, mouvement, densité, lumière, liens, souris). Surtout, une image importée peut devenir la particule : un logo, un pictogramme ou une photo qui flottent, tombent ou tourbillonnent, avec en option une teinte aux couleurs choisies.

**Recherche internet pour l'assistant** — Avec Anthropic (Claude), un bouton globe dans la zone de saisie permet à l'assistant de chercher des informations récentes sur internet et de citer ses sources. Chaque recherche est facturée par Anthropic en plus des tokens (environ 0,01 $, 5 au maximum par message) : la fonction est désactivée par défaut et l'infobulle le rappelle. L'assistant peut aussi régler la numérotation des diapositives.

**Une interface aux couleurs de Shadowrama** — Les infobulles, le choix d'une image ou d'une vidéo, l'éditeur de carrousel et la fenêtre d'installation adoptent le thème de l'application, à la place des éléments natifs de Windows.

### Nouveautés
- Effet Verre (glassmorphism) avec cinq préréglages, saturation, liseré, grain, dégradé de teinte, mode réactif à la souris, inclinaison 3D et balayage lumineux automatique ; réglable aussi par l'assistant (mode Ultra Design).
- Particules en image : une image importée sert de particule, avec option de teinte aux couleurs des particules ; elle est enregistrée dans le projet (mode Ultra Design).
- Transition animée à l'activation et à la désactivation du mode Ultra Design, et reflet permanent sur le bouton quand il est actif.
- Recherche internet pour l'assistant (Anthropic), avec les recherches effectuées visibles dans la conversation.
- L'assistant peut régler la numérotation des diapositives.
- Texte en gras dans les réponses de l'assistant (passages entre ** **), et un carré de couleur à côté de chaque code couleur cité (#1a1a2e).
- Infobulles aux couleurs du thème pour toute l'application, avec pointe et placement automatique.
- Installeur Windows aux couleurs de Shadowrama : fond sombre, barre de progression violette, icône de l'application.
- Icônes d'effets, de calques (premier plan, avancer, reculer, arrière-plan), copier, corbeille et plus.
- Zone de choix d'image ou de vidéo avec aperçu, bouton Remplacer et glisser-déposer, pour les blocs image, vidéo et carrousel (plusieurs images d'un coup).
- Repère d'insertion pendant le glisser-déposer des diapositives, indicateurs de transition et de fond sur les vignettes, compteur de diapositives et défilement automatique vers la diapositive active.

### Améliorations
- Panneau Effets : grille d'icônes, interrupteur par effet, point d'état sur les effets actifs et réglages sous la grille.
- Panneaux Mouvement et Transition : une phase à la fois (Entrée, Sortie), familles en pastilles, cartes avec mini-animation, durée en secondes à la place d'un multiplicateur de vitesse, délai jusqu'à 10 s. Changer de style conserve la durée choisie.
- Diapositives : vignettes pleine largeur avec numéro en pastille et actions en icônes au survol.
- Menu du clic droit sur un bloc : onglets Contenu, Style et Animation, curseurs, boutons segmentés pour les choix courts, et barre d'actions fixe pour l'ordre et la suppression ; le dernier onglet utilisé est mémorisé.
- Panneau de l'assistant : ouverture et fermeture animées, ouverture directement sur le dernier message, puissance de réflexion intégrée à la zone de saisie, tokens et avertissement réunis sur une seule ligne.
- Ambiances de particules : mini-scènes animées, réglages regroupés par thème et pictogrammes pour les formes.
- Blocs réservés au mode Ultra (Carrousel, Page web) : bordure dégradée, lueur et pastille Ultra.
- Zone Arrière-plan : mêmes curseurs, interrupteurs et sections repliables que le reste de l'éditeur.

### Corrections
- Ambiances de particules claires (poussière, neige, étoiles) illisibles : du texte blanc sur un dégradé blanc.
- Interlignage plafonné à 1 dans le menu du clic droit, alors que sa valeur par défaut est 1,4.
- Un fichier qui n'est pas une image pouvait être déposé dans un bloc image ; il est maintenant refusé avec un message clair.
- L'assistant s'ouvrait en haut de la conversation au lieu de la fin.

Historique complet : [CHANGELOG.md](CHANGELOG.md).
