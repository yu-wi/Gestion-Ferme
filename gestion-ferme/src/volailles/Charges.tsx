import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { calculerChargesLot } from "./chargesLot";
import { calculerCoutAliment } from "./coutAliment";
import { chargerPages } from "./chargerPages";
import { lireTarifsCharges, tarifsChargesParDefaut } from "./tarifsCharges";
import { formatMontant, formatNombre } from "../outils/formatNombre";
import toast from "react-hot-toast";
import { supabase } from "../supabaseClient";
import ModalCloseButton from "../components/ModalCloseButton";
import { chargerLotsAvecMouvements } from "./volaillesData";
import { trouverLotsAvecChargesCompletes } from "./chargesCompletes";

interface Charge {
  id: number | string;
  lot_id: string;
  lot_nom: string;
  date: string;
  type_charge: string;
  montant: number;
  automatique?: boolean;
}

interface Lot {
  id: string;
  nom: string;
  date_arrivee: string;
  batiment: string;
  age: number;
  quantiteLivree: number;
  livraisons: { quantite: number }[];
}

interface ChargesProps {
  lotIdsFiltres?: string[];
}

const chargeMeta: Record<string, { label: string; icon: string; tone: string }> = {
  aliment: { label: "Aliment", icon: "⌁", tone: "green" },
  achat_poussins: { label: "Achat poussins", icon: "♧", tone: "orange" },
  ramassage: { label: "Ramassage", icon: "🚚", tone: "blue" },
  livraison: { label: "Livraison", icon: "▣", tone: "violet" },
  divers: { label: "Divers", icon: "•••", tone: "gray" },
};

