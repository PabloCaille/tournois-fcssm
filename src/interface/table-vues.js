// HTML des sections de la table de marque. Chaque fonction reçoit le contexte courant
// (événement, tournoi, vue calculée) et retourne du HTML. Les clics sont traités dans table.js
// grâce aux attributs data-action.

import { MODELES } from '../formats/index.js';
import { CRITERES } from '../moteur/classement.js';
import { nomEquipe } from '../moteur/actions.js';
import { h, htmlEquipe, htmlMatch, htmlPoule, htmlTableau, htmlClassementFinal, htmlPlaque, htmlQr, destinations, nomManche, heureCourte, adressePage, texteEquipe, pluriel } from './rendu.js';
import { listerLocal, listerSauvegardes, enLigneConfigure, urlBase } from '../donnees/stockage.js';

const champ = (libelle, html, aide = '') => `<div class="champ"><label>${libelle}${aide ? `<span class="aide">${aide}</span>` : ''}</label>${html}</div>`;
const options = (liste, choisi) => liste.map(([v, t]) => `<option value="${h(v)}"${v === choisi ? ' selected' : ''}>${h(t)}</option>`).join('');

// ---------- Accueil : aucun tournoi ouvert ----------
export function vueAccueil() {
  const modeles = options(MODELES.map((m) => [m.id, m.nom]), 'palets');
  const locaux = listerLocal();
  const liste = locaux.length
    ? `<table class="equipes"><tbody>${locaux.map((e) => `<tr>
        <td><strong>${h(e.nom)}</strong><br><span class="discret petit">${h(e.id)}${e.maj ? ` · modifié le ${new Date(e.maj).toLocaleString('fr-FR')}` : ''}</span></td>
        <td style="text-align:right"><button class="principal" data-action="ouvrir" data-id="${h(e.id)}">Ouvrir</button> <button class="danger" data-action="supprimer-evenement" data-id="${h(e.id)}">Supprimer</button></td>
      </tr>`).join('')}</tbody></table>`
    : '<p class="discret">Aucun tournoi sur cet ordinateur pour le moment.</p>';
  return `<section>
    <h1>Table de marque</h1>
    <p class="chapeau">Créez un tournoi, saisissez les équipes, tirez les poules puis entrez les scores. L'écran et la page publique se mettent à jour seuls.</p>
    <div class="bloc"><h2>Créer un tournoi</h2>
      <div class="grille-champs">
        ${champ('Type de tournoi', `<select id="nouveau-modele" data-change="modele-change">${modeles}</select>`)}
        ${champ('Nom du tournoi', '<input type="text" id="nouveau-nom" value="Tournoi de palets FCSSM" size="32">')}
      </div>
      <button class="principal" data-action="creer">Créer le tournoi</button>
    </div>
    <div class="bloc"><h2>Tournois enregistrés sur cet ordinateur</h2>${liste}</div>
    <div class="bloc"><h2>Essayer avec des équipes fictives</h2>
      <p class="discret">Crée un tournoi de démonstration, déjà tiré au sort, pour tester la saisie et l'écran sans rien préparer.</p>
      <div class="ligne">
        <select id="demo-modele">${modeles}</select>
        <input type="number" id="demo-nombre" value="64" min="4" max="200" style="width:6em" aria-label="Nombre d'équipes">
        <span>équipes</span>
        <button data-action="demo">Créer la démonstration</button>
      </div>
    </div>
    <div class="bloc"><h2>Reprendre une sauvegarde</h2>
      <div class="ligne"><input type="file" id="fichier-import" accept=".json,application/json" data-change="importer"></div>
      ${enLigneConfigure() ? `<div class="ligne" style="margin-top:10px"><input type="text" id="id-enligne" placeholder="identifiant du tournoi en ligne"><button data-action="recuperer-enligne">Récupérer depuis la base en ligne</button></div>` : ''}
    </div>
  </section>`;
}

