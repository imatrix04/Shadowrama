# Changelog

<!-- Généré depuis changelog.json par `npm run changelog`. Ne pas éditer à la main. -->

## 1.3.0 — 2026-11-25

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

## 1.2.0 — 2026-11-19

**Des panneaux plus clairs et plus intuitifs** — Les panneaux de l'éditeur ont été refaits pour qu'on trouve ce qu'on cherche sans défiler. Effets : une grille d'icônes, un clic active l'effet et affiche ses réglages, un second clic le désactive. Mouvement et Transition : des cartes avec une mini-animation, la durée se règle en secondes et le délai peut aller jusqu'à 10 s. Diapositives : de grandes vignettes avec numéro, actions au survol et repère de glisser-déposer. Clic droit sur un bloc : trois onglets (Contenu, Style, Animation) et une barre d'ordre et de suppression toujours visible.

> **✦ Verre dépoli (glassmorphism)** *(Ultra Design)*
>
> Un nouvel effet floute ce qui se trouve derrière un bloc, avec une teinte translucide et un liseré lumineux. Cinq préréglages (Givré, Cristal, Fumé, Aurore, Liquide), puis des réglages fins : flou, saturation, opacité, liseré, grain de givre, dégradé de teinte et arrondi. Il peut être statique, ou réagir à la souris (reflet qui suit le curseur, inclinaison 3D, flou renforcé au survol) et se doter d'un balayage lumineux automatique.

> **✦ Un mode Ultra Design animé** *(Ultra Design)*
>
> Activer ou désactiver le mode Ultra Design déclenche maintenant une vraie transition : une onde d'énergie part du bouton et balaie la fenêtre, avec anneaux, étincelles et un bandeau de confirmation. À la désactivation, l'onde se résorbe vers le bouton. Les onglets Ultra jaillissent à leur apparition, et les blocs Carrousel et Page web portent un style à part avec une pastille Ultra. Les animations respectent le réglage « réduire les animations » de Windows.

> **✦ Particules : ambiances lisibles et images** *(Ultra Design)*
>
> Les ambiances de particules sont présentées en mini-scènes animées, enfin lisibles quel que soit leur coloris. Les réglages sont rangés par thème (forme et couleurs, mouvement, densité, lumière, liens, souris). Surtout, une image importée peut devenir la particule : un logo, un pictogramme ou une photo qui flottent, tombent ou tourbillonnent, avec en option une teinte aux couleurs choisies.

**Recherche internet pour l'assistant** — Avec Anthropic (Claude), un bouton globe dans la zone de saisie permet à l'assistant de chercher des informations récentes sur internet et de citer ses sources. Chaque recherche est facturée par Anthropic en plus des tokens (environ 0,01 $, 5 au maximum par message) : la fonction est désactivée par défaut et l'infobulle le rappelle. L'assistant peut aussi régler la numérotation des diapositives.

**Une interface aux couleurs de Shadowrama** — Les infobulles, le choix d'une image ou d'une vidéo, l'éditeur de carrousel et la fenêtre d'installation adoptent le thème de l'application, à la place des éléments natifs de Windows.

### Nouveautés
- Effet Verre (glassmorphism) avec cinq préréglages, saturation, liseré, grain, dégradé de teinte, mode réactif à la souris, inclinaison 3D et balayage lumineux automatique ; réglable aussi par l'assistant (mode Ultra Design).
- Particules en image : une image importée sert de particule, avec option de teinte aux couleurs des particules ; elle est enregistrée dans le projet (mode Ultra Design).
- Transition animée à l'activation et à la désactivation du mode Ultra Design, et reflet permanent sur le bouton quand il est actif.
- Recherche internet pour l'assistant (Anthropic), avec les recherches effectuées visibles dans la conversation.
- L'assistant peut régler la numérotation des diapositives.
- Texte en gras dans les réponses de l'assistant (passages entre ** **), et un carré de couleur à côté de chaque code couleur cité (#1a1a2e).
- Infobulles aux couleurs du thème pour toute l'application, avec pointe et placement automatique.
- Installeur Windows aux couleurs de Shadowrama : fond sombre, barre de progression violette, icône de l'application.
- Icônes d'effets, de calques (premier plan, avancer, reculer, arrière-plan), copier, corbeille et plus.
- Zone de choix d'image ou de vidéo avec aperçu, bouton Remplacer et glisser-déposer, pour les blocs image, vidéo et carrousel (plusieurs images d'un coup).
- Repère d'insertion pendant le glisser-déposer des diapositives, indicateurs de transition et de fond sur les vignettes, compteur de diapositives et défilement automatique vers la diapositive active.

