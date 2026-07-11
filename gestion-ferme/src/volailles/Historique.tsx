import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { supabase } from "../supabaseClient";
import ModalCloseButton from "../components/ModalCloseButton";
import { formatMontant, formatNombre, formatPoids } from "../outils/formatNombre";
import Charges from "./Charges";
import {
  chargerLotsAvecMouvements,
  supprimerLotEtDonnees,
  type LivraisonVolaille,
  type MortaliteVolaille,
} from "./volaillesData";

type LotHistorique = {
  id: string;
  nom: string;
  quantite: number;
  date_arrivee: string;
  batiment: string;
  age: number;
  is_active: boolean;
  nb_morts: number;
  sujets_restants: number;
  resultat_brut: number;
  resultat_net: number | null;
  autoconsommation: number;
  quantite_retenue: number | null;
  total_poids_livre: number;
  livraisons: LivraisonVolaille[];
  mortalites: MortaliteVolaille[];
};

type Charge = {
  lot_id: string;
  type_charge: string;
  montant: number;
};

const chargeLabels: Record<string, string> = {
  aliment: "Aliment",
  achat_poussins: "Achat poussins",
  ramassage: "Ramassage",
  livraison: "Livraison",
};

const chargeColors = ["#209447", "#f5b000", "#3b78d8", "#8b6bd9", "#a7b1bc"];

