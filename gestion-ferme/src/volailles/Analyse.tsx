import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { supabase } from "../supabaseClient";
import { formatMontant, formatNombre, formatPoids } from "../outils/formatNombre";
import {
  chargerLotsAvecMouvements,
  type LivraisonVolaille,
  type MortaliteVolaille,
} from "./volaillesData";

type OngletAnalyse = "production" | "economie";
type SourceAnalyse = "sica" | "direct";
type EspeceDirecte = "poulet" | "pintade";

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

type DirectLotAnalyse = {
  id: string;
  name: string;
  species: EspeceDirecte;
  arrival_date: string;
  location: string | null;
  initial_quantity: number;
  remaining_quantity: number;
  mortality_count: number;
  status: "elevage" | "pret" | "termine";
};

type DirectDeliveryAnalyse = {
  id: string;
  lot_id: string;
  quantity_delivered: number;
  total_weight: number | null;
  amount_invoiced: number;
  amount_paid: number;
};

type LigneAnalyse = {
  id: string;
  nom: string;
  groupe: string;
  source: SourceAnalyse;
  espece?: EspeceDirecte;
  detailUrl?: string;
  quantite: number;
  nb_morts: number;
  quantiteLivree: number;
  quantiteRetenue: number;
  total_poids_livre: number;
  chiffreAffaires: number;
  chargeAliments: number;
  totalCharges: number;
  resultatCalcule: number;
  tauxMortalite: number;
  poidsMoyen: number;
  margeParKg: number;
  tauxCharges: number;
  tauxLivraison: number;
};

