import test from 'node:test';
import assert from 'node:assert/strict';
import {controlerLivraisons,consommationIdentique,joursSansSaisie} from '../src/volailles/controlesCoherence.ts';
const lot={quantite:100,autoconsommation:5,dateArrivee:'2026-10-01',mortalites:[{nombre:10}],livraisons:[{id:'a',date:'2026-10-10',quantite:20,poids:40}]};
const ligne=(quantite=10)=>({date:'2026-10-20',quantite,poids:20});
test('le maximum tient compte de toutes les sorties du lot',()=>{
 assert.equal(controlerLivraisons(lot,[ligne(65)]).erreur,null);
 assert.match(controlerLivraisons(lot,[ligne(66)]).erreur,/65 sujets/);
 assert.match(controlerLivraisons(lot,[ligne(40),ligne(30)]).erreur,/65 sujets/);
});
test('une correction restitue l’ancienne quantité avant le contrôle',()=>{
 assert.equal(controlerLivraisons(lot,[ligne(85)],'a').erreur,null);
 assert.match(controlerLivraisons(lot,[ligne(86)],'a').erreur,/85 sujets/);
});
test('une quantité fractionnaire, infinie, nulle ou un poids invalide sont refusés',()=>{
 for(const quantite of [0,-1,1.5,Infinity,NaN])assert.ok(controlerLivraisons(lot,[ligne(quantite)]).erreur);
 for(const poids of [0,-1,Infinity,NaN])assert.ok(controlerLivraisons(lot,[{...ligne(),poids}]).erreur);
});
test('la date doit être valide et postérieure à l’arrivée du lot',()=>{
 for(const date of ['','2026-02-30','2026-09-30'])assert.ok(controlerLivraisons(lot,[{...ligne(),date}]).erreur);
});
test('les doublons existants et ceux du même formulaire sont signalés',()=>{
 assert.equal(controlerLivraisons(lot,[{...lot.livraisons[0]}]).doublon,true);
 assert.equal(controlerLivraisons(lot,[ligne(),ligne()]).doublon,true);
 assert.equal(controlerLivraisons(lot,[{...lot.livraisons[0]}],'a').doublon,false);
 assert.equal(controlerLivraisons(lot,[{...lot.livraisons[0],poids:41}]).doublon,false);
});
test('la comparaison des aliments ignore la casse et les accents, mais pas les quantités',()=>{
 const existantes=[{id:'c1',feed_type:'DÉMARRAGE ',quantite_kg:50}];
 assert.equal(consommationIdentique(existantes,[{feed_type:'demarrage',quantite_kg:50}]),true);
 assert.equal(consommationIdentique(existantes,[{feed_type:'demarrage',quantite_kg:25}]),false);
 assert.equal(consommationIdentique(existantes,[{feed_type:'demarrage',quantite_kg:50}],'c1'),false);
});
test('une transition de deux aliments contrôle aussi la seconde saisie',()=>{
 assert.equal(consommationIdentique([{id:'c2',feed_type:'finition',quantite_kg:25}],[{feed_type:'croissance',quantite_kg:25},{feed_type:'finition',quantite_kg:25}]),true);
});
test('les rappels excluent aujourd’hui et les dates précédant l’arrivée',()=>{
 assert.deepEqual(joursSansSaisie('2026-10-25','2026-10-27',[]),['2026-10-25','2026-10-26']);
 assert.deepEqual(joursSansSaisie('2026-10-27','2026-10-27',[]),[]);
 assert.deepEqual(joursSansSaisie('2026-10-25','2026-10-27',['2026-10-25','2026-10-26']),[]);
});
test('les sept jours terminés sont calculés correctement au changement de mois',()=>{
 const dates=joursSansSaisie('2025-01-01','2026-03-03',[]);
 assert.equal(dates.length,7);assert.equal(dates[0],'2026-02-24');assert.equal(dates[6],'2026-03-02');
});
