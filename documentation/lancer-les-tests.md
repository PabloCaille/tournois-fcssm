# Lancer les tests

```
npm test
```

Node 18 ou plus. Aucune dépendance à installer. Durée : environ 2 secondes.

| Fichier | Ce qu'il vérifie |
| --- | --- |
| `tests/poules.test.js` | tailles des poules, calendrier des tours |
| `tests/classement.test.js` | barème, chaque critère, égalités à 2, 3 et 4, passage 3/1/0 vers 2/1/0 |
| `tests/affectation.test.js` | phase 2 identique aux Sheets, jamais deux équipes d'une même poule ensemble |
| `tests/tableau.test.js` | croisements des quarts, matchs de classement, places |
| `tests/tournoi.test.js` | tournois complets simulés (8 à 70 équipes), planches, saisie, forfait, correction, performance |
| `tests/quinte.test.js` | planning (terrains, heures, pauses), imbrication masculin et féminin, formules féminines |

Un seul fichier : `node --test tests/classement.test.js`.

Avant de publier une modification : `npm test`, puis essayer la démonstration dans `table.html`
(bouton « Créer la démonstration », puis « Jouer la manche en cours au hasard »).
