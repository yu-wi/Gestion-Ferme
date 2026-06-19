import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
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

type OngletAnalyse = "production" | "economie";

type LotAnalyse = {
  id: string;
  nom: string;
  quantite: number;
  date_arrivee: string;
  batiment: string;
  mortalites: MortaliteVolaille[];
  livraisons: LivraisonVolaille[];
  nb_morts: number;
  sujets_restants: number;
  resultat_brut: number | null;
  resultat_net: number | null;
  autoconsommation: number;
  quantite_retenue: number;
  total_poids_livre: number;
};

type Charge = {
  lot_id: string;
  type_charge: string;
  montant: number;
};

type LigneAnalyse = LotAnalyse & {
  quantiteLivree: number;
  tauxMortalite: number;
  poidsMoyen: number;
  chargePoussins: number;
  chargeAliments: number;
  chargeRamassage: number;
  chargeLivraison: number;
  chargeDivers: number;
  totalCharges: number;
  resultatCalcule: number;
  margeParKg: number;
  tauxCharges: number;
  tauxLivraison: number;
};

const couleursCharges = ["#209447", "#f5b000", "#3b78d8", "#8b6bd9", "#9aa6b2"];

export default function Analyse() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [lots, setLots] = useState<LotAnalyse[]>([]);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [onglet, setOnglet] = useState<OngletAnalyse>(
    searchParams.get("onglet") === "economie" ? "economie" : "production"
  );
  const [recherche, setRecherche] = useState("");
  const [lotFiltreId, setLotFiltreId] = useState("");
  const [lotSelectionneId, setLotSelectionneId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const chargerAnalyse = async () => {
      try {
        const [lotsData, chargesResult] = await Promise.all([
          chargerLotsAvecMouvements(false),
          supabase.from("charges").select("lot_id, type_charge, montant"),
        ]);
        if (chargesResult.error) throw chargesResult.error;
        setLots(lotsData as LotAnalyse[]);
        setCharges(
          (chargesResult.data || []).map((charge) => ({
            ...charge,
            montant: Number(charge.montant) || 0,
          })) as Charge[]
        );
      } catch (error) {
        console.error("Erreur chargement analyse :", error);
        toast.error("La page Analyse n'a pas pu être chargée.");
      }
      setLoading(false);
    };
    chargerAnalyse();
  }, []);

  const lignes = useMemo<LigneAnalyse[]>(
    () =>
      lots.map((lot) => {
        const quantiteLivree = lot.livraisons.reduce(
          (total, livraison) => total + Number(livraison.quantite || 0),
          0
        );
        const poidsLivre = Number(lot.total_poids_livre) || 0;
        const chiffreAffaires = Number(lot.resultat_brut) || 0;
        const chargesLot = charges.filter((charge) => charge.lot_id === lot.id);
        const totalType = (type: string) =>
          chargesLot
            .filter((charge) => charge.type_charge === type)
            .reduce((total, charge) => total + charge.montant, 0);
        const chargePoussins = totalType("achat_poussins");
        const chargeAliments = totalType("aliment");
        const chargeRamassage = totalType("ramassage");
        const chargeLivraison = totalType("livraison");
        const chargeDivers = chargesLot
          .filter(
            (charge) =>
              !["achat_poussins", "aliment", "ramassage", "livraison"].includes(
                charge.type_charge
              )
          )
          .reduce((total, charge) => total + charge.montant, 0);
        const totalCharges = chargesLot.reduce(
          (total, charge) => total + charge.montant,
          0
        );
        const resultatCalcule =
          lot.resultat_net != null
            ? Number(lot.resultat_net) || 0
            : chiffreAffaires - totalCharges;

        return {
          ...lot,
          quantiteLivree,
          tauxMortalite:
            lot.quantite > 0
              ? ((Number(lot.nb_morts) || 0) / lot.quantite) * 100
              : 0,
          poidsMoyen: quantiteLivree > 0 ? poidsLivre / quantiteLivree : 0,
          chargePoussins,
          chargeAliments,
          chargeRamassage,
          chargeLivraison,
          chargeDivers,
          totalCharges,
          resultatCalcule,
          margeParKg: poidsLivre > 0 ? resultatCalcule / poidsLivre : 0,
          tauxCharges:
            chiffreAffaires > 0 ? (totalCharges / chiffreAffaires) * 100 : 0,
          tauxLivraison:
            lot.quantite > 0 ? (quantiteLivree / lot.quantite) * 100 : 0,
        };
      }),
    [lots, charges]
  );

  const terme = recherche.trim().toLowerCase();
  const lignesAffichees = lignes.filter(
    (lot) =>
      (!lotFiltreId || lot.id === lotFiltreId) &&
      (!terme ||
        lot.nom.toLowerCase().includes(terme) ||
        lot.batiment.toLowerCase().includes(terme))
  );

  useEffect(() => {
    if (
      lignesAffichees.length > 0 &&
      !lignesAffichees.some((lot) => lot.id === lotSelectionneId)
    ) {
      setLotSelectionneId(lignesAffichees[0].id);
    }
  }, [lignesAffichees, lotSelectionneId]);

  const lotSelectionne =
    lignesAffichees.find((lot) => lot.id === lotSelectionneId) ||
    lignesAffichees[0];

  if (loading) return <div className="analysis-loading">Chargement de l’analyse...</div>;

  return (
    <div className="analysis-page">
      <header className="analysis-heading">
        <h1>Analyse des lots</h1>
        <p>Comparez les performances de production et les résultats économiques des lots archivés.</p>
      </header>

      <section className="analysis-toolbar">
        <div className="analysis-tabs">
          <button type="button" className={onglet === "production" ? "analysis-tab-active" : ""} onClick={() => { setOnglet("production"); setSearchParams({}); }}>▥ Production</button>
          <button type="button" className={onglet === "economie" ? "analysis-tab-active" : ""} onClick={() => { setOnglet("economie"); setSearchParams({ onglet: "economie" }); }}>€ Économie</button>
        </div>
        <select value={lotFiltreId} onChange={(event) => setLotFiltreId(event.target.value)}>
          <option value="">Tous les lots</option>
          {lignes.map((lot) => <option key={lot.id} value={lot.id}>{lot.nom}</option>)}
        </select>
        <input type="search" value={recherche} onChange={(event) => setRecherche(event.target.value)} placeholder="Rechercher un lot ou un bâtiment..." />
      </section>

      {!lignesAffichees.length ? (
        <div className="analysis-empty">Aucun lot ne correspond à cette recherche.</div>
      ) : onglet === "production" ? (
        <AnalyseProduction lignes={lignesAffichees} lotSelectionne={lotSelectionne} />
      ) : (
        <AnalyseEconomie lignes={lignesAffichees} lotSelectionne={lotSelectionne} onSelection={setLotSelectionneId} />
      )}
    </div>
  );
}

