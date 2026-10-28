import test from 'node:test';
import assert from 'node:assert/strict';
import {livraisonSicaPrevue,prochaineCommande} from '../src/volailles/livraisonPrevue.ts';
test('SICA : une date planifiee est affichee tant qu’elle n’a pas ete livree',()=>{
 assert.deepEqual(livraisonSicaPrevue('2026-10-29',['2026-10-20'],'2026-10-28'),{date:'2026-10-29',retard:false});
 assert.deepEqual(livraisonSicaPrevue('2026-10-28',[],'2026-10-28'),{date:'2026-10-28',retard:false});
});
test('SICA : une date passee sans mouvement est signalee a revoir',()=>{
 assert.deepEqual(livraisonSicaPrevue('2026-10-20',[],'2026-10-28'),{date:'2026-10-20',retard:true});
});
test('SICA : une ancienne planification livree ne devient pas une nouvelle prevision',()=>{
 assert.equal(livraisonSicaPrevue('2026-10-20',['2026-10-20'],'2026-10-28').date,null);
 assert.equal(livraisonSicaPrevue(null,[],'2026-10-28').date,null);
});
test('vente directe : choisir la premiere commande en attente du lot',()=>{
 const commandes=[{lot_id:'a',delivery_date:'2026-10-10',status:'annulee'},{lot_id:'a',delivery_date:'2026-10-11',status:'livree'},{lot_id:'b',delivery_date:'2026-10-12',status:'a_preparer'},{lot_id:'a',delivery_date:'2026-10-30',status:'a_preparer'},{lot_id:'a',delivery_date:'2026-10-25',status:'prete'}];
 assert.equal(prochaineCommande(commandes,'a').delivery_date,'2026-10-25');
 assert.equal(commandes[0].status,'annulee');
 assert.equal(prochaineCommande(commandes,'inconnu'),null);
});
