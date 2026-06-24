import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { supabase } from "../supabaseClient";
import { formatMontant, formatNombre, formatPoids } from "../outils/formatNombre";
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
  chargeAliments: number;
  totalCharges: number;
  resultatCalcule: number;
  margeParKg: number;
  tauxCharges: number;
  tauxLivraison: number;
};

export default function Analyse() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [lots, setLots] = useState<LotAnalyse[]>([]);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [onglet, setOnglet] = useState<OngletAnalyse>(
    searchParams.get("onglet") === "economie" ? "economie" : "production"
  );
  const [recherche, setRecherche] = useState("");
  const [lotFiltreId, setLotFiltreId] = useState("");
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
        const chargeAliments = chargesLot
          .filter((charge) => charge.type_charge === "aliment")
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
          chargeAliments,
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

  if (loading) return <div className="analysis-loading">Chargement de l’analyse...</div>;

  return (
    <div className="analysis-page">
      <header className="analysis-heading">
        <h1>Analyse des lots</h1>
        <p>Comparez les performances de production et les résultats économiques des lots archivés.</p>
      </header>

      <nav className="poultry-tabs" aria-label="Sections volailles">
        <Link to="/volailles">Résumé</Link>
        <Link to="/volailles/sica">Lots SICA Madras</Link>
        <Link to="/volailles/sica/historique">Historique SICA</Link>
        <Link to="/volailles/vente-directe">Vente directe</Link>
        <Link to="/volailles/vente-directe/historique">Historique vente directe</Link>
        <Link to="/volailles/alimentation">Alimentation</Link>
        <Link to="/volailles/analyse" className="poultry-tab-active">Performances</Link>
      </nav>

      <section className="analysis-toolbar">
        <div className="analysis-tabs">
          <button type="button" className={onglet === "production" ? "analysis-tab-active" : ""} onClick={() => { setOnglet("production"); setSearchParams({}); }}>▥ Production</button>
          <button type="button" className={onglet === "economie" ? "analysis-tab-active" : ""} onClick={() => { setOnglet("economie"); setSearchParams({ onglet: "economie" }); }}>€ Économie</button>
        </div>
        <select value={lotFiltreId} onChange={(event) => {
          setLotFiltreId(event.target.value);
        }}>
          <option value="">Tous les lots</option>
          {lignes.map((lot) => <option key={lot.id} value={lot.id}>{lot.nom}</option>)}
        </select>
        <input type="search" value={recherche} onChange={(event) => setRecherche(event.target.value)} placeholder="Rechercher un lot ou un bâtiment..." />
      </section>

      {!lignesAffichees.length ? (
        <div className="analysis-empty">Aucun lot ne correspond à cette recherche.</div>
      ) : onglet === "production" ? (
        <AnalyseProduction lignes={lignesAffichees} />
      ) : (
        <AnalyseEconomie lignes={lignesAffichees} />
      )}
    </div>
  );
}

function AnalyseProduction({ lignes }: { lignes: LigneAnalyse[] }) {
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
        <AnalysisKpi tone="green" icon="▣" label="Lots analysés" value={formatNombre(lignes.length)} note="Lots affichés" />
        <AnalysisKpi tone="blue" icon="♧" label="Sujets initiaux" value={formatNombre(totalInitial)} note="Effectif cumulé" />
        <AnalysisKpi tone="blue" icon="✓" label="Sujets livrés" value={formatNombre(totalLivres)} note={`${formatNombre(tauxLivraison, 1)} % des sujets`} />
        <AnalysisKpi tone="red" icon="✝" label="Mortalités" value={formatNombre(totalMorts)} note="Sujets perdus" />
        <AnalysisKpi tone="orange" icon="%" label="Taux de mortalité" value={`${tauxMortalite.toFixed(1)} %`} note="Moyenne globale" />
        <AnalysisKpi tone="green" icon="⚖" label="Poids livré" value={formatPoids(totalPoids)} note="Poids cumulé" />
        <AnalysisKpi tone="violet" icon="◔" label="Poids moyen" value={`${poidsMoyen.toFixed(2)} kg`} note="Par sujet livré" />
        <AnalysisKpi tone="orange" icon="▣" label="Quantité retenue" value={formatNombre(quantiteRetenue)} note="Sujets conservés" />
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

      <InsightGlobal lignes={lignes} mode="production" />
    </>
  );
}