// ---------- Paramètres ----------
export function vueParametres({ evenement, tournoi, vue }) {
  const P = vue.parametres;
  const nombre = (id, valeur, min = 0) => `<input type="number" id="${id}" value="${valeur}" min="${min}" style="width:6em">`;
  const coche = (id, vrai, texte) => `<label style="font-weight:400"><input type="checkbox" id="${id}"${vrai ? ' checked' : ''}> ${texte}</label>`;
  const criteres = Object.entries(CRITERES).map(([id, c]) => `<code>${id}</code> (${h(c.nom)})`).join(', ');
  const verrou = tournoi.demarre ? ' disabled title="Le tournoi a démarré"' : '';
  return `<section>
    <h1>Paramètres</h1>
    <p class="chapeau">Tout se règle ici, sans toucher au code. Un changement de barème ou de critère recalcule aussitôt les classements.</p>
    <div class="bloc"><h2>Tournoi</h2>
      <div class="grille-champs">
        ${champ('Nom affiché', `<input type="text" id="p-nom-evenement" value="${h(evenement.nom)}" size="30">`)}
        ${champ(`Nombre de ${vue.format.nomLieu.toLowerCase()}s`, nombre('p-nbLieux', P.nbLieux, 1))}
        ${champ('Taille des poules', `<input type="number" id="p-taillePoule" value="${P.taillePoule}" min="3" max="8" style="width:6em"${verrou}>`, 'Complétées par des poules d\'une équipe de moins. À régler avant le tirage.')}
        ${champ('Qualifiés par poule pour le tableau final', nombre('p-qualifiesParPoule', P.qualifiesParPoule, 1))}
      </div>
      ${coche('p-matchsClassement', P.matchsClassement, 'Matchs de classement (5 à 8, 3es entre eux, 4es entre eux, petite finale)')}
    </div>
    <div class="bloc"><h2>Score et barème</h2>
      <div class="grille-champs">
        ${champ('Points pour une victoire', nombre('p-victoire', P.points.victoire))}
        ${champ('Points pour un match nul', nombre('p-nul', P.points.nul))}
        ${champ('Points pour une défaite', nombre('p-defaite', P.points.defaite))}
        ${champ('Score à atteindre', nombre('p-scoreCible', P.scoreCible), '0 = pas de score cible (match à durée fixe).')}
        ${champ('Durée d\'un match (minutes)', nombre('p-dureeMatch', P.dureeMatch), 'Annoncée par la table. 0 = sans limite.')}
        ${champ('Forfait : score de l\'équipe présente', nombre('p-forfait-pour', P.forfait.pour))}
        ${champ('Forfait : score de l\'équipe absente', nombre('p-forfait-contre', P.forfait.contre))}
      </div>
      ${coche('p-plafonnerScore', P.plafonnerScore, 'Un score au-dessus du score à atteindre compte comme ce score dans les classements')}
      ${champ('Critères de départage en poule, dans l\'ordre', `<input type="text" id="p-criteres" value="${h(P.criteres.join(', '))}" size="50">`, `Séparés par des virgules. Disponibles : ${criteres}. En dernier recours, la table de marque tranche.`)}
      ${champ('Match nul en phase finale', `<input type="text" id="p-departageFinale" value="${h(P.departageFinale)}" size="60">`, 'Consigne rappelée à la table quand deux équipes sont à égalité en phase finale.')}
    </div>
    <div class="bloc"><h2>Saisie et affichage public</h2>
      ${champ('Correction d\'un score déjà saisi', `<select id="p-correctionScore">${options([['tracee', 'Autorisée à la table, avec trace au journal'], ['interdite', 'Interdite']], P.correctionScore)}</select>`)}
      ${coche('p-afficherJoueurs', P.afficherJoueurs, 'Afficher les noms des joueurs sur l\'écran et la page publique (décoché : numéro et nom d\'équipe seulement)')}
    </div>
    <div class="ligne"><button class="principal" data-action="enregistrer-parametres">Enregistrer les paramètres</button><button data-action="fermer">Changer de tournoi</button></div>
  </section>`;
}