### Améliorations
- Panneau Effets : grille d'icônes, interrupteur par effet, point d'état sur les effets actifs et réglages sous la grille.
- Panneaux Mouvement et Transition : une phase à la fois (Entrée, Sortie), familles en pastilles, cartes avec mini-animation, durée en secondes à la place d'un multiplicateur de vitesse, délai jusqu'à 10 s. Changer de style conserve la durée choisie.
- Diapositives : vignettes pleine largeur avec numéro en pastille et actions en icônes au survol.
- Menu du clic droit sur un bloc : onglets Contenu, Style et Animation, curseurs, boutons segmentés pour les choix courts, et barre d'actions fixe pour l'ordre et la suppression ; le dernier onglet utilisé est mémorisé.
- Panneau de l'assistant : ouverture et fermeture animées, ouverture directement sur le dernier message, puissance de réflexion intégrée à la zone de saisie, tokens et avertissement réunis sur une seule ligne.
- Ambiances de particules : mini-scènes animées, réglages regroupés par thème et pictogrammes pour les formes.
- Blocs réservés au mode Ultra (Carrousel, Page web) : bordure dégradée, lueur et pastille Ultra.
- Zone Arrière-plan : mêmes curseurs, interrupteurs et sections repliables que le reste de l'éditeur.

### Corrections
- Ambiances de particules claires (poussière, neige, étoiles) illisibles : du texte blanc sur un dégradé blanc.
- Interlignage plafonné à 1 dans le menu du clic droit, alors que sa valeur par défaut est 1,4.
- Un fichier qui n'est pas une image pouvait être déposé dans un bloc image ; il est maintenant refusé avec un message clair.
- L'assistant s'ouvrait en haut de la conversation au lieu de la fin.

## 1.1.0 — 2026-11-19

**Assistant IA** — Décrivez ce que vous voulez dans un panneau de conversation, et l'assistant le fait directement dans votre diaporama : diapositives, titres, textes, formes, couleurs, polices, animations et transitions. Une demande entière s'annule d'un seul Ctrl+Z. Il utilise votre propre clé API (Anthropic ou OpenAI), enregistrée chiffrée sur votre ordinateur et facturée par le fournisseur, pas par Shadowrama. Rien n'est envoyé sans votre autorisation explicite, et les images, vidéos et fichiers ne le sont jamais.

**Réponses en direct et puissance de réflexion** — La réponse de l'assistant s'écrit en direct, et le bouton Arrêter la coupe aussitôt. Un réglage de puissance de réflexion (Faible, Moyen, Élevé, Très élevé), accessible depuis l'en-tête du panneau, permet de choisir entre rapidité et économie d'un côté, raisonnement approfondi de l'autre. Le panneau affiche les tokens consommés, dont ceux lus depuis le cache à tarif réduit.

**Conversation conservée par projet** — La conversation avec l'assistant, vos pièces jointes et même le message en cours de frappe suivent le projet : ils survivent à un passage par les Paramètres ou l'accueil, et au redémarrage de l'application. Chaque projet a sa propre conversation ; le bouton Effacer la supprime.

**Images, vidéos et formes personnalisées** — Joignez des images ou des vidéos à la conversation (bouton trombone ou glisser-déposer) et l'assistant les place dans des blocs image, vidéo ou carrousel. Il ne reçoit que leur nom et leurs dimensions, jamais leur contenu. Il peut aussi dessiner des formes personnalisées par points, ou à partir des modèles de l'éditeur (cœur, étoile…), et en découper vos images et vidéos.

> **✦ Effets, particules et mouvements par l'assistant** *(Ultra Design)*
>
> En mode Ultra Design, l'assistant règle les effets visuels des blocs (ombre, halo, dégradé, flou, couleurs, coins, contour du texte, flottement), ajoute des particules animées à l'arrière-plan d'une diapositive, et applique les mouvements d'entrée et de sortie ainsi que les transitions avancées.

**Nouvelle page d'accueil** — La page d'accueil a été entièrement repensée, avec une présentation plus sobre et plus professionnelle.

