// Rubrique « Planning » de la table de marque : terrains et horaires de la quinte.
// Le calcul est dans src/moteur/planning.js ; ici, uniquement le formulaire et la grille.

import { formatDe } from '../formats/index.js';
import { calculer } from '../moteur/tournoi.js';
import { planifier, compterMatchs } from '../moteur/planning.js';
import * as actions from '../moteur/actions.js';
import { appliquer, modifierEvenement } from '../donnees/evenement.js';
import { h, annuaire, texteEquipe } from './rendu.js';

const champ = (libelle, html, aide = '') => `<div class="champ"><label>${libelle}${aide ? `<span class="aide">${aide}</span>` : ''}</label>${html}</div>`;

/** Choix de la formule pour les tournois qui en proposent plusieurs, avec le nombre de matchs de chacune. */
function htmlFormules(evenement) {
  return evenement.tournois.map((t) => {
    const format = formatDe(t.format);
    if (!format.variantes) return '';
    const n = t.equipes.filter((e) => e.present !== false).length;
    const lignes = Object.entries(format.variantes).map(([id, v]) => {
      const c = n >= 4 ? compterMatchs({ format: t.format, variante: id, n, parametres: t.parametres }) : null;
      const detail = c ? `${c.total} matchs au total, ${c.parEquipeMin === c.parEquipeMax ? c.parEquipeMin : `${c.parEquipeMin} à ${c.parEquipeMax}`} par équipe, ${c.tours} tours` : 'ajoutez les équipes pour compter les matchs';
      return `<label style="font-weight:400;margin-bottom:6px"><input type="radio" name="formule-${h(t.cle)}" value="${id}" data-change="planning-variante" data-cle="${h(t.cle)}"${(t.variante || format.varianteDefaut) === id ? ' checked' : ''}${t.demarre ? ' disabled' : ''}> <strong>${h(v.nom)}</strong> : ${detail}</label>`;
    }).join('');
    return `<div class="bloc"><h2>Formule du tournoi ${h(t.nom.toLowerCase())}</h2><p class="discret petit">Pour ${n} équipes. Changer de formule oblige à refaire le tirage.</p>${lignes}</div>`;
  }).join('');
}

function htmlGrille(evenement) {
  const lignes = new Map(); // heure -> { terrain: html }
  let nbTerrains = 0;
  for (const t of evenement.tournois) {
    const vue = calculer(t);
    const equipes = annuaire(t);
    for (const m of vue.matchs) {
      if (!m.heure) continue;
      if (!lignes.has(m.heure)) lignes.set(m.heure, {});
      nbTerrains = Math.max(nbTerrains, m.lieu);
      const qui = `${h(texteEquipe(equipes, m.a, m.origineA))} / ${h(texteEquipe(equipes, m.b, m.origineB))}`;
      lignes.get(m.heure)[m.lieu] = `<span class="pastille niv-${t.cle === evenement.tournois[0].cle ? 1 : 2}">${h(t.nom)}</span> ${h(m.libelle)}${m.joue ? ` <strong>${m.score.a} à ${m.score.b}</strong>` : ''}<br><span class="petit">${qui}</span>`;
    }
  }
  if (!lignes.size) return '<p class="discret">Aucun planning calculé pour le moment.</p>';
  const heures = [...lignes.keys()].sort();
  const tete = `<tr><th>Heure</th>${Array.from({ length: nbTerrains }, (_, i) => `<th>Terrain ${i + 1}</th>`).join('')}</tr>`;
  const corps = heures.map((heure) => `<tr><td class="place">${heure}</td>${Array.from({ length: nbTerrains }, (_, i) => `<td>${lignes.get(heure)[i + 1] || ''}</td>`).join('')}</tr>`).join('');
  return `<div style="overflow-x:auto"><table class="final"><thead>${tete}</thead><tbody>${corps}</tbody></table></div>`;
}

