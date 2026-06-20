import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { supabase } from "../supabaseClient";
import ModalCloseButton from "../components/ModalCloseButton";
import { chargerLotsAvecMouvements } from "./volaillesData";

interface Charge {
  id: number | string;
  lot_id: string;
  lot_nom: string;
  date: string;
  type_charge: string;
  montant: number;
}

interface Lot {
  id: string;
  nom: string;
  date_arrivee: string;
  batiment: string;
  age: number;
  quantiteLivree: number;
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
  const [selectedLotId, setSelectedLotId] = useState("");
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
    const { data, error } = await supabase.from("charges").select("*");
    if (error) {
      console.error("Erreur chargement charges :", error.message);
      toast.error("Les charges n'ont pas pu être chargées.");
      return;
    }
    setCharges(
      (data || []).map((charge) => ({
        ...charge,
        montant: Number(charge.montant) || 0,
      })) as Charge[]
    );
  };

  useEffect(() => {
    fetchLots();
    fetchCharges();
  }, []);

  const lotsAffiches = useMemo(
    () =>
      lotIdsFiltres
        ? lots.filter((lot) => lotIdsFiltres.includes(lot.id))
        : lots,
    [lots, lotIdsFiltres]
  );

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

  const chargesDuLot = useMemo(
    () =>
      charges
        .filter((charge) => charge.lot_id === lotSelectionne?.id)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [charges, lotSelectionne]
  );

  const totalCharges = chargesDuLot.reduce(
    (total, charge) => total + charge.montant,
    0
  );
  const coutParSujet =
    Number(lotSelectionne?.quantiteLivree) > 0
      ? totalCharges / Number(lotSelectionne?.quantiteLivree)
      : 0;

  const handleSave = async () => {
    if (saving || !lotSelectionne) return;
    if (montant <= 0) {
      toast.error("Indiquez un montant positif.");
      return;
    }

    setSaving(true);
    const { error } = await supabase.from("charges").insert({
      lot_id: lotSelectionne.id,
      lot_nom: lotSelectionne.nom,
      type_charge: selectedType,
      montant,
      date: dateDuJour(),
    });

    if (error) {
      console.error("Erreur enregistrement charge :", error.message);
      toast.error("La charge n'a pas pu être enregistrée.");
    } else {
      setModalOpen(false);
      setSelectedType("achat_poussins");
      setMontant(0);
      await fetchCharges();
      toast.success("Charge enregistrée.");
    }
    setSaving(false);
  };

  const enregistrerModification = async () => {
    if (saving || !chargeEnModification) return;
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
    if (saving || !window.confirm("Supprimer cette charge ?")) return;
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
              <strong>{totalCharges.toFixed(2)} €</strong>
            </div>
            <div className="charge-summary-metric">
              <small>Coût par sujet livré</small>
              <strong>{coutParSujet.toFixed(2)} €</strong>
            </div>
          </section>

          <div className="charge-manager-heading">
            <h3>Charges du lot</h3>
            <button type="button" onClick={() => setModalOpen(true)}>＋ Ajouter une charge</button>
          </div>

          <div className="charge-manager-mobile">
            {chargesDuLot.map((charge) => {
              const meta = chargeMeta[charge.type_charge] || chargeMeta.divers;
              const pourcentage =
                totalCharges > 0 ? (charge.montant / totalCharges) * 100 : 0;
              return (
                <article key={charge.id}>
                  <div className="charge-category">
                    <span className={`charge-category-icon charge-tone-${meta.tone}`}>{meta.icon}</span>
                    <div><strong>{meta.label}</strong></div>
                  </div>
                  <div className="charge-mobile-values"><b>{charge.montant.toFixed(2)} €</b><span>{pourcentage.toFixed(1)} %</span></div>
                  <div className="charge-actions">
                    <button type="button" title="Modifier" onClick={() => setChargeEnModification({ ...charge })}>✎</button>
                    <button type="button" title="Supprimer" onClick={() => supprimerCharge(charge)} disabled={saving}>🗑</button>
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
                      <td><div className="charge-category"><span className={`charge-category-icon charge-tone-${meta.tone}`}>{meta.icon}</span><strong>{meta.label}</strong></div></td>
                      <td>{charge.montant.toFixed(2)} €</td>
                      <td>{pourcentage.toFixed(1)} %</td>
                      <td><div className="charge-actions"><button type="button" title="Modifier la charge" onClick={() => setChargeEnModification({ ...charge })}>✎</button><button type="button" title="Supprimer la charge" onClick={() => supprimerCharge(charge)} disabled={saving}>🗑</button></div></td>
                    </tr>
                  );
                })}
                {!chargesDuLot.length && <tr><td colSpan={4} className="charge-manager-empty">Aucune charge enregistrée pour ce lot.</td></tr>}
              </tbody>
              {!!chargesDuLot.length && <tfoot><tr><td>Total des charges</td><td>{totalCharges.toFixed(2)} €</td><td>100 %</td><td>—</td></tr></tfoot>}
            </table>
          </div>
        </>
      )}

      <ChargeFormModal
        open={modalOpen}
        title="Ajouter une charge"
        lotName={lotSelectionne?.nom || ""}
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
          <label>Catégorie<select value={type} onChange={(event) => onTypeChange(event.target.value)}><option value="achat_poussins">Achat poussins</option><option value="aliment">Aliment</option><option value="ramassage">Ramassage</option><option value="livraison">Livraison</option><option value="divers">Divers</option></select></label>
          <label>Montant (€)<input type="number" min={0.01} step="0.01" value={montant} onChange={(event) => onMontantChange(Number(event.target.value))} /></label>
        </div>
        <div className="poultry-modal-actions">
          <button type="button" className="poultry-modal-primary" onClick={onSave} disabled={saving}>{saving ? "Enregistrement..." : "▣ Enregistrer"}</button>
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
