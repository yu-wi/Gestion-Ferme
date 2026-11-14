import {useRef,type ReactNode} from 'react';
import IconeEau from './IconeEau';
import AnalyseEau from './AnalyseEau';
import {alertesBassinEau} from './alertesEau';
import {trierMesuresEau} from './heureMesure';
import type {MesureAnalyseEau} from './analyseEau';
import type {AjoutProduitEau} from './ajoutsProduits';
import type {SeuilsEau} from './seuilsEau';
type Bassin={id:string;name:string;species:string;fish_count:number;water_current_l:number|null;water_capacity_l:number|null;status:string};
type Culture={id:string;name:string};
const nombre=(v:number|null|undefined)=>v==null?'—':Number(v).toLocaleString('fr-FR',{maximumFractionDigits:3});
export default function ResumeAquaponie({bassins,mesures,cultures,ajouts,seuils,loading,erreur,onRecharger,onBassins,onMesure,onCulture,renderCulture,produitsErreur}:{bassins:Bassin[];mesures:MesureAnalyseEau[];cultures:Culture[];ajouts:AjoutProduitEau[];seuils:SeuilsEau;loading:boolean;erreur:string;onRecharger:()=>void;onBassins:()=>void;onMesure:(id:string)=>void;onCulture:()=>void;renderCulture:(id:string)=>ReactNode;produitsErreur:string}){
 const alertesRef=useRef<HTMLElement>(null);
 const ordonnees=trierMesuresEau(mesures);
 const etats=bassins.map(b=>({b,mesure:ordonnees.find(m=>m.basin_id===b.id&&m.target_type!=='cuve'),alertes:alertesBassinEau(mesures,b.id,Date.now(),seuils)}));
 const alertes=etats.flatMap(e=>e.alertes.map(message=>({b:e.b,message})));
 const bas=alertes.filter(a=>a.message.includes('sous le seuil')).length;
 const inconnu=loading||!!erreur;
 const voirAlertes=()=>{alertesRef.current?.scrollIntoView({behavior:'smooth',block:'center'});alertesRef.current?.focus({preventScroll:true});};
 return <section className="aqua-resume">
  <div className="aqua-resume-kpis">
   <article><span className="water-icon-bubble blue"><IconeEau nom="bassin"/></span><div><h3>Bassins actifs</h3><b>{bassins.length}</b><p>{nombre(bassins.reduce((n,b)=>n+Number(b.fish_count||0),0))} poissons</p></div></article>
   <article><span className="water-icon-bubble"><IconeEau nom="plante"/></span><div><h3>Cultures en cours</h3><b>{cultures.length}</b><p>{new Set(cultures.map(c=>c.name)).size} culture(s)</p></div></article>
   <article><span className="water-icon-bubble blue"><IconeEau nom="goutte"/></span><div><h3>Qualité de l’eau</h3><strong className={`aqua-quality ${!inconnu&&bassins.length&&!alertes.length?'ok':''}`}>{inconnu?'À vérifier':!bassins.length?'Sans relevé':alertes.length?'À surveiller':'Seuils respectés'}</strong><p>{inconnu?'Seuils indisponibles':bas?`${bas} seuil(s) bas`:alertes.length?`${alertes.length} point(s) à vérifier`:'Suivi des derniers relevés'}</p></div></article>
   <article><span className="water-icon-bubble red"><IconeEau nom="alerte"/></span><div><h3>Alertes actives</h3><b className="aqua-alert-number">{inconnu?'—':alertes.length}</b><button type="button" onClick={voirAlertes}>Voir les alertes →</button></div></article>
  </div>
  <div className="aqua-resume-middle">
   <article className="aqua-resume-panel"><header><h2><span className="water-icon-bubble"><IconeEau nom="calendrier"/></span>État des bassins</h2><button type="button" onClick={onBassins}>Voir tous les bassins →</button></header><div className="aqua-resume-basins">{etats.slice(0,4).map(({b,mesure})=><article key={b.id}><span className="aqua-fish-icon"><IconeEau nom="poisson"/></span><div className="aqua-basin-identity"><strong>{b.name}</strong><span>{b.species}</span><small>{nombre(b.fish_count)} poissons · {nombre(b.water_current_l)} / {nombre(b.water_capacity_l)} L</small></div><div className="aqua-basin-values"><span><IconeEau nom="temperature"/>{nombre(mesure?.temperature_c)} °C</span><span><IconeEau nom="produit"/>pH <b>{nombre(mesure?.ph)}</b></span><span><IconeEau nom="ec"/>EC <b>{nombre(mesure?.conductivity)}</b></span></div><span className={`aqua-basin-state ${b.status}`}>{b.status==='stable'?'Stable':b.status==='probleme'?'Problème':'À surveiller'}</span></article>)}</div>{!bassins.length&&<p className="aqua-resume-empty">Aucun bassin enregistré.</p>}</article>
   <section className="aqua-resume-panel" ref={alertesRef} tabIndex={-1}><header><h2><span className="water-icon-bubble"><IconeEau nom="plante"/></span>Surveillance de l’eau</h2>{!inconnu&&<span className="aqua-alert-count">{alertes.length} alerte(s)</span>}</header>{loading?<p role="status">Chargement des seuils…</p>:erreur?<p role="alert">{erreur} <button type="button" onClick={onRecharger}>Réessayer</button></p>:<div className="aqua-resume-alert-list">{etats.filter(e=>e.alertes.length).map(({b,alertes:messages})=><button className="aqua-resume-alert" type="button" key={b.id} onClick={()=>onMesure(b.id)} aria-label={`Enregistrer une mesure pour ${b.name}`}><span className="water-icon-bubble orange"><IconeEau nom="alerte"/></span><span><strong>{b.name}</strong>{messages.map(m=><span key={m}>{m}</span>)}</span></button>)}{!alertes.length&&<p className="aqua-resume-empty">{bassins.length?'Aucune alerte active.':'Aucun bassin à surveiller.'}</p>}</div>}</section>
  </div>
  <div className="aqua-resume-bottom"><article className="aqua-resume-graph">{produitsErreur&&<p role="alert">{produitsErreur}</p>}<AnalyseEau compact mesures={mesures} bassins={bassins} ajouts={ajouts}/></article><article className="aqua-resume-panel"><header><h2><span className="water-icon-bubble"><IconeEau nom="plante"/></span>Cultures en cours</h2></header>{cultures.length?<div>{cultures.slice(0,5).map(c=><div key={c.id}>{renderCulture(c.id)}</div>)}</div>:<div className="aqua-resume-empty-cultures"><span className="water-icon-bubble"><IconeEau nom="plante"/></span><p>Aucune culture en cours.</p></div>}<button type="button" className="aqua-add-culture" onClick={onCulture}>＋ Ajouter une culture</button></article></div>
 </section>;
}
