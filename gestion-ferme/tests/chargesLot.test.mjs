import test from 'node:test';
import assert from 'node:assert/strict';
import { calculerChargesLot } from '../src/volailles/chargesLot.ts';
import { calculerCoutAliment } from '../src/volailles/coutAliment.ts';
import { tarifsChargesParDefaut } from '../src/volailles/tarifsCharges.ts';
import { chargerPages } from '../src/volailles/chargerPages.ts';

test('historique et analyse utilisent les mêmes charges, aliment TTC compris', () => {
  const cout = calculerCoutAliment([{ feed_type: 'croissance', quantite_kg: 50 }], [{ feed_type: 'croissance', feed_price_ht: 20 }]);
  const calculees = calculerChargesLot([{ type_charge: 'achat_poussins', montant: 100 }], [{ quantite: 1000 }], cout, tarifsChargesParDefaut);
  assert.deepEqual(calculees, [
    { type_charge: 'achat_poussins', montant: 100 },
    { type_charge: 'ramassage', montant: 153.53 },
    { type_charge: 'livraison', montant: 102.1 },
    { type_charge: 'aliment', montant: 40.84 },
  ]);
  assert.equal(calculees.reduce((somme, charge) => somme + charge.montant, 0).toFixed(2), '396.47');
});
test('aucun double comptage de l’aliment et respect des charges validées ou corrigées', () => {
  const calculees = calculerChargesLot([
    { type_charge: 'aliment', montant: 500 }, { type_charge: 'aliment', montant: 200 },
    { type_charge: 'ramassage', montant: 120 }, { type_charge: 'livraison', montant: 90 },
    { type_charge: 'divers', montant: 10 },
  ], [{ quantite: 1000 }], 40.84, tarifsChargesParDefaut);
  assert.deepEqual(calculees.map(c => c.montant), [120, 90, 10, 40.84]);
});
test('sans consommation, une charge alimentaire manuelle reste conservée', () => {
  assert.deepEqual(calculerChargesLot([{ type_charge: 'aliment', montant: 50 }], [], null, tarifsChargesParDefaut), [{ type_charge: 'aliment', montant: 50 }]);
});
test('régression lot 3126 : le total de gestion inclut les 5 604,78 euros d’aliment', () => {
  // Montants fournis par les captures, sans accéder à la base de production.
  const enregistrees = [
    { id: 1, type_charge: 'ramassage', montant: 261.30 },
    { id: 2, type_charge: 'livraison', montant: 204.20 },
    { id: 3, type_charge: 'achat_poussins', montant: 2121.92 },
  ];
  const lignes = calculerChargesLot(enregistrees, [{ quantite: 850 }, { quantite: 852 }], 5604.78, tarifsChargesParDefaut);
  assert.equal(lignes.length, 4);
  const total = lignes.reduce((s, c) => s + c.montant, 0);
  assert.equal(total.toFixed(2), '8192.20');
  assert.equal((total / 1702).toFixed(2), '4.81');
  // Les lignes enregistrées gardent leur identité pour leurs actions modifier/supprimer.
  assert.equal(lignes[0], enregistrees[0]);
  assert.equal(lignes[1], enregistrees[1]);
  assert.equal(lignes[2], enregistrees[2]);
  assert.equal(enregistrees.includes(lignes[3]), false);
  assert.equal((lignes.reduce((s, c) => s + c.montant / total * 100, 0)).toFixed(1), '100.0');
});
test('les filtres des lots excluent leurs charges du total affiché', () => {
  const lots = [
    { id: 'visible', charges: calculerChargesLot([], [], 40.84, tarifsChargesParDefaut) },
    { id: 'masque', charges: calculerChargesLot([], [], 200, tarifsChargesParDefaut) },
  ];
  const total = lots.filter(lot => lot.id === 'visible').flatMap(lot => lot.charges).reduce((s, c) => s + c.montant, 0);
  assert.equal(total, 40.84);
});
test('plus de 1000 consommations : toutes les pages alimentent le calcul', async () => {
  const toutes = Array.from({ length: 1001 }, () => ({ feed_type: 'croissance', quantite_kg: 25 }));
  const plages = [];
  const chargees = await chargerPages(async (debut, fin) => {
    plages.push([debut, fin]);
    return { data: toutes.slice(debut, fin + 1), error: null };
  });
  assert.equal(chargees.length, 1001);
  assert.deepEqual(plages, [[0, 999], [1000, 1999]]);
  assert.equal(calculerCoutAliment(chargees, [{ feed_type: 'croissance', feed_price_ht: 10 }]), 10220.21);
});
test('un échec sur une page ne retourne pas de données financières partielles', async () => {
  await assert.rejects(chargerPages(async debut => debut === 0
    ? { data: Array(1000).fill({}), error: null }
    : { data: null, error: new Error('accès refusé') }), /accès refusé/);
});
