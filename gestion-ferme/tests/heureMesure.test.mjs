import test from 'node:test';import assert from 'node:assert/strict';
import {heureMesureValide,trierMesuresEau} from '../src/aquaponie/heureMesure.ts';
test('une heure de mesure doit etre une heure civile valide',()=>{
 for(const h of ['00:00','09:05','23:59'])assert.equal(heureMesureValide(h),true);
 for(const h of ['','24:00','12:60','9:5','abc'])assert.equal(heureMesureValide(h),false);
});
test('les mesures sont triees par date puis heure, sans modifier les anciennes valeurs',()=>{
 const m=[{measure_date:'2026-11-10',measure_time:null,no2:2},{measure_date:'2026-11-09',measure_time:'23:00'},{measure_date:'2026-11-10',measure_time:'08:00'},{measure_date:'2026-11-10',measure_time:'15:30'}];
 assert.equal(trierMesuresEau(m)[0].measure_time,'15:30');assert.equal(m[0].measure_time,null);assert.equal(trierMesuresEau(m)[2].no2,2);
});