function AnalyseProduction({
  lignes,
  lotSelectionne,
}: {
  lignes: LigneAnalyse[];
  lotSelectionne?: LigneAnalyse;
}) {
  const totalInitial = somme(lignes, "quantite");
  const totalMorts = somme(lignes, "nb_morts");
  const totalLivres = somme(lignes, "quantiteLivree");
  const totalPoids = somme(lignes, "total_poids_livre");
  const tauxMortalite = totalInitial > 0 ? (totalMorts / totalInitial) * 100 : 0;
  const poidsMoyen = totalLivres > 0 ? totalPoids / totalLivres : 0;
  const quantiteRetenue = somme(lignes, "quantite_retenue");
  const tauxLivraison = totalInitial > 0 ? (totalLivres / totalInitial) * 100 : 0;
  const margeParKg =
    totalPoids > 0 ? somme(lignes, "resultatCalcule") / totalPoids : 0;
  const chiffreAffaires = somme(lignes, "resultat_brut");
  const tauxCharges =
    chiffreAffaires > 0 ? (somme(lignes, "totalCharges") / chiffreAffaires) * 100 : 0;

  return (
    <>
      <section className="analysis-kpis analysis-kpis-eight">
        <AnalysisKpi tone="green" icon="▣" label="Lots analysés" value={String(lignes.length)} note="Lots affichés" />
        <AnalysisKpi tone="blue" icon="♧" label="Sujets initiaux" value={String(totalInitial)} note="Effectif cumulé" />
        <AnalysisKpi tone="blue" icon="✓" label="Sujets livrés" value={String(totalLivres)} note={`${tauxLivraison.toFixed(1)} % des sujets`} />
        <AnalysisKpi tone="red" icon="✝" label="Mortalités" value={String(totalMorts)} note="Sujets perdus" />
        <AnalysisKpi tone="orange" icon="%" label="Taux de mortalité" value={`${tauxMortalite.toFixed(1)} %`} note="Moyenne globale" />
        <AnalysisKpi tone="green" icon="⚖" label="Poids livré" value={`${totalPoids.toFixed(2)} kg`} note="Poids cumulé" />
        <AnalysisKpi tone="violet" icon="◔" label="Poids moyen" value={`${poidsMoyen.toFixed(2)} kg`} note="Par sujet livré" />
        <AnalysisKpi tone="orange" icon="▣" label="Quantité retenue" value={String(quantiteRetenue)} note="Sujets conservés" />
      </section>

      <section className="analysis-panel analysis-chart-panel">
        <div className="analysis-panel-heading"><h2>Comparaison technique par lot</h2><span>Sujets livrés et mortalités</span></div>
        <div className="analysis-chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={lignes} margin={{ top: 24, right: 25, left: 0, bottom: 18 }}>
              <CartesianGrid stroke="#e5ebe8" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="nom" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend />
              <Bar yAxisId="left" dataKey="quantiteLivree" fill="#2563eb" name="Sujets livrés" radius={[5, 5, 0, 0]} />
              <Bar yAxisId="right" dataKey="nb_morts" fill="#ef1018" name="Mortalités" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <TableauLots lignes={lignes} mode="production" />

      <section className="analysis-panel">
        <h2>Indicateurs de performance</h2>
        <div className="analysis-performance-grid">
          <PerformanceCard tone="blue" icon="✓" label="Taux de livraison" value={`${tauxLivraison.toFixed(1)} %`} status={tauxLivraison >= 80 ? "Bon" : "À surveiller"} />
          <PerformanceCard tone="green" icon="⚖" label="Poids moyen" value={`${poidsMoyen.toFixed(2)} kg`} status={poidsMoyen >= 2 ? "Bon" : "À améliorer"} />
          <PerformanceCard tone="orange" icon="€" label="Marge par kg" value={`${margeParKg.toFixed(2)} €`} status={margeParKg >= 0 ? "Positive" : "Négative"} />
          <PerformanceCard tone="violet" icon="%" label="Poids des charges" value={`${tauxCharges.toFixed(1)} %`} status={tauxCharges <= 60 ? "Maîtrisé" : "Élevé"} />
        </div>
      </section>

      {lotSelectionne && (
        <Insight lot={lotSelectionne} />
      )}
    </>
  );
}

