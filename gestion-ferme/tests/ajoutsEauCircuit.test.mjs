import test from 'node:test';
import assert from 'node:assert/strict';
import {preparerAjoutEauCircuit} from '../src/aquaponie/ajoutsEauCircuit.ts';
import {reperesProduits} from '../src/aquaponie/ajoutsProduits.ts';
const form={id:'eau',nom:'ignoré',quantite:'125.5',unite:'kg',date:'2026-11-18',heure:'09:45',cible:'bassin',cibleId:'b',notes:' Complément '};
test('ajout eau : litres, circuit et heure réelle sans modifier les mesures',()=>{const a=preparerAjoutEauCircuit(form);assert.equal(a.quantity,125.5);assert.equal(a.unit,'L');assert.equal(a.target_type,'systeme');assert.equal(a.basin_id,null);assert.equal(a.tank_id,null);assert.equal(a.product_name,'Eau');assert.equal(a.notes,'Complément');});
test('quantité strictement positive et date/heure valides obligatoires',()=>{for(const change of [{quantite:''},{quantite:'0'},{quantite:'-10'},{quantite:'Infinity'},{date:'2026-02-30'},{heure:'24:01'}])assert.throws(()=>preparerAjoutEauCircuit({...form,...change}));});
test('repère eau : filtre temporel Martinique et absence de sélection',()=>{const a=preparerAjoutEauCircuit(form);const debut=Date.parse('2026-11-18T00:00:00-04:00');const liste=reperesProduits([a],['b'],debut,debut+86400000);assert.equal(liste.length,1);assert.equal(liste[0].instant,Date.parse('2026-11-18T13:45:00Z'));assert.equal(reperesProduits([a],['b'],debut+86400000,debut+2*86400000).length,0);assert.equal(reperesProduits([a],[],debut,debut+86400000).length,0);});
