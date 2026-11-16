import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classerPoule, scoreRetenu } from '../src/moteur/classement.js';
import palets from '../src/formats/palets.js';

const P = palets.parametres;
const m = (a, b, sa, sb) => ({ a, b, score: sa == null ? null : { a: sa, b: sb } });
const ordre = (c) => c.lignes.map((l) => l.equipe);

test('barème 3/1/0 et différence', () => {
  const c = classerPoule({ equipes: [1, 2, 3, 4], parametres: P, matchs: [
    m(1, 2, 11, 5), m(3, 4, 11, 9), m(1, 3, 11, 10), m(2, 4, 7, 7), m(1, 4, 11, 0), m(2, 3, 3, 11),
  ] });
  assert.deepEqual(ordre(c), [1, 3, 4, 2]);
  assert.deepEqual(c.lignes.map((l) => l.pts), [9, 6, 1, 1]);
  assert.equal(c.terminee, true);
  assert.equal(c.egalites.length, 0);
});

test('un score supérieur à 11 compte pour 11', () => {
  assert.equal(scoreRetenu(13, P), 11);
  const c = classerPoule({ equipes: [1, 2], parametres: P, matchs: [m(1, 2, 13, 4)] });
  assert.equal(c.lignes[0].diff, 7);
});

test('critère 2 : la différence départage à points égaux', () => {
  // 1 bat 2, 2 bat 3, 3 bat 1 : 3 points chacun. Différences : 1 = +1, 2 = +4, 3 = -5.
  const c = classerPoule({ equipes: [1, 2, 3], parametres: P, matchs: [m(1, 2, 11, 5), m(2, 3, 11, 1), m(3, 1, 11, 6)] });
  assert.deepEqual(ordre(c), [2, 1, 3]);
  assert.equal(c.egalites.length, 0);
});

test('critère 3 : les points marqués départagent à différence égale', () => {
  // 1 et 2 font match nul, chacun bat 3 avec le même écart mais pas le même total marqué.
  const c = classerPoule({ equipes: [1, 2, 3], parametres: P, matchs: [m(1, 2, 6, 6), m(1, 3, 11, 5), m(2, 3, 9, 3)] });
  assert.deepEqual(ordre(c), [1, 2, 3]);
  assert.equal(c.egalites.length, 0);
});

test('égalité parfaite à 2 : alerte, ordre par défaut stable, puis décision de la table', () => {
  const matchs = [m(1, 2, 6, 6), m(1, 3, 11, 5), m(2, 3, 11, 5)];
  const c1 = classerPoule({ equipes: [1, 2, 3], parametres: P, matchs, cle: 'x', graine: 7 });
  assert.equal(c1.egalites.length, 1);
  assert.deepEqual(c1.egalites[0].equipes.slice().sort(), [1, 2]);
  assert.equal(c1.egalites[0].resolue, false);
  assert.equal(c1.lignes[0].egalite, 'en-cours');
  // Même graine : même ordre par défaut (tirage au sort figé).
  assert.deepEqual(ordre(classerPoule({ equipes: [1, 2, 3], parametres: P, matchs, cle: 'x', graine: 7 })), ordre(c1));
  // La table tranche : 2 devant 1.
  const c2 = classerPoule({ equipes: [1, 2, 3], parametres: P, matchs, cle: 'x', graine: 7, decision: [2, 1] });
  assert.deepEqual(ordre(c2), [2, 1, 3]);
  assert.equal(c2.egalites[0].resolue, true);
  const c3 = classerPoule({ equipes: [1, 2, 3], parametres: P, matchs, cle: 'x', graine: 7, decision: [1, 2] });
  assert.deepEqual(ordre(c3), [1, 2, 3]);
});

test('égalité parfaite à 3 et à 4', () => {
  const nuls3 = [m(1, 2, 5, 5), m(1, 3, 5, 5), m(2, 3, 5, 5)];
  const c3 = classerPoule({ equipes: [1, 2, 3], parametres: P, matchs: nuls3, graine: 1 });
  assert.equal(c3.egalites[0].equipes.length, 3);
  assert.deepEqual(ordre(classerPoule({ equipes: [1, 2, 3], parametres: P, matchs: nuls3, graine: 1, decision: [3, 1, 2] })), [3, 1, 2]);
  const nuls4 = [m(1, 2, 4, 4), m(3, 4, 4, 4), m(1, 3, 4, 4), m(2, 4, 4, 4), m(1, 4, 4, 4), m(2, 3, 4, 4)];
  const c4 = classerPoule({ equipes: [1, 2, 3, 4], parametres: P, matchs: nuls4, graine: 1 });
  assert.equal(c4.egalites[0].equipes.length, 4);
  assert.deepEqual(ordre(classerPoule({ equipes: [1, 2, 3, 4], parametres: P, matchs: nuls4, graine: 1, decision: [4, 3, 2, 1] })), [4, 3, 2, 1]);
});

test("pas d'alerte d'égalité tant que la poule n'est pas terminée", () => {
  const c = classerPoule({ equipes: [1, 2, 3], parametres: P, matchs: [m(1, 2, 5, 5), m(1, 3, null), m(2, 3, null)] });
  assert.equal(c.terminee, false);
  assert.equal(c.egalites.length, 0);
});

test('paramétrage : passer de 3/1/0 à 2/1/0 change le classement sans toucher au code', () => {
  // Équipe 1 : une victoire et deux défaites lourdes. Équipe 2 : deux nuls et une défaite courte.
  const matchs = [m(1, 2, 11, 10), m(3, 4, 11, 5), m(1, 3, 0, 11), m(2, 4, 6, 6), m(1, 4, 0, 11), m(2, 3, 7, 7)];
  const a = classerPoule({ equipes: [1, 2, 3, 4], parametres: P, matchs });
  const b = classerPoule({ equipes: [1, 2, 3, 4], parametres: { ...P, points: { victoire: 2, nul: 1, defaite: 0 } }, matchs });
  // À 3/1/0 : l'équipe 1 (3 points) devance l'équipe 2 (2 points).
  assert.deepEqual(a.lignes.map((l) => [l.equipe, l.pts]), [[3, 7], [4, 4], [1, 3], [2, 2]]);
  // À 2/1/0 : 2 points chacune, la différence fait passer l'équipe 2 devant.
  assert.deepEqual(b.lignes.map((l) => [l.equipe, l.pts]), [[3, 5], [4, 3], [2, 2], [1, 2]]);
});

test('critère « confrontation directe » utilisable dans la liste', () => {
  // 1 et 2 ont 6 points ; 1 a la meilleure différence, mais 2 a battu 1.
  const matchs = [m(1, 2, 5, 11), m(3, 4, 11, 0), m(1, 3, 11, 0), m(2, 4, 10, 11), m(1, 4, 11, 0), m(2, 3, 11, 10)];
  const sans = classerPoule({ equipes: [1, 2, 3, 4], parametres: P, matchs });
  const avec = classerPoule({ equipes: [1, 2, 3, 4], parametres: { ...P, criteres: ['points', 'confrontation', 'difference'] }, matchs });
  assert.deepEqual(ordre(sans).slice(0, 2), [1, 2]);
  assert.deepEqual(ordre(avec).slice(0, 2), [2, 1]);
});