export default function Analyse() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const source: SourceAnalyse = location.pathname.includes("vente-directe")
    ? "direct"
    : "sica";
  const [lotsSica, setLotsSica] = useState<LotAnalyse[]>([]);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [lotsDirects, setLotsDirects] = useState<DirectLotAnalyse[]>([]);
  const [livraisonsDirectes, setLivraisonsDirectes] = useState<DirectDeliveryAnalyse[]>([]);
  const [onglet, setOnglet] = useState<OngletAnalyse>(
    searchParams.get("onglet") === "economie" ? "economie" : "production"
  );
  const [recherche, setRecherche] = useState("");
  const [lotFiltreId, setLotFiltreId] = useState("");
  const [especeDirecte, setEspeceDirecte] = useState<"" | EspeceDirecte>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const chargerAnalyse = async () => {
      setLoading(true);
      try {
        const [
          lotsData,
          chargesResult,
          directLotsResult,
          directDeliveriesResult,
        ] = await Promise.all([
          chargerLotsAvecMouvements(false),
          supabase.from("charges").select("lot_id, type_charge, montant"),
          supabase.from("direct_sale_lots").select("*").eq("status", "termine"),
          supabase.from("direct_sale_deliveries").select("*"),
        ]);
        if (chargesResult.error) throw chargesResult.error;
        if (directLotsResult.error && !["42P01", "PGRST205"].includes(directLotsResult.error.code || "")) {
          throw directLotsResult.error;
        }
        if (directDeliveriesResult.error && !["42P01", "PGRST205"].includes(directDeliveriesResult.error.code || "")) {
          throw directDeliveriesResult.error;
        }
        setLotsSica(lotsData as LotAnalyse[]);
        setCharges(
          (chargesResult.data || []).map((charge) => ({
            ...charge,
            montant: Number(charge.montant) || 0,
          })) as Charge[]
        );
        setLotsDirects(
          (directLotsResult.data || []).map((lot) => ({
            ...lot,
            initial_quantity: Number(lot.initial_quantity) || 0,
            remaining_quantity: Number(lot.remaining_quantity) || 0,
            mortality_count: Number(lot.mortality_count) || 0,
          })) as DirectLotAnalyse[]
        );
        setLivraisonsDirectes(
          (directDeliveriesResult.data || []).map((delivery) => ({
            ...delivery,
            quantity_delivered: Number(delivery.quantity_delivered) || 0,
            total_weight: delivery.total_weight == null ? null : Number(delivery.total_weight),
            amount_invoiced: Number(delivery.amount_invoiced) || 0,
            amount_paid: Number(delivery.amount_paid) || 0,
          })) as DirectDeliveryAnalyse[]
        );
      } catch (error) {
        console.error("Erreur chargement analyse :", error);
        toast.error("La page Analyse n'a pas pu être chargée.");
      }
      setLoading(false);
    };
    chargerAnalyse();
  }, []);

  const lignesSica = useMemo<LigneAnalyse[]>(
    () =>
      lotsSica.map((lot) => {
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

        return construireLigne({
          id: lot.id,
          nom: lot.nom,
          groupe: lot.batiment,
          source: "sica",
          detailUrl: `/volailles/sica/historique/${lot.id}/analyse`,
          quantite: lot.quantite,
          nb_morts: Number(lot.nb_morts) || 0,
          quantiteLivree,
          quantiteRetenue: Number(lot.quantite_retenue) || 0,
          total_poids_livre: poidsLivre,
          chiffreAffaires,
          chargeAliments,
          totalCharges,
          resultatCalcule,
        });
      }),
    [lotsSica, charges]
  );

  const lignesDirectes = useMemo<LigneAnalyse[]>(
    () =>
      lotsDirects.map((lot) => {
        const livraisonsLot = livraisonsDirectes.filter(
          (livraison) => livraison.lot_id === lot.id
        );
        const quantiteLivree = livraisonsLot.reduce(
          (total, livraison) => total + livraison.quantity_delivered,
          0
        );
        const poidsLivre = livraisonsLot.reduce(
          (total, livraison) => total + (livraison.total_weight || 0),
          0
        );
        const chiffreAffaires = livraisonsLot.reduce(
          (total, livraison) => total + livraison.amount_invoiced,
          0
        );

        return construireLigne({
          id: lot.id,
          nom: lot.name,
          groupe: lot.location || "Non renseigné",
          source: "direct",
          espece: lot.species,
          quantite: lot.initial_quantity,
          nb_morts: lot.mortality_count,
          quantiteLivree,
          quantiteRetenue: lot.remaining_quantity,
          total_poids_livre: poidsLivre,
          chiffreAffaires,
          chargeAliments: 0,
          totalCharges: 0,
          resultatCalcule: chiffreAffaires,
        });
      }),
    [lotsDirects, livraisonsDirectes]
  );

  const lignes = source === "direct" ? lignesDirectes : lignesSica;
  const terme = recherche.trim().toLowerCase();
  const lignesAffichees = lignes.filter(
    (lot) =>
      (!lotFiltreId || lot.id === lotFiltreId) &&
      (!especeDirecte || lot.espece === especeDirecte) &&
      (!terme ||
        lot.nom.toLowerCase().includes(terme) ||
        lot.groupe.toLowerCase().includes(terme))
  );
  const titreSource = source === "direct" ? "Vente directe" : "Lots SICA";
  const prochainOnglet = (valeur: OngletAnalyse) => {
    setOnglet(valeur);
    setSearchParams(valeur === "economie" ? { onglet: "economie" } : {});
  };

  if (loading) return <div className="analysis-loading">Chargement de l’analyse...</div>;

  return (
    <div className="analysis-page">
      <header className="analysis-heading">
        <h1>Analyse {titreSource}</h1>
        <p>
          {source === "direct"
            ? "Analyse des lots clôturés de vente directe, avec lecture par espèce."
            : "Comparez les performances de production et les résultats économiques des lots SICA clôturés."}
        </p>
      </header>

      <nav className="poultry-tabs" aria-label="Sections volailles">
        <Link to="/volailles">Résumé</Link>
        <Link to="/volailles/alimentation">Alimentation</Link>
        <Link to="/volailles/sica">Lots SICA Madras</Link>
        <Link to="/volailles/sica/historique">Historique SICA</Link>
        <Link to="/volailles/vente-directe">Vente directe</Link>
        <Link to="/volailles/vente-directe/historique">Historique vente directe</Link>
        <Link to="/volailles/analyse/sica" className={source === "sica" ? "poultry-tab-active" : undefined}>Analyse SICA</Link>
        <Link to="/volailles/analyse/vente-directe" className={source === "direct" ? "poultry-tab-active" : undefined}>Analyse vente directe</Link>
        <Link to="/volailles/inventaire">Inventaire</Link>
      </nav>

      <section className="analysis-source-tabs" aria-label="Type d'analyse">
        <Link to="/volailles/analyse/sica" className={source === "sica" ? "analysis-source-active" : undefined}>Lots SICA</Link>
        <Link to="/volailles/analyse/vente-directe" className={source === "direct" ? "analysis-source-active" : undefined}>Vente directe</Link>
      </section>

      <section className={`analysis-toolbar analysis-toolbar-${source}`}>
        <div className="analysis-tabs">
          <button type="button" className={onglet === "production" ? "analysis-tab-active" : ""} onClick={() => prochainOnglet("production")}>▥ Production</button>
          <button type="button" className={onglet === "economie" ? "analysis-tab-active" : ""} onClick={() => prochainOnglet("economie")}>€ Économie</button>
        </div>
        <select value={lotFiltreId} onChange={(event) => setLotFiltreId(event.target.value)}>
          <option value="">Tous les lots</option>
          {lignes.map((lot) => <option key={lot.id} value={lot.id}>{lot.nom}</option>)}
        </select>
        {source === "direct" && (
          <select value={especeDirecte} onChange={(event) => setEspeceDirecte(event.target.value as "" | EspeceDirecte)}>
            <option value="">Toutes espèces</option>
            <option value="poulet">Poulets</option>
            <option value="pintade">Pintades</option>
          </select>
        )}
        <input type="search" value={recherche} onChange={(event) => setRecherche(event.target.value)} placeholder={source === "direct" ? "Rechercher un lot ou un emplacement..." : "Rechercher un lot ou un bâtiment..."} />
      </section>

      {!lignesAffichees.length ? (
        <div className="analysis-empty">Aucun lot ne correspond à cette recherche.</div>
      ) : onglet === "production" ? (
        <AnalyseProduction lignes={lignesAffichees} source={source} />
      ) : (
        <AnalyseEconomie lignes={lignesAffichees} source={source} />
      )}
    </div>
  );
}

