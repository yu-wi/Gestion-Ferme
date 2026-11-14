import test from 'node:test';
import assert from 'node:assert/strict';
import {preparerAjoutProduit,trierAjoutsProduits} from '../src/aquaponie/ajoutsProduits.ts';
const form={id:'a',nom:' Produit ',quantite:'12.5',unite:'g',date:'2026-11-10',heure:'08:30',cible:'bassin',cibleId:'b',notes:''};
const bassins=[{id:'b',name:'B1'}],cuves=[{id:'c',name:'C1'}];
const prepare=(change={},ancien)=>preparerAjoutProduit({...form,...change},bassins,cuves,ancien);
test('enregistre la quantité, unité, destination et heure réelle',()=>{const p=prepare();assert.equal(p.product_name,'Produit');assert.equal(p.quantity,12.5);assert.equal(p.basin_id,'b');assert.equal(p.tank_id,null);assert.equal(p.addition_time,'08:30');assert.equal(p.target_label,'Bassin : B1');});
test('refuse quantités invalides, unité absente, dates et heures invalides',()=>{for(const change of [{quantite:''},{quantite:'0'},{quantite:'-1'},{quantite:'Infinity'},{quantite:'NaN'},{unite:''},{date:'2026-02-30'},{heure:'24:00'},{nom:' '},{cibleId:'c'}])assert.throws(()=>prepare(change));});
test('distingue cuve et circuit sans réutiliser le bassin',()=>{assert.equal(prepare({cible:'cuve',cibleId:'c'}).tank_id,'c');const p=prepare({cible:'systeme'});assert.equal(p.basin_id,null);assert.equal(p.tank_id,null);assert.equal(p.target_label,'Circuit complet');});
test('conserve la destination historique supprimée lors de la correction',()=>{const ancien={...prepare(),basin_id:null};assert.equal(prepare({cibleId:''},ancien).target_label,'Bassin : B1');assert.throws(()=>prepare({cible:'cuve',cibleId:''},ancien));});
test('trie par date puis heure sans modifier la liste source',()=>{const a={...prepare(),id:'a',addition_time:'08:00'},b={...a,id:'b',addition_time:'10:00'},c={...a,id:'c',addition_date:'2026-11-11'};const source=[a,c,b];assert.deepEqual(trierAjoutsProduits(source).map(x=>x.id),['c','b','a']);assert.equal(source[0],a);});
test('repères : heure Martinique, période exclusive, bassins sélectionnés et circuit et cuves',async()=>{
  const {reperesProduits}=await import('../src/aquaponie/ajoutsProduits.ts');
  const a=prepare(),debut=Date.parse('2026-11-10T00:00:00-04:00'),fin=debut+86400000;
  const lignes=[a,{...a,id:'systeme',target_type:'systeme',basin_id:null},{...a,id:'cuve',target_type:'cuve',basin_id:null,tank_id:'c'},{...a,id:'autre',basin_id:'autre'},{...a,id:'demain',addition_date:'2026-11-11',addition_time:'00:00'},{...a,id:'invalide',addition_time:''}];
  const r=reperesProduits(lignes,['b'],debut,fin);assert.deepEqual(r.map(a=>a.id),['a','cuve','systeme']);assert.equal(r[0].instant,Date.parse('2026-11-10T12:30:00Z'));assert.equal(reperesProduits(lignes,[],debut,fin).length,0);
});
