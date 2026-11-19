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

Dernière version : **1.1.0** (2026-11-19).

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

Historique complet : [CHANGELOG.md](CHANGELOG.md).
