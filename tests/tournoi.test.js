import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculer } from '../src/moteur/tournoi.js';
import { simulerTournoi } from '../src/moteur/simulation.js';
import { creerTournoi, definirEquipes, tirerAuSort, saisirScore, declarerForfait, echangerDansTirage, modifierParametres, trancherEgalite, lireListeEquipes } from '../src/moteur/actions.js';
import { taillesPoules } from '../src/moteur/poules.js';

/** Vérifie toutes les propriétés exigées par le cahier des charges sur un tournoi terminé. */
function verifier(tournoi, n, etiquette) {
  const vue = calculer(tournoi);
  assert.equal(vue.termine, true, `${etiquette} : tournoi terminé`);
  assert.deepEqual(vue.alertes.filter((a) => a.type === 'meme-poule'), [], `${etiquette} : même poule d'origine`);

  // Aucun match en double, aucune paire jouée deux fois dans une même étape de poules.
  const ids = vue.matchs.map((m) => m.id);
  assert.equal(new Set(ids).size, ids.length, `${etiquette} : identifiants uniques`);
  for (const etape of vue.etapes.filter((e) => e.type === 'poules')) {
    const paires = new Set();
    for (const g of etape.groupes) for (const m of g.matchs) {
      const cle = [m.a, m.b].sort((x, y) => x - y).join('-');
      assert.ok(!paires.has(cle), `${etiquette} : paire ${cle} jouée deux fois en ${etape.id}`);
      paires.add(cle);
    }
  }

  for (const manche of vue.manches) {
    // Une équipe n'a jamais deux matchs dans la même manche.
    const equipes = manche.matchs.flatMap((m) => [m.a, m.b]);
    assert.equal(new Set(equipes).size, equipes.length, `${etiquette} : deux matchs en même temps (${manche.etape} tour ${manche.tour})`);
    // Deux matchs ne partagent jamais la même planche au même moment.
    const planches = manche.matchs.map((m) => `${m.vague}-${m.lieu}`);
    assert.equal(new Set(planches).size, planches.length, `${etiquette} : planche en double (${manche.etape} tour ${manche.tour})`);
    for (const m of manche.matchs) assert.ok(m.lieu >= 1 && m.lieu <= vue.parametres.nbLieux, `${etiquette} : planche ${m.lieu} hors limites`);
  }

  // Chaque équipe joue le nombre de matchs annoncé : (taille de poule - 1) à chaque étape de poules.
  for (const etape of vue.etapes.filter((e) => e.type === 'poules')) {
    for (const g of etape.groupes) for (const l of g.classement) {
      assert.equal(l.j, g.places.length - 1, `${etiquette} : matchs joués en ${etape.id} poule ${g.id}`);
    }
    const placees = etape.groupes.flatMap((g) => g.places.map((p) => p.equipe));
    assert.equal(new Set(placees).size, n, `${etiquette} : chaque équipe une seule fois en ${etape.id}`);
  }

  // Classement final : chaque équipe exactement une fois.
  const classees = vue.classementFinal.map((l) => l.equipe);
  assert.equal(classees.length, n, `${etiquette} : taille du classement final`);
  assert.equal(new Set(classees).size, n, `${etiquette} : classement final sans doublon`);
  assert.ok(classees.every((x) => x != null));
  return vue;
}

test('palets : simulations complètes à 64, 60, 57, 48 et 32 équipes', () => {
  for (const n of [64, 60, 57, 48, 32]) {
    for (const graine of [1, 2, 3]) verifier(simulerTournoi({ format: 'palets', n, graine }), n, `palets ${n} (graine ${graine})`);
  }
});

test('cornhole : simulations complètes à 32, 30 et 28 équipes', () => {
  for (const n of [32, 30, 28]) {
    for (const graine of [1, 2, 3]) verifier(simulerTournoi({ format: 'cornhole', n, graine }), n, `cornhole ${n} (graine ${graine})`);
  }
});

