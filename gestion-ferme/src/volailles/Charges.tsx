import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import toast from "react-hot-toast";

interface Charge {
  id: number;
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

const Charges = () => {
  const [lots, setLots] = useState<Lot[]>([]);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

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

    if (!error) setLots(data as Lot[]);
    else console.error("Erreur chargement lots:", error.message);
  };

  const fetchCharges = async () => {
    const { data, error } = await supabase.from("charges").select("*");
    if (!error) setCharges(data as Charge[]);
    else console.error("Erreur chargement charges:", error.message);
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

  return (
    <div className="mt-12">
      <h2 className="text-2xl font-semibold mb-4">Charges par Lot</h2>

      <button
        onClick={() => setModalOpen(true)}
        className="mb-4 bg-blue-500 text-black px-4 py-2 rounded"
      >
        Ajouter une charge
      </button>

      <table className="w-full table-auto border border-gray-300">
        <thead>
          <tr className="bg-gray-100">
            <th className="border px-3 py-2">Lot</th>
            <th className="border px-3 py-2">Achat Poussins</th>
            <th className="border px-3 py-2">Aliment</th>
            <th className="border px-3 py-2">Ramassage</th>
            <th className="border px-3 py-2">Livraison</th>
            <th className="border px-3 py-2 font-bold">Total Charges</th>
          </tr>
        </thead>
        <tbody>
          {lots.map((lot) => (
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
            </tr>
          ))}
        </tbody>
      </table>

      {/* Modale d'ajout */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
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
              className="bg-green-600 text-black px-4 py-2 rounded w-full mb-2 disabled:opacity-60"
            >
              {saving ? "Enregistrement..." : "Enregistrer"}
            </button>
            <button
              onClick={() => setModalOpen(false)}
              className="bg-gray-400 text-black px-4 py-2 rounded w-full"
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
