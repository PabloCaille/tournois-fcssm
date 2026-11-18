# Tournois FCSSM

Outil de tournois du FC Sud Sèvre et Maine : palets, cornhole, quinte masculine et féminine.
Il crée les poules, les matchs, les planches ou terrains, les classements et les tableaux finaux.

| Page | Pour qui | Adresse |
| --- | --- | --- |
| Table de marque | l'opérateur (un seul à la fois) | `table.html` |
| Écran | le vidéoprojecteur | `ecran.html?t=<identifiant>` |
| Page publique | les joueurs, par QR code | `index.html?t=<identifiant>` |

Site en ligne : https://pablocaille.github.io/tournois-fcssm/table.html

## À lire en premier (humain ou modèle qui reprend le code)

1. `documentation/architecture.md` : où se trouve quoi, en une page.
2. `documentation/ecarts.md` : choix faits et écarts au cahier des charges, avec leur raison.
3. `documentation/ajouter-un-format.md`, `documentation/changer-un-critere.md`, `documentation/lancer-les-tests.md`.
4. `documentation/hebergement.md` : GitHub Pages, Firebase, règles de sécurité, changement de service.
5. `documentation/jour-j.md` : mode d'emploi pour la table de marque.
6. `documentation/ecran.md` : écran du vidéoprojecteur (vues, défilement automatique ou manuel, commandes, réglages).

## Lancer en local

```
python3 -m http.server 8080
```

Puis ouvrir http://localhost:8080/table.html. Aucune installation, aucune compilation : le site est fait de fichiers
HTML, CSS et JavaScript servis tels quels. (Ouvrir le fichier par double-clic ne marche pas : il faut un serveur.)

## Tests

```
npm test
```

Node 18 ou plus, aucune dépendance.