// ---------- Équipes ----------
export function vueEquipes({ tournoi }) {
  const lignes = tournoi.equipes.map((e) => `<tr>
      <td style="width:3em"><strong>${e.id}</strong></td>
      <td><input type="text" value="${h(e.nom)}" data-change="equipe-nom" data-id="${e.id}" aria-label="Nom de l'équipe ${e.id}"></td>
      <td><input type="text" value="${h((e.joueurs || []).join(', '))}" data-change="equipe-joueurs" data-id="${e.id}" aria-label="Joueurs de l'équipe ${e.id}"></td>
      <td style="width:6em"><label style="font-weight:400"><input type="checkbox" data-change="equipe-present" data-id="${e.id}"${e.present !== false ? ' checked' : ''}${tournoi.demarre ? ' disabled' : ''}> présente</label></td>
    </tr>`).join('');
  const presentes = tournoi.equipes.filter((e) => e.present !== false).length;
  return `<section>
    <h1>Équipes</h1>
    <p class="chapeau">${pluriel(tournoi.equipes.length, 'équipe inscrite', 'équipes inscrites')}, ${pluriel(presentes, 'pointée présente', 'pointées présentes')}. Seules les équipes présentes entrent dans le tirage.</p>
    <div class="deux-colonnes">
      <div class="bloc"><h2>Coller une liste</h2>
        <p class="discret petit">Une équipe par ligne. Copiez les colonnes d'un tableur (nom d'équipe, joueur 1, joueur 2...) ou séparez par des points-virgules. Les numéros sont attribués dans l'ordre.</p>
        <textarea id="liste-equipes" class="jaune" placeholder="Les Tireurs; Dupont Jean; Martin Léa&#10;Les Pointeurs; Durand Paul; Petit Anne"${tournoi.demarre ? ' disabled' : ''}></textarea>
        <div class="ligne" style="margin-top:8px">
          <button class="principal" data-action="remplacer-equipes"${tournoi.demarre ? ' disabled' : ''}>Remplacer la liste</button>
          <button data-action="ajouter-equipes"${tournoi.demarre ? ' disabled' : ''}>Ajouter à la liste</button>
        </div>
        ${tournoi.demarre ? '<p class="discret petit" style="margin-top:8px">Le tournoi a démarré : la liste est figée, mais les noms restent modifiables.</p>' : ''}
      </div>
      <div class="bloc"><h2>Liste des équipes</h2>
        ${tournoi.equipes.length ? `<table class="equipes"><thead><tr><th>N°</th><th>Nom d'équipe</th><th>Joueurs (séparés par des virgules)</th><th></th></tr></thead><tbody>${lignes}</tbody></table>` : '<p class="discret">Aucune équipe. Collez une liste à gauche.</p>'}
      </div>
    </div>
  </section>`;
}

// ---------- Tirage et composition des poules ----------
export function vueTirage({ tournoi, vue, equipes, etat }) {
  if (!tournoi.tirage) {
    const n = tournoi.equipes.filter((e) => e.present !== false).length;
    return `<section><h1>Tirage des poules</h1>
      <p class="chapeau">${pluriel(n, 'équipe présente', 'équipes présentes')}. Le tirage est aléatoire et enregistré : il ne change pas quand on actualise la page.</p>
      <button class="principal" data-action="tirer"${n < 2 ? ' disabled' : ''}>Tirer les poules au sort</button></section>`;
  }
  const etape = vue.etapes.find((e) => e.id === etat.etapeTirage && e.type === 'poules') || vue.etapes[0];
  const premiere = etape === vue.etapes[0];
  const onglets = vue.etapes.filter((e) => e.type === 'poules').map((e) => `<button data-action="etape-tirage" data-id="${e.id}" aria-pressed="${e === etape}">${h(e.nom)}</button>`).join('');
  const conflits = vue.alertes.filter((a) => a.type === 'meme-poule' && a.etape === etape.id);
  const modifiable = premiere ? !tournoi.demarre : true;
  const poules = etape.groupes.map((g) => `<article class="poule"><header><h3>Poule ${h(g.nom)}</h3><span>${h(g.nomNiveau || '')}</span></header>
      <ul class="liste-equipes">${g.places.map((p) => p.equipe == null
        ? `<li>${htmlEquipe(equipes, null, p.origine)}</li>`
        : `<li class="${etat.choixTirage === p.equipe ? 'choisie' : ''}" ${modifiable ? `data-action="choisir-tirage" data-id="${p.equipe}" role="button" tabindex="0"` : ''}>${htmlEquipe(equipes, p.equipe)}${p.modifie ? ' <span class="depart">déplacée à la main</span>' : ''}</li>`).join('')}</ul></article>`).join('');
  return `<section class="tirage">
    <h1>Tirage des poules</h1>
    <p class="chapeau">${premiere
      ? (tournoi.demarre ? 'Le tournoi a démarré : ce tirage est verrouillé.' : 'Pour corriger à la main, cliquez sur une équipe puis sur celle avec qui l\'échanger.')
      : 'Ces poules se remplissent seules quand les poules d\'origine sont terminées. Pour corriger, cliquez sur deux équipes à échanger.'}</p>
    <div class="onglets-etapes">${onglets}</div>
    ${conflits.map((c) => `<div class="bandeau alerte"><strong>Poule ${h(c.nomGroupe)} :</strong> ${h(texteEquipe(equipes, c.equipes[0]))} et ${h(texteEquipe(equipes, c.equipes[1]))} étaient déjà ensemble dans la poule ${h(c.origine)}.</div>`).join('')}
    <div class="ligne" style="margin-bottom:14px">
      ${premiere ? `<button data-action="tirer"${tournoi.demarre ? ' disabled' : ''}>Relancer le tirage</button>` : `<button data-action="annuler-echanges" data-id="${etape.id}">Annuler les échanges manuels</button>`}
      <button data-action="imprimer" data-quoi="poules" data-id="${etape.id}">Imprimer ces poules</button>
    </div>
    <div class="poules">${poules}</div>
  </section>`;
}

// ---------- Saisie des scores ----------
function htmlEgalites({ vue, equipes, etat }) {
  return vue.alertes.filter((a) => a.type === 'egalite').map((a) => {
    const choisis = (etat.ordreEgalite[a.cle] || []).filter((id) => a.equipes.includes(id));
    const restants = a.equipes.filter((id) => !choisis.includes(id));
    const rang = choisis.length + 1;
    return `<div class="bandeau alerte">
      <h3>Égalité parfaite, poule ${h(a.nomGroupe)} (${h(a.nomEtape)})</h3>
      <p>Les critères ne départagent pas ces ${a.equipes.length} équipes. Faites-les jouer un départage sur le terrain, puis indiquez l'ordre. En attendant, un tirage au sort provisoire s'applique.</p>
      ${choisis.length ? `<p>Déjà placées : ${choisis.map((id, i) => `${i + 1}. ${h(texteEquipe(equipes, id))}`).join(', ')}</p>` : ''}
      <div class="ligne"><span>Qui passe ${rang === 1 ? 'en premier' : `en position ${rang}`} ?</span>
        ${restants.map((id) => `<button data-action="egalite-choisir" data-cle="${h(a.cle)}" data-id="${id}">${h(texteEquipe(equipes, id))}</button>`).join('')}
        ${choisis.length ? `<button class="lien" data-action="egalite-recommencer" data-cle="${h(a.cle)}">Recommencer</button>` : ''}
      </div>
    </div>`;
  }).join('');
}

function htmlFicheScore({ vue, equipes, etat, tournoi }) {
  const m = vue.matchs.find((x) => x.id === etat.saisie.match);
  if (!m) return '<p class="discret">Tapez un numéro de planche puis Entrée, ou cliquez sur un match dans la liste.</p>';
  const s = etat.saisie;
  const deja = (tournoi.scores || {})[m.id];
  const valeur = (cote) => (s[cote] != null ? s[cote] : deja ? deja[cote] : '');
  let controle = '';
  if (s.controle) {
    const [a, b] = [s.a, s.b];
    const cible = vue.parametres.scoreCible;
    const remarques = [];
    if (cible > 0 && a < cible && b < cible) remarques.push(`aucune équipe n'atteint ${cible} (limite de temps ?)`);
    if (cible > 0 && (a > cible || b > cible)) remarques.push(`score supérieur à ${cible}`);
    if (a === b && m.type === 'tableau') {
      controle = `<div class="controle attention">Égalité ${a} à ${b} : match nul impossible en phase finale. ${h(vue.parametres.departageFinale)}. Qui a gagné le départage ?
        <div class="ligne" style="margin-top:8px">
          <button class="principal" data-action="valider-score" data-vainqueur="a">${h(texteEquipe(equipes, m.a))}</button>
          <button class="principal" data-action="valider-score" data-vainqueur="b">${h(texteEquipe(equipes, m.b))}</button>
        </div></div>`;
    } else {
      const resultat = a === b ? `Match nul ${a} à ${b}` : `Vainqueur : ${texteEquipe(equipes, a > b ? m.a : m.b)}, ${Math.max(a, b)} à ${Math.min(a, b)}`;
      controle = `<div class="controle${remarques.length ? ' attention' : ''}">${h(resultat)}${remarques.length ? `<br>À vérifier : ${h(remarques.join(', '))}.` : ''}
        <div class="ligne" style="margin-top:8px"><button class="principal" id="bouton-valider" data-action="valider-score">${deja ? 'Enregistrer la correction' : 'Enregistrer ce score'}</button><button data-action="annuler-controle">Modifier</button></div></div>`;
    }
  }
  return `<div class="fiche-score">
    <div class="tete">${htmlPlaque(m)}<div><strong>${h(m.nomEtape)}, tour ${m.tour}</strong><br><span class="discret petit">${h(m.libelle)}${m.nomNiveau ? ` · ${h(m.nomNiveau)}` : ''}${deja ? ' · score déjà saisi' : ''}</span></div></div>
    <div class="cote">${htmlEquipe(equipes, m.a, m.origineA, { joueurs: true })}<input class="jaune" type="number" min="0" inputmode="numeric" id="score-a" value="${valeur('a')}" aria-label="Score équipe 1"${s.controle ? ' disabled' : ''}></div>
    <div class="cote">${htmlEquipe(equipes, m.b, m.origineB, { joueurs: true })}<input class="jaune" type="number" min="0" inputmode="numeric" id="score-b" value="${valeur('b')}" aria-label="Score équipe 2"${s.controle ? ' disabled' : ''}></div>
    ${controle || `<div class="ligne" style="margin-top:10px"><button class="principal" data-action="controler-score">Contrôler</button><button data-action="fermer-fiche">Fermer</button></div>`}
    <details style="margin-top:12px"><summary class="discret petit">Forfait, planche, effacement</summary>
      <div class="ligne" style="margin-top:8px">
        <button data-action="forfait" data-cote="a">Forfait de ${h(texteEquipe(equipes, m.a))}</button>
        <button data-action="forfait" data-cote="b">Forfait de ${h(texteEquipe(equipes, m.b))}</button>
        ${deja ? '<button class="danger" data-action="effacer-score">Effacer ce score</button>' : ''}
      </div>
      <div class="ligne" style="margin-top:8px"><label for="lieu-match" style="margin:0">Changer de ${h(m.nomLieu.toLowerCase())} :</label><input type="number" id="lieu-match" min="1" value="${m.lieu ?? ''}" style="width:5em"><button data-action="changer-lieu">Appliquer</button></div>
    </details>
  </div>`;
}