const Charges = ({ lotIdsFiltres }: ChargesProps) => {
  const [lots, setLots] = useState<Lot[]>([]);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [consommations, setConsommations] = useState<{ lot_id: string | null }[]>([]);
  const [coutsAliment, setCoutsAliment] = useState<Map<string, number>>(new Map());
  const [tarifs, setTarifs] = useState(tarifsChargesParDefaut);
  const [chargementCharges, setChargementCharges] = useState(true);
  const [erreurCharges, setErreurCharges] = useState(false);
  const [selectedLotId, setSelectedLotId] = useState("");
  const [lotSaisieId, setLotSaisieId] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [chargeEnModification, setChargeEnModification] = useState<Charge | null>(null);
  const [selectedType, setSelectedType] = useState("achat_poussins");
  const [montant, setMontant] = useState<number>(0);

  const fetchLots = async () => {
    try {
      const lotsData = await chargerLotsAvecMouvements(false);
      setLots(
        lotsData.map((lot) => ({
          id: lot.id,
          nom: lot.nom,
          date_arrivee: lot.date_arrivee,
          batiment: lot.batiment,
          age: Number(lot.age) || 0,
          livraisons: lot.livraisons,
          quantiteLivree: lot.livraisons.reduce(
            (total, livraison) => total + Number(livraison.quantite || 0),
            0
          ),
        }))
      );
    } catch (error) {
      console.error("Erreur chargement lots :", error);
      toast.error("Les lots des charges n'ont pas pu être chargés.");
    }
  };

  const fetchCharges = async () => {
    try {
      const [chargesRows, consommationsRows, referencesResult, tarifsResult] = await Promise.all([
        chargerPages((debut, fin) => supabase.from("charges").select("*").order("id").range(debut, fin)),
        chargerPages((debut, fin) => supabase.from("consommations_aliment").select("lot_id, feed_type, quantite_kg").not("lot_id", "is", null).order("id").range(debut, fin)),
        supabase.from("feed_reference").select("feed_type, feed_price_ht").order("age_min_days"),
        supabase.from("app_settings").select("key, value").eq("category", "volailles"),
      ]);
      if (referencesResult.error) throw referencesResult.error;
      if (tarifsResult.error) throw tarifsResult.error;
      const couts = new Map<string, number>();
      for (const id of new Set(consommationsRows.map((item) => item.lot_id))) {
        if (!id) continue;
        const cout = calculerCoutAliment(consommationsRows.filter((item) => item.lot_id === id), referencesResult.data || []);
        if (cout !== null) couts.set(id, cout);
      }
      setCharges(chargesRows.map((charge) => ({ ...charge, montant: Number(charge.montant) || 0 })) as Charge[]);
      setConsommations(consommationsRows);
      setCoutsAliment(couts);
      setTarifs(lireTarifsCharges(tarifsResult.data || []));
      setErreurCharges(false);
    } catch (error) {
      console.error("Erreur chargement charges :", error);
      setErreurCharges(true);
      toast.error("Les charges n'ont pas pu être chargées.");
    }
    setChargementCharges(false);
  };

  useEffect(() => {
    fetchLots();
    fetchCharges();
  }, []);

  const lotsAffiches = useMemo(
    () => lots.filter((lot) => !lotIdsFiltres || lotIdsFiltres.includes(lot.id)),
    [lots, lotIdsFiltres]
  );

  const lotsASaisir = useMemo(() => {
    const lotsComplets = trouverLotsAvecChargesCompletes(charges, consommations);
    return lotsAffiches.filter((lot) => !lotsComplets.has(lot.id));
  }, [lotsAffiches, charges, consommations]);

  const lotSaisie = lotsASaisir.find((lot) => lot.id === lotSaisieId);

  useEffect(() => {
    if (!lotsAffiches.length) {
      setSelectedLotId("");
      return;
    }
    if (!lotsAffiches.some((lot) => lot.id === selectedLotId)) {
      setSelectedLotId(lotsAffiches[0].id);
    }
  }, [lotsAffiches, selectedLotId]);

  const lotSelectionne =
    lotsAffiches.find((lot) => lot.id === selectedLotId) || lotsAffiches[0];

  const chargesDuLot = useMemo<Charge[]>(() => {
    if (!lotSelectionne) return [];
    const enregistrees = charges.filter((charge) => charge.lot_id === lotSelectionne.id)
      .sort((a, b) => b.date.localeCompare(a.date));
    return calculerChargesLot(enregistrees, lotSelectionne.livraisons, coutsAliment.get(lotSelectionne.id) ?? null, tarifs)
      .map((charge) => {
        const source = enregistrees.find((item) => item === charge);
        return source || { ...charge, id: `auto-${charge.type_charge}`, lot_id: lotSelectionne.id,
          lot_nom: lotSelectionne.nom, date: "", automatique: true };
      });
  }, [charges, lotSelectionne, coutsAliment, tarifs]);

  const libelleCharge = (charge: Charge) => charge.automatique && charge.type_charge === "aliment"
    ? "Aliment consommé (TTC)" : (chargeMeta[charge.type_charge] || chargeMeta.divers).label;
  const actionsCharge = (charge: Charge) => charge.automatique
    ? <Link to={charge.type_charge === "aliment" ? "/volailles/alimentation" : `/volailles/sica/historique/${charge.lot_id}/analyse`}>
        {charge.type_charge === "aliment" ? "Calculé depuis les consommations" : "À valider dans l’analyse"}
      </Link>
    : <><button type="button" title="Modifier la charge" disabled={saving} onClick={() => setChargeEnModification({ ...charge })}>✎</button>
      <button type="button" title="Supprimer la charge" disabled={saving} onClick={() => supprimerCharge(charge)}>🗑</button></>;

  const totalCharges = chargesDuLot.reduce(
    (total, charge) => total + charge.montant,
    0
  );
  const coutParSujet =
    Number(lotSelectionne?.quantiteLivree) > 0
      ? totalCharges / Number(lotSelectionne?.quantiteLivree)
      : 0;

  const handleSave = async () => {
    if (saving || !lotSaisie) return;
    if (montant <= 0) {
      toast.error("Indiquez un montant positif.");
      return;
    }

    setSaving(true);
    const { error } = await supabase.from("charges").insert({
      lot_id: lotSaisie.id,
      lot_nom: lotSaisie.nom,
      type_charge: selectedType,
      montant,
      date: dateDuJour(),
    });

    if (error) {
      console.error("Erreur enregistrement charge :", error.message);
      toast.error("La charge n'a pas pu être enregistrée.");
    } else {
      setSelectedLotId(lotSaisie.id);
      setModalOpen(false);
      setSelectedType("achat_poussins");
      setMontant(0);
      await fetchCharges();
      toast.success("Charge enregistrée.");
    }
    setSaving(false);
  };

  const enregistrerModification = async () => {
    if (saving || !chargeEnModification || chargeEnModification.automatique) return;
    if (chargeEnModification.montant <= 0) {
      toast.error("Indiquez un montant positif.");
      return;
    }

    setSaving(true);
    const { data, error } = await supabase
      .from("charges")
      .update({
        type_charge: chargeEnModification.type_charge,
        montant: chargeEnModification.montant,
      })
      .eq("id", chargeEnModification.id)
      .select("*")
      .single();

    if (error) {
      console.error("Erreur modification charge :", error.message);
      toast.error("La charge n'a pas pu être modifiée.");
    } else if (data) {
      setCharges((chargesActuelles) =>
        chargesActuelles.map((charge) =>
          charge.id === data.id
            ? { ...(data as Charge), montant: Number(data.montant) || 0 }
            : charge
        )
      );
      setChargeEnModification(null);
      toast.success("Charge modifiée.");
    }
    setSaving(false);
  };

  const supprimerCharge = async (charge: Charge) => {
    if (charge.automatique || saving || !window.confirm("Supprimer cette charge ?")) return;
    setSaving(true);
    const { error } = await supabase.from("charges").delete().eq("id", charge.id);
    if (error) {
      console.error("Erreur suppression charge :", error.message);
      toast.error("La charge n'a pas pu être supprimée.");
    } else {
      setCharges((chargesActuelles) =>
        chargesActuelles.filter((item) => item.id !== charge.id)
      );
      toast.success("Charge supprimée.");
    }
    setSaving(false);
  };

  if (chargementCharges) return <p className="charge-manager-empty">Chargement des charges…</p>;
  if (erreurCharges) return <p className="charge-manager-empty" role="alert">Impossible de déterminer les lots à compléter. Fermez puis rouvrez la gestion des charges pour réessayer.</p>;

  return (
    <div className="charge-manager">
      {!lotsAffiches.length ? (
        <p className="charge-manager-empty">Aucun lot archivé à afficher.</p>
      ) : (
        <>
          <section className="charge-lot-summary">
            <div className="charge-lot-copy">
              <span>▣</span>
              <div>
                {lotsAffiches.length > 1 ? (
                  <select
                    aria-label="Lot à afficher"
                    value={lotSelectionne?.id || ""}
                    onChange={(event) => setSelectedLotId(event.target.value)}
                  >
                    {lotsAffiches.map((lot) => (
                      <option key={lot.id} value={lot.id}>Lot {lot.nom}</option>
                    ))}
                  </select>
                ) : (
                  <strong>Lot {lotSelectionne?.nom}</strong>
                )}
                <small>
                  Arrivé le {formatDate(lotSelectionne?.date_arrivee || "")} · Bâtiment {lotSelectionne?.batiment || "—"} · {lotSelectionne?.age || 0} jours
                </small>
              </div>
            </div>
            <div className="charge-summary-metric">
              <small>Total des charges</small>
              <strong>{formatMontant(totalCharges)}</strong>
            </div>
            <div className="charge-summary-metric">
              <small>Coût par sujet livré</small>
              <strong>{formatMontant(coutParSujet)}</strong>
            </div>
          </section>

          <div className="charge-manager-heading">
            <h3>Charges du lot</h3>
            <button type="button" disabled={!lotsASaisir.length} onClick={() => {
              setLotSaisieId(lotsASaisir.find((lot) => lot.id === lotSelectionne?.id)?.id || lotsASaisir[0]?.id || "");
              setModalOpen(true);
            }}>＋ Ajouter une charge</button>
          </div>
          {!lotsASaisir.length && <p className="charge-manager-empty">Tous les lots affichés ont leurs quatre catégories de charges renseignées.</p>}

          <div className="charge-manager-mobile">
            {chargesDuLot.map((charge) => {
              const meta = chargeMeta[charge.type_charge] || chargeMeta.divers;
              const pourcentage =
                totalCharges > 0 ? (charge.montant / totalCharges) * 100 : 0;
              return (
                <article key={charge.id}>
                  <div className="charge-category">
                    <span className={`charge-category-icon charge-tone-${meta.tone}`}>{meta.icon}</span>
                    <div><strong>{libelleCharge(charge)}</strong></div>
                  </div>
                  <div className="charge-mobile-values"><b>{formatMontant(charge.montant)}</b><span>{formatNombre(pourcentage, 1)} %</span></div>
                  <div className="charge-actions">
                    {actionsCharge(charge)}
                  </div>
                </article>
              );
            })}
          </div>

          <div className="charge-manager-table-wrap">
            <table className="charge-manager-table">
              <thead><tr><th>Catégorie</th><th>Montant (€)</th><th>% du total</th><th>Actions</th></tr></thead>
              <tbody>
                {chargesDuLot.map((charge) => {
                  const meta = chargeMeta[charge.type_charge] || chargeMeta.divers;
                  const pourcentage =
                    totalCharges > 0 ? (charge.montant / totalCharges) * 100 : 0;
                  return (
                    <tr key={charge.id}>
                      <td><div className="charge-category"><span className={`charge-category-icon charge-tone-${meta.tone}`}>{meta.icon}</span><strong>{libelleCharge(charge)}</strong></div></td>
                      <td>{formatMontant(charge.montant)}</td>
                      <td>{formatNombre(pourcentage, 1)} %</td>
                      <td><div className="charge-actions">{actionsCharge(charge)}</div></td>
                    </tr>
                  );
                })}
                {!chargesDuLot.length && <tr><td colSpan={4} className="charge-manager-empty">Aucune charge enregistrée pour ce lot.</td></tr>}
              </tbody>
              {!!chargesDuLot.length && <tfoot><tr><td>Total des charges</td><td>{formatMontant(totalCharges)}</td><td>100 %</td><td>—</td></tr></tfoot>}
            </table>
          </div>
        </>
      )}

      <ChargeFormModal
        open={modalOpen}
        title="Ajouter une charge"
        lotName={lotSaisie?.nom || ""}
        lots={lotsASaisir}
        lotId={lotSaisieId}
        onLotChange={setLotSaisieId}
        type={selectedType}
        montant={montant}
        onTypeChange={setSelectedType}
        onMontantChange={setMontant}
        onSave={handleSave}
        onClose={() => setModalOpen(false)}
        saving={saving}
        front
      />

      {chargeEnModification && (
        <ChargeFormModal
          open
          title="Modifier la charge"
          lotName={chargeEnModification.lot_nom}
          type={chargeEnModification.type_charge}
          montant={chargeEnModification.montant}
          onTypeChange={(type) => setChargeEnModification({ ...chargeEnModification, type_charge: type })}
          onMontantChange={(nouveauMontant) => setChargeEnModification({ ...chargeEnModification, montant: nouveauMontant })}
          onSave={enregistrerModification}
          onClose={() => setChargeEnModification(null)}
          saving={saving}
          front
        />
      )}
    </div>
  );
};