test('tous les effectifs de 8 à 70 équipes fonctionnent, dans les deux formats', () => {
  for (const format of ['palets', 'cornhole']) {
    for (let n = 8; n <= 70; n++) verifier(simulerTournoi({ format, n, graine: n, parametres: { nbLieux: 40 } }), n, `${format} ${n}`);
  }
});

test('palets 64 : structure et planches identiques au Sheet', () => {
  const t = simulerTournoi({ format: 'palets', n: 64, graine: 5 });
  const vue = calculer(t);
  const [phase1, phase2, finales] = vue.etapes;
  assert.equal(phase1.groupes.length, 16);
  assert.equal(phase2.groupes.length, 16);
  assert.deepEqual(phase2.groupes.map((g) => g.id).slice(0, 5), ['P1', 'P2', 'P3', 'P4', 'PC1']);
  assert.equal(vue.matchs.length, 96 + 96 + 4 * 14);
  // Au moins 7 matchs par équipe (3 + 3 + au moins 1).
  const parEquipe = new Map();
  for (const m of vue.matchs) for (const e of [m.a, m.b]) parEquipe.set(e, (parEquipe.get(e) || 0) + 1);
  assert.ok([...parEquipe.values()].every((x) => x >= 7 && x <= 9));
  // Phase 1 : poule A sur les planches 1 et 2, poule P sur 31 et 32, aux trois tours.
  const p1 = (id) => vue.matchs.find((m) => m.id === id).lieu;
  assert.equal(p1('phase1:A:1:1'), 1);
  assert.equal(p1('phase1:A:1:2'), 2);
  assert.equal(p1('phase1:B:2:1'), 3);
  assert.equal(p1('phase1:P:3:2'), 32);
  // Phase 2 : Principale 1 à 8, Principale Challenge 9 à 16, Consolante 17 à 24, Consolante Challenge 25 à 32.
  assert.equal(p1('phase2:P1:1:1'), 1);
  assert.equal(p1('phase2:PC1:1:1'), 9);
  assert.equal(p1('phase2:C1:2:1'), 17);
  assert.equal(p1('phase2:CC4:3:2'), 32);
  // Phases finales : mêmes planches que l'onglet « Phases finales » du Sheet.
  assert.equal(p1('finales:P:Q1'), 1);
  assert.equal(p1('finales:P:C3A'), 5);
  assert.equal(p1('finales:P:C4B'), 8);
  assert.equal(p1('finales:PC:Q1'), 9);
  assert.equal(p1('finales:P:D1'), 1);
  assert.equal(p1('finales:P:C58A'), 3);
  assert.equal(p1('finales:CC:D1'), 25);
  assert.equal(p1('finales:P:F'), 1);
  assert.equal(p1('finales:P:PF'), 2);
  assert.equal(p1('finales:C:F'), 17);
  // Classement général : Principale 1 à 16, puis Principale Challenge 17 à 32, etc.
  assert.deepEqual(vue.classementFinal.slice(0, 6).map((l) => l.place), ['1', '2', '3', '4', '5 à 6', '5 à 6']);
  assert.equal(vue.classementFinal[16].place, '17');
  assert.equal(vue.classementFinal[16].niveau, 'Principale Challenge');
  assert.equal(vue.classementFinal[63].place, '63 à 64');
  assert.equal(vue.classementFinal[20].placeNiveau, '5 à 6');
  assert.equal(vue.classementFinal[20].place, '21 à 22');
  assert.equal(finales.tableaux.length, 4);
});

test("cornhole 32 : 2 niveaux, planches 1 à 8 et 9 à 16, classement 1 à 32", () => {
  const vue = calculer(simulerTournoi({ format: 'cornhole', n: 32, graine: 9 }));
  const lieu = (id) => vue.matchs.find((m) => m.id === id).lieu;
  assert.equal(vue.etapes[1].groupes.length, 8);
  assert.equal(lieu('finales:P:Q1'), 1);
  assert.equal(lieu('finales:C:Q1'), 9);
  assert.equal(lieu('finales:C:D2'), 10);
  assert.equal(lieu('finales:C:PF'), 10);
  assert.equal(vue.classementFinal.length, 32);
  assert.equal(vue.classementFinal[16].place, '17');
  assert.equal(vue.classementFinal[16].niveau, 'Consolante');
});