export function vueSaisie(ctx) {
  const { vue, equipes, etat, tournoi, demo } = ctx;
  if (!tournoi.tirage) return '<section><h1>Saisie des scores</h1><p class="chapeau">Tirez d\'abord les poules (rubrique Tirage).</p></section>';
  const courante = vue.mancheCourante;
  const manche = vue.manches.find((x) => `${x.etape}:${x.tour}` === etat.mancheVue) || courante || vue.manches[vue.manches.length - 1];
  // Un groupe de boutons par étape : « Phase 1 : tour 1, 2, 3 ».
  const onglets = vue.etapes.map((e) => `<span class="ligne"><span class="discret petit">${h(e.nom)}</span>${vue.manches.filter((x) => x.etape === e.id)
    .map((x) => `<button data-action="manche" data-id="${x.etape}:${x.tour}" aria-pressed="${x === manche}" title="${h(nomManche(x))}${x.terminee ? ', terminé' : x === courante ? ', en cours' : ''}">tour ${x.tour}${x.terminee ? ' ✓' : ''}</button>`).join('')}</span>`).join('');
  const tries = manche.matchs.slice().sort((x, y) => (x.joue ? 1 : 0) - (y.joue ? 1 : 0) || (x.heure || '').localeCompare(y.heure || '') || x.vague - y.vague || x.lieu - y.lieu);
  const liste = tries.map((m) => htmlMatch(m, equipes, {
    balise: m.pret ? 'button' : 'div', attributs: m.pret ? `data-action="ouvrir-match" data-id="${h(m.id)}"` : '',
    info: `${h(m.libelle)}${m.type === 'tableau' && m.nomNiveau ? `, ${h(m.nomNiveau)}` : ''}${m.vague > 1 ? `, vague ${m.vague}` : ''}${m.score && m.score.forfait ? ', forfait' : ''}`,
  })).join('');
  const etatManche = vue.termine
    ? '<div class="bandeau ok"><strong>Tournoi terminé.</strong> Le classement final est dans la rubrique Classements.</div>'
    : (courante ? `<p class="chapeau">En cours : <strong>${h(nomManche(courante))}</strong>, ${pluriel(courante.joues, 'match saisi', 'matchs saisis')} sur ${courante.matchs.length}.${courante.prete ? '' : ' Certaines équipes ne sont pas encore connues.'}</p>` : '');
  return `<section>
    <h1>Saisie des scores</h1>
    ${etatManche}
    ${htmlEgalites(ctx)}
    <div class="deux-colonnes">
      <div>
        <div class="saisie-planche">
          <div><label for="numero-planche">${h(vue.format.nomLieu)} n°</label><input class="jaune" type="number" min="1" inputmode="numeric" id="numero-planche" autocomplete="off"></div>
          <button data-action="chercher-planche">Ouvrir</button>
        </div>
        ${htmlFicheScore(ctx)}
        ${demo ? '<div class="bloc" style="margin-top:14px"><h2>Démonstration</h2><p class="discret petit">Tournoi fictif : remplissez une manche d\'un clic pour voir la suite.</p><button data-action="demo-jouer">Jouer la manche en cours au hasard</button></div>' : ''}
      </div>
      <div>
        <div class="onglets-etapes">${onglets}</div>
        <div class="ligne" style="justify-content:space-between;margin-bottom:8px"><h2>${h(nomManche(manche))}</h2><button data-action="imprimer" data-quoi="manche" data-id="${manche.etape}:${manche.tour}">Imprimer cette manche</button></div>
        <div class="liste-matchs">${liste}</div>
      </div>
    </div>
  </section>`;
}