export default function Historique() {
  const [historique, setHistorique] = useState<LotHistorique[]>([]);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [loading, setLoading] = useState(true);
  const [recherche, setRecherche] = useState("");
  const [batimentFiltre, setBatimentFiltre] = useState("");
  const [resultatFiltre, setResultatFiltre] = useState("");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [saving, setSaving] = useState(false);
  const [showResultatNetModal, setShowResultatNetModal] = useState(false);
  const [showQuantiteRetenueModal, setShowQuantiteRetenueModal] = useState(false);
  const [selectedLot, setSelectedLot] = useState<LotHistorique | null>(null);
  const [resultatNetInput, setResultatNetInput] = useState("");
  const [quantiteRetenueInput, setQuantiteRetenueInput] = useState("");
  const [showChargesManager, setShowChargesManager] = useState(false);
  const [lotAnalyseId, setLotAnalyseId] = useState("");

  const fetchLots = async () => {
    try {
      const [lots, chargesResult] = await Promise.all([
        chargerLotsAvecMouvements(false),
        supabase.from("charges").select("lot_id, type_charge, montant"),
      ]);
      if (chargesResult.error) throw chargesResult.error;
      setHistorique(lots as LotHistorique[]);
      setCharges(
        (chargesResult.data || []).map((charge) => ({
          ...charge,
          montant: Number(charge.montant) || 0,
        })) as Charge[]
      );
    } catch (error) {
      console.error("Erreur chargement historique :", error);
      toast.error("L'historique n'a pas pu être chargé.");
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLots();
  }, []);

  const lignes = useMemo(
    () =>
      historique.map((lot) => {
        const quantiteLivree = lot.livraisons.reduce(
          (total, livraison) => total + Number(livraison.quantite || 0),
          0
        );
        const totalCharges = charges
          .filter((charge) => charge.lot_id === lot.id)
          .reduce((total, charge) => total + charge.montant, 0);
        const chiffreAffaires = Number(lot.resultat_brut) || 0;
        const resultat =
          lot.resultat_net != null
            ? Number(lot.resultat_net) || 0
            : chiffreAffaires - totalCharges;
        return { ...lot, quantiteLivree, totalCharges, chiffreAffaires, resultat };
      }),
    [historique, charges]
  );

  const batiments = Array.from(
    new Set(historique.map((lot) => lot.batiment).filter(Boolean))
  ).sort();

  const lotsAffiches = lignes
    .filter((lot) => {
      const terme = recherche.trim().toLowerCase();
      const correspondRecherche =
        !terme ||
        lot.nom.toLowerCase().includes(terme) ||
        lot.batiment.toLowerCase().includes(terme);
      const correspondBatiment = !batimentFiltre || lot.batiment === batimentFiltre;
      const correspondDebut = !dateDebut || lot.date_arrivee >= dateDebut;
      const correspondFin = !dateFin || lot.date_arrivee <= dateFin;
      const correspondResultat =
        !resultatFiltre ||
        (resultatFiltre === "positif" && lot.resultat >= 0) ||
        (resultatFiltre === "negatif" && lot.resultat < 0);
      return (
        correspondRecherche &&
        correspondBatiment &&
        correspondDebut &&
        correspondFin &&
        correspondResultat
      );
    })
    .sort((a, b) =>
      sortOrder === "asc"
        ? a.nom.localeCompare(b.nom)
        : b.nom.localeCompare(a.nom)
    );

  const totalLivres = lotsAffiches.reduce(
    (total, lot) => total + lot.quantiteLivree,
    0
  );
  const totalPoids = lotsAffiches.reduce(
    (total, lot) => total + Number(lot.total_poids_livre || 0),
    0
  );
  const totalResultat = lotsAffiches.reduce(
    (total, lot) => total + lot.resultat,
    0
  );
  const totalCharges = lotsAffiches.reduce(
    (total, lot) => total + lot.totalCharges,
    0
  );
  const totalChiffreAffaires = lotsAffiches.reduce(
    (total, lot) => total + lot.chiffreAffaires,
    0
  );
  const tauxMarge =
    totalChiffreAffaires > 0 ? (totalResultat / totalChiffreAffaires) * 100 : 0;
  const lotAnalyse =
    lotsAffiches.find((lot) => lot.id === lotAnalyseId) || lotsAffiches[0];
  const lotsSansResultatNet = historique.filter(
    (lot) => lot.resultat_net == null
  );
  const lotsSansQuantiteRetenue = historique.filter(
    (lot) => lot.quantite_retenue == null || Number(lot.quantite_retenue) === 0
  );

  const repartitionCharges = Object.entries(
    charges
      .filter((charge) => lotsAffiches.some((lot) => lot.id === charge.lot_id))
      .reduce<Record<string, number>>((totaux, charge) => {
        totaux[charge.type_charge] =
          (totaux[charge.type_charge] || 0) + charge.montant;
        return totaux;
      }, {})
  )
    .map(([type, montant]) => ({
      type,
      label: chargeLabels[type] || "Divers",
      montant,
    }))
    .sort((a, b) => b.montant - a.montant);

  const segmentsCharges = repartitionCharges.reduce(
    (acc, charge, index) => {
      const debut = acc.fin;
      const fin =
        index === repartitionCharges.length - 1 || totalCharges <= 0
          ? 360
          : debut + (charge.montant / totalCharges) * 360;
      acc.segments.push(
        `${chargeColors[index % chargeColors.length]} ${debut}deg ${fin}deg`
      );
      acc.fin = fin;
      return acc;
    },
    { segments: [] as string[], fin: 0 }
  ).segments;

  const resetFiltres = () => {
    setRecherche("");
    setBatimentFiltre("");
    setResultatFiltre("");
    setDateDebut("");
    setDateFin("");
  };

  const handleSaveResultatNet = async () => {
    const montant = Number(resultatNetInput);
    if (!selectedLot || !Number.isFinite(montant)) {
      toast.error("Sélectionnez un lot et indiquez un montant valide.");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("lots_volailles")
      .update({ resultat_net: montant })
      .eq("id", selectedLot.id);
    if (error) {
      toast.error("Le résultat net n'a pas pu être enregistré.");
    } else {
      toast.success("Résultat net enregistré.");
      setShowResultatNetModal(false);
      setSelectedLot(null);
      setResultatNetInput("");
      await fetchLots();
    }
    setSaving(false);
  };

  const handleSaveQuantiteRetenue = async () => {
    const quantite = Number(quantiteRetenueInput);
    if (!selectedLot || !Number.isFinite(quantite) || quantite < 0) {
      toast.error("Sélectionnez un lot et indiquez une quantité valide.");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("lots_volailles")
      .update({ quantite_retenue: quantite })
      .eq("id", selectedLot.id);
    if (error) {
      toast.error("La quantité retenue n'a pas pu être enregistrée.");
    } else {
      toast.success("Quantité retenue enregistrée.");
      setShowQuantiteRetenueModal(false);
      setSelectedLot(null);
      setQuantiteRetenueInput("");
      await fetchLots();
    }
    setSaving(false);
  };

  const reactiverLot = async (lot: LotHistorique) => {
    if (saving || !window.confirm(`Réactiver le lot ${lot.nom} ?`)) return;
    setSaving(true);
    const { error } = await supabase
      .from("lots_volailles")
      .update({ is_active: true })
      .eq("id", lot.id);
    if (error) toast.error("Le lot n'a pas pu être réactivé.");
    else {
      setHistorique((lots) => lots.filter((item) => item.id !== lot.id));
      toast.success("Lot réactivé.");
    }
    setSaving(false);
  };

  const supprimerLot = async (lot: LotHistorique) => {
    if (
      saving ||
      !window.confirm(`Supprimer définitivement le lot ${lot.nom} ?`)
    )
      return;
    setSaving(true);
    try {
      await supprimerLotEtDonnees(lot.id);
      setHistorique((lots) => lots.filter((item) => item.id !== lot.id));
      toast.success("Lot supprimé définitivement.");
    } catch (error) {
      console.error("Erreur suppression lot :", error);
      toast.error("Le lot n'a pas pu être supprimé.");
    }
    setSaving(false);
  };

  if (loading) return <div className="history-loading">Chargement...</div>;

  return (
    <div className="history-page">
      <header className="history-heading">
        <div>
          <h1><span>▣</span> Historique SICA Madras</h1>
          <p>Lots archivés, résultats et livraisons.</p>
        </div>
        <button type="button" onClick={() => window.print()}>▤ Exporter PDF</button>
      </header>

      <nav className="poultry-tabs" aria-label="Sections volailles">
        <Link to="/volailles">Résumé</Link>
        <Link to="/volailles/alimentation">Alimentation</Link>
        <Link to="/volailles/sica">Lots SICA Madras</Link>
        <Link to="/volailles/sica/historique" className="poultry-tab-active">Historique SICA</Link>
        <Link to="/volailles/vente-directe">Vente directe</Link>
        <Link to="/volailles/vente-directe/historique">Historique vente directe</Link>
        <Link to="/volailles/analyse/sica">Analyse SICA</Link>
        <Link to="/volailles/analyse/vente-directe">Analyse vente directe</Link>
        <Link to="/volailles/inventaire">Inventaire</Link>
      </nav>

      <section className="history-kpis">
        <HistoryKpi tone="green" icon="▣" label="Lots archivés" value={formatNombre(lotsAffiches.length)} note="Lots affichés" />
        <HistoryKpi tone="blue" icon="♧" label="Sujets livrés" value={formatNombre(totalLivres)} note="Sur la période" />
        <HistoryKpi tone="green" icon="⚖" label="Poids livré" value={formatPoids(totalPoids, 1)} note="Poids cumulé" />
        <HistoryKpi tone="orange" icon="€" label="Résultat net" value={formatMontant(totalResultat)} note="Après charges" />
      </section>

      <section className="history-filters">
        <input type="search" value={recherche} onChange={(event) => setRecherche(event.target.value)} placeholder="Rechercher un lot ou un bâtiment..." />
        <select value={batimentFiltre} onChange={(event) => setBatimentFiltre(event.target.value)}>
          <option value="">Tous les bâtiments</option>
          {batiments.map((batiment) => <option key={batiment} value={batiment}>{batiment}</option>)}
        </select>
        <div className="history-date-filter">
          <input type="date" aria-label="Date de début" value={dateDebut} onChange={(event) => setDateDebut(event.target.value)} />
          <span>→</span>
          <input type="date" aria-label="Date de fin" value={dateFin} onChange={(event) => setDateFin(event.target.value)} />
        </div>
        <select value={resultatFiltre} onChange={(event) => setResultatFiltre(event.target.value)}>
          <option value="">Tous les résultats</option>
          <option value="positif">Résultat positif</option>
          <option value="negatif">Résultat négatif</option>
        </select>
        <button type="button" onClick={resetFiltres}>↻ Réinitialiser</button>
      </section>

      <section className="history-panel history-table-panel">
        <div className="history-panel-heading">
          <h2>Liste des lots terminés</h2>
          <div>
            <button type="button" disabled={!lotsSansQuantiteRetenue.length} onClick={() => setShowQuantiteRetenueModal(true)}>Quantité retenue</button>
            <button type="button" disabled={!lotsSansResultatNet.length} onClick={() => setShowResultatNetModal(true)}>Résultat net</button>
          </div>
        </div>

        <div className="history-mobile-list">
          {lotsAffiches.map((lot) => (
            <article key={lot.id}>
              <div><strong>{lot.nom}</strong><span>{lot.batiment} · {formatDate(lot.date_arrivee)}</span></div>
              <div className="history-mobile-values">
                <span>Livrés <b>{formatNombre(lot.quantiteLivree)}</b></span>
                <span>Poids <b>{formatPoids(lot.total_poids_livre, 1)}</b></span>
                <span>Résultat <b>{formatMontant(lot.resultat)}</b></span>
              </div>
              <div className="history-mobile-actions">
                <Link to={`/volailles/sica/historique/${lot.id}/analyse`}>Voir l’analyse</Link>
                <button type="button" onClick={() => reactiverLot(lot)}>Réactiver</button>
                <button type="button" onClick={() => supprimerLot(lot)}>🗑</button>
              </div>
            </article>
          ))}
        </div>

        <div className="history-table-wrap">
          <table className="history-table">
            <thead>
              <tr>
                <th onClick={() => setSortOrder((ordre) => ordre === "asc" ? "desc" : "asc")}>N° lot {sortOrder === "asc" ? "↑" : "↓"}</th>
                <th>Arrivée</th><th>Bâtiment</th><th>Restants</th><th>Livraisons</th>
                <th>Quantité livrée</th><th>Quantité retenue</th><th>Poids total</th>
                <th>Autoconsommation</th><th>Résultat net</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {lotsAffiches.map((lot) => (
                <tr key={lot.id}>
                  <td>{lot.nom}</td>
                  <td>{formatDate(lot.date_arrivee)}</td>
                  <td>{lot.batiment}</td>
                  <td>{formatNombre(lot.sujets_restants)}</td>
                  <td>{lot.livraisons.length ? lot.livraisons.map((livraison) => formatDate(livraison.date)).join(" → ") : "—"}</td>
                  <td>{formatNombre(lot.quantiteLivree)}</td>
                  <td>{formatNombre(lot.quantite_retenue || 0)}</td>
                  <td>{formatPoids(lot.total_poids_livre)}</td>
                  <td>{formatNombre(lot.autoconsommation || 0)}</td>
                  <td className={lot.resultat < 0 ? "history-negative" : "history-positive"}>{formatMontant(lot.resultat)}</td>
                  <td>
                    <div className="history-row-actions">
                      <Link title="Voir l’analyse complète" to={`/volailles/sica/historique/${lot.id}/analyse`}>👁</Link>
                      <button type="button" title="Réactiver le lot" onClick={() => reactiverLot(lot)}>↻</button>
                      <button type="button" title="Supprimer le lot" onClick={() => supprimerLot(lot)}>🗑</button>
                    </div>
                  </td>
                </tr>
              ))}
              {!lotsAffiches.length && <tr><td colSpan={11} className="history-empty">Aucun lot archivé à afficher.</td></tr>}
            </tbody>
            {!!lotsAffiches.length && (
              <tfoot><tr><td>Totaux</td><td>—</td><td>—</td><td>{formatNombre(lotsAffiches.reduce((total, lot) => total + lot.sujets_restants, 0))}</td><td>—</td><td>{formatNombre(totalLivres)}</td><td>{formatNombre(lotsAffiches.reduce((total, lot) => total + Number(lot.quantite_retenue || 0), 0))}</td><td>{formatPoids(totalPoids)}</td><td>{formatNombre(lotsAffiches.reduce((total, lot) => total + Number(lot.autoconsommation || 0), 0))}</td><td>{formatMontant(totalResultat)}</td><td>—</td></tr></tfoot>
            )}
          </table>
        </div>
      </section>

      <section className="history-summary-grid">
        <article className="history-panel history-charges">
          <div className="history-card-heading">
            <h2>Charges des lots affichés</h2>
            <button type="button" onClick={() => setShowChargesManager(true)}>Gérer les charges</button>
          </div>
          {totalCharges > 0 ? (
            <div>
              <div className="history-charge-ring" style={{ background: `conic-gradient(${segmentsCharges.join(", ")})` }}>
                <span><small>Total charges</small><strong>{formatMontant(totalCharges)}</strong></span>
              </div>
              <div className="history-charge-list">
                {repartitionCharges.map((charge, index) => (
                  <div key={charge.type}><i style={{ background: chargeColors[index % chargeColors.length] }} /><span>{charge.label}</span><b>{formatMontant(charge.montant)}</b><em>{formatNombre((charge.montant / totalCharges) * 100)}%</em></div>
                ))}
              </div>
            </div>
          ) : <p className="history-empty">Aucune charge enregistrée.</p>}
        </article>

        <article className="history-panel history-economy">
          <h2>Résultat économique</h2>
          <div className="history-economy-kpis">
            <span><small>Chiffre d’affaires</small><strong>{formatMontant(totalChiffreAffaires)}</strong></span>
            <span><small>Total charges</small><strong>{formatMontant(totalCharges)}</strong></span>
            <span><small>Marge nette</small><strong>{formatMontant(totalResultat)}</strong><em>{formatNombre(tauxMarge, 1)} %</em></span>
          </div>
          <p className={totalResultat >= 0 ? "history-performance-good" : "history-performance-alert"}>
            {totalResultat >= 0 ? "Performance positive sur les lots affichés." : "Les charges dépassent le chiffre d’affaires sur la sélection."}
          </p>
        </article>
      </section>

      {lotAnalyse && (
        <section className="history-analysis-callout">
          <span>☼</span>
          <div>
            <h2>Analyse du lot {lotAnalyse.nom}</h2>
            <p>Consultez ses performances de production, ses livraisons, ses mortalités et son résultat économique.</p>
            <select value={lotAnalyse.id} onChange={(event) => setLotAnalyseId(event.target.value)}>
              {lotsAffiches.map((lot) => <option key={lot.id} value={lot.id}>Lot {lot.nom} · {lot.batiment}</option>)}
            </select>
          </div>
          <Link to={`/volailles/sica/historique/${lotAnalyse.id}/analyse`}>Voir l’analyse complète →</Link>
        </section>
      )}

      <HistoryInputModal
        open={showResultatNetModal}
        title="Saisir le résultat net"
        icon="€"
        lots={lotsSansResultatNet}
        selectedLot={selectedLot}
        onLotChange={setSelectedLot}
        value={resultatNetInput}
        onValueChange={setResultatNetInput}
        label="Montant (€)"
        onSave={handleSaveResultatNet}
        onClose={() => {
          setShowResultatNetModal(false);
          setSelectedLot(null);
          setResultatNetInput("");
        }}
        saving={saving}
      />
      <HistoryInputModal
        open={showQuantiteRetenueModal}
        title="Saisir la quantité retenue"
        icon="▣"
        lots={lotsSansQuantiteRetenue}
        selectedLot={selectedLot}
        onLotChange={setSelectedLot}
        value={quantiteRetenueInput}
        onValueChange={setQuantiteRetenueInput}
        label="Quantité retenue"
        onSave={handleSaveQuantiteRetenue}
        onClose={() => {
          setShowQuantiteRetenueModal(false);
          setSelectedLot(null);
          setQuantiteRetenueInput("");
        }}
        saving={saving}
      />
      {showChargesManager && (
        <div className="poultry-modal-backdrop">
          <div className="poultry-modal poultry-modal-large history-charge-manager">
            <ModalCloseButton onClick={() => {
              setShowChargesManager(false);
              fetchLots();
            }} />
            <div className="poultry-modal-header">
              <span className="poultry-modal-icon">€</span>
              <div><h2>Gestion des charges</h2><p>Ajouter, consulter ou modifier les charges des lots archivés.</p></div>
            </div>
            <Charges lotIdsFiltres={lotsAffiches.map((lot) => lot.id)} />
          </div>
        </div>
      )}
    </div>
  );
}

function HistoryKpi({ tone, icon, label, value, note }: { tone: string; icon: string; label: string; value: string; note: string }) {
  return <article className="history-kpi"><span className={`history-kpi-icon history-kpi-${tone}`}>{icon}</span><div><small>{label}</small><strong>{value}</strong><em>{note}</em></div></article>;
}

function HistoryInputModal({
  open, title, icon, lots, selectedLot, onLotChange, value, onValueChange,
  label, onSave, onClose, saving,
}: {
  open: boolean;
  title: string;
  icon: string;
  lots: LotHistorique[];
  selectedLot: LotHistorique | null;
  onLotChange: (lot: LotHistorique | null) => void;
  value: string;
  onValueChange: (value: string) => void;
  label: string;
  onSave: () => void;
  onClose: () => void;
  saving: boolean;
}) {
  if (!open) return null;
  return (
    <div className="poultry-modal-backdrop">
      <div className="poultry-modal poultry-modal-small">
        <ModalCloseButton onClick={onClose} disabled={saving} />
        <div className="poultry-modal-header"><span className="poultry-modal-icon">{icon}</span><div><h2>{title}</h2><p>Compléter les données du lot archivé.</p></div></div>
        <div className="poultry-form-stack">
          <label>Lot<select value={selectedLot?.id || ""} onChange={(event) => onLotChange(lots.find((lot) => lot.id === event.target.value) || null)}><option value="">-- Choisir un lot --</option>{lots.map((lot) => <option key={lot.id} value={lot.id}>{lot.nom} · {lot.batiment}</option>)}</select></label>
          {selectedLot && <label>{label}<input type="number" step="0.01" value={value} onChange={(event) => onValueChange(event.target.value)} /></label>}
        </div>
        <div className="poultry-modal-actions">{selectedLot && <button type="button" className="poultry-modal-primary" onClick={onSave} disabled={saving}>{saving ? "Enregistrement..." : "▣ Enregistrer"}</button>}<button type="button" className="poultry-modal-secondary" onClick={onClose}>Annuler</button></div>
      </div>
    </div>
  );
}

function formatDate(date: string) {
  if (!date) return "—";
  return new Date(`${date}T00:00:00`).toLocaleDateString("fr-FR");
}