function AnalyseEconomie({ lignes }: { lignes: LigneAnalyse[] }) {
  const chiffreAffaires = somme(lignes, "resultat_brut");
  const totalCharges = somme(lignes, "totalCharges");
  const resultat = somme(lignes, "resultatCalcule");
  const tauxMarge = chiffreAffaires > 0 ? (resultat / chiffreAffaires) * 100 : 0;
  const margeParKg =
    somme(lignes, "total_poids_livre") > 0
      ? resultat / somme(lignes, "total_poids_livre")
      : 0;
  return (
    <>
      <section className="analysis-kpis">
        <AnalysisKpi tone="blue" icon="↗" label="Chiffre d’affaires" value={formatMontant(chiffreAffaires)} note="Ventes enregistrées" />
        <AnalysisKpi tone="red" icon="↘" label="Total charges" value={formatMontant(totalCharges)} note="Charges cumulées" />
        <AnalysisKpi tone="green" icon="€" label="Résultat net" value={formatMontant(resultat)} note={`${formatNombre(tauxMarge, 1)} % de marge`} />
        <AnalysisKpi tone="violet" icon="◔" label="Marge par kg" value={`${margeParKg.toFixed(2)} €`} note="Sur le poids livré" />
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

      <InsightGlobal lignes={lignes} mode="economie" />
    </>
  );
}

function TableauLots({ lignes, mode }: { lignes: LigneAnalyse[]; mode: OngletAnalyse }) {
  return (
    <section className="analysis-panel analysis-detail">
      <h2>Détail par lot</h2>
      <div className="analysis-mobile-list">
        {lignes.map((lot) => <article key={lot.id}><div><strong>{lot.nom}</strong><span>{lot.batiment}</span></div><div><span>{mode === "production" ? "Livrés" : "Résultat"}<b>{mode === "production" ? formatNombre(lot.quantiteLivree) : formatMontant(lot.resultatCalcule)}</b></span><span>{mode === "production" ? "Mortalité" : "Charges"}<b>{mode === "production" ? `${formatNombre(lot.tauxMortalite, 1)} %` : formatMontant(lot.totalCharges)}</b></span><span>{mode === "production" ? "Poids moyen" : "Marge / kg"}<b>{mode === "production" ? formatPoids(lot.poidsMoyen) : formatMontant(lot.margeParKg)}</b></span></div><Link to={`/volailles/sica/historique/${lot.id}/analyse`}>Voir l’analyse complète →</Link></article>)}
      </div>
      <div className="analysis-table-wrap">
        <table className="analysis-table">
          <thead><tr><th>Lot</th><th>Bâtiment</th>{mode === "production" ? <><th>Livrés</th><th>Mortalités</th><th>Taux de mortalité</th><th>Poids livré</th><th>Poids moyen</th></> : <><th>Chiffre d’affaires</th><th>Charges</th><th>Résultat</th><th>Marge / kg</th><th>Charges / CA</th></>}</tr></thead>
          <tbody>{lignes.map((lot) => <tr key={lot.id}><td><Link to={`/volailles/sica/historique/${lot.id}/analyse`}>{lot.nom}</Link></td><td>{lot.batiment}</td>{mode === "production" ? <><td className="analysis-blue">{formatNombre(lot.quantiteLivree)}</td><td className="analysis-red">{formatNombre(lot.nb_morts)}</td><td className="analysis-orange">{formatNombre(lot.tauxMortalite, 1)} %</td><td className="analysis-green">{formatPoids(Number(lot.total_poids_livre))}</td><td>{formatPoids(lot.poidsMoyen)}</td></> : <><td className="analysis-blue">{formatMontant(Number(lot.resultat_brut) || 0)}</td><td className="analysis-orange">{formatMontant(lot.totalCharges)}</td><td className={lot.resultatCalcule < 0 ? "analysis-red" : "analysis-green"}>{formatMontant(lot.resultatCalcule)}</td><td>{formatMontant(lot.margeParKg)}</td><td>{formatNombre(lot.tauxCharges, 1)} %</td></>}</tr>)}</tbody>
        </table>
      </div>
      {lignes.length === 1 && <Link className="analysis-history-link" to={`/volailles/sica/historique/${lignes[0].id}/analyse`}>Voir la fiche complète du lot →</Link>}
    </section>
  );
}

