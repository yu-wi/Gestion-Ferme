import test from 'node:test';
import assert from 'node:assert/strict';
import {lireSeuilsEau,validerSeuilsEau} from '../src/aquaponie/seuilsEau.ts';
import {alertesBassinEau} from '../src/aquaponie/alertesEau.ts';
test('valeurs initiales et paramètres enregistrés, zéro conservé',()=>{assert.deepEqual(lireSeuilsEau([]),{ph:6,conductivity:1,delaiHeures:24});assert.equal(lireSeuilsEau([{key:'aquaponie_ec_min',value:'0'}]).conductivity,0);assert.equal(lireSeuilsEau([{key:'aquaponie_ph_min',value:'6.5'}]).ph,6.5);});
test('validation des limites et nombres invalides',()=>{for(const f of [{ph:''},{ph:'15'},{conductivity:'-1'},{delaiHeures:'0'},{conductivity:'NaN'},{delaiHeures:'Infinity'}])assert.throws(()=>validerSeuilsEau({ph:'6',conductivity:'1',delaiHeures:'24',...f}));});
test('les alertes appliquent les seuils et le délai personnalisés',()=>{const m={id:'m',basin_id:'b',measure_date:'2026-11-10',measure_time:'08:00',ph:6.2,conductivity:1.2};const now=Date.parse('2026-11-10T12:00:00-04:00');assert.equal(alertesBassinEau([m],'b',now).length,0);assert.equal(alertesBassinEau([m],'b',now,{ph:6.5,conductivity:1.5,delaiHeures:2}).length,3);});
