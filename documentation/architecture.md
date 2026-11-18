# Architecture

Trois couches, qui ne se mélangent jamais :

```
src/formats/    DONNÉES   un fichier par format de tournoi (étapes, niveaux, réglages par défaut)
src/moteur/     RÈGLES    fonctions pures et testées, sans réseau, sans horloge, sans affichage
src/donnees/    STOCKAGE  une seule porte d'entrée vers le navigateur et la base en ligne
src/interface/  ÉCRANS    met en forme ce que le moteur a calculé, aucune règle sportive
tests/          tests du moteur (node --test)
```

## Le principe

L'état d'un tournoi est un petit document : équipes, tirage, scores, décisions de la table.
`calculer(tournoi)` (dans `src/moteur/tournoi.js`) en tire tout le reste à chaque fois : poules, matchs, planches,
classements, tableaux, classement final, alertes. Rien de calculé n'est stocké, donc rien ne peut se désynchroniser.
Les trois pages utilisent ce même calcul.

## Modèle commun

- **Événement** (`src/donnees/evenement.js`) : ce qui se joue le même jour. Un tournoi (palets, cornhole) ou deux qui
  partagent les terrains (quinte masculine et féminine). Contient le journal.
- **Tournoi** (`src/moteur/actions.js`, forme décrite en tête de fichier).
- **Étapes** d'un format : `poules` (tirage, ou composition depuis l'étape précédente par niveaux) et `tableaux`.
- **Groupes** (poules), **Matchs** (identifiant stable, par exemple `phase1:A:2:1` ou `finales:P:Q3`).
- **Règle d'affectation** : « le rang r de la poule X de l'étape n va dans la poule Y de l'étape n+1 »
  (`src/moteur/affectation.js`, modes `cyclique` et `serpentin`).
- **Critères de classement** : liste ordonnée dans les paramètres (`src/moteur/classement.js`).

## Fichiers du moteur

| Fichier | Rôle |
| --- | --- |
| `aleatoire.js` | hasard reproductible (graine) |
| `poules.js` | tailles des poules, calendrier des tours |
| `classement.js` | barème, critères, égalités parfaites |
| `affectation.js` | passage d'une étape de poules à la suivante |
| `tableau.js` | tableau final, matchs de classement, places |
| `tournoi.js` | chef d'orchestre : `calculer(tournoi)` |
| `actions.js` | toutes les modifications d'état (saisir un score, tirer au sort...) |
| `planning.js` | terrains et horaires de la quinte |
| `simulation.js` | tournoi joué au hasard (tests et démonstration) |

## Fichiers de l'interface

| Fichier | Rôle |
| --- | --- |
| `rendu.js` | HTML commun (match, poule, tableau, QR code) |
| `table.js` | table de marque : état de la page, clics, enregistrement |
| `table-vues.js` | HTML des rubriques de la table |
| `table-planning.js` | rubrique Planning (quinte) |
| `ecran.js` | vidéoprojecteur : vues, défilement automatique ou manuel, barre de commandes (voir `ecran.md`) |
| `public.js` | page publique |
| `styles.css` | une seule feuille de style |

## Règles à garder en modifiant

1. Une règle sportive va dans `src/formats` (si c'est un réglage) ou `src/moteur` (si c'est un calcul), jamais dans l'interface.
2. Toute modification du moteur s'accompagne d'un test. `npm test` doit rester vert.
3. Le moteur ne lit ni l'heure ni le réseau. L'interface lui passe la date et la graine.
4. Tout accès aux données passe par `src/donnees/stockage.js`.
