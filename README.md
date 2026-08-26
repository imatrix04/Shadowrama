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

Dernière version : **0.16.0** (2026-08-26).

**Vos images ne disparaissent plus** — Supprimer une image, enregistrer, puis annuler ramenait un cadre vide : l'enregistrement avait effacé l'image de la mémoire de l'application, et l'annulation n'avait plus rien à restituer. Le fichier .shma ne contient toujours que les images réellement utilisées, mais l'annulation retrouve désormais les autres.

**Fini l'écran blanc** — Annuler l'ajout d'une diapositive pouvait interrompre l'éditeur et laisser une fenêtre entièrement vide, sans explication ni retour possible. Ce cas est corrigé, et si une autre erreur survenait, un écran de récupération propose désormais de recharger — votre travail reste dans la sauvegarde automatique.

**Les projets illustrés ne saturent plus** — La sauvegarde automatique tenait dans quelques mégaoctets, vite atteints dès qu'un projet contenait des photos : passé cette limite elle échouait, et l'avertissement « Brouillon non sauvegardé » s'installait dans la barre. Elle repose maintenant sur un stockage sans ce plafond, où les images sont conservées telles quelles au lieu d'être converties en texte — l'ouverture d'un projet illustré est d'autant plus rapide.

### Nouveautés
- Un écran de récupération remplace la fenêtre vide en cas d'erreur inattendue : il explique la situation, propose de recharger l'application et affiche le détail technique.
- Une suite de tests automatisés couvre l'historique d'édition, le presse-papiers, la lecture des fichiers .shma et le cycle de vie des images. Elle est rejouée à chaque modification du code.

### Améliorations
- Déplacer plusieurs blocs à la fois est plus fluide : toute la sélection est repositionnée en une seule opération, au lieu d'une par bloc et soixante fois par seconde.
- Les images circulent et sont enregistrées en binaire plutôt qu'en texte, de l'import jusqu'au fichier .shma : moins de mémoire occupée, et une écriture plus rapide.
- L'application est verrouillée sur son propre contenu : elle refuse toute ressource extérieure, et sa fenêtre ne peut plus être détournée vers une page web. Elle fonctionne, comme avant, entièrement hors ligne.

### Corrections
- Annuler l'ajout d'une diapositive, ou refaire une suppression, pouvait interrompre l'éditeur sur une fenêtre vide.
- Changer le plan d'un bloc (« Mettre au premier plan », « Reculer d'un plan ») ne créait pas d'étape d'annulation distincte : le Ctrl+Z suivant défaisait aussi la modification précédente.
- Ouvrir depuis l'accueil un projet trop volumineux pour le stockage local rouvrait silencieusement le projet précédent, au risque de l'écraser à la première sauvegarde. L'échec est désormais signalé.
- Une image dont le nom ne comporte pas d'extension, ou dont l'extension est en majuscules (« PHOTO.JPG »), n'était pas retrouvée à la réouverture du projet.

Historique complet : [CHANGELOG.md](CHANGELOG.md).
