# Changer un critère de départage

## Changer l'ordre ou la liste pour un tournoi

Sans toucher au code : rubrique **Paramètres** de la table de marque, champ « Critères de départage en poule ».
Exemple : `points, confrontation, difference, marques`. Les classements sont recalculés aussitôt.

## Changer la valeur par défaut d'un format

Dans le fichier du format (`src/formats/palets.js` par exemple), ligne `criteres` de `parametres`.

## Critères disponibles

`points`, `difference`, `marques`, `encaisses`, `victoires`, `confrontation` (définis dans `src/moteur/classement.js`).

## Créer un nouveau critère

Dans `src/moteur/classement.js`, ajouter une ligne à `CRITERES` :

```js
nuls: { nom: 'Nombre de nuls (le moins)', valeur: (l) => -l.n },
```

`l` est la ligne de classement d'une équipe : `j, v, n, d, pts, pour, contre, diff`. La plus grande valeur passe devant.
Ajouter un test dans `tests/classement.test.js`, puis `npm test`.

## Barème, score cible, forfait

Rubrique Paramètres également (victoire, nul, défaite, score à atteindre, plafonnement, score de forfait).
Les valeurs par défaut sont dans `src/formats/commun.js` et dans chaque format.