### Nouveautés
- Panneau Assistant IA dans l'éditeur, ouvert depuis la barre du haut, avec suggestions de départ et note rappelant à qui les données sont envoyées.
- Choix du fournisseur (Anthropic ou OpenAI) et du modèle dans Paramètres → Assistant IA, avec des modèles proposés et la saisie libre d'un identifiant.
- Consentement explicite à l'envoi des données, vérifié aussi côté application : sans lui, aucun appel ne part.
- Clé API chiffrée avec le coffre du système (jamais écrite en clair) ; si le chiffrement est indisponible, la clé n'est pas enregistrée.
- Réponses affichées en direct pendant qu'elles s'écrivent, avec un curseur clignotant.
- Réglage de la puissance de réflexion (Faible, Moyen, Élevé, Très élevé), dans les réglages et en raccourci dans l'en-tête du panneau.
- Compteur de tokens de la conversation : entrée, sortie et part lue depuis le cache.
- Conversation, pièces jointes et texte en cours de frappe conservés par projet, y compris après un redémarrage.
- Pièces jointes par bouton trombone ou glisser-déposer (images et vidéos), placées par l'assistant dans des blocs image, vidéo ou carrousel.
- L'assistant peut créer des blocs image, vidéo et carrousel vides, à remplir ensuite par vous.
- Formes personnalisées créées par l'assistant : liste de points ou modèle (cercle, étoile, diamant, croix, éclair, cœur), aussi pour découper une image ou une vidéo.
- Effets visuels des blocs réglables par l'assistant (mode Ultra Design).
- Particules animées d'arrière-plan réglables par l'assistant : huit modèles (poussière, constellation, neige, bulles, braises, confettis, nébuleuse, étoiles) et réglages détaillés (mode Ultra Design).
- Animations d'entrée et de sortie des blocs et transitions de diapositives réglables par l'assistant.
- Réponses jusqu'à 10 000 tokens et jusqu'à 300 actions sur 30 tours par demande, de quoi traiter une présentation d'une vingtaine de diapositives ; une longue réponse n'est interrompue qu'après 2 minutes sans aucune donnée reçue.
- Cache de requêtes chez Anthropic (consignes, outils et début de conversation) : les tours répétés d'une même demande coûtent beaucoup moins cher.
- L'assistant connaît la diapositive affichée, la sélection, l'état du mode Ultra Design et les pièces jointes à chaque demande.
- Nouvelle liste déroulante aux couleurs du thème, avec navigation au clavier, utilisée dans les réglages de l'assistant.
- Nouvelle icône trombone.

### Améliorations
- Page d'accueil entièrement refondue.

## 1.0.0 — 2026-11-17

**Export PowerPoint** — Exportez votre présentation en fichier .pptx depuis la barre du haut, pour l'ouvrir dans PowerPoint ou Google Slides. Textes, images, formes, fonds et vidéos sont convertis ; ce qui ne peut pas être reproduit fidèlement (effets, pages web…) est capturé en image.

**Nouvelle interface et nouveaux thèmes** — L'éditeur a été entièrement repensé : barre du haut, panneaux latéraux, menus et fenêtres plus sobres et plus professionnels, avec une interface plus fluide. Choisissez parmi trois palettes dans Paramètres : Nuit encre, Graphite néon et Chaud / crème, en thème clair comme sombre.

**Sélecteur de couleurs** — Un nouveau sélecteur de couleurs remplace les anciens champs : palette harmonisée avec le thème, couleurs du projet, favoris enregistrés d'un projet à l'autre et saisie précise des valeurs.

**Outils d'alignement** — Alignez, centrez et répartissez vos blocs depuis un nouveau panneau, sur la sélection ou sur la diapositive. Au glissé, les blocs s'aimantent aux bords et aux centres des autres (Alt pour désactiver). Fonctionnalité bêta, à activer dans Paramètres → Fonctionnalités.

