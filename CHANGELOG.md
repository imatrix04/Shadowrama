# Changelog

<!-- Généré depuis changelog.json par `npm run changelog`. Ne pas éditer à la main. -->

## 0.18.1 — 2026-08-31

### Corrections
- correctif d'import

## 0.18.0 — 2026-09-05

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

## 0.17.1 — 2026-08-31

### Corrections
- correctif d'import

## 0.17.0 — 2026-08-31

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

## 0.16.0 — 2026-08-26

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

## 0.15.0 — 2026-07-30

> **✦ Mode Ultra Design** *(Ultra Design)*
>
> Un interrupteur qui déverrouille les effets visuels avancés et les séquences d'animation composées. Il se coupe et se réactive à tout moment : un projet reste ouvrable dans les deux modes, et rien n'est perdu en repassant en mode simple.

> **✦ Séquences d'animation** *(Ultra Design)*
>
> 22 mouvements répartis en six familles, à l'entrée comme à la sortie. Un mouvement n'est plus une simple transition mais une suite d'étapes — apparaître, dépasser, revenir. Le texte peut s'animer lettre par lettre ou mot par mot.

> **✦ Effets visuels** *(Ultra Design)*
>
> Ombre portée, lueur, dégradé, arrondi par coin, contour de texte, flou, luminosité, saturation, contraste et modes de fusion. Tous cumulables sur un même bloc.

**Transitions entre diapositives** — Quatre transitions classiques disponibles pour tout le monde — fondu, glissement, glissement vertical, zoom — et quatre transitions spectaculaires réservées au mode Ultra Design.

**Blocs plus expressifs** — Rotation et opacité sur les quatre types de blocs, verrouillage des proportions au redimensionnement, alignement vertical du texte, graisse et italique, et trois nouvelles formes.

### Nouveautés
- Rotation et opacité disponibles sur tous les blocs.
- Maj pendant un redimensionnement conserve les proportions.
- Alignement vertical, graisse, italique, interlignage et interlettrage sur les blocs texte et titre.
- Trois nouvelles formes : ligne, étoile et hexagone.
- Onglet Transitions dans la barre latérale droite, pour régler l'apparition de chaque diapositive.
- Aperçu d'une séquence directement dans l'éditeur, sans passer par le mode présentation.

### Améliorations
- Le menu contextuel d'un bloc affiche son nom plutôt que son type technique.
- Le gras des titres est devenu un réglage modifiable au lieu d'être figé.

### Corrections
- Les flèches du clavier déplaçaient le bloc sélectionné pendant la présentation, en plus de changer de diapositive.
- Le champ « Arrondi » était proposé pour toutes les formes mais n'agissait que sur le rectangle et le cercle.
- La bordure des formes anguleuses débordait de leur cadre.
- Le dernier emoji visible sur une diapositive, dans l'emplacement d'image vide, a été remplacé par une icône.

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