function AnalyseEconomie({
  lignes,
  lotSelectionne,
  onSelection,
}: {
  lignes: LigneAnalyse[];
  lotSelectionne?: LigneAnalyse;
  onSelection: (id: string) => void;
}) {
  const chiffreAffaires = somme(lignes, "resultat_brut");
  const totalCharges = somme(lignes, "totalCharges");
  const resultat = somme(lignes, "resultatCalcule");
  const tauxMarge = chiffreAffaires > 0 ? (resultat / chiffreAffaires) * 100 : 0;
  const margeParKg =
    somme(lignes, "total_poids_livre") > 0
      ? resultat / somme(lignes, "total_poids_livre")
      : 0;
  const pieData = lotSelectionne
    ? [
        { name: "Poussins", value: lotSelectionne.chargePoussins },
        { name: "Aliment", value: lotSelectionne.chargeAliments },
        { name: "Ramassage", value: lotSelectionne.chargeRamassage },
        { name: "Livraison", value: lotSelectionne.chargeLivraison },
        { name: "Divers", value: lotSelectionne.chargeDivers },
      ].filter((charge) => charge.value > 0)
    : [];

  return (
    <>
      <section className="analysis-kpis">
        <AnalysisKpi tone="blue" icon="↗" label="Chiffre d’affaires" value={`${chiffreAffaires.toFixed(2)} €`} note="Ventes enregistrées" />
        <AnalysisKpi tone="red" icon="↘" label="Total charges" value={`${totalCharges.toFixed(2)} €`} note="Charges cumulées" />
        <AnalysisKpi tone="green" icon="€" label="Résultat net" value={`${resultat.toFixed(2)} €`} note={`${tauxMarge.toFixed(1)} % de marge`} />
        <AnalysisKpi tone="violet" icon="◔" label="Marge par kg" value={`${margeParKg.toFixed(2)} €`} note="Sur le poids livré" />
      </section>

      <section className="analysis-economic-grid">
        <article className="analysis-panel">
          <div className="analysis-panel-heading"><h2>Répartition des charges</h2><select value={lotSelectionne?.id || ""} onChange={(event) => onSelection(event.target.value)}>{lignes.map((lot) => <option key={lot.id} value={lot.id}>{lot.nom}</option>)}</select></div>
          <div className="analysis-pie">
            {pieData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart><Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="45%" innerRadius={55} outerRadius={95}>{pieData.map((charge, index) => <Cell key={charge.name} fill={couleursCharges[index % couleursCharges.length]} />)}</Pie><Legend /><Tooltip formatter={(value) => `${Number(value).toFixed(2)} €`} /></PieChart>
              </ResponsiveContainer>
            ) : <div className="analysis-empty">Aucune charge enregistrée pour ce lot.</div>}
          </div>
        </article>
        <article className="analysis-panel">
          <div className="analysis-panel-heading"><h2>Rentabilité par lot</h2><span>CA, charges et résultat</span></div>
          <div className="analysis-pie">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={lignes} margin={{ top: 20, right: 15, left: 0, bottom: 18 }}><CartesianGrid stroke="#e5ebe8" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="nom" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip formatter={(value) => `${Number(value).toFixed(2)} €`} /><Legend /><Bar dataKey="resultat_brut" fill="#2563eb" name="Chiffre d’affaires" radius={[4, 4, 0, 0]} /><Bar dataKey="totalCharges" fill="#f5b000" name="Charges" radius={[4, 4, 0, 0]} /><Bar dataKey="resultatCalcule" fill="#16853d" name="Résultat" radius={[4, 4, 0, 0]} /></BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>

      <TableauLots lignes={lignes} mode="economie" />

      <section className="analysis-panel">
        <h2>Indicateurs économiques</h2>
        <div className="analysis-performance-grid">
          <PerformanceCard tone="green" icon="%" label="Taux de marge" value={`${tauxMarge.toFixed(1)} %`} status={tauxMarge >= 20 ? "Bon" : "À améliorer"} />
          <PerformanceCard tone="blue" icon="€" label="Marge par kg" value={`${margeParKg.toFixed(2)} €`} status={margeParKg >= 0 ? "Positive" : "Négative"} />
          <PerformanceCard tone="orange" icon="▣" label="Charge alimentaire" value={`${somme(lignes, "chargeAliments").toFixed(2)} €`} status="Poste principal" />
          <PerformanceCard tone="violet" icon="◔" label="Charges / CA" value={`${(chiffreAffaires > 0 ? totalCharges / chiffreAffaires * 100 : 0).toFixed(1)} %`} status="Ratio global" />
        </div>
      </section>

      {lotSelectionne && <Insight lot={lotSelectionne} />}
    </>
  );
}

