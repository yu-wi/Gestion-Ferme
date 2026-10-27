import test from 'node:test';
import assert from 'node:assert/strict';
import {champsModifies,valeurJournal,borneDateJournal,echapperRechercheJournal} from '../src/pages/journalUtils.ts';
test('les valeurs avant/après distinguent zéro, faux et absence',()=>{
 const champs=champsModifies({montant:10,is_active:true},{montant:0,is_active:false});
 assert.equal(champs.length,2);assert.equal(champs[0].avant,10);assert.equal(champs[0].apres,0);
 assert.equal(valeurJournal(false),'Non');assert.equal(valeurJournal(0),'0');assert.equal(valeurJournal(null),'—');
});
test('les changements techniques ne masquent pas les vrais changements métier',()=>{
 assert.deepEqual(champsModifies({id:'a',updated_at:'hier',montant:10},{id:'a',updated_at:'demain',montant:10}),[]);
 assert.equal(champsModifies(null,{id:'a',montant:15})[0].apres,15);
 assert.equal(champsModifies({id:'a',montant:15},null)[0].avant,15);
});
test('les objets complexes restent consultables sans perte de valeurs',()=>{
 const object={tarif:.1415,tva:8.5};
 assert.deepEqual(JSON.parse(valeurJournal(object)),object);
 assert.equal(champsModifies({value:{tarif:10}},{value:{tarif:20}}).length,1);
});
test('les filtres de date couvrent la journée de Martinique, borne de fin exclusive',()=>{
 assert.equal(borneDateJournal('2026-10-27'),'2026-10-27T00:00:00-04:00');
 assert.equal(borneDateJournal('2026-10-31',true),'2026-11-01T00:00:00-04:00');
});
test('une recherche ne transforme pas les caractères de nom en jokers',()=>{
 assert.equal(echapperRechercheJournal('lot_10%'), 'lot\\_10\\%');
});
