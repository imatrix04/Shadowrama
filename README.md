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

Dernière version : **0.20.0** (2026-10-12).

**Import PowerPoint** — Ouvrez un fichier .pptx (ou une présentation Google Slides exportée en .pptx) directement dans Shadowrama, depuis l'accueil ou la barre du haut. Textes, images, formes, fonds, groupes et transitions sont convertis en blocs modifiables, avec la mise en page du fichier d'origine. Un bilan clair liste ce qui a été approché ou ignoré.

**Bloc Vidéo** — Importez une vidéo (MP4, WebM, MOV…) dans une diapositive. Elle se cadre, s'arrondit et se découpe en forme libre comme une image, et reçoit les mêmes animations et effets, en mode simple comme en Ultra Design. Lecture automatique à l'arrivée de la diapo, boucle, début et fin réglables, vitesse, volume et commandes de lecture au choix.

> **✦ Bloc Page web** *(Ultra Design)*
>
> Affichez n'importe quelle page web dans une diapositive en tapant son adresse (localhost:3000, youtube.com…). On y navigue, on clique et on écrit dedans, aussi bien dans l'éditeur qu'en présentation. Les connexions aux sites sont conservées d'une séance à l'autre.

**Numérotation des diapositives** — Numérotez automatiquement toutes les diapositives depuis le nouvel onglet Numérotation : format, position, taille, opacité, couleur et début au choix. En mode Ultra Design, le numéro peut aussi s'animer (compteur, entrées prédéfinies ou mouvement personnalisé).

### Nouveautés
- Import de présentations PowerPoint (.pptx) depuis l'accueil et depuis l'éditeur, avec bilan d'import.
- L'import reprend les textes (taille, couleur, gras, italique, alignement, interligne, puces), les images (rognées, arrondies), les formes simples et personnalisées, les groupes, les fonds (couleur, dégradé, image), les décors des masques et les transitions.
- Les mises en page, masques et thèmes du fichier PowerPoint sont résolus pour retrouver les bonnes couleurs et positions, quel que soit le format de diapositive.
- Nouveau bloc Vidéo (MP4, WebM, MOV…), disponible sans mode Ultra Design, avec le même cadrage, arrondi, forme personnalisée, animations et effets que le bloc Image.
- Réglages de lecture de la vidéo : lecture automatique, boucle, sans le son, volume, vitesse (×0,25 à ×4), début et fin, commandes de lecture en présentation.
- Bouton Aperçu au survol d'un bloc Vidéo pour tester la lecture directement dans l'éditeur.
- Le bloc Vidéo prend automatiquement le rapport largeur/hauteur de la vidéo importée (taille maximale : 300 Mo).
- Nouveau bloc Page web (mode Ultra Design) : navigation complète, barre précédent/suivant/recharger/adresse, page de départ épinglable, message clair quand la page est injoignable.
- Numérotation automatique des diapositives : formats 3, 03, 3 / 12 et III, six positions, taille, opacité, gras, couleur automatique ou choisie, numéro de départ, masquage sur la première diapositive.
- Animation du numéro de diapositive, en mode Ultra Design : compteur, presets d'entrée ou mouvement personnalisé.

### Améliorations
- Le bilan d'import PowerPoint s'affiche dans une fenêtre à hauteur limitée dont la liste défile, dans le style de la fenêtre Nouveautés, au lieu de remplir toute la page.
- Les remarques d'import identiques sont regroupées : un message n'apparaît qu'une fois, suivi des diapositives concernées (ex. « Diapos 1-6, 8-11 · 18 »).
- L'enregistrement d'un projet ne recompresse plus les vidéos, qui sont déjà compressées : sauvegarde plus rapide.
- Le cadrage et l'arrondi des images et des vidéos partagent désormais le même code et les mêmes réglages.

### Corrections
- réglage fond clair et sombre du texte dans le bloc Titre
- particules en arrières plan de diapositives qui faisait paraître un effet de bug lors des transitions
- certaines écritures rester en blanc en thème clair ce qui les rendaientt illisibles
- les boutons arrières plan, premier plan fermer l'interface de modifications à chaque fois ce qui gêner et faisait perdre du temps inutilement

Historique complet : [CHANGELOG.md](CHANGELOG.md).