function TableauLots({ lignes, mode }: { lignes: LigneAnalyse[]; mode: OngletAnalyse }) {
  return (
    <section className="analysis-panel analysis-detail">
      <h2>Détail par lot</h2>
      <div className="analysis-mobile-list">
        {lignes.map((lot) => <article key={lot.id}><div><strong>{lot.nom}</strong><span>{lot.batiment}</span></div><div><span>{mode === "production" ? "Livrés" : "Résultat"}<b>{mode === "production" ? lot.quantiteLivree : `${lot.resultatCalcule.toFixed(2)} €`}</b></span><span>{mode === "production" ? "Mortalité" : "Charges"}<b>{mode === "production" ? `${lot.tauxMortalite.toFixed(1)} %` : `${lot.totalCharges.toFixed(2)} €`}</b></span><span>{mode === "production" ? "Poids moyen" : "Marge / kg"}<b>{mode === "production" ? `${lot.poidsMoyen.toFixed(2)} kg` : `${lot.margeParKg.toFixed(2)} €`}</b></span></div><Link to={`/volailles/historique/${lot.id}/analyse`}>Voir l’analyse complète →</Link></article>)}
      </div>
      <div className="analysis-table-wrap">
        <table className="analysis-table">
          <thead><tr><th>Lot</th><th>Bâtiment</th>{mode === "production" ? <><th>Livrés</th><th>Mortalités</th><th>Taux de mortalité</th><th>Poids livré</th><th>Poids moyen</th></> : <><th>Chiffre d’affaires</th><th>Charges</th><th>Résultat</th><th>Marge / kg</th><th>Charges / CA</th></>}</tr></thead>
          <tbody>{lignes.map((lot) => <tr key={lot.id}><td><Link to={`/volailles/historique/${lot.id}/analyse`}>{lot.nom}</Link></td><td>{lot.batiment}</td>{mode === "production" ? <><td className="analysis-blue">{lot.quantiteLivree}</td><td className="analysis-red">{lot.nb_morts}</td><td className="analysis-orange">{lot.tauxMortalite.toFixed(1)} %</td><td className="analysis-green">{Number(lot.total_poids_livre).toFixed(2)} kg</td><td>{lot.poidsMoyen.toFixed(2)} kg</td></> : <><td className="analysis-blue">{(Number(lot.resultat_brut) || 0).toFixed(2)} €</td><td className="analysis-orange">{lot.totalCharges.toFixed(2)} €</td><td className={lot.resultatCalcule < 0 ? "analysis-red" : "analysis-green"}>{lot.resultatCalcule.toFixed(2)} €</td><td>{lot.margeParKg.toFixed(2)} €</td><td>{lot.tauxCharges.toFixed(1)} %</td></>}</tr>)}</tbody>
        </table>
      </div>
      {lignes.length === 1 && <Link className="analysis-history-link" to={`/volailles/historique/${lignes[0].id}/analyse`}>Voir l’historique complet du lot →</Link>}
    </section>
  );
}

