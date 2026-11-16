# Ajouter un format de tournoi

Aucun changement du moteur n'est nécessaire tant que le format se décrit avec des poules et des tableaux.

1. Copier `src/formats/cornhole.js` sous un nouveau nom, par exemple `src/formats/belote.js`.
2. Changer `id`, `nom`, `nomLieu` (« Planche », « Terrain », « Table »...).
3. Régler `parametres` : seuls les réglages différents de `src/formats/commun.js` sont à écrire.
4. Décrire `etapes`, dans l'ordre :
   - `{ id, nom, type: 'poules' }` : première étape, poules tirées au sort.
   - `{ id, nom, type: 'poules', source: '<étape précédente>', niveaux: [...], repartition }` : nouvelles poules
     composées d'après le rang obtenu. Chaque niveau liste ses rangs : `{ id: 'P', nom: 'Principale', prefixe: 'P', rangs: [1, 2] }`.
     Le dernier niveau reçoit aussi les rangs non cités. `repartition` vaut `'cyclique'` ou `'serpentin'`.
   - `{ id, nom, type: 'tableaux', source: '<étape de poules>' }` : un tableau final par niveau.
   Une seule étape de poules donne un championnat : le classement de la poule est le classement final.
5. Inscrire le format dans `src/formats/index.js` : dans `FORMATS`, et dans `MODELES` pour qu'il apparaisse à la création.
6. Ajouter un test de simulation dans `tests/` (modèle : `tests/tournoi.test.js`, fonction `verifier`).
7. `npm test`.

Variantes d'un même format (plusieurs formules au choix) : voir `src/formats/quinte-feminin.js`.

Si le format a besoin d'un nouveau type d'étape (double élimination par exemple), il faut l'ajouter dans
`src/moteur/tournoi.js` (boucle de `calculer`) avec ses tests.
