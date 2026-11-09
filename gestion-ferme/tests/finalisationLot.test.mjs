import test from 'node:test';
import assert from 'node:assert/strict';
import {verifierFinalisationLot,verifierValeurFinalisation} from '../src/volailles/finalisationLot.ts';
const lot={resultat_brut:0,quantite_retenue:0,livraisons:[{}],sujets_restants:0};
const charges=['aliment','achat_poussins','ramassage','livraison'].map(type_charge=>({type_charge}));
test('une valeur zero enregistree est valide et toutes les verifications peuvent etre terminees',()=>{
 const v=verifierFinalisationLot(lot,charges,[],true);assert.equal(v.length,9);assert.ok(v.every(x=>x.fait));
});
test('les charges proposees restent a valider et les autres manquantes ouvrent une saisie',()=>{
 const v=verifierFinalisationLot(lot,charges.filter(c=>c.type_charge!=='achat_poussins'),['ramassage'],true).filter(x=>!x.fait);
 assert.equal(v.length,2);assert.equal(v[0].action,'charge');assert.equal(v[0].categorie,'achat_poussins');assert.equal(v[1].action,'validation');assert.equal(v[1].categorie,'ramassage');
});
test('recettes, retenue, tarifs, livraison et effectifs ont chacun une action ciblee',()=>{
 const v=verifierFinalisationLot({...lot,resultat_brut:null,quantite_retenue:null,livraisons:[],sujets_restants:5},charges,[],false).filter(x=>!x.fait);
 assert.deepEqual(v.map(x=>x.action),['tarifs','recettes','retenue','livraison','effectifs']);
});
test('une saisie vide ou invalide ne devient pas un zero de cloture',()=>{
 const s={valeur:'',date:'',quantite:'',poids:''};
 for(const action of ['charge','recettes','retenue','effectifs']){
  for(const valeur of ['', ' ', '-1', 'Infinity','abc'])assert.throws(()=>verifierValeurFinalisation(action,{...s,valeur}));
  assert.equal(verifierValeurFinalisation(action,{...s,valeur:'0'}),0);
 }
 assert.throws(()=>verifierValeurFinalisation('effectifs',{...s,valeur:'1.5'}));
 assert.equal(verifierValeurFinalisation('recettes',{...s,valeur:'12.5'}),12.5);
});
test('un effectif negatif ne permet pas de declarer le lot pret a cloturer',()=>{
 const v=verifierFinalisationLot({...lot,sujets_restants:-1},charges,[],true);
 const anomalie=v.find(x=>x.id==='effectifs');assert.equal(anomalie.fait,false);assert.match(anomalie.raison,/négatif/);
});
