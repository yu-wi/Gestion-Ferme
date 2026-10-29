import test from 'node:test';
import assert from 'node:assert/strict';
import {controlerCorrection,stockDisponibleCorrection} from '../src/volailles/correctionQuotidienne.ts';
test('la correction refuse les dates invalides, futures et anterieures a l’arrivee',()=>{
 for(const date of ['','2026-02-30','2026-10-30','2026-09-30']) assert.throws(()=>controlerCorrection(date,2,'2026-10-01','2026-10-29','mortalite'));
 assert.doesNotThrow(()=>controlerCorrection('2026-10-29',2,'2026-10-01','2026-10-29','mortalite'));
});
test('la mortalite doit etre entiere et positive, l’aliment peut etre fractionnaire',()=>{
 for(const n of [0,-1,1.5,Infinity,NaN])assert.throws(()=>controlerCorrection('2026-10-29',n,'2026-10-01','2026-10-29','mortalite'));
 assert.doesNotThrow(()=>controlerCorrection('2026-10-29',12.5,'2026-10-01','2026-10-29','aliment'));
 for(const n of [0,-1,Infinity,NaN])assert.throws(()=>controlerCorrection('2026-10-29',n,'2026-10-01','2026-10-29','aliment'));
});
test('une correction restitue l’ancienne consommation seulement pour le meme aliment',()=>{
 const stocks=[{feed_type:'DÉMARRAGE',stock_kg:25},{feed_type:'finition',stock_kg:50}];
 const ancien={id:'a',date:'2026-10-29',quantite:50,aliment:'demarrage'};
 assert.equal(stockDisponibleCorrection(stocks,ancien,'démarrage'),75);
 assert.equal(stockDisponibleCorrection(stocks,ancien,'finition'),50);
 assert.equal(stockDisponibleCorrection(stocks,ancien,'inconnu'),0);
});