// ---------- Classements et tableaux ----------
export function vueClassements({ vue, equipes, etat, tournoi }) {
  if (!vue.etapes.length) return '<section><h1>Classements</h1><p class="chapeau">Les classements apparaîtront après le tirage.</p></section>';
  const choix = etat.etapeClassement || (vue.mancheCourante ? vue.mancheCourante.etape : 'final');
  const onglets = [...vue.etapes.map((e) => [e.id, e.nom]), ['final', 'Classement final']]
    .map(([id, nom]) => `<button data-action="etape-classement" data-id="${id}" aria-pressed="${id === choix}">${h(nom)}</button>`).join('');
  const etape = vue.etapes.find((e) => e.id === choix);
  let corps;
  if (!etape) corps = `<div class="ligne" style="margin-bottom:10px"><button data-action="exporter-csv">Exporter en CSV</button><button data-action="imprimer" data-quoi="final">Imprimer</button></div>${htmlClassementFinal(vue, equipes)}`;
  else if (etape.type === 'poules') {
    const destination = destinations(tournoi, vue, etape.id);
    corps = `<div class="poules">${etape.groupes.map((g) => htmlPoule(g, equipes, vue, { destination, complet: true })).join('')}</div>`;
  } else corps = etape.tableaux.map((t) => htmlTableau(t, equipes, vue)).join('');
  return `<section><h1>Classements</h1><div class="onglets-etapes">${onglets}</div>${corps}</section>`;
}