export function vuePlanning({ evenement }) {
  const r = evenement.planning;
  if (!r) return '<section><h1>Planning</h1><p class="chapeau">Ce tournoi n\'a pas de planning horaire.</p></section>';
  const nombre = (id, valeur, min = 0) => `<input type="number" id="${id}" value="${valeur}" min="${min}" style="width:6em">`;
  const pretes = evenement.tournois.every((t) => t.tirage);
  const rythmes = evenement.tournois.map((t) => champ(`Tours ${h(t.nom.toLowerCase())} à la suite`, nombre(`pl-rythme-${t.cle}`, (r.rythme || {})[t.cle] || 1, 1))).join('');
  const resume = r.resultat
    ? `<div class="bandeau ${r.resultat.depasse ? 'alerte' : 'ok'}"><strong>${r.resultat.nbMatchs} matchs de ${h(r.resultat.debut)} à ${h(r.resultat.fin)}.</strong> ${r.resultat.depasse ? `La journée dépasse l'heure de fin (${h(r.fin)}) : ajoutez un terrain, raccourcissez les matchs ou changez de formule.` : `La journée tient avant ${h(r.fin)}.`}</div>` : '';
  return `<section>
    <h1>Planning</h1>
    <p class="chapeau">Un terrain et une heure pour chaque match, masculin et féminin mélangés. Aucune équipe ne joue deux matchs en même temps, et chacune a sa pause minimale.</p>
    ${htmlFormules(evenement)}
    <div class="bloc"><h2>Réglages de la journée</h2>
      <div class="grille-champs">
        ${champ('Nombre de terrains', nombre('pl-terrains', r.nbTerrains, 1))}
        ${champ('Début', `<input type="time" id="pl-debut" value="${h(r.debut)}">`)}
        ${champ('Fin souhaitée', `<input type="time" id="pl-fin" value="${h(r.fin)}">`)}
        ${champ('Durée d\'un match (minutes)', nombre('pl-duree', r.duree, 1))}
        ${champ('Battement entre deux matchs (minutes)', nombre('pl-battement', r.battement))}
        ${champ('Pause minimale d\'une équipe (minutes)', nombre('pl-pause', r.pause))}
        ${rythmes}
      </div>
      <p class="discret petit">Rythme : avec 3 et 1, le planning place trois tours masculins, puis un tour féminin, et recommence.</p>
      <button class="principal" data-action="planning-calculer"${pretes ? '' : ' disabled'}>Calculer le planning</button>
      ${pretes ? '' : '<p class="discret petit" style="margin-top:8px">Faites d\'abord le tirage des deux tournois (rubrique Tirage, en changeant de tournoi dans le menu).</p>'}
    </div>
    ${resume}
    <div class="ligne" style="justify-content:space-between;margin-bottom:8px"><h2>Grille de la journée</h2><button data-action="planning-imprimer">Imprimer la grille</button></div>
    <div id="grille-planning">${htmlGrille(evenement)}</div>
  </section>`;
}

/** Réactions aux clics de la rubrique. `outils` vient de table.js. */
export function actionsPlanning({ etat, $, dire, enregistrer, maintenant }) {
  return {
    'planning-calculer': () => {
      const e = etat.evenement;
      const rythme = Object.fromEntries(e.tournois.map((t) => [t.cle, Math.max(1, Number($(`#pl-rythme-${t.cle}`).value) || 1)]));
      const r = {
        nbTerrains: Math.max(1, Number($('#pl-terrains').value) || 1), debut: $('#pl-debut').value || '09:00', fin: $('#pl-fin').value || '18:00',
        duree: Math.max(1, Number($('#pl-duree').value) || 12), battement: Math.max(0, Number($('#pl-battement').value) || 0),
        pause: Math.max(0, Number($('#pl-pause').value) || 0), rythme,
      };
      if (e.tournois.some((t) => t.demarre) && !window.confirm('Des matchs sont déjà joués. Recalculer peut déplacer les matchs restants. Continuer ?')) return;
      try {
        const plan = planifier(e.tournois, r);
        let suivant = e;
        for (const t of e.tournois) suivant = appliquer(suivant, t.cle, (x) => actions.definirCreneaux(x, plan.creneaux[t.cle]), maintenant());
        // Le nombre de terrains et la durée des matchs suivent dans les paramètres de chaque tournoi.
        for (const t of e.tournois) suivant = appliquer(suivant, t.cle, (x) => ({ tournoi: { ...x, parametres: { ...x.parametres, nbLieux: r.nbTerrains, dureeMatch: r.duree } }, trace: null }), maintenant());
        suivant = modifierEvenement(suivant, { planning: { ...r, resultat: { nbMatchs: plan.nbMatchs, debut: plan.debut, fin: plan.fin, depasse: plan.depasse } } }, null, maintenant());
        enregistrer(suivant, 'Planning calculé');
        dire(plan.depasse ? `Planning calculé, mais il finit à ${plan.fin}.` : `Planning calculé : fin à ${plan.fin}.`, plan.depasse);
      } catch (err) { dire(err.message, true); }
    },
    'planning-imprimer': () => {
      $('#impression').innerHTML = `<h1>${h(etat.evenement.nom)}</h1><h2>Planning de la journée</h2>${$('#grille-planning').innerHTML}`;
      window.print();
    },
  };
}

/** Changement de formule (bouton radio). Appelé par table.js. */
export function changerFormule({ etat, enregistrer, maintenant, dire }, cle, variante) {
  try {
    enregistrer(appliquer(etat.evenement, cle, (x) => actions.choisirVariante(x, variante), maintenant()), 'Formule changée');
    dire('Formule changée. Le tirage de ce tournoi est à refaire.');
  } catch (err) { dire(err.message, true); }
}
