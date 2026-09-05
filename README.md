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

Dernière version : **0.18.0** (2026-09-05).

**Mouvement** — Le panneau Animations disparaît : ses effets rejoignent Mouvement, qui distingue maintenant Classiques (actifs même hors mode Ultra Design) et Ultra, entrée comme sortie. Chaque effet a sa mini-scène animée en boucle pour voir ce qu'il fait sans avoir à l'essayer sur un bloc.

**Forme personnalisée** — L'ancienne grille pixel art 10×10 laisse place à un tracé par polygone : arêtes droites et coins arrondis, pour les blocs forme comme pour le découpage d'image.

**Paramètres** — Nouvelle page avec sélecteur de thème clair, sombre ou système, et une transition en cercle animée au changement.

### Nouveautés
- Panneau Mouvement : les presets Classiques (Fondu, Glisse gauche/droite, Depuis le bas, Zoom) restent actifs même hors mode Ultra Design.
- Animations de sortie classiques (Fondu, Glisse gauche/droite, Descend et disparaît, Zoom arrière), disponibles hors mode Ultra Design.
- Mini-scène animée en boucle pour chaque mouvement du panneau Mouvement, entrée comme sortie, Classique comme Ultra.
- Éditeur de forme personnalisée par polygone (arêtes droites, coins arrondis) pour les blocs forme et image, en remplacement de la grille pixel art 10×10.
- Page Paramètres avec sélecteur de thème clair / sombre / système et transition en cercle animée entre les deux.
- Distinction visuelle du mode Ultra Design partout où il apparaît (onglets, transitions, mouvements), avec le même dégradé et halo que le bouton Ultra Design de la barre d'outils.
- Glisser dans un panneau latéral (Mouvement, Blocs, Effets) fait défiler son contenu, comme au clic sur la molette.

### Améliorations
- Réglage de vitesse des transitions et des mouvements : curseur restylé, valeur affichée en direct, pas plus fin (0,25 → 0,05).
- Refonte visuelle du panneau Mouvement : cartes distinctes pour Entrée et Sortie, badges Classiques/Ultra, bouton de lecture, apparition en cascade à l'ouverture.

### Corrections
- La duplication d'une diapositive ne copiait pas son fond animé (dégradé, image) ni sa transition.
- Les titres (h1/h2) suivaient le thème du système d'exploitation au lieu du thème choisi dans l'application, illisibles en thème clair sur un OS en sombre.
- Couper le mode Ultra Design neutralisait aussi les mouvements Classiques du panneau Mouvement, qui doivent pourtant rester actifs sans lui.
- Les cartes du panneau Mouvement pouvaient déborder de leur cadre.
- Certains panneaux latéraux ne défilaient plus une fois leur contenu plus long que la fenêtre visible.

Historique complet : [CHANGELOG.md](CHANGELOG.md).
