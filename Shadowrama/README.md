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

## Format de projet

Un projet Shadowrama est un fichier `.shma` : une archive zip contenant
`manifest.json` (diapositives et blocs) et un dossier `media/` (images
embarquées en base64).

## Changelog

### v0.11.0

Passe de correctifs sur l'éditeur, à la suite d'un audit du code existant.

**Corrections**
- Le build de production (`tsc -b`) ne compilait plus à cause d'imports morts
  (`Sidebar`, `AnimationsSidebar` non utilisés dans `Editor.tsx`) — corrigé.
- **Annuler/Rétablir (Ctrl+Z)** ne restaurait pas la position d'un bloc après
  un déplacement ou un redimensionnement : l'historique capturait l'état
  final du geste au lieu de l'état initial. Le redimensionnement n'avait
  d'ailleurs aucun historique du tout. Réécrit autour d'un modèle de « geste »
  (une entrée d'historique par glisser, resize ou saisie de texte, quel que
  soit le nombre de mises à jour intermédiaires).
- **Déplacement et redimensionnement des blocs à un zoom différent de 100 %**
  suivaient la souris à la mauvaise vitesse (deux fois trop vite à 50 %,
  deux fois trop lentement à 200 %) : les deltas souris n'étaient pas ramenés
  en coordonnées canvas.
- Les boutons **+ / − du zoom** pouvaient rester bloqués sur une valeur
  périmée lors de clics rapprochés.
- **Les images disparaissaient au redémarrage de l'application** : le cache
  des médias importés n'existait qu'en mémoire et n'était jamais persisté.
  Les images sont maintenant sauvegardées dans IndexedDB et rechargées au
  démarrage de l'éditeur.
- **Les médias supprimés restaient dans le fichier `.shma`** indéfiniment,
  faisant grossir le fichier à chaque sauvegarde. Un nettoyage supprime
  désormais les médias qu'aucun bloc ne référence plus avant chaque
  enregistrement.
- Les identifiants de blocs et de diapositives (basés sur `Date.now()`)
  pouvaient entrer en collision lors d'ajouts rapprochés — remplacés par un
  générateur d'identifiants monotone.
- L'autosauvegarde du brouillon réécrivait tout le projet dans le
  `localStorage` à chaque frame pendant un glisser-déposer, provoquant des
  saccades ; elle est désormais différée (debounce).
- Plusieurs violations des règles React (écriture de refs pendant le rendu)
  pouvaient provoquer un rendu incohérent en mode concurrent — corrigées.
- Les polices (Google Fonts) étaient chargées par le réseau, ce qui les
  rendait invisibles dans l'application packagée hors ligne — elles sont
  maintenant embarquées dans le build.

**Nettoyage**
- Suppression de composants obsolètes et non utilisés (`Sidebar`,
  `AnimationsSidebar`, `PropertiesPanel`), remplacés depuis par
  `LeftSidebars` et le menu contextuel des blocs.
- `TextBlock` et `TitleBlock`, quasiment identiques, fusionnés en une seule
  fabrique de composant paramétrée.
- Déclaration dupliquée du type `BaseBlockData` et des types `Window`
  regroupées en un seul endroit chacune.
- Logs de débogage retirés du chargement de projet.
