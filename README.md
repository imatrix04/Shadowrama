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

Dernière version : **1.0.0** (2026-11-17).

**Export PowerPoint** — Exportez votre présentation en fichier .pptx depuis la barre du haut, pour l'ouvrir dans PowerPoint ou Google Slides. Textes, images, formes, fonds et vidéos sont convertis ; ce qui ne peut pas être reproduit fidèlement (effets, pages web…) est capturé en image.

**Nouvelle interface et nouveaux thèmes** — L'éditeur a été entièrement repensé : barre du haut, panneaux latéraux, menus et fenêtres plus sobres et plus professionnels, avec une interface plus fluide. Choisissez parmi trois palettes dans Paramètres : Nuit encre, Graphite néon et Chaud / crème, en thème clair comme sombre.

**Sélecteur de couleurs** — Un nouveau sélecteur de couleurs remplace les anciens champs : palette harmonisée avec le thème, couleurs du projet, favoris enregistrés d'un projet à l'autre et saisie précise des valeurs.

**Outils d'alignement** — Alignez, centrez et répartissez vos blocs depuis un nouveau panneau, sur la sélection ou sur la diapositive. Au glissé, les blocs s'aimantent aux bords et aux centres des autres (Alt pour désactiver). Fonctionnalité bêta, à activer dans Paramètres → Fonctionnalités.

### Nouveautés
- Export de la présentation au format PowerPoint (.pptx), avec choix de l'emplacement du fichier.
- Les éléments non convertibles en objets PowerPoint (effets, pages web) sont exportés sous forme d'image.
- Trois palettes de couleurs au choix dans Paramètres : Nuit encre, Graphite néon et Chaud / crème.
- Nouveau fond d'écran low-poly, adapté au thème clair et au thème sombre.
- Nouveau sélecteur de couleurs avec couleurs du projet et favoris conservés d'un projet à l'autre.
- Panneau d'alignement : aligner à gauche, à droite, en haut, en bas, centrer, répartir horizontalement ou verticalement, sur la sélection ou sur la diapositive.
- Magnétisme au glissé : les blocs s'aimantent aux bords et aux centres des autres blocs, Alt pour placer sans magnétisme.
- Fonctionnalités bêta activables dans Paramètres → Fonctionnalités (outils d'alignement).
- Nouveau menu déroulant réutilisable dans la barre du haut.

### Améliorations
- Interface de l'éditeur entièrement refondue : barre du haut, panneaux, menu contextuel, tiroirs, fenêtres Nouveautés et bilan d'import, listes déroulantes, interrupteurs et pages de Paramètres.
- Les panneaux Arrière-plan, Numérotation et Effets reprennent les mêmes contrôles pour plus de cohérence.
- Les nouvelles formes sont créées avec une couleur de remplissage et de bordure adaptée au fond de la diapositive.
- Meilleure lisibilité automatique du texte selon le fond (calcul du contraste revu).
- Le code d'import PowerPoint a été réorganisé en modules plus petits, sans changement de comportement.
- Les fichiers importés (images, vidéos) sont conservés sous forme de Blob : une vidéo de 300 Mo n'occupe plus deux fois sa taille en mémoire, et les gros projets se chargent plus légèrement.
- Les médias qui ne sont plus utilisés sont nettoyés au démarrage de l'éditeur au lieu de s'accumuler d'une séance à l'autre.

### Corrections
- deux fichiers importés dans la même milliseconde (sélection multiple d'un carrousel) pouvaient recevoir la même clé : le second écrasait le premier
- remplacer un média sous la même clé gardait l'ancienne version en mémoire
- couleurs par défaut des formes parfois peu visibles selon le fond ou le thème

Historique complet : [CHANGELOG.md](CHANGELOG.md).
