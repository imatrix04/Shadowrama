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

Dernière version : **1.3.0** (2026-11-25).

**Bloc Tableau** — Un nouveau bloc pour présenter des données en lignes et en colonnes, jusqu'à 30 lignes × 12 colonnes. Collez un tableau copié depuis Excel ou Google Sheets dans une cellule et la grille se remplit d'elle-même ; un fichier CSV s'importe et s'exporte en un clic. Ligne d'en-tête, lignes alternées, couleurs, bordures et alignement se règlent au clic droit. Le tableau s'exporte en vrai tableau PowerPoint, et les tableaux des fichiers PowerPoint importés sont repris.

**Bloc Graphique (bêta)** — Colonnes, barres, courbe, aire, camembert ou anneau, qui s'animent à l'apparition : durée, délai, style (doux, rebond, linéaire) et apparition donnée par donnée. Les données (jusqu'à 24) se saisissent dans une liste avec nom, valeur et couleur, avec une unité au choix (%, k€…). Il ne demande pas le mode Ultra Design. Le bloc est en bêta : activez-le dans Paramètres → Fonctionnalités. L'assistant IA sait aussi créer des graphiques et des tableaux.

**Des polices pour le texte** — Les blocs texte, titre, tableau et graphique peuvent maintenant changer de police, parmi quinze polices rangées en quatre familles : Sobre (Inter, Montserrat, Lato, Merriweather, IBM Plex Mono), Créatif (Bricolage Grotesque, Space Grotesk, Playfair Display, Oswald, Bebas Neue), Manuscrit (Caveat, Dancing Script, Pacifico, Permanent Marker) et Ancien (IM Fell English). Chaque police s'affiche dans sa propre écriture dans la liste. Elles sont embarquées dans l'application : le rendu est le même sur tous les ordinateurs, et la police est conservée à l'export et à l'import PowerPoint.

**Diaporama automatique** — Choisissez dans la barre du haut entre un diaporama manuel (clic, flèches) et un diaporama automatique qui enchaîne les diapositives en boucle. Chaque diapositive a sa propre durée d'affichage (10 s par défaut, de 1 s à 1 h), réglable dans le nouvel onglet Durée. En mode automatique, les vidéos démarrent seules et les carrousels défilent d'eux-mêmes. La barre de commandes de la présentation devient une pastille discrète qui n'apparaît qu'au survol du bas de l'écran.

**Palette « Plan d'architecte »** — Une nouvelle palette d'interface façon papier ancien et crayon : écriture d'imprimerie ancienne, angles presque droits, accents hachurés, séparations en pointillé et quadrillage de calque en fond. En thème sombre, papier au fusain et traits à la craie crème.

**Une section Blocs repensée** — Les blocs sont rangés par catégorie (Texte, Médias, Données, Formes & web), chacun avec une petite illustration et une ligne qui dit à quoi il sert. Un champ de recherche trouve un bloc par son nom ou un mot-clé, sans tenir compte des accents ; Entrée ajoute le premier résultat. Shadowrama a aussi une nouvelle icône.

### Nouveautés
- Bloc Tableau : saisie dans une grille, collage depuis Excel ou Sheets, import et export CSV, ligne d'en-tête, lignes alternées, couleurs et bordures réglables.
- Export des tableaux en tableaux PowerPoint natifs, et import des tableaux d'un fichier PowerPoint (les cellules fusionnées et les styles de tableau du thème ne sont pas repris, ce qui est signalé).
- Bloc Graphique (bêta, à activer dans Paramètres → Fonctionnalités) : six types de graphiques animés, palette de couleurs ou couleur unique, étiquettes, valeurs, quadrillage, légende, courbe lissée, épaisseur de l'anneau.
- Graphiques exportés en image dans PowerPoint, dans leur état final.
- L'assistant IA peut créer des tableaux (liste de lignes ou texte CSV) et des graphiques, et choisir la police des blocs texte, titre, tableau et graphique ; il ne propose le bloc Graphique que si la fonctionnalité est activée.
- Choix de la police pour les blocs texte, titre, tableau et graphique, parmi quinze polices embarquées réparties en Sobre, Créatif, Manuscrit et Ancien.
- Diaporama automatique en boucle, avec une durée d'affichage par diapositive (onglet Durée, préréglages de 5 s à 2 min) ; le mode choisi est mémorisé.
- Palette d'interface « Plan d'architecte », en thème clair et sombre.
- Recherche dans la section Blocs, insensible aux accents.
- Nouvelle icône de l'application.

### Améliorations
- Section Blocs : cartes illustrées rangées par catégorie, avec une accroche sous chaque nom.
- Barre de commandes de la présentation : pastille flottante en verre fumé avec des icônes, qui n'apparaît qu'au survol du bas de l'écran.
- En diaporama automatique, les vidéos démarrent seules et bouclent sans commandes, et les carrousels défilent même hors mode Ultra Design.
- Import PowerPoint : les polices du fichier sont conservées si elles font partie du catalogue, sinon remplacées par la plus proche (avec ou sans empattement, manuscrite, à chasse fixe).
- Les notes de mise à jour affichées avant l'installation sont mises en forme (titres, listes, gras, italique) et la fenêtre n'est plus transparente.

### Corrections
- La barre de commandes de la présentation masquait le bas de la diapositive.
- Ouvrir Shadowrama une seconde fois provoquait des erreurs de cache (« Accès refusé ») : la fenêtre déjà ouverte est maintenant remise au premier plan.

Historique complet : [CHANGELOG.md](CHANGELOG.md).