function ChargeFormModal({
  open,
  title,
  lotName,
  lots,
  lotId,
  onLotChange,
  type,
  montant,
  onTypeChange,
  onMontantChange,
  onSave,
  onClose,
  saving,
  front = false,
}: {
  open: boolean;
  title: string;
  lotName: string;
  lots?: Lot[];
  lotId?: string;
  onLotChange?: (value: string) => void;
  type: string;
  montant: number;
  onTypeChange: (value: string) => void;
  onMontantChange: (value: number) => void;
  onSave: () => void;
  onClose: () => void;
  saving: boolean;
  front?: boolean;
}) {
  if (!open) return null;
  return (
    <div className={`poultry-modal-backdrop${front ? " poultry-modal-backdrop-front" : ""}`}>
      <div className="poultry-modal poultry-modal-small">
        <ModalCloseButton onClick={onClose} disabled={saving} />
        <div className="poultry-modal-header">
          <span className="poultry-modal-icon">€</span>
          <div><h2>{title}</h2><p>Lot {lotName}</p></div>
        </div>
        <div className="poultry-form-stack">
          {lots && onLotChange && <label>Lot<select value={lotId || ""} onChange={(event) => onLotChange(event.target.value)} disabled={saving}>
            <option value="">-- Choisir un lot --</option>
            {lots.map((lot) => <option key={lot.id} value={lot.id}>Lot {lot.nom} · {lot.batiment}</option>)}
          </select></label>}
          <label>Catégorie<select value={type} onChange={(event) => onTypeChange(event.target.value)}><option value="achat_poussins">Achat poussins</option><option value="aliment">Aliment</option><option value="ramassage">Ramassage</option><option value="livraison">Livraison</option><option value="divers">Divers</option></select></label>
          <label>Montant (€)<input type="number" min={0.01} step="0.01" value={montant || ""} onChange={(event) => onMontantChange(Number(event.target.value))} /></label>
        </div>
        <div className="poultry-modal-actions">
          <button type="button" className="poultry-modal-primary" onClick={onSave} disabled={saving || (!!lots && !lots.some((lot) => lot.id === lotId))}>{saving ? "Enregistrement..." : "▣ Enregistrer"}</button>
          <button type="button" className="poultry-modal-secondary" onClick={onClose}>Annuler</button>
        </div>
      </div>
    </div>
  );
}

function formatDate(date: string) {
  if (!date) return "—";
  return new Date(`${date}T00:00:00`).toLocaleDateString("fr-FR");
}

function dateDuJour() {
  const date = new Date();
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export default Charges;
