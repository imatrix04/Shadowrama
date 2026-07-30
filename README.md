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

Dernière version : **0.14.0** (2026-07-30).

**Barre latérale plus vive** — Les panneaux Blocs et Animations s'ouvrent près de deux fois plus vite, indiquent lequel est actif, et leur contenu apparaît progressivement au lieu de surgir d'un bloc.

**Le panneau Animations vous répond** — Il signale l'animation appliquée au bloc sélectionné et explique quoi faire quand aucun bloc ne l'est. Jusqu'ici, cliquer sans sélection restait sans effet et sans explication.

**Des icônes dessinées** — Les emoji laissent place à un jeu d'icônes cohérent, identique quel que soit votre système : barre latérale, barre du haut et menu contextuel.

### Nouveautés
- L'onglet ouvert est mis en évidence dans la barre latérale.
- L'animation appliquée à la sélection est cochée dans la liste.
- Un message indique quoi faire lorsque aucun bloc n'est sélectionné.
- Les infobulles précisent l'action et le nombre de blocs concernés.

### Améliorations
- Les panneaux latéraux s'ouvrent et se ferment plus vite, et leur contenu s'estompe au lieu de disparaître d'un coup.
- Le menu contextuel affiche le nom du bloc (« Image ») au lieu de son type technique (« image »).
- Le réglage système « réduire les animations » est respecté : les transitions sont alors supprimées.
- Les deux panneaux latéraux reposent désormais sur un composant commun, et les couleurs de l'interface sont unifiées — deux violets d'accent différents cohabitaient jusqu'ici.

### Corrections
- À l'ouverture de l'éditeur, la vue était calée sur le coin haut-gauche de la diapositive au lieu d'être centrée dessus.
- La diapositive n'était pas recadrée après l'agrandissement de la fenêtre : le cadrage restait calculé pour la taille précédente.
- Le bouton d'ouverture de la barre latérale déclarait un état « ouvert » qui n'avait aucun effet.

Historique complet : [CHANGELOG.md](CHANGELOG.md).
