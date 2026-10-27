import type { TarifsCharges } from './tarifsCharges.ts';

export type LotFiche = {
  id: string; nom: string; batiment: string; date_arrivee: string; age: number;
  quantite: number; nb_morts: number; sujets_restants: number; autoconsommation: number;
  quantite_retenue: number | null; resultat_brut: number | null;
  livraisons: { date: string; quantite: number; poids: number }[];
  mortalites: { date: string; nombre: number }[];
};
export type ConsoFiche = { date: string; feed_type: string; quantite_kg: number };
export type ReferenceFiche = { feed_type: string; feed_price_ht: number | null };
const labels: Record<string,string> = { achat_poussins:'Achat poussins', aliment:'Aliment', ramassage:'Ramassage', livraison:'Livraison', divers:'Divers' };
const centimes = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
export function creerFicheCloture(lot: LotFiche, charges: {type_charge:string;montant:number}[], options: {
  aValider: string[]; alimentCalcule: boolean; consommations: ConsoFiche[];
  tarifs: TarifsCharges; references: ReferenceFiche[]; tvaAliment: number;
  gel: { date:string; origine:string } | null; date?:string;
}) {
  const totaux = new Map<string,number>();
  for(const charge of charges) totaux.set(charge.type_charge,(totaux.get(charge.type_charge)||0)+charge.montant);
  const manquantes = ['achat_poussins','aliment','ramassage','livraison'].filter(type=>!totaux.has(type));
  const raisons = [
    ...manquantes.map(type=>`${labels[type]} : montant non renseigné`),
    ...options.aValider.map(type=>`${labels[type] || type} : estimation à valider`),
    ...(!options.gel ? ['Tarifs non figés'] : []),
    ...(lot.resultat_brut == null ? ['Recettes non renseignées'] : []),
    ...(lot.quantite_retenue == null ? ['Quantité retenue non renseignée'] : []),
    ...(!lot.livraisons.length ? ['Aucune livraison enregistrée'] : []),
    ...(lot.sujets_restants > 0 ? ['Des sujets restent dans le lot'] : []),
  ];
  const detailCharges = [...totaux].map(([type,montant])=>({
    type, label:labels[type] || 'Divers', montant:centimes(montant),
    statut:options.aValider.includes(type) ? 'Estimé · à valider' : type==='aliment' && options.alimentCalcule ? 'Calculé sur consommations' : 'Enregistré',
  })).sort((a,b)=>b.montant-a.montant);
  const totalCharges = centimes(charges.reduce((s,c)=>s+c.montant,0));
  const recettes = centimes(Number(lot.resultat_brut)||0);
  const marge = centimes(recettes-totalCharges);
  const livres = lot.livraisons.reduce((s,l)=>s+Number(l.quantite),0);
  const poids = lot.livraisons.reduce((s,l)=>s+Number(l.poids),0);
  return {
    lot, date:options.date || new Date().toISOString(), statut:raisons.length ? 'Provisoire' : 'Complète', raisons,
    charges:detailCharges, totalCharges, recettes, marge, tauxMarge:recettes>0 ? marge/recettes*100 : null,
    livres, poids, poidsMoyen:livres>0 ? poids/livres : null,
    mortalite:lot.quantite>0 ? Number(lot.nb_morts)/lot.quantite*100 : null,
    consommationKg:options.consommations.length ? options.consommations.reduce((s,c)=>s+c.quantite_kg,0) : null,
    consommations:options.consommations, tarifs:options.tarifs, references:options.references,
    tvaAliment:options.tvaAliment, gel:options.gel,
  };
}
export type FicheCloture = ReturnType<typeof creerFicheCloture>;
export function nomFichierFiche(fiche:FicheCloture) {
  const nom = fiche.lot.nom.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'_').slice(0,70) || 'sans_nom';
  return `fiche_lot_${nom}_${new Intl.DateTimeFormat('en-CA',{timeZone:'America/Martinique',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(fiche.date))}`;
}
