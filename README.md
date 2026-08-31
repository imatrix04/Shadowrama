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

Dernière version : **0.17.0** (2026-08-31).

**Fond de diapositive** — Couleur unie, dégradé (statique ou animé en boucle), image importée, avec une superposition réglable pour garder le texte lisible. Un nouvel onglet « Arrière-plan » le règle diapositive par diapositive.

**Grille personnalisée 10×10** — Dessinez la silhouette d'un bloc forme à la main, ou découpez une image dans cette même forme. Six presets de base (Cœur, Étoile, Diamant, Croix, Cercle, Éclair) pour démarrer sans tout dessiner soi-même.

**Flottement** — Nouvel effet du mode Ultra Design dans le panneau Effets, disponible sur tous les types de blocs : flotte doucement en boucle et s'élève au survol de la souris.

### Nouveautés
- Fond de diapositive : couleur, dégradé animé, image et superposition, réglables par diapositive.
- Effet « Flottement » (Ultra Design) applicable à tous les types de blocs.
- Grille personnalisée 10×10 pour les blocs forme et image, avec six presets de base.
- Le menu contextuel affiche « Niveau X / Y » dans la section Ordre, et désactive les boutons déjà à l'extrémité de l'empilement.

### Corrections
- Les blocs à entrée retardée restaient visibles pendant tout le délai avant de sauter à leur état caché, au lieu d'être cachés dès le montage.
- Revenir en arrière pendant une présentation attendait la fin de l'animation de sortie de la diapositive courante ; le retour est désormais instantané.
- Un menu déroulant ouvert près du bas de l'écran, à l'intérieur du menu contextuel, pouvait sortir de la fenêtre au lieu de s'ouvrir vers le haut.
- Interagir avec le menu contextuel (glisser dans un champ, sélectionner du texte) pouvait faire bouger le bloc sélectionné en dessous.
- Le fond et la transition d'une diapositive n'étaient pas conservés à la réouverture du projet, ni après un redémarrage sans sauvegarde.
- Cliquer sur « Avancer » / « Reculer » dans le menu contextuel fermait le menu, obligeant à le rouvrir pour continuer.

Historique complet : [CHANGELOG.md](CHANGELOG.md).
