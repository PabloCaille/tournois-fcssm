# Choix et écarts au cahier des charges

Une ligne par décision, avec sa raison.

## Écarts

- **Fonctionnement local d'abord, en ligne ensuite** (le cahier supposait un bon wifi) : la table écrit dans le navigateur puis publie. Si le wifi tombe, la saisie et l'écran branché au PC continuent.
- **Rejouer le tournoi du 14/11/2026** : non fait, le fichier de scores du Drive était vide le 16/11. Remplacé par des tests de structure identiques aux Sheets et par des simulations.
- **Écran et page publique lisent par interrogation périodique** (5 à 10 s) et non par connexion permanente : l'offre gratuite Firebase limite à 100 connexions simultanées, l'interrogation n'a pas cette limite.
- **Code de la table au lieu d'un compte** : un seul secret à retenir, vérifié par les règles de la base. Pas de compte à créer pour les bénévoles.
- **Score au-dessus du score cible** : plafonné pour la différence ET pour les points marqués (le règlement ne cite que la différence), par cohérence entre les deux critères.
- **Places ex aequo sans match** : une équipe sans adversaire pour un match de classement (nombre impair de poules, poule de 3) est classée avec les vainqueurs de ce palier.
- **Vue horaire commune sur l'écran de la quinte** : non faite. L'écran affiche les matchs tournoi par tournoi, triés par heure. La grille commune existe dans la rubrique Planning (imprimable).
- **Critère « fair-play »** de la quinte : non automatisé. En dernier recours la table tranche, comme pour toute égalité parfaite.

## Choix sur les points laissés ouverts (section 9 du cahier)

- **Nombre d'équipes non multiple de 4** : poules de 4 complétées par des poules de 3, jamais de 5, pour garder 3 tours par étape. Testé de 8 à 70 équipes.
- **Tableaux quand le nombre de poules n'est pas 1, 2, 4 ou 8** : têtes de série avec exemptions pour les meilleurs premiers, sans duel d'entrée entre deux équipes d'une même poule.
- **Égalité parfaite, règle par défaut** : tirage au sort figé (dépend de la graine du tirage, de la poule et du numéro d'équipe). Remplacé par la décision de la table dès qu'elle est saisie.
- **Cornhole** : croisements et matchs de classement identiques aux palets (repris des formules du Sheet). Répartition de l'après-midi en « serpentin », qui redonne exactement le Sheet à 32 équipes.
- **Planches** : chaque poule garde ses planches pendant une étape, chaque niveau garde son bloc en phase finale (numérotation des Sheets). S'il manque des planches, les matchs en trop passent en « vague 2 » sur les mêmes planches.
- **Noms au public** : numéro et nom d'équipe seulement, joueurs masqués par défaut (des mineurs peuvent jouer). Réglable dans Paramètres.
- **Hébergement** : GitHub Pages (site) et Firebase Realtime Database (données), gratuits et sans carte bancaire. Supabase écarté (projet gratuit mis en pause après une semaine sans activité). Détails dans `hebergement.md`.
- **Comptes** : ceux de Pablo le 16/11/2026. À transférer vers un compte du club (voir `hebergement.md`).
- **Quinte (hypothèses à confirmer par le club)** : football à 5, 4 terrains, matchs de 12 min, 3 min de battement, 10 min de pause minimale, 9h à 18h, 3 tours masculins pour 1 féminin, tirs au but en phase finale, forfait 3 à 0. Tout se règle dans Planning et Paramètres.
- **Format masculin** : poules de 4, puis poules de niveau (1ers et 2es en Principale, 3es et 4es en Consolante), puis tableaux. Même mécanique que le cornhole.
- **Format féminin** : deux formules au choix dans Planning, avec le nombre de matchs de chacune. Pour 8 équipes : toutes contre toutes = 28 matchs (7 par équipe) ; deux poules puis phase finale = 18 matchs (4 à 5 par équipe).
- **Correction de score** : autorisée avec trace par défaut. Le règlement palets dit « plus contestable » : passer le paramètre sur « interdite » pour l'appliquer à la lettre.
