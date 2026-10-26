import test from 'node:test';
import assert from 'node:assert/strict';
import { creerTarifsFiges, lireTarifsFiges } from '../src/volailles/tarifsFiges.ts';
import { calculerCoutAliment } from '../src/volailles/coutAliment.ts';
import { calculerChargesLot } from '../src/volailles/chargesLot.ts';
import { tarifsChargesParDefaut } from '../src/volailles/tarifsCharges.ts';

const refs = () => [{ feed_type: 'croissance', feed_price_ht: 20 }];
const conso = [{ feed_type: 'croissance', quantite_kg: 50 }];

test('le gel conserve les prix alimentaires après modification des références générales', () => {
  const references = refs();
  const snapshot = creerTarifsFiges(references, tarifsChargesParDefaut, 'archivage');
  references[0].feed_price_ht = 200;
  assert.equal(calculerCoutAliment(conso, snapshot.references, snapshot.tvaAliment), 40.84);
  assert.equal(calculerCoutAliment(conso, references), 408.4);
});

test('ramassage et transport ne suivent plus les tarifs généraux après le gel', () => {
  const tarifs = { ...tarifsChargesParDefaut };
  const snapshot = creerTarifsFiges(refs(), tarifs, 'archivage');
  tarifs.poultry_transport_price_ht = '1000';
  tarifs.poultry_collection_vat = '20';
  const charges = calculerChargesLot([], [{ quantite: 1000 }], 40.84, snapshot.tarifs);
  assert.equal(charges.find(c => c.type_charge === 'livraison').montant, 102.1);
  assert.equal(charges.find(c => c.type_charge === 'ramassage').montant, 153.53);
});

test('le gel des prix ne bloque pas une correction des quantités consommées', () => {
  const snapshot = creerTarifsFiges(refs(), tarifsChargesParDefaut, 'archivage');
  assert.equal(calculerCoutAliment([{ feed_type: 'croissance', quantite_kg: 100 }], snapshot.references, snapshot.tvaAliment), 81.68);
});

test('persistance JSON sans perte des tarifs, de la TVA et de la provenance du gel', () => {
  const snapshot = creerTarifsFiges(refs(), tarifsChargesParDefaut, 'historique');
  assert.deepEqual(lireTarifsFiges(JSON.stringify(snapshot)), snapshot);
  assert.equal(snapshot.origine, 'historique');
});

test('une archive corrompue ou incomplète ne retombe pas sur les prix actuels', () => {
  const snapshot = creerTarifsFiges(refs(), tarifsChargesParDefaut, 'archivage');
  for (const change of [{version:2}, {date:'invalide'}, {tvaAliment:-1}, {tarifs:{}},
    {references:[{feed_type:'croissance',feed_price_ht:-1}]}]) {
    assert.throws(() => lireTarifsFiges(JSON.stringify({...snapshot,...change})));
  }
});

test('les charges déjà validées conservent leurs corrections avec des tarifs figés', () => {
  const snapshot = creerTarifsFiges(refs(), tarifsChargesParDefaut, 'archivage');
  const charges = calculerChargesLot([{type_charge:'livraison',montant:90}], [{quantite:1000}], null, snapshot.tarifs);
  assert.equal(charges.find(c=>c.type_charge==='livraison').montant,90);
});
