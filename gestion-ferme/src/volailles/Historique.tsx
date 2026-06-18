import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import Charges from "./Charges";
import { chargerLotsAvecMouvements, type LivraisonVolaille } from './volaillesData';

type LotVolailles = {
  id: string;
  nom: string;
  quantite: number;
  date_arrivee: string;
  batiment: string;
  mortalites: any;
  evenements: any;
  couleur: string;
  age: number;
  is_active: boolean;
  nb_morts: number;
  sujets_restants: number;
  facture_date: string;
  resultat_brut: number;
  resultat_net: number;
  autoconsommation: number;
  prix_vente_kg: number;
  prix_poussins: number;
  quantite_retenue: number;
  total_poids_livre: number;
  livraisons: LivraisonVolaille[];
};

export default function Historique() {
  const [historique, setHistorique] = useState<LotVolailles[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [sortedHistorique, setSortedHistorique] = useState<LotVolailles[]>([]);

  const [showResultatNetModal, setShowResultatNetModal] = useState(false);
  const [resultatNetInput, setResultatNetInput] = useState('');
  const [selectedLot, setSelectedLot] = useState<LotVolailles | null>(null);

  const [showQuantiteRetenueModal, setShowQuantiteRetenueModal] = useState(false);
  const [quantiteRetenueInput, setQuantiteRetenueInput] = useState('');

  // ✅ Fonction réutilisable pour charger les lots
  const fetchLots = async () => {
    try {
      const lots = await chargerLotsAvecMouvements(false) as LotVolailles[];
      setHistorique(lots);
      setSortedHistorique(lots);
    } catch (error) {
      console.error('Erreur chargement des lots:', error);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchLots();
  }, []);

  // ✅ Appel fetchLots() après update
  const handleSaveResultatNet = async (lotId: string, montant: number) => {
    const { error } = await supabase
      .from('lots_volailles')
      .update({ resultat_net: montant })
      .eq('id', lotId)
      .select('*');

    if (error) {
      console.error('Erreur mise à jour résultat net :', error);
    } else {
      await fetchLots(); // Recharge les données après mise à jour

      setShowResultatNetModal(false);
      setSelectedLot(null);
      setResultatNetInput('');
    }
  };

  // ✅ Appel fetchLots() après update
  const handleSaveQuantiteRetenue = async (lotId: string, nouvelleQuantiteRetenue: number) => {
    const { error } = await supabase
      .from('lots_volailles')
      .update({ quantite_retenue: nouvelleQuantiteRetenue })
      .eq('id', lotId)
      .select('*');

    if (error) {
      console.error('Erreur mise à jour quantité retenue :', error);
    } else {
      await fetchLots(); // Recharge les données après mise à jour

      setShowQuantiteRetenueModal(false);
      setSelectedLot(null);
      setQuantiteRetenueInput('');
    }
  };
  
  

  const totalLivres = historique.reduce(
    (acc, lot) => acc + lot.livraisons.reduce((total, livraison) => total + livraison.quantite, 0),
    0
  );

  const totalRestants = historique.reduce(
    (acc, lot) => acc + (lot.sujets_restants || 0),
    0
  );

  const totalPoids = historique.reduce(
    (acc, lot) => acc + lot.livraisons.reduce((total, livraison) => total + livraison.poids, 0),
    0
  );

  const totalQuantiteRetenue = historique.reduce(
    (acc, lot) => acc + (lot.quantite_retenue || 0),
    0
  );

  const totalResultatBrut = historique.reduce(
    (acc, lot) => acc + (lot.resultat_brut || 0),
    0
  );

  const totalResultatNet = historique.reduce(
    (acc, lot) => acc + (lot.resultat_net || 0),
    0
  );

  const trierParNom = () => {
    const order = sortOrder === 'asc' ? 'desc' : 'asc';
    setSortOrder(order);
    const sorted = [...historique].sort((a, b) =>
      order === 'asc'
        ? a.nom.localeCompare(b.nom)
        : b.nom.localeCompare(a.nom)
    );
    setSortedHistorique(sorted);
  };

  if (loading) return <div className="p-4">Chargement...</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Historique des lots</h1>

      {/* Boutons modaux */}
      <div className="flex gap-4 mb-4">
        <button className="bg-yellow-500 text-black px-4 py-2 rounded" onClick={() => setShowResultatNetModal(true)}>Résultat Net</button>
        <button className="bg-blue-500 text-black px-4 py-2 rounded" onClick={() => setShowQuantiteRetenueModal(true)}>Quantité Retenue</button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm border border-gray-300">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-3 py-2 border cursor-pointer" onClick={trierParNom}>
                N° lot {sortOrder === 'asc' ? '↑' : '↓'}
              </th>
              <th className="px-3 py-2 border">Arrivée</th>
              <th className="px-3 py-2 border">Bâtiment</th>
              <th className="px-3 py-2 border">Restants</th>
              <th className="px-3 py-2 border">Livraisons</th>
              <th className="px-3 py-2 border">Quantité livrée</th>
              <th className="px-3 py-2 border">Quantité retenue</th>
              <th className="px-3 py-2 border">Poids total</th>
              <th className="px-3 py-2 border">Autoconsommation</th>
              <th className="px-3 py-2 border">Résultat brut</th>
              <th className="px-3 py-2 border">Résultat net</th>
            </tr>
          </thead>
          <tbody>
            {sortedHistorique.map((lot) => (
              <tr key={lot.id} className="even:bg-gray-50">
                <td className="border px-3 py-2">{lot.nom}</td>
                <td className="border px-3 py-2">{new Date(lot.date_arrivee).toLocaleDateString('fr-FR')}</td>
                <td className="border px-3 py-2">{lot.batiment}</td>
                <td className="border px-3 py-2">{lot.sujets_restants}</td>
                <td className="border px-3 py-2">
                  {lot.livraisons.length
                    ? lot.livraisons.map((livraison) => livraison.date).join(', ')
                    : '-'}
                </td>
                <td className="border px-3 py-2">
                  {lot.livraisons.reduce((total, livraison) => total + livraison.quantite, 0)}
                </td>
                <td className="border px-3 py-2">{lot.quantite_retenue}</td>
                <td className="border px-3 py-2">{lot.total_poids_livre != null ? lot.total_poids_livre.toFixed(2) + ' kg' : '-'}</td>
                <td className="border px-3 py-2">{lot.autoconsommation}</td>
                <td className="border px-3 py-2">{lot.resultat_brut}</td>
                <td className="border px-3 py-2">{lot.resultat_net}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold bg-gray-200">
              <td className="px-3 py-2 border">Totaux</td>
              <td className="px-3 py-2 border">—</td>
              <td className="px-3 py-2 border">—</td>
              <td className="px-3 py-2 border">{totalRestants}</td>
              <td className="px-3 py-2 border">—</td>
              <td className="px-3 py-2 border">{totalLivres}</td>
              <td className="px-3 py-2 border">{totalQuantiteRetenue}</td>
              <td className="px-3 py-2 border">{totalPoids.toFixed(2)} kg</td>
              <td className="px-3 py-2 border">—</td>
              <td className="px-3 py-2 border">{totalResultatBrut.toFixed(2)} €</td>
              <td className="px-3 py-2 border">{totalResultatNet.toFixed(2)} €</td>
            </tr>
          </tfoot>
        </table>
      </div>
      
      <div>
      <Charges />
      </div>

     {/* Modale Résultat Net */}
     {showResultatNetModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow-lg w-96">
            <h2 className="text-lg font-bold mb-4">Saisir le Résultat Net</h2>
            <label className="block mb-2 text-sm font-medium text-gray-700">Sélectionner un lot</label>
            <select
              className="w-full p-2 border rounded mb-4"
              value={selectedLot?.id || ''}
              onChange={(e) => {
                const lot = historique.find((l) => l.id === e.target.value);
                setSelectedLot(lot || null);
              }}
            >
              <option value="">-- Choisir un lot --</option>
              {historique.map((lot) => (
                <option key={lot.id} value={lot.id}>
                  {lot.nom} (Arrivé le {new Date(lot.date_arrivee).toLocaleDateString('fr-FR', { timeZone: 'UTC' })})
                </option>
              ))}
            </select>

            {selectedLot && (
              <>
                <label className="block mb-2 text-sm font-medium text-gray-700">Montant (€)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Montant"
                  value={resultatNetInput}
                  onChange={(e) => setResultatNetInput(e.target.value)}
                  className="border p-2 rounded w-full mb-4"
                />
                <button
                className="bg-green-600 text-black p-2 rounded w-full"
                onClick={() => {
                  if (selectedLot && resultatNetInput !== '') {
                    handleSaveResultatNet(selectedLot.id, parseFloat(resultatNetInput));
                  }
                }}
              >
                Enregistrer
              </button>
              </>
            )}

            <button
              onClick={() => {
                setShowResultatNetModal(false);
                setSelectedLot(null);
                setResultatNetInput('');
              }}
              className="mt-2 p-2 w-full bg-gray-400 rounded text-black"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Modale Quantité Retenue */}
      {showQuantiteRetenueModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow-lg w-96">
            <h2 className="text-lg font-bold mb-4">Saisir la Quantité Retenue</h2>
            <label className="block mb-2 text-sm font-medium text-gray-700">Sélectionner un lot</label>
            <select
              className="w-full p-2 border rounded mb-4"
              value={selectedLot?.id || ''}
              onChange={(e) => {
                const lot = historique.find((l) => l.id === e.target.value);
                setSelectedLot(lot || null);
              }}
            >
              <option value="">-- Choisir un lot --</option>
              {historique.map((lot) => (
                <option key={lot.id} value={lot.id}>
                  {lot.nom} (Arrivé le {new Date(lot.date_arrivee).toLocaleDateString('fr-FR', { timeZone: 'UTC' })})
                </option>
              ))}
            </select>

            {selectedLot && (
              <>
                <label className="block mb-2 text-sm font-medium text-gray-700">Quantité Retenue</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Quantité retenue"
                  value={quantiteRetenueInput}
                  onChange={(e) => setQuantiteRetenueInput(e.target.value)}
                  className="border p-2 rounded w-full mb-4"
                />
                <button
                className="bg-blue-600 text-black p-2 rounded w-full"
                onClick={() => {
                  if (selectedLot && quantiteRetenueInput !== '') {
                    handleSaveQuantiteRetenue(selectedLot.id, parseFloat(quantiteRetenueInput));
                  }
                }}
              >
                Enregistrer
              </button>
              </>
            )}

            <button
              onClick={() => {
                setShowQuantiteRetenueModal(false);
                setSelectedLot(null);
                setQuantiteRetenueInput('');
              }}
              className="mt-2 p-2 w-full bg-gray-400 rounded text-black"
            >
              Annuler
            </button>
          </div>
        </div>
      )}



    </div>
  );
}
