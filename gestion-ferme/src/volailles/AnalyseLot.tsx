import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { chargerTarifsFiges, figerTarifsLot } from "./tarifsFigesService";
import type { TarifsFiges } from "./tarifsFiges";
import FicheClotureImpression from "./FicheClotureImpression";
import { creerFicheCloture, type ConsoFiche, type ReferenceFiche } from "./ficheCloture";
import { ActionButton, ActionLink } from "../components/ActionButton";
import StatutCharge from "./StatutCharge";
import ChargeValider from "./ChargeValider";
import { categoriesChargesProposees, calculerChargesLivraisons, lireTarifsCharges, tarifsChargesParDefaut, type CategorieAutomatique } from "./tarifsCharges";
import toast from "react-hot-toast";
import { supabase } from "../supabaseClient";
import { formatMontant, formatNombre, formatPoids } from "../outils/formatNombre";
import { calculerChargesLot } from "./chargesLot";
import { chargerPages } from "./chargerPages";
import { calculerCoutAliment } from "./coutAliment";
import {
  chargerLotsAvecMouvements,
  type LivraisonVolaille,
  type MortaliteVolaille,
} from "./volaillesData";

type LotAnalyse = {
  id: string;
  nom: string;
  quantite: number;
  date_arrivee: string;
  batiment: string;
  age: number;
  nb_morts: number;
  sujets_restants: number;
  resultat_brut: number | null;
  resultat_net: number | null;
  autoconsommation: number;
  quantite_retenue: number | null;
  total_poids_livre: number;
  livraisons: LivraisonVolaille[];
  mortalites: MortaliteVolaille[];
};

type Charge = { id?: string | number; type_charge: string; montant: number };

const chargeLabels: Record<string, string> = {
  aliment: "Aliment",
  achat_poussins: "Achat poussins",
  ramassage: "Ramassage",
  livraison: "Livraison",
};
const chargeColors = ["#209447", "#f5b000", "#3b78d8", "#8b6bd9", "#a7b1bc"];