### Nouveautés
- Export de la présentation au format PowerPoint (.pptx), avec choix de l'emplacement du fichier.
- Les éléments non convertibles en objets PowerPoint (effets, pages web) sont exportés sous forme d'image.
- Trois palettes de couleurs au choix dans Paramètres : Nuit encre, Graphite néon et Chaud / crème.
- Nouveau fond d'écran low-poly, adapté au thème clair et au thème sombre.
- Nouveau sélecteur de couleurs avec couleurs du projet et favoris conservés d'un projet à l'autre.
- Panneau d'alignement : aligner à gauche, à droite, en haut, en bas, centrer, répartir horizontalement ou verticalement, sur la sélection ou sur la diapositive.
- Magnétisme au glissé : les blocs s'aimantent aux bords et aux centres des autres blocs, Alt pour placer sans magnétisme.
- Fonctionnalités bêta activables dans Paramètres → Fonctionnalités (outils d'alignement).
- Nouveau menu déroulant réutilisable dans la barre du haut.

### Améliorations
- Interface de l'éditeur entièrement refondue : barre du haut, panneaux, menu contextuel, tiroirs, fenêtres Nouveautés et bilan d'import, listes déroulantes, interrupteurs et pages de Paramètres.
- Les panneaux Arrière-plan, Numérotation et Effets reprennent les mêmes contrôles pour plus de cohérence.
- Les nouvelles formes sont créées avec une couleur de remplissage et de bordure adaptée au fond de la diapositive.
- Meilleure lisibilité automatique du texte selon le fond (calcul du contraste revu).
- Le code d'import PowerPoint a été réorganisé en modules plus petits, sans changement de comportement.
- Les fichiers importés (images, vidéos) sont conservés sous forme de Blob : une vidéo de 300 Mo n'occupe plus deux fois sa taille en mémoire, et les gros projets se chargent plus légèrement.
- Les médias qui ne sont plus utilisés sont nettoyés au démarrage de l'éditeur au lieu de s'accumuler d'une séance à l'autre.

### Corrections
- deux fichiers importés dans la même milliseconde (sélection multiple d'un carrousel) pouvaient recevoir la même clé : le second écrasait le premier
- remplacer un média sous la même clé gardait l'ancienne version en mémoire
- couleurs par défaut des formes parfois peu visibles selon le fond ou le thème

## 0.20.0 — 2026-10-12

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

## 0.19.4 — 2026-10-09

### Corrections
- problème d'affichage par rapport à l'animation de la slide

## 0.19.0 — 2026-09-09

> **✦ Particules** *(Ultra Design)*
>
> Un champ de particules animé se pose derrière n'importe quel fond de diapositive. Quantité, vitesse, taille, couleurs, halo, style de particule, trajectoire, liens entre particules, réaction au curseur : tout se règle depuis l'onglet Arrière-plan. Huit ambiances prêtes à l'emploi (Poussière, Constellation, Neige, Bulles, Braises, Confettis, Nébuleuse, Étoiles) pour partir d'une base et l'ajuster.

> **✦ Carrousel** *(Ultra Design)*
>
> Nouveau type de bloc : plusieurs images qui défilent, à la main avec les flèches et les puces, ou toutes seules. Huit animations au choix, du défilement horizontal ou vertical au retournement 3D. Chaque vue se règle exactement comme un bloc image — cadrage, arrondi, forme personnalisée — et peut porter sa propre légende.

### Nouveautés
- Particules animées en arrière-plan de diapositive, réglables indépendamment du type de fond (couleur, dégradé ou image).
- Huit styles de particules : Point, Halo, Carré, Triangle, Étoile, Anneau, Trait, Croix.
- Sept trajectoires : Dérive, Flux dirigé, Montée, Chute, Tourbillon, Ondulation, Pulsation.
- Réglages fins des particules : quantité, vitesse, taille et variation de taille, opacité, halo, jusqu'à quatre couleurs tirées au sort.
- Réaction au curseur : repousser, attirer, grossir ou relier les particules, avec rayon d'influence et force réglables.
- Liens entre particules proches (effet constellation), avec portée, épaisseur et couleur au choix.
- Options de rendu des particules : fusion additive, scintillement, rotation des formes.
- Huit ambiances de particules prêtes à l'emploi : Poussière, Constellation, Neige, Bulles, Braises, Confettis, Nébuleuse, Étoiles.
- Nouveau bloc Carrousel : plusieurs images qui défilent manuellement (flèches et puces) ou automatiquement.
- Huit animations de carrousel : défilement horizontal et vertical dans les deux sens, fondu, zoom, retournement, empilement — avec durée et courbe réglables.
- Chaque vue d'un carrousel se règle comme un bloc image : image, description, cadrage, arrondi, forme personnalisée, plus une légende en surimpression.
- Réglages du carrousel : intervalle de défilement, boucle, pause au survol, affichage des flèches et des puces, couleur des commandes, arrondi et fond du cadre, zoom lent (Ken Burns).
- Import de plusieurs images d'un coup dans un carrousel, et réorganisation des vues par monter / descendre.

### Améliorations
- Le rendu d'une image — cadrage, arrondi, découpe en forme personnalisée — est désormais partagé entre le bloc image et les vues du carrousel : un réglage ajouté à l'un profite à l'autre.
- Les blocs réservés au mode Ultra Design n'apparaissent plus dans la palette quand il est coupé ; un bloc déjà posé reste dans le projet et s'affiche en version statique.
- Les images d'un carrousel sont prises en compte au nettoyage des médias à l'enregistrement, comme celles des blocs image et des fonds.

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
