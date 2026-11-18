# Écran du vidéoprojecteur

Page `ecran.html?t=<identifiant>`, en lecture seule. Code : `src/interface/ecran.js`, styles dans `src/interface/styles.css`
(section « Vidéoprojecteur »). Le tournoi de démonstration s'affiche sur la même page.

## Les vues

Dans l'ordre, pour chaque tournoi de l'événement : matchs de la manche en cours, classements des poules,
tableaux finaux (dès la phase finale), classement général. Une vue trop chargée est découpée en plusieurs.
Chaque vue a une clé stable (`cle`) : quand les scores se mettent à jour (toutes les 5 s), l'écran reste sur la même vue.

## Défilement, façon Google Slides

Deux modes :

- **Automatique** : les vues tournent seules. Durée par vue réglable. Avec la boucle, on repart au début après la
  dernière vue ; sans boucle, on s'arrête sur la dernière (« Fin du défilement » dans le pied de page).
- **Manuel** : on avance à la main. Pratique quand les joueurs veulent lire leur match.

Barre de commandes en bas à gauche. Elle apparaît quand on bouge la souris et disparaît après 3 s (le curseur aussi) :
précédent, lecture/pause (= automatique/manuel), suivant, compteur « 3 / 7 », options, plein écran.

Options (roue) : mode, durée par vue, boucle, accès direct à une vue.

| Action | Effet |
| --- | --- |
| Clic sur la vue | vue suivante (dans les deux modes) |
| Clic droit sur la vue | vue précédente |
| Flèche droite, flèche bas, Page suivante, Entrée | vue suivante (télécommande de présentation comprise) |
| Flèche gauche, flèche haut, Page précédente, Retour arrière | vue précédente |
| Début, Fin | première, dernière vue |
| Espace | bascule automatique / manuel |
| F | plein écran |
| Échap | ferme les options |

Sans boucle, les flèches s'arrêtent aux extrémités ; avec la boucle, elles font le tour.

## Réglages

- Les réglages faits sur l'écran (mode, durée, boucle) restent sur l'ordinateur de l'écran (stockage du navigateur,
  clé `tournois-fcssm:ecran`) et survivent à un rechargement.
- Durée : le réglage de l'écran l'emporte. Sur « Comme la table de marque », c'est la durée de la rubrique Diffusion
  (`evenement.affichage.duree`) qui s'applique, ou `&duree=` dans l'adresse s'il est présent.

Options d'adresse :

| Option | Effet |
| --- | --- |
| `&duree=12` | durée par défaut de 12 s (remplace celle de la table) |
| `&mode=manuel` ou `&mode=auto` | impose le mode au chargement |
| `&enligne=1` | lit la base en ligne même sur l'ordinateur de la table |