// ---------- Diffusion : écran, QR code, mise en ligne ----------
export function vueDiffusion({ evenement, etat }) {
  const ecran = adressePage('ecran.html', evenement.id);
  const publique = adressePage('index.html', evenement.id);
  const local = /^(localhost|127\.|file:)/.test(window.location.hostname) || window.location.protocol === 'file:';
  const liaison = !enLigneConfigure()
    ? '<div class="bandeau info"><strong>Mode local.</strong> Aucune base en ligne n\'est réglée (fichier src/donnees/config.js). La table et l\'écran fonctionnent sur cet ordinateur ; la page publique ne sera pas visible sur les téléphones.</div>'
    : `<div class="bandeau ${etat.liaison.erreur ? 'alerte' : 'ok'}"><strong>Base en ligne :</strong> ${h(urlBase())}<br>${etat.liaison.erreur ? `Dernière publication en échec : ${h(etat.liaison.erreur)} La saisie continue en local et sera republiée au prochain score.` : etat.liaison.date ? `Dernière publication réussie à ${heureCourte(etat.liaison.date)}.` : 'Pas encore de publication depuis l\'ouverture de cette page.'}</div>`;
  return `<section>
    <h1>Diffusion</h1>
    <p class="chapeau">L'écran pour le vidéoprojecteur et la page publique pour les téléphones, en lecture seule.</p>
    ${liaison}
    ${enLigneConfigure() ? `<div class="bloc"><h2>Code de la table de marque</h2>
      <p class="discret petit">Seul ce code autorise la publication en ligne. Il reste sur cet ordinateur.</p>
      <div class="ligne"><input type="password" id="code-table" value="${h(etat.code)}" autocomplete="off"><button data-action="enregistrer-code">Enregistrer et publier</button></div></div>` : ''}
    <div class="deux-colonnes">
      <div class="bloc"><h2>Écran du vidéoprojecteur</h2>
        <p>Ouvrez cette adresse sur l'ordinateur relié au vidéoprojecteur, puis F11 pour le plein écran.</p>
        <p><a href="${h(ecran)}" target="_blank" rel="noopener">${h(ecran)}</a></p>
        ${champ('Durée d\'affichage de chaque vue (secondes)', `<input type="number" id="duree-vue" min="4" max="120" value="${evenement.affichage ? evenement.affichage.duree : 15}" style="width:6em"> <button data-action="enregistrer-duree">Appliquer</button>`)}
        <p class="discret petit">Sur l'écran : flèches gauche et droite pour changer de vue, espace pour mettre en pause.</p>
      </div>
      <div class="bloc"><h2>Page publique et QR code</h2>
        ${local ? '<p class="discret petit">Vous êtes sur une adresse locale : ce QR code ne fonctionnera sur les téléphones qu\'une fois le site en ligne.</p>' : ''}
        <div class="ligne" style="align-items:flex-start">${htmlQr(publique)}<div><p><a href="${h(publique)}" target="_blank" rel="noopener">${h(publique)}</a></p><button data-action="imprimer" data-quoi="qr">Imprimer le QR code</button></div></div>
      </div>
    </div>
    <div class="bloc"><h2>Sauvegarde</h2>
      <p class="discret petit">Le fichier contient tout le tournoi. Il se recharge depuis l'accueil, sur n'importe quel ordinateur.</p>
      <button data-action="exporter-json">Télécharger la sauvegarde</button>
    </div>
  </section>`;
}