function AnalysisKpi({ tone, icon, label, value, note }: { tone: string; icon: string; label: string; value: string; note: string }) {
  return <article className="analysis-kpi"><span className={`analysis-kpi-icon analysis-tone-${tone}`}>{icon}</span><div><small>{label}</small><strong>{value}</strong><em>{note}</em></div></article>;
}

function PerformanceCard({ tone, icon, label, value, status }: { tone: string; icon: string; label: string; value: string; status: string }) {
  return <article className={`analysis-performance-card analysis-card-${tone}`}><span>{icon}</span><div><small>{label}</small><strong>{value}</strong><b>{status}</b></div></article>;
}

function InsightGlobal({
  lignes,
  mode,
}: {
  lignes: LigneAnalyse[];
  mode: OngletAnalyse;
}) {
  const totalInitial = somme(lignes, "quantite");
  const totalLivres = somme(lignes, "quantiteLivree");
  const totalMorts = somme(lignes, "nb_morts");
  const totalPoids = somme(lignes, "total_poids_livre");
  const tauxLivraison = totalInitial > 0 ? (totalLivres / totalInitial) * 100 : 0;
  const tauxMortalite = totalInitial > 0 ? (totalMorts / totalInitial) * 100 : 0;
  const poidsMoyen = totalLivres > 0 ? totalPoids / totalLivres : 0;
  const chiffreAffaires = somme(lignes, "resultat_brut");
  const totalCharges = somme(lignes, "totalCharges");
  const resultat = somme(lignes, "resultatCalcule");
  const tauxMarge = chiffreAffaires > 0 ? (resultat / chiffreAffaires) * 100 : 0;
  const chargesAliment = somme(lignes, "chargeAliments");
  const partAliment = totalCharges > 0 ? (chargesAliment / totalCharges) * 100 : 0;
  const lotsDeficitaires = lignes.filter((lot) => lot.resultatCalcule < 0).length;

  const message = mode === "production"
    ? `${formatNombre(lignes.length)} lot(s) affiché(s) : ${formatNombre(tauxLivraison, 1)} % des sujets ont été livrés, avec ${formatNombre(tauxMortalite, 1)} % de mortalité et un poids moyen de ${formatPoids(poidsMoyen)}.`
    : `${formatNombre(lignes.length)} lot(s) affiché(s) dégagent un résultat cumulé de ${formatMontant(resultat)}, soit ${formatNombre(tauxMarge, 1)} % de marge. ${formatNombre(lotsDeficitaires)} lot(s) présentent un résultat négatif.`;

  const conseil = mode === "production"
    ? tauxMortalite > 10
      ? "Priorité recommandée : renforcer le suivi sanitaire et identifier les périodes où les pertes se concentrent."
      : tauxLivraison < 80
        ? "Priorité recommandée : analyser les sorties non livrées et les écarts d’effectif."
        : "Les indicateurs de production sont globalement stables. Maintenez le suivi régulier des pertes et du poids final."
    : partAliment > 50
      ? `L’aliment représente ${formatNombre(partAliment, 1)} % des charges. C’est le premier levier à surveiller pour améliorer la marge globale.`
      : tauxMarge < 20
        ? "La marge globale reste limitée. Comparez les prix de vente et les principaux postes de charges entre les lots."
        : "La rentabilité globale est satisfaisante. Surveillez toutefois les lots déficitaires pour éviter qu’ils ne réduisent la marge d’ensemble.";

  return <section className="analysis-insight"><span>✓</span><div><strong>Synthèse et recommandations globales</strong><p>{message} {conseil}</p></div></section>;
}

function somme<T extends keyof LigneAnalyse>(lignes: LigneAnalyse[], cle: T) {
  return lignes.reduce((total, ligne) => {
    const valeur = ligne[cle];
    return total + (typeof valeur === "number" ? valeur : 0);
  }, 0);
}