function AnalyseProduction({ lignes, source }: { lignes: LigneAnalyse[]; source: SourceAnalyse }) {
  const totalInitial = somme(lignes, "quantite");
  const totalMorts = somme(lignes, "nb_morts");
  const totalLivres = somme(lignes, "quantiteLivree");
  const totalPoids = somme(lignes, "total_poids_livre");
  const tauxMortalite = totalInitial > 0 ? (totalMorts / totalInitial) * 100 : 0;
  const poidsMoyen = totalLivres > 0 ? totalPoids / totalLivres : 0;
  const quantiteRetenue = somme(lignes, "quantiteRetenue");
  const tauxLivraison = totalInitial > 0 ? (totalLivres / totalInitial) * 100 : 0;
  const chiffreAffaires = somme(lignes, "chiffreAffaires");
  const totalCharges = somme(lignes, "totalCharges");

  return (
    <>
      {source === "direct" && <AnalyseParEspece lignes={lignes} />}
      <section className="analysis-kpis analysis-kpis-eight">
        <AnalysisKpi tone="green" icon="▣" label="Lots analysés" value={formatNombre(lignes.length)} note="Lots clôturés affichés" />
        <AnalysisKpi tone="blue" icon="♧" label="Sujets initiaux" value={formatNombre(totalInitial)} note="Effectif cumulé" />
        <AnalysisKpi tone="blue" icon="✓" label="Sujets livrés" value={formatNombre(totalLivres)} note={`${formatNombre(tauxLivraison, 1)} % des sujets`} />
        <AnalysisKpi tone="red" icon="✝" label="Mortalités" value={formatNombre(totalMorts)} note="Sujets perdus" />
        <AnalysisKpi tone="orange" icon="%" label="Taux de mortalité" value={`${formatNombre(tauxMortalite, 1)} %`} note="Moyenne globale" />
        <AnalysisKpi tone="green" icon="⚖" label="Poids livré" value={formatPoids(totalPoids)} note="Poids cumulé" />
        <AnalysisKpi tone="violet" icon="◔" label="Poids moyen" value={formatPoids(poidsMoyen)} note="Par sujet livré" />
        <AnalysisKpi tone="orange" icon="▣" label={source === "direct" ? "Restants" : "Quantité retenue"} value={formatNombre(quantiteRetenue)} note={source === "direct" ? "Après clôture" : "Sujets conservés"} />
      </section>

      <TableauLots lignes={lignes} mode="production" source={source} />

      <section className="analysis-panel">
        <h2>Indicateurs de performance</h2>
        <div className="analysis-performance-grid">
          <PerformanceCard tone="blue" icon="✓" label="Taux de livraison" value={`${formatNombre(tauxLivraison, 1)} %`} status={tauxLivraison >= 80 ? "Bon" : "À surveiller"} />
          <PerformanceCard tone="green" icon="⚖" label="Poids moyen" value={formatPoids(poidsMoyen)} status={poidsMoyen >= 2 ? "Bon" : source === "direct" && poidsMoyen === 0 ? "Non renseigné" : "À améliorer"} />
          <PerformanceCard tone="orange" icon="€" label="Chiffre d'affaires" value={formatMontant(chiffreAffaires)} status="Ventes livrées" />
          <PerformanceCard tone="violet" icon="%" label="Charges / CA" value={`${formatNombre(chiffreAffaires > 0 ? (totalCharges / chiffreAffaires) * 100 : 0, 1)} %`} status={source === "direct" ? "Non suivi" : "Ratio global"} />
        </div>
      </section>

      <InsightGlobal lignes={lignes} mode="production" source={source} />
    </>
  );
}

