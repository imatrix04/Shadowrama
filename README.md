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

Dernière version : **0.13.0** (2026-07-28).

**Savoir ce qu'on installe** — La fenêtre de mise à jour affiche désormais le numéro de version et le détail des changements avant que vous ne décidiez de télécharger.

**Écran « Nouveautés »** — Après une mise à jour, l'application présente ce qui a changé. Si plusieurs versions ont été franchies, elles sont toutes récapitulées.

### Nouveautés
- Bouton « Ignorer cette version » pour écarter durablement une mise à jour.
- Bouton « Rechercher les mises à jour » depuis l'écran Nouveautés.
- Entrée « Nouveautés » sur l'écran d'accueil, pour relire l'historique à tout moment.

### Améliorations
- Les mises à jour sont recherchées périodiquement, et non plus au seul démarrage.
- Le téléchargement ne démarre plus automatiquement : il attend votre accord.

### Corrections
- Le numéro de version et les notes n'atteignaient jamais la fenêtre de mise à jour, qui restait sur un texte générique.
- Le bouton « Télécharger » relançait un téléchargement déjà en cours à votre insu.

Historique complet : [CHANGELOG.md](CHANGELOG.md).
