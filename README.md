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

Dernière version : **0.15.0** (2026-07-30).

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

Historique complet : [CHANGELOG.md](CHANGELOG.md).
