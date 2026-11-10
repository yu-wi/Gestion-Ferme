import test from 'node:test';
import assert from 'node:assert/strict';
import {alertesBassinEau} from '../src/aquaponie/alertesEau.ts';
const now=Date.parse('2026-11-10T12:00:00-04:00');
const m={id:'m',basin_id:'b',target_type:'bassin',measure_date:'2026-11-10',measure_time:'10:00',ph:6,conductivity:1};
test('les seuils exacts sont respectés ; les valeurs inférieures alertent',()=>{assert.deepEqual(alertesBassinEau([m],'b',now),[]);assert.equal(alertesBassinEau([{...m,ph:5.9,conductivity:.9}],'b',now).length,2);});
test('absence, null et heure inconnue ne sont pas des valeurs conformes',()=>{assert.equal(alertesBassinEau([],'b',now).length,1);assert.equal(alertesBassinEau([{...m,ph:null,conductivity:null,measure_time:null}],'b',now).length,3);});
test('ne compare que le dernier relevé du bassin, sans attribuer cuve ou global',()=>{assert.deepEqual(alertesBassinEau([{...m,id:'old',measure_time:'08:00',ph:4},m,{...m,id:'tank',target_type:'cuve',measure_time:'11:00',ph:4}],'b',now),[]);assert.equal(alertesBassinEau([{...m,basin_id:null}],'b',now).length,1);});
test('fraîcheur à 24h, date future et fuseau Martinique',()=>{assert.deepEqual(alertesBassinEau([m],'b',Date.parse('2026-11-11T10:00:00-04:00')),[]);assert.match(alertesBassinEau([m],'b',now+86400000).join(),/24 h/);assert.match(alertesBassinEau([m],'b',now-86400000).join(),/futur/);});
