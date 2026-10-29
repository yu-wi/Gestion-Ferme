import test from 'node:test';
import assert from 'node:assert/strict';
import {indicateursComparaison, comparerMesures} from '../src/volailles/comparaisonLots.ts';
const lot={resultat:1000,aliment:500,livres:500,poids:1000,morts:20,initial:1000,consommation:1500};
test('les indicateurs utilisent les sujets et le poids réellement livrés',()=>{
 assert.deepEqual(indicateursComparaison(lot),{margeSujet:2,alimentKg:.5,mortalite:2,consommation:1500,ratioAliment:1.5});
});
test('un dénominateur nul donne une mesure indisponible et non zéro',()=>{
 const m=indicateursComparaison({...lot,livres:0,poids:0,initial:0});
 assert.equal(m.margeSujet,null);assert.equal(m.alimentKg,null);assert.equal(m.mortalite,null);assert.equal(m.ratioAliment,null);
});
test('les données manquantes ne ressemblent pas à des performances gratuites ou exceptionnelles',()=>{
 const m=indicateursComparaison({...lot,resultat:null,aliment:null,consommation:null});
 assert.equal(m.margeSujet,null);assert.equal(m.alimentKg,null);assert.equal(m.consommation,null);assert.equal(m.ratioAliment,null);
});
test('les vrais montants nuls et marges négatives restent comparables',()=>{
 assert.equal(indicateursComparaison({...lot,aliment:0}).alimentKg,0);
 assert.equal(indicateursComparaison({...lot,resultat:-500}).margeSujet,-1);
});
test('les mesures absentes sont classées en dernier dans les deux sens',()=>{
 assert.deepEqual([null,2,0,-1].sort((a,b)=>comparerMesures(a,b,true)),[-1,0,2,null]);
 assert.deepEqual([null,2,0,-1].sort((a,b)=>comparerMesures(a,b,false)),[2,0,-1,null]);
});

import {selectionnerLotsRecents} from '../src/volailles/comparaisonLots.ts';
test('la selection recente utilise la derniere livraison, avant le tri des performances',()=>{
 const lots=[{id:'a',date:'2026-01-01',dateFin:'2026-10-28'},{id:'b',date:'2026-09-01',dateFin:'2026-10-01'},{id:'c',date:'2026-10-10',dateFin:null}];
 assert.deepEqual(selectionnerLotsRecents(lots,2).map(l=>l.id),['a','c']);
 assert.deepEqual(lots.map(l=>l.id),['a','b','c']);
 assert.equal(selectionnerLotsRecents(lots,null).length,3);
});
test('les derniers lots respectent la limite et les dates identiques restent stables',()=>{
 const lots=Array.from({length:12},(_,i)=>({id:String(i).padStart(2,'0'),date:`2026-10-${String(i+1).padStart(2,'0')}`}));
 assert.equal(selectionnerLotsRecents(lots,5).length,5);
 assert.equal(selectionnerLotsRecents(lots,10).length,10);
 assert.equal(selectionnerLotsRecents(lots,5)[0].id,'11');
 assert.deepEqual(selectionnerLotsRecents([{id:'b',date:'2026-01-01'},{id:'a',date:'2026-01-01'}],5).map(l=>l.id),['a','b']);
});
