import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import toast from "react-hot-toast";

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
}

interface ChargesProps {
  lotIdsFiltres?: string[];
}

const Charges = ({ lotIdsFiltres }: ChargesProps) => {
  const [lots, setLots] = useState<Lot[]>([]);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lotDetail, setLotDetail] = useState<Lot | null>(null);
  const [chargeEnModification, setChargeEnModification] = useState<Charge | null>(null);

  // Form fields
  const [selectedLotId, setSelectedLotId] = useState("");
  const [selectedType, setSelectedType] = useState("achat_poussins");
  const [montant, setMontant] = useState<number>(0);
  const [date, setDate] = useState("");

  useEffect(() => {
    fetchLots();
    fetchCharges();
  }, []);

  const fetchLots = async () => {
    const { data, error } = await supabase
      .from("lots_volailles")
      .select("id, nom")
      .eq("is_active", false);

    if (!error) setLots((data || []) as Lot[]);
    else {
      console.error("Erreur chargement lots:", error.message);
      toast.error("Les lots des charges n'ont pas pu être chargés.");
    }
  };

  const fetchCharges = async () => {
    const { data, error } = await supabase.from("charges").select("*");
    if (!error) {
      setCharges(
        (data || []).map((charge) => ({
          ...charge,
          montant: Number(charge.montant) || 0,
        })) as Charge[]
      );
    }
    else {
      console.error("Erreur chargement charges:", error.message);
      toast.error("Les charges n'ont pas pu être chargées.");
    }
  };

  const handleSave = async () => {
    if (saving) return;
    const lot = lots.find((l) => l.id === selectedLotId);
    if (!lot) {
      toast.error("Sélectionnez un lot.");
      return;
    }

    if (!date || montant <= 0) {
      toast.error("Indiquez une date et un montant positif.");
      return;
    }

    setSaving(true);
    const { error } = await supabase.from("charges").insert({
      lot_id: lot.id,
      lot_nom: lot.nom,
      type_charge: selectedType,
      montant,
      date,
    });

    if (!error) {
      setModalOpen(false);
      setSelectedLotId("");
      setSelectedType("achat_poussins");
      setMontant(0);
      setDate("");
      fetchCharges();
      toast.success("Charge enregistrée.");
    } else {
      console.error("Erreur enregistrement charge:", error.message);
      toast.error("La charge n'a pas pu être enregistrée.");
    }
    setSaving(false);
  };

  const getTotalByType = (lotId: string, type: string) =>
    charges
      .filter((c) => c.lot_id === lotId && c.type_charge === type)
      .reduce((sum, c) => sum + c.montant, 0);

  const getTotalCharges = (lotId: string) =>
    charges
      .filter((c) => c.lot_id === lotId)
      .reduce((sum, c) => sum + c.montant, 0);

  const libelleType = (type: string) => {
    const libelles: Record<string, string> = {
      achat_poussins: "Achat poussins",
      aliment: "Aliment",
      ramassage: "Ramassage",
      livraison: "Livraison",
    };
    return libelles[type] || type;
  };

  const chargesDuLot = (lotId: string) =>
    charges
      .filter((charge) => charge.lot_id === lotId)
      .sort((a, b) => b.date.localeCompare(a.date));

  const enregistrerModification = async () => {
    if (saving || !chargeEnModification) return;
    if (!chargeEnModification.date || chargeEnModification.montant <= 0) {
      toast.error("Indiquez une date et un montant positif.");
      return;
    }

    setSaving(true);
    const { data, error } = await supabase
      .from("charges")
      .update({
        date: chargeEnModification.date,
        type_charge: chargeEnModification.type_charge,
        montant: chargeEnModification.montant,
      })
      .eq("id", chargeEnModification.id)
      .select("*")
      .single();

    if (error) {
      console.error("Erreur modification charge:", error.message);
      toast.error("La charge n'a pas pu être modifiée.");
    } else if (data) {
      const chargeModifiee = {
        ...data,
        montant: Number(data.montant) || 0,
      } as Charge;
      setCharges((chargesActuelles) =>
        chargesActuelles.map((charge) =>
          charge.id === chargeModifiee.id ? chargeModifiee : charge
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
    const { error } = await supabase
      .from("charges")
      .delete()
      .eq("id", charge.id);

    if (error) {
      console.error("Erreur suppression charge:", error.message);
      toast.error("La charge n'a pas pu être supprimée.");
    } else {
      setCharges((chargesActuelles) =>
        chargesActuelles.filter((item) => item.id !== charge.id)
      );
      toast.success("Charge supprimée.");
    }
    setSaving(false);
  };

  const lotsAffiches = lotIdsFiltres
    ? lots.filter((lot) => lotIdsFiltres.includes(lot.id))
    : lots;

  return (
    <div className="mt-12">
      <h2 className="text-2xl font-semibold mb-4">Charges par Lot</h2>

      <button
        onClick={() => setModalOpen(true)}
        className="mb-4 !bg-blue-600 !text-white px-4 py-2 rounded"
      >
        Ajouter une charge
      </button>

      <div className="space-y-3 md:hidden">
        {lotsAffiches.length === 0 && (
          <div className="rounded-lg border bg-white p-6 text-center text-gray-500">
            Aucune charge à afficher pour cette recherche.
          </div>
        )}
        {lotsAffiches.map((lot) => (
          <article key={lot.id} className="rounded-lg border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">{lot.nom}</h3>
              <div className="text-lg font-bold">{getTotalCharges(lot.id).toFixed(2)} €</div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded border p-2">
                <div className="text-gray-500">Poussins</div>
                <div className="font-semibold">
                  {getTotalByType(lot.id, "achat_poussins").toFixed(2)} €
                </div>
              </div>
              <div className="rounded border p-2">
                <div className="text-gray-500">Aliment</div>
                <div className="font-semibold">
                  {getTotalByType(lot.id, "aliment").toFixed(2)} €
                </div>
              </div>
              <div className="rounded border p-2">
                <div className="text-gray-500">Ramassage</div>
                <div className="font-semibold">
                  {getTotalByType(lot.id, "ramassage").toFixed(2)} €
                </div>
              </div>
              <div className="rounded border p-2">
                <div className="text-gray-500">Livraison</div>
                <div className="font-semibold">
                  {getTotalByType(lot.id, "livraison").toFixed(2)} €
                </div>
              </div>
            </div>
            <button
              onClick={() => setLotDetail(lot)}
              className="mt-3 w-full !bg-slate-700 !text-white rounded px-3 py-2"
            >
              Voir le détail
            </button>
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded border md:block">
      <table className="w-full min-w-[700px] table-auto border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="border px-3 py-2">Lot</th>
            <th className="border px-3 py-2">Achat Poussins</th>
            <th className="border px-3 py-2">Aliment</th>
            <th className="border px-3 py-2">Ramassage</th>
            <th className="border px-3 py-2">Livraison</th>
            <th className="border px-3 py-2 font-bold">Total Charges</th>
            <th className="border px-3 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {lotsAffiches.length === 0 && (
            <tr>
              <td colSpan={7} className="border p-6 text-center text-gray-500">
                Aucune charge à afficher pour cette recherche.
              </td>
            </tr>
          )}
          {lotsAffiches.map((lot) => (
            <tr key={lot.id}>
              <td className="border px-3 py-2">{lot.nom}</td>
              <td className="border px-3 py-2">
                {getTotalByType(lot.id, "achat_poussins").toFixed(2)} €
              </td>
              <td className="border px-3 py-2">
                {getTotalByType(lot.id, "aliment").toFixed(2)} €
              </td>
              <td className="border px-3 py-2">
                {getTotalByType(lot.id, "ramassage").toFixed(2)} €
              </td>
              <td className="border px-3 py-2">
                {getTotalByType(lot.id, "livraison").toFixed(2)} €
              </td>
              <td className="border px-3 py-2 font-semibold">
                {getTotalCharges(lot.id).toFixed(2)} €
              </td>
              <td className="border px-3 py-2">
                <button
                  onClick={() => setLotDetail(lot)}
                  className="!bg-slate-700 !text-white rounded px-3 py-2 text-xs"
                >
                  Détail
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      {lotDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-6 shadow-lg">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h3 className="text-xl font-semibold">Charges du lot {lotDetail.nom}</h3>
                <p className="text-sm text-gray-600">
                  Total : {getTotalCharges(lotDetail.id).toFixed(2)} €
                </p>
              </div>
              <button
                onClick={() => setLotDetail(null)}
                className="!bg-gray-200 !text-gray-900 rounded px-4 py-2"
              >
                Fermer
              </button>
            </div>

            {chargesDuLot(lotDetail.id).length === 0 ? (
              <p className="mt-5 rounded border p-5 text-center text-gray-500">
                Aucune charge enregistrée pour ce lot.
              </p>
            ) : (
              <div className="mt-5 space-y-3">
                {chargesDuLot(lotDetail.id).map((charge) => (
                  <div
                    key={charge.id}
                    className="flex flex-col gap-3 rounded border p-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <div className="font-semibold">{libelleType(charge.type_charge)}</div>
                      <div className="text-sm text-gray-600">
                        {new Date(`${charge.date}T00:00:00`).toLocaleDateString("fr-FR")}
                      </div>
                    </div>
                    <div className="text-lg font-bold">{charge.montant.toFixed(2)} €</div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setChargeEnModification({ ...charge })}
                        className="!bg-blue-600 !text-white rounded px-3 py-2 text-sm"
                      >
                        Modifier
                      </button>
                      <button
                        onClick={() => supprimerCharge(charge)}
                        disabled={saving}
                        className="!bg-red-600 !text-white rounded px-3 py-2 text-sm disabled:opacity-60"
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {chargeEnModification && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
            <h3 className="text-lg font-semibold">Modifier la charge</h3>
            <p className="mb-4 text-sm text-gray-600">{chargeEnModification.lot_nom}</p>

            <label className="block text-sm font-medium text-gray-700">
              Type
              <select
                value={chargeEnModification.type_charge}
                onChange={(event) =>
                  setChargeEnModification({
                    ...chargeEnModification,
                    type_charge: event.target.value,
                  })
                }
                className="mt-1 mb-3 w-full rounded border p-2"
              >
                <option value="achat_poussins">Achat poussins</option>
                <option value="aliment">Aliment</option>
                <option value="ramassage">Ramassage</option>
                <option value="livraison">Livraison</option>
              </select>
            </label>

            <label className="block text-sm font-medium text-gray-700">
              Montant (€)
              <input
                type="number"
                min={0.01}
                step="0.01"
                value={chargeEnModification.montant}
                onChange={(event) =>
                  setChargeEnModification({
                    ...chargeEnModification,
                    montant: Number(event.target.value),
                  })
                }
                className="mt-1 mb-3 w-full rounded border p-2"
              />
            </label>

            <label className="block text-sm font-medium text-gray-700">
              Date
              <input
                type="date"
                value={chargeEnModification.date}
                onChange={(event) =>
                  setChargeEnModification({
                    ...chargeEnModification,
                    date: event.target.value,
                  })
                }
                className="mt-1 mb-4 w-full rounded border p-2"
              />
            </label>

            <button
              onClick={enregistrerModification}
              disabled={saving}
              className="w-full !bg-blue-600 !text-white rounded px-4 py-2 disabled:opacity-60"
            >
              {saving ? "Enregistrement..." : "Enregistrer la modification"}
            </button>
            <button
              onClick={() => setChargeEnModification(null)}
              disabled={saving}
              className="mt-2 w-full !bg-gray-200 !text-gray-900 rounded px-4 py-2 disabled:opacity-60"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Modale d'ajout */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-lg w-full max-w-md shadow-lg">
            <h3 className="text-lg font-semibold mb-4">Ajouter une charge</h3>

            <select
              value={selectedLotId}
              onChange={(e) => setSelectedLotId(e.target.value)}
              className="w-full p-2 border rounded mb-3"
            >
              <option value="">Sélectionner un lot</option>
              {lots.map((lot) => (
                <option key={lot.id} value={lot.id}>
                  {lot.nom}
                </option>
              ))}
            </select>

            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full p-2 border rounded mb-3"
            >
              <option value="achat_poussins">Achat poussins</option>
              <option value="aliment">Aliment</option>
              <option value="ramassage">Ramassage</option>
              <option value="livraison">Livraison</option>
            </select>

            <input
              type="number"
              placeholder="Montant (€)"
              value={montant}
              onChange={(e) => setMontant(Number(e.target.value))}
              className="w-full p-2 border rounded mb-3"
            />

            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full p-2 border rounded mb-4"
            />

            <button
              onClick={handleSave}
              disabled={saving}
              className="!bg-green-600 !text-white px-4 py-2 rounded w-full mb-2 disabled:opacity-60"
            >
              {saving ? "Enregistrement..." : "Enregistrer"}
            </button>
            <button
              onClick={() => setModalOpen(false)}
              disabled={saving}
              className="!bg-gray-200 !text-gray-900 px-4 py-2 rounded w-full"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Charges;
