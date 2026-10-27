import test from 'node:test';
import assert from 'node:assert/strict';
import {elementsManquantsLot} from '../src/volailles/lotACompleter.ts';
const lot = {id:'a',quantite_retenue:0,livraisons:[{quantite:1000}]};
const charges = ['achat_poussins','ramassage','livraison'].map(type_charge=>({lot_id:'a',type_charge}));
test('un lot renseigné disparaît de la liste, zéro saisi reste valide',()=>{
 assert.deepEqual(elementsManquantsLot(lot,charges,[{lot_id:'a'}],true),[]);
});
test('les charges proposées ne sont pas considérées comme déjà validées',()=>{
 const taches=elementsManquantsLot(lot,charges.filter(c=>c.type_charge==='achat_poussins'),[{lot_id:'a'}],true);
 assert.deepEqual(taches.map(t=>[t.categorie,t.action]),[['ramassage','analyse'],['livraison','analyse']]);
});
test('l’aliment peut provenir des consommations ou d’une charge manuelle',()=>{
 assert.equal(elementsManquantsLot(lot,[...charges,{lot_id:'a',type_charge:'aliment'}],[],true).length,0);
 assert.equal(elementsManquantsLot(lot,charges,[{lot_id:'autre'}],true)[0].categorie,'aliment');
});
test('les actions ciblent les données manquantes du lot, et non celles d’un autre lot',()=>{
 const taches=elementsManquantsLot({...lot,quantite_retenue:null},charges.filter(c=>c.type_charge!=='achat_poussins'),[{lot_id:'a'}],false);
 assert.deepEqual(taches.map(t=>t.action),['charges','quantite','analyse']);
 assert.equal(taches[0].categorie,'achat_poussins');
});
test('sans livraison, aucun calcul de transport ou ramassage n’est prétendu validable',()=>{
 const taches=elementsManquantsLot({...lot,livraisons:[]},[],[],true);
 assert.equal(taches[0].libelle,'Aucune livraison enregistrée');
 assert.ok(taches.filter(t=>t.categorie).every(t=>t.action==='charges'));
});
test('une catégorie Divers ou des doublons ne remplacent pas une catégorie requise',()=>{
 const taches=elementsManquantsLot(lot,[{lot_id:'a',type_charge:'divers'},...charges.filter(c=>c.type_charge!=='ramassage')],[{lot_id:'a'}],true);
 assert.equal(taches.length,1);assert.equal(taches[0].categorie,'ramassage');
});