function AnalyseEconomie({ lignes, source }: { lignes: LigneAnalyse[]; source: SourceAnalyse }) {
  const chiffreAffaires = somme(lignes, "chiffreAffaires");
  const totalCharges = somme(lignes, "totalCharges");
  const resultat = somme(lignes, "resultatCalcule");
  const totalPoids = somme(lignes, "total_poids_livre");
  const tauxMarge = chiffreAffaires > 0 ? (resultat / chiffreAffaires) * 100 : 0;
  const margeParKg = totalPoids > 0 ? resultat / totalPoids : 0;
  return (
    <>
      {source === "direct" && <AnalyseParEspece lignes={lignes} />}
      <section className="analysis-kpis">
        <AnalysisKpi tone="blue" icon="↗" label="Chiffre d’affaires" value={formatMontant(chiffreAffaires)} note="Ventes enregistrées" />
        <AnalysisKpi tone="red" icon="↘" label="Total charges" value={formatMontant(totalCharges)} note={source === "direct" ? "Non suivi ici" : "Charges cumulées"} />
        <AnalysisKpi tone="green" icon="€" label={source === "direct" ? "Solde vente" : "Résultat net"} value={formatMontant(resultat)} note={`${formatNombre(tauxMarge, 1)} % de marge`} />
        <AnalysisKpi tone="violet" icon="◔" label="Marge par kg" value={formatMontant(margeParKg)} note={totalPoids > 0 ? "Sur le poids livré" : "Poids non renseigné"} />
      </section>

      <TableauLots lignes={lignes} mode="economie" source={source} />

      <section className="analysis-panel">
        <h2>Indicateurs économiques</h2>
        <div className="analysis-performance-grid">
          <PerformanceCard tone="green" icon="%" label="Taux de marge" value={`${formatNombre(tauxMarge, 1)} %`} status={tauxMarge >= 20 ? "Bon" : "À améliorer"} />
          <PerformanceCard tone="blue" icon="€" label="Marge par kg" value={formatMontant(margeParKg)} status={margeParKg > 0 ? "Positive" : "À compléter"} />
          <PerformanceCard tone="orange" icon="▣" label={source === "direct" ? "Lots vendus" : "Charge alimentaire"} value={source === "direct" ? formatNombre(lignes.length) : formatMontant(somme(lignes, "chargeAliments"))} status={source === "direct" ? "Clôturés" : "Poste principal"} />
          <PerformanceCard tone="violet" icon="◔" label="CA moyen / lot" value={formatMontant(lignes.length > 0 ? chiffreAffaires / lignes.length : 0)} status="Moyenne affichée" />
        </div>
      </section>

      <InsightGlobal lignes={lignes} mode="economie" source={source} />
    </>
  );
}