function AnalysisKpi({ tone, icon, label, value, note }: { tone: string; icon: string; label: string; value: string; note: string }) {
  return <article className="analysis-kpi"><span className={`analysis-kpi-icon analysis-tone-${tone}`}>{icon}</span><div><small>{label}</small><strong>{value}</strong><em>{note}</em></div></article>;
}

function PerformanceCard({ tone, icon, label, value, status }: { tone: string; icon: string; label: string; value: string; status: string }) {
  return <article className={`analysis-performance-card analysis-card-${tone}`}><span>{icon}</span><div><small>{label}</small><strong>{value}</strong><b>{status}</b></div></article>;
}

function Insight({ lot }: { lot: LigneAnalyse }) {
  const message =
    lot.resultatCalcule >= 0 && lot.tauxMortalite <= 15
      ? `Le lot ${lot.nom} présente de bonnes performances globales.`
      : lot.tauxMortalite > 15
        ? `Le lot ${lot.nom} nécessite une attention particulière sur la mortalité.`
        : `Le résultat économique du lot ${lot.nom} peut être amélioré.`;
  const conseil =
    lot.chargeAliments > lot.totalCharges * 0.5
      ? "Les charges alimentaires représentent plus de la moitié des charges : surveillez la conversion alimentaire."
      : "La structure des charges reste équilibrée. Continuez à suivre le poids moyen et les pertes.";
  return <section className="analysis-insight"><span>✓</span><div><strong>Insights et recommandations</strong><p>{message} {conseil}</p></div></section>;
}

function somme<T extends keyof LigneAnalyse>(lignes: LigneAnalyse[], cle: T) {
  return lignes.reduce((total, ligne) => {
    const valeur = ligne[cle];
    return total + (typeof valeur === "number" ? valeur : 0);
  }, 0);
}
