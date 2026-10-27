import test from 'node:test';
import assert from 'node:assert/strict';
import { categoriesChargesProposees, calculerChargesLivraisons, completerChargesLivraisons, lireTarifsCharges, tarifsChargesParDefaut } from '../src/volailles/tarifsCharges.ts';

test('tarifs initiaux et TVA distinctes : 1000 sujets sur deux livraisons', () => {
  assert.deepEqual(calculerChargesLivraisons([{ quantite: 400 }, { quantite: 600 }], tarifsChargesParDefaut), {
    ramassage: 153.53, livraison: 204.2,
  });
});
test('aucune livraison ne produit aucune charge', () => {
  assert.deepEqual(calculerChargesLivraisons([], tarifsChargesParDefaut), { ramassage: 0, livraison: 0 });
});
test('le transport compte les enregistrements, même le même jour', () => {
  assert.equal(calculerChargesLivraisons([{ quantite: 500 }, { quantite: 500 }, { quantite: 500 }], tarifsChargesParDefaut).livraison, 306.3);
});
test('les paramètres enregistrés remplacent les valeurs initiales', () => {
  const tarifs = lireTarifsCharges([
    { key: 'poultry_collection_price_ht', value: '0.2' },
    { key: 'poultry_collection_vat', value: '10' },
    { key: 'poultry_transport_price_ht', value: '50' },
    { key: 'poultry_transport_vat', value: '0' },
  ]);
  assert.deepEqual(calculerChargesLivraisons([{ quantite: 100 }], tarifs), { ramassage: 22, livraison: 50 });
});
test('les anciennes configurations sans ces clés utilisent les tarifs initiaux', () => {
  assert.deepEqual(lireTarifsCharges([{ key: 'sica_delivery_day', value: '70' }]), tarifsChargesParDefaut);
});
test('un paramètre invalide ne produit pas silencieusement un prix nul', () => {
  for (const value of ['', '-1', 'NaN', 'Infinity']) {
    assert.throws(() => lireTarifsCharges([{ key: 'poultry_collection_price_ht', value }]), /invalides/);
  }
});
test('la validation ne compte pas deux fois la charge et préserve les corrections', () => {
  const livraisons = [{ quantite: 1000 }];
  const avant = completerChargesLivraisons([], livraisons, tarifsChargesParDefaut);
  const apres = completerChargesLivraisons([{ type_charge: 'ramassage', montant: 153.53 }], livraisons, tarifsChargesParDefaut);
  assert.deepEqual(avant, apres);
  const corrigees = completerChargesLivraisons([{ type_charge: 'ramassage', montant: 120 }], livraisons, tarifsChargesParDefaut);
  assert.equal(corrigees.find(charge => charge.type_charge === 'ramassage').montant, 120);
});
test('les lignes existantes multiples sont conservées sans ajout automatique', () => {
  const charges = [{ type_charge: 'ramassage', montant: 50 }, { type_charge: 'ramassage', montant: 60 }, { type_charge: 'livraison', montant: 90 }];
  assert.deepEqual(completerChargesLivraisons(charges, [{ quantite: 1000 }], tarifsChargesParDefaut), charges);
  assert.deepEqual(completerChargesLivraisons([], [], tarifsChargesParDefaut), []);
});
test('les deux charges sont estimées avant validation puis enregistrées sans changer leur total', () => {
  const livraisons = [{ quantite: 1000 }];
  const charges = [];
  assert.deepEqual(categoriesChargesProposees(charges, livraisons), ['ramassage', 'livraison']);
  const avant = completerChargesLivraisons(charges, livraisons, tarifsChargesParDefaut);
  charges.push(avant[0]);
  assert.deepEqual(categoriesChargesProposees(charges, livraisons), ['livraison']);
  charges.push(avant[1]);
  assert.deepEqual(categoriesChargesProposees(charges, livraisons), []);
  assert.deepEqual(completerChargesLivraisons(charges, livraisons, tarifsChargesParDefaut), avant);
});
test('un montant zéro enregistré et les doublons ne deviennent pas des estimations', () => {
  assert.deepEqual(categoriesChargesProposees([
    {type_charge:'ramassage', montant:0}, {type_charge:'ramassage', montant:10},
    {type_charge:'livraison', montant:0},
  ], [{}]), []);
  assert.deepEqual(categoriesChargesProposees([], []), []);
});
