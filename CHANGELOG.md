# Changelog

<!-- Généré depuis changelog.json par `npm run changelog`. Ne pas éditer à la main. -->

## 0.14.0 — 2026-07-30

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

## 0.13.1 — 2026-07-28

### Corrections
- Le texte des notes de version n'était pas affiché dans la fenêtre de mise à jour, qui restait sur un texte générique.

## 0.13.0 — 2026-07-28

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

## 0.12.2 — 2026-07-28

### Améliorations
- Mise à jour des dépendances et du script de publication.

## 0.12.1 — 2026-07-28

### Améliorations
- Ajout d'un README décrivant le projet, le format .shma et l'historique des versions.

## 0.12.0 — 2026-07-28

**Réglages d'animation** — La durée, le délai et la courbe d'accélération sont désormais modifiables bloc par bloc. Le délai permet de faire apparaître les blocs d'une diapositive en cascade.

**Projets récents** — L'écran d'accueil propose d'ouvrir un projet et liste les derniers projets utilisés.

**Magnétisme au redimensionnement** — Les bords que vous tirez s'alignent sur les autres blocs et sur la diapositive, comme c'était déjà le cas au déplacement.

### Nouveautés
- Cadrage des images : remplir (rogne), contenir ou étirer.
- Boutons Annuler / Rétablir dans la barre du haut, désactivés quand il n'y a rien à annuler.
- Ctrl+D duplique la sélection, Ctrl+A sélectionne tous les blocs de la diapositive.
- Le contenu d'un bloc texte est éditable depuis le menu contextuel, en plus du double-clic.

### Améliorations
- Le bouton ↺ ajuste et centre la diapositive au lieu de revenir à 100 % dans le coin ; la vue s'ouvre également ajustée.
- Ctrl+molette zoome, la molette seule fait défiler et Maj+molette défile horizontalement.
- La hauteur d'un bloc texte s'ajuste au contenu en fin de saisie au lieu de laisser le texte déborder.
- Les boîtes de dialogue du navigateur sont remplacées par un dialogue intégré à la charte graphique.

### Corrections
- Les champs éditables d'un bloc étaient recopiés dans le fichier .shma au lieu d'être résolus depuis son type : un projet enregistré restait figé sur l'ancienne liste de champs et ne voyait jamais ceux ajoutés ensuite.
- L'ouverture d'un .shma ne validait rien : un fichier corrompu provoquait un plantage. Le contenu est vérifié, les blocs de type inconnu sont ignorés et l'erreur affichée est explicite.
- L'échec de la sauvegarde automatique du brouillon (stockage saturé) faisait tomber l'éditeur ; il est maintenant signalé sans interrompre le travail.
- Les boutons + / − du zoom pouvaient rester bloqués sur une valeur périmée lors de clics rapprochés.

## 0.11.0 — 2026-07-27

**Annuler enfin fiable** — Un déplacement ou un redimensionnement s'annule d'un seul Ctrl+Z, et restaure bien la position d'origine.

**Les images ne disparaissent plus** — Les images importées sont conservées d'une session à l'autre au lieu d'être perdues au redémarrage.

### Améliorations
- Suppression de composants obsolètes et fusion des blocs Texte et Titre, devenus quasiment identiques.

### Corrections
- Le déplacement et le redimensionnement des blocs suivaient la souris à la mauvaise vitesse dès que le zoom n'était pas à 100 %.
- Le redimensionnement n'était pas enregistré dans l'historique et ne pouvait donc pas être annulé.
- Les médias supprimés restaient dans le fichier .shma, qui grossissait à chaque sauvegarde.
- Les identifiants de blocs pouvaient entrer en collision lors d'ajouts rapprochés.
- La sauvegarde automatique réécrivait tout le projet à chaque image pendant un glisser-déposer, provoquant des saccades.
- Les polices étaient chargées depuis le réseau et n'apparaissaient donc pas dans l'application packagée hors ligne.
- Le build de production ne compilait plus.
