# Hébergement (gratuit, sans carte bancaire)

| Brique | Service | Limites gratuites vérifiées le 16/11/2026 |
| --- | --- | --- |
| Site (pages) | GitHub Pages, dépôt public | site de 1 Go, 100 Go de trafic par mois |
| Données en direct | Firebase Realtime Database, offre Spark | 1 Go stocké, 10 Go téléchargés par mois, 100 connexions simultanées |

Un tournoi de 64 équipes pèse environ 100 Ko. Les pages publiques interrogent un numéro de version (quelques octets)
toutes les 5 à 10 secondes et ne téléchargent l'état que s'il a changé : la limite de 100 connexions simultanées
ne s'applique pas à ce mode de lecture.

## Publier une nouvelle version du site

```
git push origin main
```

GitHub Pages sert la branche `main`, dossier racine (Settings > Pages > Source « Deploy from a branch » > `main` / `(root)`,
réglé le 18/11/2026). Chaque envoi sur `main` relance la publication (1 à 2 minutes, onglet Actions,
« pages build and deployment »). Pour forcer le rechargement sur l'ordinateur de l'écran : Ctrl+F5.
La branche `gh-pages` (ancienne source, figée au 16/11/2026) ne sert plus.

## Brancher la base Firebase

1. console.firebase.google.com > créer un projet > Realtime Database > créer (Belgique, mode verrouillé).
2. Onglet Règles : coller le contenu de `documentation/regles-firebase.json`, publier.
3. Onglet Données : ajouter à la racine la clé `cle` avec pour valeur le code secret de la table de marque.
4. Écrire l'adresse de la base dans `src/donnees/config.js` (`urlBase`), puis publier le site.
5. Sur la table de marque : rubrique Diffusion, saisir le code, « Enregistrer et publier ».

Changer le code : modifier la valeur de `cle` dans l'onglet Données, puis le ressaisir dans Diffusion.

## Comment la sécurité fonctionne

- `/pub/<identifiant>` : lisible par tous ceux qui connaissent l'identifiant. Contient `rev` (version) et `etat` (le tournoi).
- `/cle` : le code, illisible de l'extérieur.
- Écrire dans `/pub/<identifiant>` exige d'écrire en même temps `/preuves/<identifiant>` avec le bon code et le même
  numéro de version, strictement supérieur au précédent. Sans le code, aucune écriture ne passe.
- La page `table.html` est publique, mais sans le code elle ne peut modifier que la copie locale de son propre navigateur.

## Changer de service

Tout l'accès aux données est dans `src/donnees/stockage.js`. Pour un autre service, réécrire les quatre fonctions
de la partie « En ligne » : `lireRevEnLigne`, `lireEnLigne`, `ecrireEnLigne`, `surveillerEnLigne`. Rien d'autre ne change.

## Transférer au club

- Firebase : Paramètres du projet > Utilisateurs et autorisations > ajouter le compte Google du club comme Propriétaire.
- GitHub : Settings > Transfer ownership vers un compte ou une organisation du club, puis mettre à jour l'adresse du site
  dans `README.md`. L'adresse des pages change avec le propriétaire : réimprimer les QR codes.
