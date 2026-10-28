import test from 'node:test';
import assert from 'node:assert/strict';
import {preparerSaisie} from '../src/volailles/saisieQuotidienne.ts';
const lots=[{id:'a',source:'sica',nom:'3126',arrivee:'2026-10-01',restants:10},{id:'b',source:'vente_directe',nom:'Direct',arrivee:'2026-10-10',restants:20}];
const stocks=[{feed_type:'DÉMARRAGE',stock_kg:100}];
const ligne=(id='a',source='sica',sacs='2',morts='1')=>({lot_id:id,source,aliment:'demarrage',sacs,morts});
const preparer=(lignes,date='2026-10-28')=>preparerSaisie(date,'2026-10-28',lignes,lots,stocks);
test('les deux sources utilisent leurs lots et convertissent les sacs en kg',()=>{
 const resultat=preparer([ligne(),ligne('b','vente_directe')]);
 assert.equal(resultat.length,2);assert.equal(resultat[0].quantite_kg,50);assert.equal(resultat[1].source,'vente_directe');
});
test('le stock est verifie sur le total des lots, avec normalisation des accents',()=>{
 assert.throws(()=>preparer([ligne(),ligne('b','vente_directe','3')]),/Stock insuffisant/);
});
test('les dates futures, impossibles et anterieures a l’arrivee sont bloquees',()=>{
 for(const date of ['2026-10-29','2026-02-30','2026-09-30',''])assert.throws(()=>preparer([ligne()],date));
});
test('les mortalites depassant les restants et les nombres invalides sont bloques',()=>{
 assert.throws(()=>preparer([ligne('a','sica','2','11')]),/10 sujets/);
 for(const n of ['-1','1.5','Infinity','abc']) {assert.throws(()=>preparer([ligne('a','sica',n)]));assert.throws(()=>preparer([ligne('a','sica','2',n)]));}
});
test('les champs vides et zeros ne creent pas de mouvements',()=>{
 assert.throws(()=>preparer([ligne('a','sica','','0')]),/au moins/);
 assert.equal(preparer([ligne('a','sica','','2')])[0].quantite_kg,0);
});
test('aliment manquant, lot inconnu et lot repete sont refuses',()=>{
 assert.throws(()=>preparer([{...ligne(),aliment:''}]),/choisissez/);
 assert.throws(()=>preparer([ligne('inconnu')]));
 assert.throws(()=>preparer([ligne(),ligne()]),/plusieurs/);
});