function AnalyseParEspece({ lignes }: { lignes: LigneAnalyse[] }) {
  const especes: Array<{ key: EspeceDirecte; label: string }> = [
    { key: "poulet", label: "Poulets" },
    { key: "pintade", label: "Pintades" },
  ];

  return (
    <section className="analysis-species-grid">
      {especes.map((espece) => {
        const lignesEspece = lignes.filter((ligne) => ligne.espece === espece.key);
        const sujets = somme(lignesEspece, "quantite");
        const livres = somme(lignesEspece, "quantiteLivree");
        const ca = somme(lignesEspece, "chiffreAffaires");
        return (
          <article key={espece.key}>
            <span>{espece.key === "pintade" ? "◎" : "▣"}</span>
            <div>
              <strong>{espece.label}</strong>
              <small>{formatNombre(lignesEspece.length)} lot(s)</small>
            </div>
            <b>{formatNombre(livres)} livrés</b>
            <em>{formatNombre(sujets)} sujets initiaux · {formatMontant(ca)}</em>
          </article>
        );
      })}
    </section>
  );
}

function TableauLots({
  lignes,
  mode,
  source,
}: {
  lignes: LigneAnalyse[];
  mode: OngletAnalyse;
  source: SourceAnalyse;
}) {
  const groupeLabel = source === "direct" ? "Emplacement" : "Bâtiment";
  return (
    <section className="analysis-panel analysis-detail">
      <h2>Détail par lot</h2>
      <div className="analysis-mobile-list">
        {lignes.map((lot) => (
          <article key={lot.id}>
            <div><strong>{lot.nom}</strong><span>{source === "direct" && lot.espece ? `${speciesLabel(lot.espece)} · ` : ""}{lot.groupe}</span></div>
            <div>
              <span>{mode === "production" ? "Livrés" : "CA"}<b>{mode === "production" ? formatNombre(lot.quantiteLivree) : formatMontant(lot.chiffreAffaires)}</b></span>
              <span>{mode === "production" ? "Mortalité" : "Résultat"}<b>{mode === "production" ? `${formatNombre(lot.tauxMortalite, 1)} %` : formatMontant(lot.resultatCalcule)}</b></span>
              <span>{mode === "production" ? "Poids moyen" : "Marge / kg"}<b>{mode === "production" ? formatPoids(lot.poidsMoyen) : formatMontant(lot.margeParKg)}</b></span>
            </div>
            {lot.detailUrl && <Link to={lot.detailUrl}>Voir l’analyse complète →</Link>}
          </article>
        ))}
      </div>
      <div className="analysis-table-wrap">
        <table className="analysis-table">
          <thead>
            <tr>
              <th>Lot</th>
              {source === "direct" && <th>Espèce</th>}
              <th>{groupeLabel}</th>
              {mode === "production" ? (
                <>
                  <th>Livrés</th>
                  <th>Mortalités</th>
                  <th>Taux de mortalité</th>
                  <th>Poids livré</th>
                  <th>Poids moyen</th>
                </>
              ) : (
                <>
                  <th>Chiffre d’affaires</th>
                  <th>Charges</th>
                  <th>Résultat</th>
                  <th>Marge / kg</th>
                  <th>Charges / CA</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {lignes.map((lot) => (
              <tr key={lot.id}>
                <td>{lot.detailUrl ? <Link to={lot.detailUrl}>{lot.nom}</Link> : <strong>{lot.nom}</strong>}</td>
                {source === "direct" && <td>{lot.espece ? speciesLabel(lot.espece) : "—"}</td>}
                <td>{lot.groupe}</td>
                {mode === "production" ? (
                  <>
                    <td className="analysis-blue">{formatNombre(lot.quantiteLivree)}</td>
                    <td className="analysis-red">{formatNombre(lot.nb_morts)}</td>
                    <td className="analysis-orange">{formatNombre(lot.tauxMortalite, 1)} %</td>
                    <td className="analysis-green">{formatPoids(Number(lot.total_poids_livre))}</td>
                    <td>{formatPoids(lot.poidsMoyen)}</td>
                  </>
                ) : (
                  <>
                    <td className="analysis-blue">{formatMontant(lot.chiffreAffaires)}</td>
                    <td className="analysis-orange">{formatMontant(lot.totalCharges)}</td>
                    <td className={lot.resultatCalcule < 0 ? "analysis-red" : "analysis-green"}>{formatMontant(lot.resultatCalcule)}</td>
                    <td>{formatMontant(lot.margeParKg)}</td>
                    <td>{formatNombre(lot.tauxCharges, 1)} %</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {lignes.length === 1 && lignes[0].detailUrl && <Link className="analysis-history-link" to={lignes[0].detailUrl}>Voir la fiche complète du lot →</Link>}
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
  source,
}: {
  lignes: LigneAnalyse[];
  mode: OngletAnalyse;
  source: SourceAnalyse;
}) {
  const totalInitial = somme(lignes, "quantite");
  const totalLivres = somme(lignes, "quantiteLivree");
  const totalMorts = somme(lignes, "nb_morts");
  const totalPoids = somme(lignes, "total_poids_livre");
  const tauxLivraison = totalInitial > 0 ? (totalLivres / totalInitial) * 100 : 0;
  const tauxMortalite = totalInitial > 0 ? (totalMorts / totalInitial) * 100 : 0;
  const poidsMoyen = totalLivres > 0 ? totalPoids / totalLivres : 0;
  const chiffreAffaires = somme(lignes, "chiffreAffaires");
  const totalCharges = somme(lignes, "totalCharges");
  const resultat = somme(lignes, "resultatCalcule");
  const tauxMarge = chiffreAffaires > 0 ? (resultat / chiffreAffaires) * 100 : 0;
  const chargesAliment = somme(lignes, "chargeAliments");
  const partAliment = totalCharges > 0 ? (chargesAliment / totalCharges) * 100 : 0;
  const lotsDeficitaires = lignes.filter((lot) => lot.resultatCalcule < 0).length;

  const message = mode === "production"
    ? `${formatNombre(lignes.length)} lot(s) affiché(s) : ${formatNombre(tauxLivraison, 1)} % des sujets ont été livrés, avec ${formatNombre(tauxMortalite, 1)} % de mortalité et un poids moyen de ${formatPoids(poidsMoyen)}.`
    : `${formatNombre(lignes.length)} lot(s) affiché(s) dégagent ${source === "direct" ? "un chiffre d’affaires" : "un résultat cumulé"} de ${formatMontant(resultat)}, soit ${formatNombre(tauxMarge, 1)} % de marge. ${formatNombre(lotsDeficitaires)} lot(s) présentent un résultat négatif.`;

  const conseil = source === "direct"
    ? mode === "production"
      ? "Pour affiner l’analyse Vente directe, le prochain levier sera de renseigner plus régulièrement les poids livrés et de comparer poulets et pintades."
      : "La vente directe est analysée ici à partir des livraisons facturées. Les charges spécifiques pourront être ajoutées plus tard pour obtenir une marge nette réelle."
    : mode === "production"
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

function construireLigne(params: {
  id: string;
  nom: string;
  groupe: string;
  source: SourceAnalyse;
  espece?: EspeceDirecte;
  detailUrl?: string;
  quantite: number;
  nb_morts: number;
  quantiteLivree: number;
  quantiteRetenue: number;
  total_poids_livre: number;
  chiffreAffaires: number;
  chargeAliments: number;
  totalCharges: number;
  resultatCalcule: number;
}): LigneAnalyse {
  const tauxMortalite = params.quantite > 0 ? (params.nb_morts / params.quantite) * 100 : 0;
  const poidsMoyen = params.quantiteLivree > 0 ? params.total_poids_livre / params.quantiteLivree : 0;
  return {
    ...params,
    tauxMortalite,
    poidsMoyen,
    margeParKg: params.total_poids_livre > 0 ? params.resultatCalcule / params.total_poids_livre : 0,
    tauxCharges: params.chiffreAffaires > 0 ? (params.totalCharges / params.chiffreAffaires) * 100 : 0,
    tauxLivraison: params.quantite > 0 ? (params.quantiteLivree / params.quantite) * 100 : 0,
  };
}

function speciesLabel(species: EspeceDirecte) {
  return species === "pintade" ? "Pintades" : "Poulets";
}

function somme<T extends keyof LigneAnalyse>(lignes: LigneAnalyse[], cle: T) {
  return lignes.reduce((total, ligne) => {
    const valeur = ligne[cle];
    return total + (typeof valeur === "number" ? valeur : 0);
  }, 0);
}
