import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import {creerFicheCloture,nomFichierFiche} from '../src/volailles/ficheCloture.ts';
import {construireClasseurFiche} from '../src/outils/exportFicheCloture.ts';
import {tarifsChargesParDefaut} from '../src/volailles/tarifsCharges.ts';
const lot={id:'l1',nom:'3126',batiment:'A',date_arrivee:'2026-07-30',age:74,quantite:1800,nb_morts:98,sujets_restants:0,autoconsommation:0,quantite_retenue:0,resultat_brut:12408.85,livraisons:[{date:'2026-10-12',quantite:850,poids:1700},{date:'2026-10-13',quantite:852,poids:1704}],mortalites:[{date:'2026-08-01',nombre:98}]};
const charges=[{type_charge:'aliment',montant:5604.78},{type_charge:'achat_poussins',montant:2121.92},{type_charge:'ramassage',montant:261.30},{type_charge:'livraison',montant:204.20}];
const options={aValider:[],alimentCalcule:true,consommations:[{date:'2026-08-01',feed_type:'croissance',quantite_kg:50}],references:[{feed_type:'croissance',feed_price_ht:2744.75}],tarifs:tarifsChargesParDefaut,tvaAliment:.021,gel:{date:'2026-10-26T12:00:00Z',origine:'historique'},date:'2026-10-28T02:00:00Z'};
test('la fiche reprend les montants du lot 3126 et les sujets réellement livrés',()=>{
 const f=creerFicheCloture(lot,charges,options);
 assert.equal(f.totalCharges,8192.20);assert.equal(f.marge,4216.65);assert.equal(f.livres,1702);assert.equal(f.poids,3404);assert.equal(f.statut,'Complète');
 assert.equal(f.charges.find(c=>c.type==='aliment').statut,'Calculé sur consommations');
});
test('les propositions, données manquantes et tarifs non figés rendent la fiche provisoire',()=>{
 const f=creerFicheCloture({...lot,quantite_retenue:null},charges.filter(c=>c.type_charge!=='achat_poussins'),{...options,aValider:['ramassage'],gel:null});
 assert.equal(f.statut,'Provisoire');assert.equal(f.raisons.length,4);
 assert.equal(f.charges.find(c=>c.type==='ramassage').statut,'Estimé · à valider');
});
test('une vraie valeur zéro reste distincte des données absentes',()=>{
 const f=creerFicheCloture({...lot,resultat_brut:0,livraisons:[]},[],{...options,consommations:[]});
 assert.equal(f.tauxMarge,null);assert.equal(f.poidsMoyen,null);assert.equal(f.consommationKg,null);
 assert.ok(!f.raisons.includes('Recettes non renseignées'));
 assert.ok(creerFicheCloture({...lot,resultat_brut:null},charges,options).raisons.includes('Recettes non renseignées'));
 assert.ok(!f.raisons.includes('Quantité retenue non renseignée'));
});
test('Excel contient des cellules numériques, les détails et les mêmes totaux après relecture',()=>{
 const f=creerFicheCloture(lot,charges,options);
 const book=construireClasseurFiche(f);
 const relu=XLSX.read(XLSX.write(book,{type:'buffer',bookType:'xlsx'}),{type:'buffer'});
 assert.deepEqual(relu.SheetNames,['Synthèse','Production','Charges','Livraisons','Mortalités','Consommations','Tarifs']);
 assert.equal(relu.Sheets['Synthèse'].B10.v,8192.20);assert.equal(relu.Sheets['Synthèse'].B10.t,'n');
 assert.equal(relu.Sheets['Synthèse'].B11.v,4216.65);
 assert.equal(relu.Sheets['Charges'].B2.v,5604.78);
 assert.equal(relu.Sheets['Livraisons'].B3.v,852);
 assert.equal(relu.Sheets['Consommations'].C2.v,50);
 assert.equal(relu.Sheets['Tarifs'].B2.v,.1415);
});
test('un nom contenant une formule reste du texte, et le nom de fichier est sécurisé',()=>{
 const f=creerFicheCloture({...lot,nom:'=1+1/élevage'},charges,options);
 const book=construireClasseurFiche(f);
 assert.equal(book.Sheets['Synthèse'].B2.t,'s');assert.equal(book.Sheets['Synthèse'].B2.f,undefined);
 assert.equal(nomFichierFiche(f),'fiche_lot__1_1_elevage_2026-10-27');
});
