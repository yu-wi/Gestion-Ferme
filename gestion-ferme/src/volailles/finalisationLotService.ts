import { supabase } from '../supabaseClient';
import { chargerLotsAvecMouvements } from './volaillesData';
import { chargerPages } from './chargerPages';
import { controlerLivraisons } from './controlesCoherence';
import { controlerCorrection } from './correctionQuotidienne';
import { verifierValeurFinalisation, type SaisieFinalisation, type VerificationFinalisation } from './finalisationLot';
export async function enregistrerFinalisationLot(id: string, tache: VerificationFinalisation, saisie: SaisieFinalisation) {
  const lot = (await chargerLotsAvecMouvements(false)).find(l => l.id === id);
  if (!lot) throw new Error('Le lot archivé ne peut pas être relu. Actualisez la page.');
  const valeur = verifierValeurFinalisation(tache.action, saisie);
  const aujourdHui = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Martinique' }).format(new Date());
  if (tache.action === 'charge') {
    if (!['aliment','achat_poussins','ramassage','livraison'].includes(tache.categorie || '')) throw new Error('Catégorie de charge invalide.');
    const existantes = await chargerPages((a,b) => supabase.from('charges').select('id').eq('lot_id', id).eq('type_charge', tache.categorie).order('id').range(a,b));
    if (tache.categorie === 'aliment') {
      const consommations = await chargerPages((a,b) => supabase.from('consommations_aliment').select('id').eq('lot_id', id).order('id').range(a,b));
      if (consommations.length) throw new Error('La charge d’aliment est déjà calculée à partir des consommations. Actualisez le lot.');
    }
    if (existantes.length) throw new Error('Cette charge est déjà renseignée. Actualisez le lot avant de la modifier.');
    const { error } = await supabase.from('charges').insert({ lot_id: id, lot_nom: lot.nom, type_charge: tache.categorie, montant: valeur, date: aujourdHui }).select('id').single();
    if (error) throw error;
  } else if (tache.action === 'recettes' || tache.action === 'retenue') {
    const champ = tache.action === 'recettes' ? 'resultat_brut' : 'quantite_retenue';
    if (lot[champ] != null) throw new Error('Cette donnée est déjà renseignée. Actualisez le lot avant de la modifier.');
    const { error } = await supabase.from('lots_volailles').update({ [champ]: valeur }).eq('id', id).eq('is_active', false).is(champ,null).select('id').single();
    if (error) throw error;
  } else if (tache.action === 'livraison') {
    const livraison = { date: saisie.date, quantite: Number(saisie.quantite), poids: Number(saisie.poids) };
    if (saisie.date > aujourdHui) throw new Error('Une livraison enregistrée ne peut pas être dans le futur.');
    const controle = controlerLivraisons({ quantite: Number(lot.quantite), autoconsommation: Number(lot.autoconsommation) || 0, mortalites: lot.mortalites, livraisons: lot.livraisons, dateArrivee: lot.date_arrivee },[livraison]);
    if (controle.erreur) throw new Error(controle.erreur);
    if (controle.doublon && !window.confirm('Une livraison identique existe déjà. Confirmer cette livraison supplémentaire ?')) return false;
    const {error} = await supabase.from('livraisons_volailles').insert({ lot_id: id, ...livraison }).select('id').single();
    if (error) throw error;
  } else if (tache.action === 'effectifs') {
    const maximum = lot.sujets_restants + (Number(lot.autoconsommation) || 0);
    if (valeur > maximum) throw new Error(`L’autoconsommation ne peut pas dépasser ${maximum} sujets compte tenu des livraisons et mortalités enregistrées.`);
    const {error} = await supabase.from('lots_volailles').update({ autoconsommation: valeur }).eq('id', id).eq('is_active', false).select('id').single();
    if (error) throw error;
  } else if (tache.action === 'mortalite') {
    // Utilise depuis le panneau de verification des effectifs, sans reactiver le lot.
    const nombre = Number(saisie.quantite);
    controlerCorrection(saisie.date, nombre, lot.date_arrivee, aujourdHui, 'mortalite');
    if (nombre > lot.sujets_restants) throw new Error(`Le maximum disponible est de ${lot.sujets_restants} sujets.`);
    const {error} = await supabase.from('mortalites_volailles').insert({ lot_id: id, date: saisie.date, nombre }).select('id').single();
    if (error) throw error;
  } else throw new Error('Action non prise en charge.');
  return true;
}
