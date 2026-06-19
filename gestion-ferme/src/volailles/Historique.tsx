import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';
import Charges from "./Charges";
import ModalCloseButton from '../components/ModalCloseButton';
import {
  chargerLotsAvecMouvements,
  supprimerLotEtDonnees,
  type LivraisonVolaille,
  type MortaliteVolaille,
} from './volaillesData';

type LotVolailles = {
  id: string;
  nom: string;
  quantite: number;
  date_arrivee: string;
  batiment: string;
  mortalites: MortaliteVolaille[];
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
  const [detailLot, setDetailLot] = useState<LotVolailles | null>(null);
  const [recherche, setRecherche] = useState('');
  const [saving, setSaving] = useState(false);

  // ✅ Fonction réutilisable pour charger les lots
  const fetchLots = async () => {
    try {
      const lots = await chargerLotsAvecMouvements(false) as LotVolailles[];
      setHistorique(lots);
      setSortedHistorique(lots);
    } catch (error) {
      console.error('Erreur chargement des lots:', error);
      toast.error("L'historique n'a pas pu être chargé.");
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchLots();
  }, []);

  // ✅ Appel fetchLots() après update
  const handleSaveResultatNet = async (lotId: string, montant: number) => {
    if (!Number.isFinite(montant) || montant < 0) {
      toast.error('Indiquez un montant valide.');
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('lots_volailles')
      .update({ resultat_net: montant })
      .eq('id', lotId)
      .select('*');

    if (error) {
      console.error('Erreur mise à jour résultat net :', error);
      toast.error("Le résultat net n'a pas pu être enregistré.");
    } else {
      await fetchLots(); // Recharge les données après mise à jour

      setShowResultatNetModal(false);
      setSelectedLot(null);
      setResultatNetInput('');
      toast.success('Résultat net enregistré.');
    }
    setSaving(false);
  };

  // ✅ Appel fetchLots() après update
  const handleSaveQuantiteRetenue = async (lotId: string, nouvelleQuantiteRetenue: number) => {
    if (!Number.isFinite(nouvelleQuantiteRetenue) || nouvelleQuantiteRetenue < 0) {
      toast.error('Indiquez une quantité valide.');
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('lots_volailles')
      .update({ quantite_retenue: nouvelleQuantiteRetenue })
      .eq('id', lotId)
      .select('*');

    if (error) {
      console.error('Erreur mise à jour quantité retenue :', error);
      toast.error("La quantité retenue n'a pas pu être enregistrée.");
    } else {
      await fetchLots(); // Recharge les données après mise à jour

      setShowQuantiteRetenueModal(false);
      setSelectedLot(null);
      setQuantiteRetenueInput('');
      toast.success('Quantité retenue enregistrée.');
    }
    setSaving(false);
  };

  const reactiverLot = async (lot: LotVolailles) => {
    if (saving || !window.confirm(`Réactiver le lot ${lot.nom} ?`)) return;

    setSaving(true);
    const { error } = await supabase
      .from('lots_volailles')
      .update({ is_active: true })
      .eq('id', lot.id);

    if (error) {
      console.error('Erreur réactivation du lot :', error);
      toast.error("Le lot n'a pas pu être réactivé.");
    } else {
      setHistorique((lots) => lots.filter((item) => item.id !== lot.id));
      setSortedHistorique((lots) => lots.filter((item) => item.id !== lot.id));
      setDetailLot(null);
      toast.success('Lot réactivé. Il apparaît de nouveau dans les lots en cours.');
    }
    setSaving(false);
  };

  const supprimerLot = async (lot: LotVolailles) => {
    if (
      saving ||
      !window.confirm(
        `Supprimer définitivement le lot ${lot.nom} et toutes ses données ?`
      )
    ) {
      return;
    }

    setSaving(true);
    try {
      await supprimerLotEtDonnees(lot.id);
      setHistorique((lots) => lots.filter((item) => item.id !== lot.id));
      setSortedHistorique((lots) =>
        lots.filter((item) => item.id !== lot.id)
      );
      if (detailLot?.id === lot.id) setDetailLot(null);
      toast.success('Lot supprimé définitivement.');
    } catch (error) {
      console.error('Erreur suppression du lot :', error);
      toast.error("Le lot n'a pas pu être supprimé.");
    } finally {
      setSaving(false);
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

  const lotsAffiches = sortedHistorique.filter((lot) => {
    const terme = recherche.trim().toLowerCase();
    return (
      !terme ||
      lot.nom.toLowerCase().includes(terme) ||
      lot.batiment.toLowerCase().includes(terme)
    );
  });

  if (loading) return <div className="p-4">Chargement...</div>;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">Historique des lots</h1>
        <p className="text-sm text-gray-600">Lots archivés, résultats et livraisons.</p>
      </div>

      {/* Boutons modaux */}
      <div className="flex flex-wrap gap-3">
        <button className="!bg-yellow-400 !text-black px-4 py-2 rounded" onClick={() => setShowResultatNetModal(true)}>Résultat net</button>
        <button className="!bg-blue-600 !text-white px-4 py-2 rounded" onClick={() => setShowQuantiteRetenueModal(true)}>Quantité retenue</button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <div className="text-xs uppercase text-gray-500">Lots archivés</div>
          <div className="mt-1 text-2xl font-bold">{historique.length}</div>
        </div>
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <div className="text-xs uppercase text-gray-500">Sujets livrés</div>
          <div className="mt-1 text-2xl font-bold">{totalLivres}</div>
        </div>
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <div className="text-xs uppercase text-gray-500">Poids livré</div>
          <div className="mt-1 text-2xl font-bold">{totalPoids.toFixed(1)} kg</div>
        </div>
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <div className="text-xs uppercase text-gray-500">Résultat net</div>
          <div className="mt-1 text-2xl font-bold">{totalResultatNet.toFixed(2)} €</div>
        </div>
      </div>

      <input
        type="search"
        value={recherche}
        onChange={(event) => setRecherche(event.target.value)}
        placeholder="Rechercher un lot ou un bâtiment"
        className="w-full rounded border bg-white p-3 md:max-w-md"
      />

      <div className="space-y-3 md:hidden">
        {lotsAffiches.length === 0 && (
          <div className="rounded-lg border bg-white p-6 text-center text-gray-500">
            Aucun lot archivé à afficher.
          </div>
        )}
        {lotsAffiches.map((lot) => {
          const quantiteLivree = lot.livraisons.reduce(
            (total, livraison) => total + livraison.quantite,
            0
          );
          return (
            <article key={lot.id} className="rounded-lg border bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">{lot.nom}</h2>
                  <p className="text-sm text-gray-600">
                    {lot.batiment} · {new Date(lot.date_arrivee).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <span
                  className="h-7 w-7 rounded-full border"
                  style={{ backgroundColor: lot.couleur || '#999999' }}
                />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded border p-3">
                  <div className="text-gray-500">Livrés</div>
                  <div className="font-semibold">{quantiteLivree}</div>
                </div>
                <div className="rounded border p-3">
                  <div className="text-gray-500">Âge à la clôture</div>
                  <div className="font-semibold">{lot.age || 0} jours</div>
                </div>
                <div className="rounded border p-3">
                  <div className="text-gray-500">Poids</div>
                  <div className="font-semibold">{Number(lot.total_poids_livre || 0).toFixed(2)} kg</div>
                </div>
                <div className="rounded border p-3">
                  <div className="text-gray-500">Résultat brut</div>
                  <div className="font-semibold">{lot.resultat_brut || 0} €</div>
                </div>
                <div className="rounded border p-3">
                  <div className="text-gray-500">Résultat net</div>
                  <div className="font-semibold">{lot.resultat_net || 0} €</div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  onClick={() => setDetailLot(lot)}
                  className="!bg-slate-700 !text-white rounded px-3 py-2"
                >
                  Voir la fiche
                </button>
                <button
                  onClick={() => reactiverLot(lot)}
                  disabled={saving}
                  className="!bg-emerald-600 !text-white rounded px-3 py-2 disabled:opacity-60"
                >
                  Réactiver
                </button>
                <button
                  onClick={() => supprimerLot(lot)}
                  disabled={saving}
                  className="col-span-2 rounded !bg-red-700 px-3 py-2 !text-white disabled:opacity-60"
                >
                  × Supprimer le lot
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {/* Table */}
      <div className="hidden overflow-x-auto rounded border md:block">
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
              <th className="px-3 py-2 border">Actions</th>
            </tr>
          </thead>
          <tbody>
            {lotsAffiches.length === 0 && (
              <tr>
                <td colSpan={12} className="border p-6 text-center text-gray-500">
                  Aucun lot archivé à afficher.
                </td>
              </tr>
            )}
            {lotsAffiches.map((lot) => (
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
                <td className="border px-3 py-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setDetailLot(lot)}
                      className="!bg-slate-700 !text-white rounded px-3 py-2 text-xs"
                    >
                      Fiche
                    </button>
                    <button
                      onClick={() => reactiverLot(lot)}
                      disabled={saving}
                      className="!bg-emerald-600 !text-white rounded px-3 py-2 text-xs disabled:opacity-60"
                    >
                      Réactiver
                    </button>
                    <button
                      onClick={() => supprimerLot(lot)}
                      disabled={saving}
                      className="rounded !bg-red-700 px-3 py-2 text-xs !text-white disabled:opacity-60"
                      title="Supprimer définitivement le lot"
                    >
                      ×
                    </button>
                  </div>
                </td>
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
              <td className="px-3 py-2 border">—</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {detailLot && (() => {
        const totalMortalites = detailLot.mortalites.reduce(
          (total, mortalite) => total + mortalite.nombre,
          0
        );
        const quantiteLivree = detailLot.livraisons.reduce(
          (total, livraison) => total + livraison.quantite,
          0
        );

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-white p-6 shadow-lg">
              <ModalCloseButton onClick={() => setDetailLot(null)} disabled={saving} />
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="pr-12">
                  <h2 className="text-2xl font-bold">{detailLot.nom}</h2>
                  <p className="text-sm text-gray-600">
                    {detailLot.batiment} · arrivé le{' '}
                    {new Date(detailLot.date_arrivee).toLocaleDateString('fr-FR')} ·
                    {' '}{detailLot.age || 0} jours à la clôture
                  </p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="rounded border p-3">
                  <div className="text-xs uppercase text-gray-500">Quantité initiale</div>
                  <div className="text-xl font-bold">{detailLot.quantite}</div>
                </div>
                <div className="rounded border p-3">
                  <div className="text-xs uppercase text-gray-500">Mortalités</div>
                  <div className="text-xl font-bold">{totalMortalites}</div>
                </div>
                <div className="rounded border p-3">
                  <div className="text-xs uppercase text-gray-500">Quantité livrée</div>
                  <div className="text-xl font-bold">{quantiteLivree}</div>
                </div>
                <div className="rounded border p-3">
                  <div className="text-xs uppercase text-gray-500">Poids livré</div>
                  <div className="text-xl font-bold">
                    {Number(detailLot.total_poids_livre || 0).toFixed(2)} kg
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <section className="rounded border p-4">
                  <h3 className="font-semibold">Mortalités</h3>
                  {detailLot.mortalites.length === 0 ? (
                    <p className="mt-2 text-sm text-gray-500">Aucune mortalité enregistrée.</p>
                  ) : (
                    <div className="mt-3 max-h-56 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="py-2 text-left">Date</th>
                            <th className="py-2 text-right">Nombre</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detailLot.mortalites.map((mortalite) => (
                            <tr key={mortalite.id} className="border-b">
                              <td className="py-2">{mortalite.date}</td>
                              <td className="py-2 text-right">{mortalite.nombre}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                <section className="rounded border p-4">
                  <h3 className="font-semibold">Livraisons</h3>
                  {detailLot.livraisons.length === 0 ? (
                    <p className="mt-2 text-sm text-gray-500">Aucune livraison enregistrée.</p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {detailLot.livraisons.map((livraison, index) => (
                        <div key={livraison.id} className="rounded bg-gray-50 p-3 text-sm">
                          <div className="font-medium">Livraison {index + 1}</div>
                          <div>Date : {livraison.date}</div>
                          <div>Quantité : {livraison.quantite}</div>
                          <div>Poids : {livraison.poids.toFixed(2)} kg</div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>

              <div className="mt-5 rounded border p-4">
                <h3 className="font-semibold">Résultats</h3>
                <div className="mt-3 grid gap-3 text-sm md:grid-cols-4">
                  <div>Autoconsommation : {detailLot.autoconsommation || 0}</div>
                  <div>Quantité retenue : {detailLot.quantite_retenue || 0}</div>
                  <div>Résultat brut : {detailLot.resultat_brut || 0} €</div>
                  <div>Résultat net : {detailLot.resultat_net || 0} €</div>
                </div>
              </div>

              <div className="mt-5 flex flex-col-reverse gap-2 md:flex-row md:justify-end">
                <button
                  onClick={() => reactiverLot(detailLot)}
                  disabled={saving}
                  className="!bg-emerald-600 !text-white rounded px-4 py-2 disabled:opacity-60"
                >
                  Réactiver ce lot
                </button>
                <button
                  onClick={() => supprimerLot(detailLot)}
                  disabled={saving}
                  className="rounded !bg-red-700 px-4 py-2 !text-white disabled:opacity-60"
                >
                  × Supprimer le lot
                </button>
              </div>
            </div>
          </div>
        );
      })()}
      
      <div>
      <Charges
        lotIdsFiltres={lotsAffiches.map((lot) => lot.id)}
      />
      </div>

     {/* Modale Résultat Net */}
     {showResultatNetModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="relative bg-white p-6 rounded shadow-lg w-full max-w-md">
            <ModalCloseButton
              onClick={() => {
                setShowResultatNetModal(false);
                setSelectedLot(null);
                setResultatNetInput('');
              }}
              disabled={saving}
            />
            <h2 className="pr-12 text-lg font-bold mb-4">Saisir le Résultat Net</h2>
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
                className="!bg-green-600 !text-white p-2 rounded w-full disabled:opacity-60"
                disabled={saving}
                onClick={() => {
                  if (selectedLot && resultatNetInput !== '') {
                    handleSaveResultatNet(selectedLot.id, parseFloat(resultatNetInput));
                  }
                }}
              >
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
              </>
            )}

            <button
              onClick={() => {
                setShowResultatNetModal(false);
                setSelectedLot(null);
                setResultatNetInput('');
              }}
              disabled={saving}
              className="mt-2 p-2 w-full !bg-gray-200 !text-gray-900 rounded disabled:opacity-60"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Modale Quantité Retenue */}
      {showQuantiteRetenueModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="relative bg-white p-6 rounded shadow-lg w-full max-w-md">
            <ModalCloseButton
              onClick={() => {
                setShowQuantiteRetenueModal(false);
                setSelectedLot(null);
                setQuantiteRetenueInput('');
              }}
              disabled={saving}
            />
            <h2 className="pr-12 text-lg font-bold mb-4">Saisir la Quantité Retenue</h2>
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
                className="!bg-blue-600 !text-white p-2 rounded w-full disabled:opacity-60"
                disabled={saving}
                onClick={() => {
                  if (selectedLot && quantiteRetenueInput !== '') {
                    handleSaveQuantiteRetenue(selectedLot.id, parseFloat(quantiteRetenueInput));
                  }
                }}
              >
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
              </>
            )}

            <button
              onClick={() => {
                setShowQuantiteRetenueModal(false);
                setSelectedLot(null);
                setQuantiteRetenueInput('');
              }}
              disabled={saving}
              className="mt-2 p-2 w-full !bg-gray-200 !text-gray-900 rounded disabled:opacity-60"
            >
              Annuler
            </button>
          </div>
        </div>
      )}



    </div>
  );
}
