import { test } from 'node:test';
import assert from 'node:assert/strict';
import { construireTableau } from '../src/moteur/tableau.js';

const poules = (prefixe, tailles) => tailles.map((taille, i) => ({ id: `${prefixe}${i + 1}`, taille }));
const lire = (r) => (r.type === 'rang' ? `${r.groupe}-${r.rang}` : `${r.type === 'vainqueur' ? 'V' : 'P'}(${r.match.split(':').pop()})`);
const parId = (t) => Object.fromEntries(t.matchs.map((m) => [m.id.split(':').pop(), `${lire(m.a)} / ${lire(m.b)}`]));

test('4 poules : croisements et matchs de classement identiques aux Sheets', () => {
  const t = construireTableau({ prefixe: 'f:P', poules: poules('P', [4, 4, 4, 4]) });
  const m = parId(t);
  assert.equal(m.Q1, 'P1-1 / P2-2');
  assert.equal(m.Q2, 'P3-1 / P4-2');
  assert.equal(m.Q3, 'P2-1 / P1-2');
  assert.equal(m.Q4, 'P4-1 / P3-2');
  assert.equal(m.C3A, 'P1-3 / P2-3');
  assert.equal(m.C3B, 'P3-3 / P4-3');
  assert.equal(m.C4A, 'P1-4 / P2-4');
  assert.equal(m.C4B, 'P3-4 / P4-4');
  assert.equal(m.D1, 'V(Q1) / V(Q2)');
  assert.equal(m.D2, 'V(Q3) / V(Q4)');
  assert.equal(m.C58A, 'P(Q1) / P(Q2)');
  assert.equal(m.C58B, 'P(Q3) / P(Q4)');
  assert.equal(m.F, 'V(D1) / V(D2)');
  assert.equal(m.PF, 'P(D1) / P(D2)');
  // Ordre des matchs par tour = ordre des planches du Sheet.
  assert.deepEqual(t.matchs.map((x) => `${x.tour}:${x.id.split(':').pop()}`), [
    '1:Q1', '1:Q2', '1:Q3', '1:Q4', '1:C3A', '1:C3B', '1:C4A', '1:C4B',
    '2:D1', '2:D2', '2:C58A', '2:C58B', '3:F', '3:PF',
  ]);
  // Places : 1, 2, 3, 4, 5 à 6, 7 à 8, 9 à 10, 11 à 12, 13 à 14, 15 à 16.
  assert.deepEqual(t.paliers.map((p) => p.length), [1, 1, 1, 1, 2, 2, 2, 2, 2, 2]);
  assert.deepEqual(t.paliers[4].map(lire), ['V(C58A)', 'V(C58B)']);
  assert.deepEqual(t.paliers[8].map(lire), ['V(C4A)', 'V(C4B)']);
});

test('2 poules : demies croisées, finale, petite finale', () => {
  const t = construireTableau({ prefixe: 'f:P', poules: poules('P', [4, 4]) });
  const m = parId(t);
  assert.equal(m.D1, 'P1-1 / P2-2');
  assert.equal(m.D2, 'P2-1 / P1-2');
  assert.equal(m.C3A, 'P1-3 / P2-3');
  assert.deepEqual(t.paliers.map((p) => p.length), [1, 1, 1, 1, 1, 1, 1, 1]);
});

test('tous les cas de 1 à 8 poules, poules de 3 ou 4 : chaque équipe a exactement une place', () => {
  for (let k = 1; k <= 8; k++) {
    for (const tailles of [Array(k).fill(4), Array(k).fill(3), Array.from({ length: k }, (_, i) => (i === k - 1 ? 3 : 4))]) {
      const t = construireTableau({ prefixe: 'f:X', poules: poules('X', tailles) });
      const total = tailles.reduce((a, b) => a + b, 0);
      assert.equal(t.paliers.flat().length, total, `k=${k} tailles=${tailles}`);
      const ids = t.matchs.map((x) => x.id);
      assert.equal(new Set(ids).size, ids.length, 'identifiants de matchs uniques');
      // Aucun premier tour entre deux équipes d'une même poule (sauf poule unique).
      if (k > 1) for (const x of t.matchs) {
        if (x.a.type === 'rang' && x.b.type === 'rang' && x.principal) assert.notEqual(x.a.groupe, x.b.groupe, `k=${k} ${x.id}`);
      }
    }
  }
});
