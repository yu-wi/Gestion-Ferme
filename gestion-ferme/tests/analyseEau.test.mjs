import test from 'node:test';import assert from 'node:assert/strict';
import {analyserEau,instantMesureEau,bassinsDesMesures} from '../src/aquaponie/analyseEau.ts';
const bassins=[{id:'a',name:'Bassin A'},{id:'b',name:'Bassin B'}];
const ligne=(id,basin_id,measure_time,ph=7,conductivity=100)=>({id,basin_id,measure_time,ph,conductivity,measure_date:'2026-11-10',target_type:'bassin'});
const analyser=(mesures,metric='ph',ids=['a','b'])=>analyserEau(mesures,bassins,ids,metric,'2026-11-10','jour');
test('les heures sont positionnees dans le fuseau Martinique et les intervalles sont reels',()=>{
 assert.equal(instantMesureEau('2026-11-10','08:00'),Date.parse('2026-11-10T12:00:00Z'));
 assert.equal(instantMesureEau('2026-11-10','13:00')-instantMesureEau('2026-11-10','08:00'),5*3600000);
 assert.equal(instantMesureEau('2026-11-10',null),null);assert.equal(instantMesureEau('2026-11-10','24:00'),null);
});
test('les bassins ne sont jamais melanges et les mesures generales et des cuves ne sont pas affectees aux courbes',()=>{
 const r=analyser([ligne('a1','a','08:00',6.5),ligne('b1','b','09:00',7.5),ligne('general',null,'10:00'),{...ligne('cuve','a','11:00'),target_type:'cuve'}]);
 assert.equal(r.nbPoints,2);assert.equal(r.generales,1);assert.equal(r.series[0].points[0].valeur,6.5);assert.equal(r.series[1].points[0].valeur,7.5);
 assert.equal(analyser([ligne('a1','a','08:00'),ligne('b1','b','08:00')],'ph',['a']).nbPoints,1);
});
test('une heure inconnue reste consultable et une valeur manquante interrompt la serie',()=>{
 const r=analyser([ligne('un','a','08:00'),ligne('deux','a','09:00',null),ligne('trois','a','10:00'),ligne('sans','a',null)]);
 assert.equal(r.sansHeure,1);assert.equal(r.sansValeur,1);assert.equal(r.series[0].segments.length,2);assert.equal(r.releves.length,4);assert.equal(r.nbPoints,2);
});
test('les valeurs EC nulles et les mesures au meme instant sont conservees',()=>{
 const r=analyser([ligne('1','a','08:00',7,0),ligne('2','a','08:00',7,2)],'conductivity');
 assert.equal(r.series[0].points.length,2);assert.equal(r.series[0].points[0].valeur,0);assert.ok(r.domaine[1]>2);
});
test('la periode choisie filtre sans limiter aux douze derniers releves',()=>{
 const mesures=Array.from({length:24},(_,i)=>ligne(String(i),'a',`${String(i).padStart(2,'0')}:00`));
 mesures.push({...ligne('ancien','a','08:00'),measure_date:'2026-11-09'});
 assert.equal(analyser(mesures).nbPoints,24);
 const semaine=analyserEau(mesures,bassins,['a'],'ph','2026-11-10','semaine');assert.equal(semaine.nbPoints,25);assert.equal(semaine.fin-semaine.debut,7*86400000);
});
test('un identifiant de bassin absent du repertoire reste accessible sans inventer son nom',()=>{
 const b=bassinsDesMesures(bassins,[ligne('1','archive','08:00')]);assert.equal(b.length,3);assert.match(b.find(x=>x.id==='archive').name,/archivé/);
});
test('vue mensuelle : mois civil complet, fuseau Martinique et limites exclusives',()=>{
 for(const [date,jours,fin] of [['2026-11-15',30,'2026-12-01'],['2026-12-15',31,'2027-01-01'],['2028-02-10',29,'2028-03-01'],['2027-02-10',28,'2027-03-01']]){
  const debut=date.slice(0,7)+'-01';
  const mesures=[{...ligne('premier','a','00:00'),measure_date:debut},{...ligne('dernier','a','23:59'),measure_date:date.slice(0,7)+'-'+jours},{...ligne('hors','a','00:00'),measure_date:fin}];
  for(const metric of ['ph','conductivity']){const r=analyserEau(mesures,bassins,['a'],metric,date,'mois');assert.equal(r.fin-r.debut,jours*86400000);assert.equal(r.debut,Date.parse(debut+'T00:00:00-04:00'));assert.equal(r.fin,Date.parse(fin+'T00:00:00-04:00'));assert.equal(r.nbPoints,2);}
 }
});

test('bassins et cuves : identifiants isolés, aucune attribution des relevés globaux',async()=>{
 const {sourcesAnalyseEau}=await import('../src/aquaponie/analyseEau.ts');
 const mesures=[ligne('b','a','08:00',6.5,1),{...ligne('c','a','09:00',7.2,2),target_type:'cuve',tank_id:'a'},{...ligne('global-cuve',null,'10:00',9,9),target_type:'cuve',tank_id:null}];
 const sources=sourcesAnalyseEau([{id:'a',name:'B2'}],[{id:'a',name:'CT1'}],mesures);
 assert.deepEqual(sources.map(s=>s.id),['a','cuve:a']);
 for(const metrique of ['ph','conductivity']){
  const r=analyserEau(mesures,sources,sources.map(s=>s.id),metrique,'2026-11-10','jour');
  assert.equal(r.nbPoints,2);assert.equal(r.series[0].points[0].id,'b');assert.equal(r.series[1].points[0].id,'c');assert.notEqual(r.series[0].couleur,r.series[1].couleur);
  const cuve=analyserEau(mesures,sources,['cuve:a'],metrique,'2026-11-10','jour');assert.equal(cuve.releves.length,1);assert.equal(cuve.releves[0].bassin,'Cuve · CT1');
 }
});
test('les relevés d’une cuve archivée restent accessibles sans inventer son nom',async()=>{
 const {sourcesAnalyseEau}=await import('../src/aquaponie/analyseEau.ts');
 const m={...ligne('c',null,'09:00'),target_type:'cuve',tank_id:'archive'};
 const sources=sourcesAnalyseEau([],[],[m]);assert.equal(sources.length,1);assert.equal(sources[0].id,'cuve:archive');assert.match(sources[0].name,/archivée/);assert.equal(analyserEau([m],sources,['cuve:archive'],'ph','2026-11-10','jour').nbPoints,1);
});