// ---------- Journal et restauration ----------
const TEXTES_TRACE = {
  score: (t) => `Score saisi : ${t.libelle} = ${t.nouveau.a} à ${t.nouveau.b}`,
  correction: (t) => `Correction : ${t.libelle}, ${t.ancien.a} à ${t.ancien.b} devient ${t.nouveau.a} à ${t.nouveau.b}`,
  effacement: (t) => `Score effacé (${t.ancien.a} à ${t.ancien.b}) : ${t.match}`,
  tirage: (t) => `Tirage au sort : ${t.equipes} équipes, ${t.poules} poules`,
  'echange-tirage': (t) => `Échange dans le tirage : équipes ${t.equipes.join(' et ')}`,
  'echange-etape': (t) => `Échange manuel (${t.etape}) : équipes ${t.equipes.join(' et ')}`,
  'annulation-echanges': (t) => `Échanges manuels annulés (${t.etape})`,
  departage: (t) => `Égalité tranchée, ${t.poule} : ordre ${t.ordre.join(', ')}`,
  equipes: (t) => `Liste des équipes remplacée : ${t.nombre} équipes`,
  equipe: (t) => `Équipe ${t.equipe} modifiée`,
  lieu: (t) => `Changement de planche ou terrain : ${t.match} vers ${t.lieu}`,
  parametres: () => 'Paramètres modifiés',
  creation: () => 'Tournoi créé',
  restauration: (t) => `Restauration de la sauvegarde de ${t.de}`,
  planning: () => 'Planning horaire enregistré',
  variante: (t) => `Formule changée : ${t.variante}`,
};

