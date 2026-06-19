import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import toast from "react-hot-toast";
import { supabase } from "../supabaseClient";
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
  resultat_brut: number;
  resultat_net: number | null;
  autoconsommation: number;
  quantite_retenue: number;
  total_poids_livre: number;
  livraisons: LivraisonVolaille[];
  mortalites: MortaliteVolaille[];
};

type Charge = { type_charge: string; montant: number };

const chargeLabels: Record<string, string> = {
  aliment: "Aliment",
  achat_poussins: "Achat poussins",
  ramassage: "Ramassage",
  livraison: "Livraison",
};
const chargeColors = ["#209447", "#f5b000", "#3b78d8", "#8b6bd9", "#a7b1bc"];

export default function AnalyseLot() {
  const { lotId } = useParams();
  const [lot, setLot] = useState<LotAnalyse | null>(null);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const charger = async () => {
      if (!lotId) {
        setLoading(false);
        return;
      }
      try {
        const [lots, chargesResult] = await Promise.all([
          chargerLotsAvecMouvements(false),
          supabase.from("charges").select("type_charge, montant").eq("lot_id", lotId),
        ]);
        if (chargesResult.error) throw chargesResult.error;
        setLot((lots as LotAnalyse[]).find((item) => item.id === lotId) || null);
        setCharges((chargesResult.data || []).map((charge) => ({ ...charge, montant: Number(charge.montant) || 0 })));
      } catch (error) {
        console.error("Erreur chargement analyse lot :", error);
        toast.error("L'analyse du lot n'a pas pu être chargée.");
      }
      setLoading(false);
    };
    charger();
  }, [lotId]);

  const donnees = useMemo(() => {
    if (!lot) return null;
    const quantiteLivree = lot.livraisons.reduce((total, livraison) => total + Number(livraison.quantite || 0), 0);
    const totalPoids = Number(lot.total_poids_livre) || 0;
    const poidsMoyen = quantiteLivree > 0 ? totalPoids / quantiteLivree : 0;
    const tauxMortalite = lot.quantite > 0 ? (Number(lot.nb_morts || 0) / lot.quantite) * 100 : 0;
    const totalCharges = charges.reduce((total, charge) => total + charge.montant, 0);
    const chiffreAffaires = Number(lot.resultat_brut) || 0;
    const resultat = lot.resultat_net != null ? Number(lot.resultat_net) || 0 : chiffreAffaires - totalCharges;
    const tauxMarge = chiffreAffaires > 0 ? (resultat / chiffreAffaires) * 100 : 0;
    const repartition = Object.entries(charges.reduce<Record<string, number>>((totaux, charge) => {
      totaux[charge.type_charge] = (totaux[charge.type_charge] || 0) + charge.montant;
      return totaux;
    }, {})).map(([type, montant]) => ({ type, label: chargeLabels[type] || "Divers", montant })).sort((a, b) => b.montant - a.montant);
    const segments = repartition.reduce((acc, charge, index) => {
      const debut = acc.fin;
      const fin = index === repartition.length - 1 || totalCharges <= 0 ? 360 : debut + (charge.montant / totalCharges) * 360;
      acc.segments.push(`${chargeColors[index % chargeColors.length]} ${debut}deg ${fin}deg`);
      acc.fin = fin;
      return acc;
    }, { segments: [] as string[], fin: 0 }).segments;
    const evolutionPoids = [...lot.livraisons].sort((a, b) => a.date.localeCompare(b.date)).map((livraison, index) => ({
      label: livraison.date ? new Date(`${livraison.date}T00:00:00`).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }) : `Liv. ${index + 1}`,
      poids: livraison.quantite > 0 ? livraison.poids / livraison.quantite : 0,
    }));
    return { quantiteLivree, totalPoids, poidsMoyen, tauxMortalite, totalCharges, chiffreAffaires, resultat, tauxMarge, repartition, segments, evolutionPoids };
  }, [lot, charges]);

  if (loading) return <div className="history-loading">Chargement de l’analyse...</div>;
  if (!lot || !donnees) return <div className="history-page"><div className="history-empty">Lot introuvable.</div></div>;

  return (
    <div className="lot-analysis-page">
      <div className="lot-analysis-breadcrumb"><Link to="/volailles/historique">Historique des lots</Link><span>›</span><span>{lot.nom}</span><span>›</span><strong>Analyse complète</strong></div>
      <header className="lot-analysis-heading">
        <div><h1>Analyse complète – Lot {lot.nom} <span>Terminé</span></h1><p>Arrivé le {formatDate(lot.date_arrivee)} · Bâtiment {lot.batiment} · Période de {lot.age || 0} jours</p></div>
        <div><button type="button" onClick={() => window.print()}>▤ Exporter PDF</button><Link to="/volailles/historique">← Retour à l’historique</Link></div>
      </header>

      <section className="history-kpis">
        <HistoryMetric tone="blue" icon="♧" label="Sujets livrés" value={String(donnees.quantiteLivree)} note={`Sur ${lot.quantite} sujets arrivés`} />
        <HistoryMetric tone="green" icon="⚖" label="Poids total livré" value={`${donnees.totalPoids.toFixed(2)} kg`} note={`Poids moyen : ${donnees.poidsMoyen.toFixed(2)} kg`} />
        <HistoryMetric tone="orange" icon="€" label="Résultat net" value={`${donnees.resultat.toFixed(2)} €`} note={`Taux de marge : ${donnees.tauxMarge.toFixed(1)} %`} />
        <HistoryMetric tone="red" icon="✝" label="Taux de mortalité" value={`${donnees.tauxMortalite.toFixed(1)} %`} note={`${lot.nb_morts || 0} sujets perdus`} />
      </section>

      <section className="lot-analysis-top-grid">
        <article className="history-panel lot-analysis-performance">
          <h2>Performances de production</h2>
          <dl>
            <div><dt>Âge à la livraison</dt><dd>{lot.age || 0} jours</dd></div>
            <div><dt>Poids moyen à la livraison</dt><dd>{donnees.poidsMoyen.toFixed(2)} kg</dd></div>
            <div><dt>Taux de mortalité</dt><dd>{donnees.tauxMortalite.toFixed(1)} %</dd></div>
            <div><dt>Quantité retenue</dt><dd>{lot.quantite_retenue || 0}</dd></div>
            <div><dt>Autoconsommation</dt><dd>{lot.autoconsommation || 0}</dd></div>
            <div><dt>Sujets restants</dt><dd>{lot.sujets_restants || 0}</dd></div>
          </dl>
        </article>
        <article className="history-panel lot-analysis-chart">
          <h2>Poids moyen par livraison (kg)</h2>
          {donnees.evolutionPoids.length ? (
            <ResponsiveContainer width="100%" height={245}>
              <LineChart data={donnees.evolutionPoids} margin={{ top: 20, right: 25, left: 0, bottom: 5 }}>
                <CartesianGrid stroke="#e5ebe8" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => [`${Number(value).toFixed(2)} kg`, "Poids moyen"]} />
                <Line type="monotone" dataKey="poids" stroke="#16853d" strokeWidth={3} dot={{ fill: "#16853d", r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : <p className="history-empty">Aucune livraison enregistrée.</p>}
        </article>
      </section>

      <section className="lot-analysis-middle-grid">
        <article className="history-panel history-charges">
          <h2>Charges par lot</h2>
          {donnees.totalCharges > 0 ? <div><div className="history-charge-ring" style={{ background: `conic-gradient(${donnees.segments.join(", ")})` }}><span><small>Total charges</small><strong>{donnees.totalCharges.toFixed(2)} €</strong></span></div><div className="history-charge-list">{donnees.repartition.map((charge, index) => <div key={charge.type}><i style={{ background: chargeColors[index % chargeColors.length] }} /><span>{charge.label}</span><b>{charge.montant.toFixed(2)} €</b><em>{((charge.montant / donnees.totalCharges) * 100).toFixed(0)}%</em></div>)}</div></div> : <p className="history-empty">Aucune charge enregistrée.</p>}
        </article>
        <article className="history-panel lot-analysis-economy">
          <h2>Détail économique</h2>
          <div className="lot-analysis-economic-columns">
            <div><h3>Produits</h3><p><span>Vente des volailles</span><b>{donnees.chiffreAffaires.toFixed(2)} €</b></p><strong>Total produits <b>{donnees.chiffreAffaires.toFixed(2)} €</b></strong></div>
            <div><h3>Charges</h3>{donnees.repartition.map((charge) => <p key={charge.type}><span>{charge.label}</span><b>{charge.montant.toFixed(2)} €</b></p>)}<strong>Total charges <b>{donnees.totalCharges.toFixed(2)} €</b></strong></div>
          </div>
          <div className="lot-analysis-margin"><span>Marge nette <b>{donnees.resultat.toFixed(2)} €</b></span><span>Taux de marge <b>{donnees.tauxMarge.toFixed(1)} %</b></span></div>
        </article>
      </section>

      <section className="lot-analysis-bottom-grid">
        <article className="history-panel"><h2>Livraisons</h2><div className="lot-analysis-table-wrap"><table className="lot-analysis-table"><thead><tr><th>Date</th><th>Quantité</th><th>Poids total</th><th>Poids moyen</th></tr></thead><tbody>{lot.livraisons.map((livraison) => <tr key={livraison.id}><td>{formatDate(livraison.date)}</td><td>{livraison.quantite}</td><td>{livraison.poids.toFixed(2)} kg</td><td>{livraison.quantite > 0 ? (livraison.poids / livraison.quantite).toFixed(2) : "0.00"} kg</td></tr>)}</tbody><tfoot><tr><td>Total</td><td>{donnees.quantiteLivree}</td><td>{donnees.totalPoids.toFixed(2)} kg</td><td>{donnees.poidsMoyen.toFixed(2)} kg</td></tr></tfoot></table></div></article>
        <article className="history-panel"><h2>Mortalités</h2><div className="lot-analysis-table-wrap"><table className="lot-analysis-table"><thead><tr><th>Date</th><th>Nombre</th></tr></thead><tbody>{lot.mortalites.map((mortalite) => <tr key={mortalite.id}><td>{formatDate(mortalite.date)}</td><td>{mortalite.nombre}</td></tr>)}</tbody><tfoot><tr><td>Total</td><td>{lot.nb_morts || 0}</td></tr></tfoot></table></div></article>
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