test('le tirage est aléatoire, reproductible avec la même graine, et modifiable avant le début', () => {
  let t = creerTournoi({ format: 'palets' });
  t = definirEquipes(t, Array.from({ length: 64 }, (_, i) => ({ nom: `E${i + 1}` }))).tournoi;
  const a = tirerAuSort(t, 123).tournoi;
  const b = tirerAuSort(t, 123).tournoi;
  const c = tirerAuSort(t, 124).tournoi;
  assert.deepEqual(a.tirage.poules, b.tirage.poules);
  assert.notDeepEqual(a.tirage.poules, c.tirage.poules);
  assert.notDeepEqual(a.tirage.poules.flat(), Array.from({ length: 64 }, (_, i) => i + 1), "pas dans l'ordre d'inscription");
  assert.deepEqual(a.tirage.poules.flat().slice().sort((x, y) => x - y), Array.from({ length: 64 }, (_, i) => i + 1));
  // Échange manuel avant le premier match.
  const [x, y] = [a.tirage.poules[0][0], a.tirage.poules[5][2]];
  const d = echangerDansTirage(a, x, y).tournoi;
  assert.equal(d.tirage.poules[0][0], y);
  assert.equal(d.tirage.poules[5][2], x);
  // Après le premier score, le tirage est verrouillé.
  const e = saisirScore(d, 'phase1:A:1:1', { a: 11, b: 3 }).tournoi;
  assert.throws(() => tirerAuSort(e, 1), /démarré/);
  assert.throws(() => echangerDansTirage(e, x, y), /démarré/);
});

test('les poules de phase 2 se remplissent dès que la poule d\'origine est terminée', () => {
  let t = creerTournoi({ format: 'palets' });
  t = definirEquipes(t, Array.from({ length: 64 }, (_, i) => ({ nom: `E${i + 1}` }))).tournoi;
  t = tirerAuSort(t, 4).tournoi;
  let vue = calculer(t);
  assert.ok(vue.etapes[1].groupes[0].places.every((p) => p.equipe == null));
  assert.equal(vue.etapes[1].groupes[0].places[0].origine, '1er A');
  for (const m of vue.etapes[0].groupes[0].matchs) t = saisirScore(t, m.id, { a: 11, b: m.index + m.tour }).tournoi;
  vue = calculer(t);
  const premierDeA = vue.etapes[0].groupes[0].classement[0].equipe;
  assert.equal(vue.etapes[1].groupes[0].places[0].equipe, premierDeA);
  assert.equal(vue.etapes[1].groupes[0].places[1].equipe, null, 'la poule E n\'est pas terminée');
});

test('saisie : nul possible en poule, impossible en phase finale sans départage', () => {
  let t = simulerTournoi({ format: 'cornhole', n: 8, graine: 2 });
  const vue = calculer(t);
  const finale = vue.matchs.find((m) => m.id.endsWith(':F'));
  assert.throws(() => saisirScore(t, finale.id, { a: 15, b: 15 }), /Match nul impossible/);
  t = saisirScore(t, finale.id, { a: 15, b: 15, vainqueur: 'b' }).tournoi;
  const f2 = calculer(t).matchs.find((m) => m.id === finale.id);
  assert.equal(f2.vainqueur, 'b');
  assert.throws(() => saisirScore(t, finale.id, { a: -1, b: 3 }), /entiers positifs/);
});

test('forfait : score des paramètres, compté tel quel', () => {
  let t = creerTournoi({ format: 'palets' });
  t = definirEquipes(t, Array.from({ length: 8 }, (_, i) => ({ nom: `E${i + 1}` }))).tournoi;
  t = tirerAuSort(t, 1).tournoi;
  const r = declarerForfait(t, 'phase1:A:1:1', 'a');
  assert.deepEqual(r.tournoi.scores['phase1:A:1:1'], { a: 0, b: 11, forfait: 'a' });
});