export default function AnalyseLot() {
  const { lotId } = useParams();
  const navigate = useNavigate();
  const [lot, setLot] = useState<LotAnalyse | null>(null);
  const [lotsDisponibles, setLotsDisponibles] = useState<LotAnalyse[]>([]);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [coutAliment, setCoutAliment] = useState<number | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tarifs, setTarifs] = useState(tarifsChargesParDefaut);
  const [tarifsFiges, setTarifsFiges] = useState<TarifsFiges | null>(null);
  const [consoFiche, setConsoFiche] = useState<ConsoFiche[]>([]);
  const [referencesFiche, setReferencesFiche] = useState<ReferenceFiche[]>([]);
  const [exporting, setExporting] = useState(false);
  const [reload, setReload] = useState(0);
  const [saving, setSaving] = useState(false);
  const saveLock = useRef(false);

  useEffect(() => {
    let active = true;
    const charger = async () => {
      setLoading(true);
      setErreur(null);
      if (!lotId) {
        setLoading(false);
        return;
      }
      try {
        const [lots, chargesResult, consommationsResult, referencesResult, tarifsResult, snapshots] = await Promise.all([
          chargerLotsAvecMouvements(false),
          chargerPages((debut, fin) => supabase.from("charges").select("id, type_charge, montant").eq("lot_id", lotId).order("id").range(debut, fin)),
          chargerPages((debut, fin) => supabase.from("consommations_aliment").select("date, feed_type, quantite_kg").eq("lot_id", lotId).order("id").range(debut, fin)),
          supabase.from("feed_reference").select("feed_type, feed_price_ht").order("age_min_days"),
          supabase.from("app_settings").select("key, value").eq("category", "volailles"),
          chargerTarifsFiges(),
        ]);
        if (tarifsResult.error) throw tarifsResult.error;
        const tarifsCharges = lireTarifsCharges(tarifsResult.data || []);
        if (referencesResult.error) throw referencesResult.error;
        const snapshot = snapshots.get(lotId);
        const cout = calculerCoutAliment(consommationsResult, snapshot?.references ?? referencesResult.data ?? [], snapshot?.tvaAliment);
        if (!active) return;
        const lotsArchives = lots as LotAnalyse[];
        setLotsDisponibles(lotsArchives);
        setLot(lotsArchives.find((item) => item.id === lotId) || null);
        setCharges(chargesResult.map((charge) => ({ ...charge, montant: Number(charge.montant) || 0 })));
        setCoutAliment(cout);
        setTarifs(snapshot?.tarifs ?? tarifsCharges);
        setTarifsFiges(snapshot ?? null);
        setConsoFiche(consommationsResult.map(row=>({date:row.date || "",feed_type:row.feed_type,quantite_kg:Number(row.quantite_kg)})));
        setReferencesFiche((snapshot?.references ?? referencesResult.data ?? []).map(row=>({feed_type:row.feed_type,feed_price_ht:row.feed_price_ht==null ? null : Number(row.feed_price_ht)})));
      } catch (error) {
        if (!active) return;
        console.error("Erreur chargement analyse lot :", error);
        setErreur(error instanceof Error ? error.message : "L’analyse du lot n’a pas pu être chargée. Veuillez réessayer.");
        toast.error("L'analyse du lot n'a pas pu être chargée.");
      }
      if (active) setLoading(false);
    };
    charger();
    return () => { active = false; };
  }, [lotId, reload]);

  const donnees = useMemo(() => {
    if (!lot) return null;
    const quantiteLivree = lot.livraisons.reduce((total, livraison) => total + Number(livraison.quantite || 0), 0);
    const totalPoids = Number(lot.total_poids_livre) || 0;
    const poidsMoyen = quantiteLivree > 0 ? totalPoids / quantiteLivree : 0;
    const tauxMortalite = lot.quantite > 0 ? (Number(lot.nb_morts || 0) / lot.quantite) * 100 : 0;
    const aValider = categoriesChargesProposees(charges, lot.livraisons);
    const propositions = calculerChargesLivraisons(lot.livraisons, tarifs);
    const chargesAnalyse = calculerChargesLot(charges, lot.livraisons, coutAliment, tarifs);
    const totalCharges = chargesAnalyse.reduce((total, charge) => total + charge.montant, 0);
    const chiffreAffaires = Number(lot.resultat_brut) || 0;
    const resultat = chiffreAffaires - totalCharges;
    const tauxMarge = chiffreAffaires > 0 ? (resultat / chiffreAffaires) * 100 : 0;
    const repartition = Object.entries(chargesAnalyse.reduce<Record<string, number>>((totaux, charge) => {
      totaux[charge.type_charge] = (totaux[charge.type_charge] || 0) + charge.montant;
      return totaux;
    }, {})).map(([type, montant]) => ({ type, label: type === "aliment" && coutAliment !== null ? "Aliment consommé (TTC)" : chargeLabels[type] || "Divers", montant })).sort((a, b) => b.montant - a.montant);
    const segments = repartition.reduce((acc, charge, index) => {
      const debut = acc.fin;
      const fin = index === repartition.length - 1 || totalCharges <= 0 ? 360 : debut + (charge.montant / totalCharges) * 360;
      acc.segments.push(`${chargeColors[index % chargeColors.length]} ${debut}deg ${fin}deg`);
      acc.fin = fin;
      return acc;
    }, { segments: [] as string[], fin: 0 }).segments;
    const fiche = creerFicheCloture(lot, chargesAnalyse, { aValider, alimentCalcule:coutAliment!==null,
      consommations:consoFiche, tarifs, references:referencesFiche, tvaAliment:tarifsFiges?.tvaAliment ?? .021, gel:tarifsFiges });
    return { fiche, aValider, propositions, quantiteLivree, totalPoids, poidsMoyen, tauxMortalite, totalCharges, chiffreAffaires, resultat, tauxMarge, repartition, segments };
  }, [lot, charges, coutAliment, tarifs, tarifsFiges, consoFiche, referencesFiche]);

  const enregistrerCharge = async (type: CategorieAutomatique, montant: number, id?: string | number) => {
    if (!lot || saveLock.current || !Number.isFinite(montant) || montant < 0) return false;
    saveLock.current = true;
    setSaving(true);
    try {
      const query = id != null
        ? supabase.from("charges").update({ montant }).eq("id", id).eq("lot_id", lot.id)
        : supabase.from("charges").insert({ lot_id: lot.id, lot_nom: lot.nom, type_charge: type, montant, date: new Date().toLocaleDateString("en-CA") });
      const { data, error } = await query.select("id, type_charge, montant").single();
      if (error) throw error;
      setCharges((current) => [...current.filter((charge) => charge.id !== data.id), { ...data, montant: Number(data.montant) }]);
      toast.success("Charge enregistrée.");
      return true;
    } catch (error) {
      console.error("Erreur enregistrement charge :", error);
      toast.error("La charge n’a pas pu être enregistrée. Veuillez réessayer.");
      return false;
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  };

  const figer = async () => {
    if (!lotId || saveLock.current) return;
    saveLock.current = true;
    setSaving(true);
    try {
      await figerTarifsLot(lotId, "historique");
      setReload(value => value + 1);
      toast.success("Tarifs actuels figés pour ce lot.");
    } catch (error) {
      console.error("Erreur gel des tarifs :", error);
      toast.error("Les tarifs n’ont pas pu être figés. Aucun changement de tarif n’a été appliqué au lot.");
    } finally { saveLock.current = false; setSaving(false); }
  };

  const exporterExcel = async () => {
    if (!donnees || exporting) return;
    setExporting(true);
    try { const { exporterFicheExcel } = await import("../outils/exportFicheCloture"); exporterFicheExcel(donnees.fiche); }
    catch (error) { console.error("Erreur export fiche :", error); toast.error("Le fichier Excel n’a pas pu être créé."); }
    finally { setExporting(false); }
  };

  if (loading) return <div className="history-loading">Chargement de l’analyse...</div>;
  if (erreur) return <div className="history-page"><p className="history-empty" role="alert">{erreur}</p><ActionLink icon="back" label="Retour à l’historique SICA" to="/volailles/sica/historique" /></div>;
  if (!lot || !donnees) return <div className="history-page"><div className="history-empty">Lot introuvable.</div></div>;

  return (
    <div className="lot-analysis-page">
      <div className="lot-analysis-breadcrumb"><Link to="/volailles/sica/historique">Historique SICA</Link><span>›</span><span>{lot.nom}</span><span>›</span><strong>Analyse complète</strong></div>
      <header className="lot-analysis-heading">
        <div>
          <h1>Analyse complète – Lot {lot.nom} <span>Terminé</span></h1>
          <p>Arrivé le {formatDate(lot.date_arrivee)} · Bâtiment {lot.batiment} · Période de {lot.age || 0} jours</p>
          <label className="lot-analysis-selector">
            Lot analysé
            <select disabled={saving} value={lot.id} onChange={(event) => navigate(`/volailles/sica/historique/${event.target.value}/analyse`)}>
              {lotsDisponibles.map((item) => <option key={item.id} value={item.id}>Lot {item.nom} · {item.batiment}</option>)}
            </select>
          </label>
        </div>
        <div><ActionButton icon="print" label="Fiche PDF / imprimer" disabled={saving} onClick={() => window.print()} /><ActionButton icon="download" label={exporting ? "Création…" : "Fiche Excel"} disabled={saving || exporting} onClick={exporterExcel} /><ActionLink icon="back" label="Retour à l’historique SICA" to="/volailles/sica/historique" /></div>
      </header>

      <section className="history-kpis">
        <HistoryMetric tone="orange" icon="€" label={donnees.aValider.length ? "Résultat net estimé" : "Résultat net"} value={formatMontant(donnees.resultat)} note={`Taux de marge : ${formatNombre(donnees.tauxMarge, 1)} %`} />
        <HistoryMetric tone="blue" icon="♧" label="Sujets livrés" value={formatNombre(donnees.quantiteLivree)} note={`Sur ${formatNombre(lot.quantite)} sujets arrivés`} />
        <HistoryMetric tone="green" icon="⚖" label="Poids total livré" value={formatPoids(donnees.totalPoids)} note={`Poids moyen : ${formatPoids(donnees.poidsMoyen)}`} />
        <HistoryMetric tone="red" icon="✝" label="Taux de mortalité" value={`${formatNombre(donnees.tauxMortalite, 1)} %`} note={`${formatNombre(lot.nb_morts || 0)} sujets perdus`} />
      </section>

      <section className="history-panel closure-export-info"><strong>Fiche de clôture {donnees.fiche.statut.toLowerCase()}</strong>
        <p>{donnees.fiche.raisons.length ? donnees.fiche.raisons.join(" · ") : "Charges renseignées et tarifs figés."}</p>
        <details className="lot-export-help"><summary>Comment exporter la fiche ?</summary><p>Le bouton PDF ouvre la fenêtre d’impression : choisissez « Enregistrer au format PDF ». Les deux formats reprennent les mêmes données.</p></details>
        {donnees.aValider.length > 0 && <a className="lot-validation-link" href="#detail-economique">Valider les {donnees.aValider.length} charges proposées ↓</a>}
      </section>
      <FicheClotureImpression fiche={donnees.fiche} />
      <section className="history-panel lot-tariffs-status">
        {tarifsFiges ? <p>✓ Tarifs figés le {new Date(tarifsFiges.date).toLocaleDateString("fr-FR")}{tarifsFiges.origine === "historique" ? " à partir des prix disponibles lors du gel" : " lors de l’archivage"}. Les changements de tarifs généraux ne modifient plus ce lot.</p>
          : <><p>Les tarifs de ce lot ancien ne sont pas encore figés. Le gel conservera les prix actuels ; il ne reconstitue pas les prix d’origine.</p><button type="button" disabled={saving} onClick={figer}>Figer les tarifs actuels</button></>}
      </section>
      <section className="lot-analysis-middle-grid">
        <article className="history-panel history-charges">
          <h2>Charges par lot</h2>
          {donnees.aValider.length > 0 && <p className="history-charge-note"><StatutCharge statut="estime" /> {donnees.aValider.length} charge(s) à valider dans le détail économique.</p>}
          {donnees.totalCharges > 0 ? <div><div className="history-charge-ring" style={{ background: `conic-gradient(${donnees.segments.join(", ")})` }}><span><small>{donnees.aValider.length ? "Total estimé" : "Total charges"}</small><strong>{formatMontant(donnees.totalCharges)}</strong></span></div><div className="history-charge-list">{donnees.repartition.map((charge, index) => <div key={charge.type}><i style={{ background: chargeColors[index % chargeColors.length] }} /><span>{charge.label}{donnees.aValider.some(type => type === charge.type) && <StatutCharge statut="estime" />}</span><b>{formatMontant(charge.montant)}</b><em>{((charge.montant / donnees.totalCharges) * 100).toFixed(0)}%</em></div>)}</div></div> : <p className="history-empty">Aucune charge enregistrée.</p>}
          {coutAliment !== null && <p className="lot-analysis-feed-note">Montant TTC, TVA de 2,10 % incluse.</p>}
        </article>
        <article id="detail-economique" className="history-panel lot-analysis-economy">
          <h2>Détail économique</h2>
          {donnees.aValider.length > 0 && <p className="lot-analysis-feed-note">Les totaux incluent les charges proposées à valider avec ✓. Le crayon permet de corriger le montant TTC.</p>}
          <div className="lot-analysis-economic-columns">
            <div><h3>Produits</h3><p><span>Vente des volailles</span><b>{formatMontant(donnees.chiffreAffaires)}</b></p><strong>Total produits <b>{formatMontant(donnees.chiffreAffaires)}</b></strong></div>
            <div><h3>Charges</h3>{donnees.repartition.filter((charge) => charge.type !== "ramassage" && charge.type !== "livraison").map((charge) => <p key={charge.type}><span>{charge.label}</span><b>{formatMontant(charge.montant)}</b></p>)}
              {(["ramassage", "livraison"] as const).map((type) => {
                const enregistrees = charges.filter((charge) => charge.type_charge === type);
                const detail = type === "ramassage"
                  ? `${formatNombre(donnees.quantiteLivree)} sujets × ${formatNombre(Number(tarifs.poultry_collection_price_ht), 4)} € HT + TVA ${formatNombre(Number(tarifs.poultry_collection_vat), 1)} %`
                  : `${lot.livraisons.length} livraison(s) × ${formatMontant(Number(tarifs.poultry_transport_price_ht))} HT + TVA ${formatNombre(Number(tarifs.poultry_transport_vat), 1)} %`;
                return enregistrees.length ? enregistrees.map((charge) => <ChargeValider key={`${lot.id}-${charge.id}`} label={chargeLabels[type]}
                  montant={charge.montant} enregistree detail={detail} disabled={saving}
                  onSave={(montant) => enregistrerCharge(type, montant, charge.id)} />)
                  : lot.livraisons.length > 0 ? <ChargeValider key={`${lot.id}-${type}`} label={chargeLabels[type]}
                    montant={donnees.propositions[type]} enregistree={false} detail={detail} disabled={saving}
                    onSave={(montant) => enregistrerCharge(type, montant)} /> : null;
              })}
              <strong>{donnees.aValider.length ? "Total estimé" : "Total charges"} <b>{formatMontant(donnees.totalCharges)}</b></strong></div>
          </div>
          <div className="lot-analysis-margin"><span>{donnees.aValider.length ? "Marge nette estimée" : "Marge nette"} <b>{formatMontant(donnees.resultat)}</b></span><span>Taux de marge <b>{donnees.tauxMarge.toFixed(1)} %</b></span></div>
        </article>
      </section>

      <section className="history-panel lot-analysis-performance">
        <h2>Performances de production</h2>
        <dl>
          <div><dt>Âge à la livraison</dt><dd>{lot.age || 0} jours</dd></div>
          <div><dt>Poids moyen à la livraison</dt><dd>{formatPoids(donnees.poidsMoyen)}</dd></div>
          <div><dt>Taux de mortalité</dt><dd>{formatNombre(donnees.tauxMortalite, 1)} %</dd></div>
          <div><dt>Quantité retenue</dt><dd>{formatNombre(lot.quantite_retenue || 0)}</dd></div>
          <div><dt>Autoconsommation</dt><dd>{formatNombre(lot.autoconsommation || 0)}</dd></div>
          <div><dt>Sujets restants</dt><dd>{formatNombre(lot.sujets_restants || 0)}</dd></div>
        </dl>
      </section>

      <section className="lot-analysis-bottom-grid">
        <article className="history-panel lot-history-details"><details key={`livraisons-${lot.id}`}><summary><strong>Historique des livraisons</strong><span>{lot.livraisons.length} livraison(s) · {formatNombre(donnees.quantiteLivree)} sujets</span></summary><div className="lot-analysis-table-wrap"><table className="lot-analysis-table"><thead><tr><th>Date</th><th>Quantité</th><th>Poids total</th><th>Poids moyen</th></tr></thead><tbody>{lot.livraisons.map((livraison) => <tr key={livraison.id}><td>{formatDate(livraison.date)}</td><td>{livraison.quantite}</td><td>{livraison.poids.toFixed(2)} kg</td><td>{livraison.quantite > 0 ? (livraison.poids / livraison.quantite).toFixed(2) : "0.00"} kg</td></tr>)}</tbody><tfoot><tr><td>Total</td><td>{donnees.quantiteLivree}</td><td>{donnees.totalPoids.toFixed(2)} kg</td><td>{donnees.poidsMoyen.toFixed(2)} kg</td></tr></tfoot></table></div></details></article>
        <article className="history-panel lot-history-details"><details key={`mortalites-${lot.id}`}><summary><strong>Historique des mortalités</strong><span>{lot.mortalites.length} saisie(s) · {formatNombre(lot.nb_morts || 0)} sujets</span></summary><div className="lot-analysis-table-wrap"><table className="lot-analysis-table"><thead><tr><th>Date</th><th>Nombre</th></tr></thead><tbody>{lot.mortalites.map((mortalite) => <tr key={mortalite.id}><td>{formatDate(mortalite.date)}</td><td>{mortalite.nombre}</td></tr>)}</tbody><tfoot><tr><td>Total</td><td>{lot.nb_morts || 0}</td></tr></tfoot></table></div></details></article>
        <article className="history-panel lot-analysis-keypoints"><h2>Points clés</h2><p>✓ Poids moyen final : {donnees.poidsMoyen.toFixed(2)} kg.</p><p>✓ {donnees.resultat >= 0 ? "Marge nette positive." : "Marge nette à améliorer."}</p><p>✓ Les charges alimentaires représentent {donnees.totalCharges > 0 ? ((donnees.repartition.find((charge) => charge.type === "aliment")?.montant || 0) / donnees.totalCharges * 100).toFixed(0) : 0}% des charges.</p><p>✓ Taux de mortalité : {donnees.tauxMortalite.toFixed(1)} %.</p></article>
      </section>
    </div>
  );
}

function HistoryMetric({ tone, icon, label, value, note }: { tone: string; icon: string; label: string; value: string; note: string }) {
  return <article className="history-kpi"><span className={`history-kpi-icon history-kpi-${tone}`}>{icon}</span><div><small>{label}</small><strong>{value}</strong><em>{note}</em></div></article>;
}

function formatDate(date: string) {
  if (!date) return "—";
  return new Date(`${date}T00:00:00`).toLocaleDateString("fr-FR");
}