export function vueJournal({ evenement }) {
  const lignes = evenement.journal.slice().reverse().slice(0, 400).map((t) => `<tr>
      <td style="white-space:nowrap">${t.date ? new Date(t.date).toLocaleString('fr-FR') : ''}</td>
      <td>${h(t.qui || '')}</td>
      <td>${h((TEXTES_TRACE[t.type] || (() => t.type))(t))}</td></tr>`).join('');
  const sauvegardes = listerSauvegardes(evenement.id).map((s, i) => `<tr>
      <td style="white-space:nowrap">${s.date ? new Date(s.date).toLocaleString('fr-FR') : ''}</td>
      <td>${h(s.libelle)}</td>
      <td style="text-align:right">${i === 0 ? '<span class="discret">état actuel</span>' : `<button data-action="restaurer" data-index="${i}">Revenir à cet état</button>`}</td></tr>`).join('');
  return `<section>
    <h1>Journal et restauration</h1>
    <p class="chapeau">Chaque modification est datée. L'état du tournoi est sauvegardé à chaque action sur cet ordinateur.</p>
    <div class="bloc"><h2>Revenir en arrière</h2>${sauvegardes ? `<table class="journal"><tbody>${sauvegardes}</tbody></table>` : '<p class="discret">Aucune sauvegarde pour le moment.</p>'}</div>
    <div class="bloc"><h2>Journal des modifications</h2>${lignes ? `<table class="journal"><tbody>${lignes}</tbody></table>` : '<p class="discret">Rien pour le moment.</p>'}</div>
  </section>`;
}

/** Noms fictifs pour le tournoi de démonstration. */
export function equipesFictives(n) {
  const debuts = ['Les Tireurs', 'Les Pointeurs', 'Les Rois', 'Les As', 'Les Fondus', 'Les Cadors', 'Les Copains', 'Les Voisins', 'Les Anciens', 'Les Cousins'];
  const fins = ['du Plomb', 'de la Sèvre', 'du Maître', 'de la Maine', 'du Vignoble', 'du Samedi', 'de la Buvette', 'du Stade', 'du Coteau', 'de Minuit', 'du Dimanche', 'de la Fonte', 'du Bourg'];
  return Array.from({ length: n }, (_, i) => ({
    nom: `${debuts[i % debuts.length]} ${fins[Math.floor(i / debuts.length) % fins.length]}${i >= debuts.length * fins.length ? ` ${Math.floor(i / (debuts.length * fins.length)) + 1}` : ''}`,
    joueurs: [`Joueur ${2 * i + 1}`, `Joueur ${2 * i + 2}`],
  }));
}

export { nomEquipe };