test('correction de score : tracée ou interdite selon le paramètre', () => {
  let t = creerTournoi({ format: 'palets' });
  t = definirEquipes(t, Array.from({ length: 8 }, (_, i) => ({ nom: `E${i + 1}` }))).tournoi;
  t = tirerAuSort(t, 1).tournoi;
  t = saisirScore(t, 'phase1:A:1:1', { a: 11, b: 3 }).tournoi;
  const correction = saisirScore(t, 'phase1:A:1:1', { a: 11, b: 4 });
  assert.equal(correction.trace.type, 'correction');
  assert.deepEqual(correction.trace.ancien, { a: 11, b: 3 });
  assert.deepEqual(correction.trace.nouveau, { a: 11, b: 4 });
  const strict = modifierParametres(t, { correctionScore: 'interdite' }).tournoi;
  assert.throws(() => saisirScore(strict, 'phase1:A:1:1', { a: 11, b: 4 }), /interdites/);
});

test('égalité parfaite : alerte, puis la décision de la table change la suite du tournoi', () => {
  let t = creerTournoi({ format: 'palets' });
  t = definirEquipes(t, Array.from({ length: 8 }, (_, i) => ({ nom: `E${i + 1}` }))).tournoi;
  t = tirerAuSort(t, 1).tournoi;
  let vue = calculer(t);
  for (const m of vue.etapes[0].groupes[0].matchs) t = saisirScore(t, m.id, { a: 5, b: 5 }).tournoi;
  vue = calculer(t);
  const alerte = vue.alertes.find((a) => a.type === 'egalite');
  assert.ok(alerte, 'la table est alertée');
  assert.equal(alerte.equipes.length, 4);
  const inverse = alerte.equipes.slice().reverse();
  t = trancherEgalite(t, alerte.cle, inverse).tournoi;
  vue = calculer(t);
  assert.equal(vue.alertes.filter((a) => a.type === 'egalite').length, 0);
  assert.deepEqual(vue.etapes[0].groupes[0].classement.map((l) => l.equipe), inverse);
});

test('changer le barème depuis les paramètres recalcule les classements', () => {
  const t = simulerTournoi({ format: 'palets', n: 16, graine: 3 });
  const avant = calculer(t).etapes[0].groupes[0].classement.map((l) => l.pts);
  const apres = calculer(modifierParametres(t, { points: { victoire: 2, nul: 1, defaite: 0 } }).tournoi).etapes[0].groupes[0].classement.map((l) => l.pts);
  assert.ok(Math.max(...avant) > Math.max(...apres) || avant.join() !== apres.join());
});

test('lecture d\'une liste d\'équipes collée depuis un tableur', () => {
  const e = lireListeEquipes('Les Tireurs\tDupont Jean\tMartin Léa\n\n2;Les Pointeurs;Durand Paul\nSolo');
  assert.equal(e.length, 3);
  assert.deepEqual(e[0], { id: 1, nom: 'Les Tireurs', joueurs: ['Dupont Jean', 'Martin Léa'], present: true });
  assert.equal(e[1].nom, 'Les Pointeurs');
  assert.equal(e[2].nom, 'Solo');
});

test('performance : 64 équipes générées en moins de 2 s, un score recalculé en moins de 1 s', () => {
  let debut = performance.now();
  let t = creerTournoi({ format: 'palets' });
  t = definirEquipes(t, Array.from({ length: 64 }, (_, i) => ({ nom: `E${i + 1}` }))).tournoi;
  t = tirerAuSort(t, 1).tournoi;
  calculer(t);
  assert.ok(performance.now() - debut < 2000);
  const complet = simulerTournoi({ format: 'palets', n: 64, graine: 1 });
  debut = performance.now();
  calculer(saisirScore(complet, 'phase1:A:1:1', { a: 11, b: 2 }).tournoi);
  assert.ok(performance.now() - debut < 1000);
  assert.deepEqual(taillesPoules(64), Array(16).fill(4));
});
