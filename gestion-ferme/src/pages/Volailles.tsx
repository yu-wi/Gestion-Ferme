import { useState, useEffect  } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { supabase } from "../supabaseClient";
import { exportToExcel } from "../outils/exportToExcel"
import toast from 'react-hot-toast';

interface Mortalite { date: string; nombre: number; }
interface Evenement { title: string; date: Date; }
interface LotVolaille {
id: string; nom: string; quantite: number; dateArrivee: string;
batiment: string; mortalites: Mortalite[]; evenements: Evenement[];
couleur: string; age: number; autoconsommation?: number;
is_active?: boolean;
}


function Volailles() {
const [lots, setLots] = useState<LotVolaille[]>([]);
const [nom, setNom] = useState('');
const [quantite, setQuantite] = useState<number>(0);
const [dateArrivee, setDateArrivee] = useState('');
const [batiment, setBatiment] = useState('');
const [searchNom, setSearchNom] = useState('');
const [searchBatiment, setSearchBatiment] = useState('');


const [mortaliteModalOpen, setMortaliteModalOpen] = useState(false);
const [mortaliteLotId, setMortaliteLotId] = useState<string | null>(null);
const [mortaliteDate, setMortaliteDate] = useState('');
const [mortaliteNombre, setMortaliteNombre] = useState(0);


const [mortaliteDetailsModalOpen, setMortaliteDetailsModalOpen] = useState(false);
const [mortaliteDetailsLotId, setMortaliteDetailsLotId] = useState<string | null>(null);


const [sortColumn, setSortColumn] = useState<string>('nom');
const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

const [selectedLot, setSelectedLot] = useState<any>(null);
const [livraisons, setLivraisons] = useState([
  { date: '', quantite: '', poids: '' },
]);
const [showLivraisonModal, setShowLivraisonModal] = useState(false);

const [venteModalOpen, setVenteModalOpen] = useState(false);
const [factureDate, setFactureDate] = useState('');
const [resultatBrut, setResultatBrut] = useState('');
const [saving, setSaving] = useState(false);

const [showAutoconsommationModal, setShowAutoconsommationModal] = useState(false);
  const [quantiteAutoconsommationInput, setQuantiteAutoconsommationInput] = useState('');

// Charger les lots existants
useEffect(() => {
 const fetchLots = async () => {
   const { data, error } = await supabase.from('lots_volailles').select('*')
   .eq('is_active', true);
   if (error) {
     console.error('Erreur chargement des lots', error);
   } else {
     const lotsTransformés = (data || []).map((lot: any) => ({
       ...lot,
       evenements: (lot.evenements || []).map((e: any) => ({
         ...e,
         date: new Date(e.date),
       })),
       dateArrivee: lot.date_arrivee,
     }));
     setLots(lotsTransformés);
   }
 };
 fetchLots();
}, []);

 // Générer une couleur aléatoire
 const genererCouleurAleatoire = () => {
   const lettres = '0123456789ABCDEF';
   let couleur = '#';
   for (let i = 0; i < 6; i++) {
     couleur += lettres[Math.floor(Math.random() * 16)];
   }
   return couleur;
 };

// Filtre les lots par nom et bâtiment
const filteredLots = lots.filter(lot => {
 return (
   lot.nom.toLowerCase().includes(searchNom.toLowerCase()) &&
   lot.batiment.toLowerCase().includes(searchBatiment.toLowerCase())
 );
});

// Trie les lots en fonction de la colonne et de l'ordre
const sortedLots = [...filteredLots].sort((a, b) => {
 const valA = a[sortColumn as keyof LotVolaille];
 const valB = b[sortColumn as keyof LotVolaille];
 if (typeof valA === 'string' && typeof valB === 'string') {
   return sortOrder === 'asc'
     ? valA.localeCompare(valB)
     : valB.localeCompare(valA);
 }
 if (typeof valA === 'number' && typeof valB === 'number') {
   return sortOrder === 'asc' ? valA - valB : valB - valA;
 }
 return 0;
});

// Calcul des dates des événements
const ajouterLot = async () => {
 if (saving) return;
 if (!nom.trim() || quantite <= 0 || !dateArrivee || !batiment.trim()) {
   toast.error('Complétez le nom, la quantité, la date et le bâtiment.');
   return;
 }

 setSaving(true);

 const id = crypto.randomUUID();
 const dateArriveeDate = new Date(dateArrivee);
 const couleur = genererCouleurAleatoire();
 const now = new Date();
  const ageCalcule = Math.floor((now.getTime() - dateArriveeDate.getTime()) / (1000 * 60 * 60 * 24));
  const sujetsRestants = quantite; // Aucun mort au début


 const evenementDates = {
   reception: new Date(dateArriveeDate.getTime()),  // J+0
   ouverturePoussiniere: new Date(dateArriveeDate.getTime() + 15 * 86400000),  // J+15
   vaccin: new Date(dateArriveeDate.getTime() + 15 * 86400000),               // J+15
   rappelVaccin: new Date(dateArriveeDate.getTime() + 25 * 86400000),         // J+25
   dateAnalyse: new Date(dateArriveeDate.getTime() + 47 * 86400000),          // J+47
   livraison: new Date(dateArriveeDate.getTime() + 70 * 86400000),            // J+70
 };


 const nouveauxEvenements: Evenement[] = [
   { title: "Réception", date: evenementDates.reception },
   { title: "Ouverture poussinière", date: evenementDates.ouverturePoussiniere },
   { title: "Vaccin", date: evenementDates.vaccin },
   { title: "Rappel vaccin", date: evenementDates.rappelVaccin },
   { title: "Date analyse", date: evenementDates.dateAnalyse },
   { title: "Livraison", date: evenementDates.livraison },
 ];


 const nouveauLot: LotVolaille = {
   id,
   nom,
   quantite,
   age: ageCalcule,
   dateArrivee,
   batiment,
   mortalites: [],
   evenements: nouveauxEvenements,
   couleur,
   is_active: true,
 };


 const { error } = await supabase.from('lots_volailles').insert({
   id,
   nom,
   quantite,
   age: ageCalcule,
   date_arrivee: dateArrivee,
   batiment,
   mortalites: [],
   evenements: nouveauxEvenements.map(e => ({ title: e.title, date: e.date.toISOString().split('T')[0] })),
   couleur,
   sujets_restants: sujetsRestants,
   is_active: true
 });


 if (error) {
   console.error('Erreur lors de l’ajout du lot à Supabase :', error.message);
   toast.error("Le lot n'a pas pu être enregistré.");
  } else {
   setLots([...lots, nouveauLot]);
   setNom('');
   setQuantite(0);
   setDateArrivee('');
   setBatiment('');
   toast.success('Lot enregistré.');
  }
  setSaving(false);
};




const ouvrirMortaliteModal = (lotId: string) => {
 setMortaliteLotId(lotId);
 setMortaliteDate('');
 setMortaliteNombre(0);
 setMortaliteModalOpen(true);
};


const enregistrerMortalite = async () => {
  if (saving) return;
  if (!mortaliteLotId || !mortaliteDate || mortaliteNombre <= 0) {
    toast.error('Indiquez une date et un nombre positif.');
    return;
  }

  const lot = lots.find((l) => l.id === mortaliteLotId);
  if (!lot) return;
  setSaving(true);

  const nouvelleMortalite = { date: mortaliteDate, nombre: mortaliteNombre };
  const nouvellesMortalites = [...lot.mortalites, nouvelleMortalite];

  // Calculs
  const totalMortalites = nouvellesMortalites.reduce((sum, m) => sum + m.nombre, 0);
  const sujetsRestants = lot.quantite - totalMortalites - (lot.autoconsommation || 0); // si autoconsommation existe

  // Mise à jour sur Supabase
  const { data, error } = await supabase
    .from('lots_volailles')
    .update({
      mortalites: nouvellesMortalites,
      nb_morts: totalMortalites,
      sujets_restants: sujetsRestants,
    })
    .eq('id', mortaliteLotId)
    .select('*'); // pour récupérer les données à jour

  if (error) {
    console.error('Erreur ajout mortalité Supabase:', error);
    toast.error("La mortalité n'a pas pu être enregistrée.");
  } else if (data && data.length > 0) {
    const updatedLot = data[0];

    // Mise à jour locale avec toutes les nouvelles données
    setLots((prevLots) =>
      prevLots.map((l) => (l.id === mortaliteLotId ? { ...l, ...updatedLot } : l))
    );

    setMortaliteModalOpen(false);
    setMortaliteNombre(0);
    setMortaliteDate('');
    setMortaliteLotId(null);
    toast.success('Mortalité enregistrée.');
  }
  setSaving(false);
};




const handleSort = (column: string) => {
 const newSortOrder = sortColumn === column && sortOrder === 'asc' ? 'desc' : 'asc';
 setSortColumn(column);
 setSortOrder(newSortOrder);
};


// Affiche les détails des mortalités
const ouvrirMortaliteDetailsModal = (lotId: string) => {
 setMortaliteDetailsLotId(lotId);
 setMortaliteDetailsModalOpen(true);
};


const fermerMortaliteDetailsModal = () => {
 setMortaliteDetailsModalOpen(false);
};

// Affiche les sujets restants
const calculerSujetsRestants = (lot: LotVolaille) => {
  const quantiteInitiale = lot.quantite ?? 0;
  const totalMortalites = Array.isArray(lot.mortalites)
    ? lot.mortalites.reduce((sum, m) => sum + (m.nombre ?? 0), 0)
    : 0;
  const totalAutoconsommation = lot.autoconsommation ?? 0;

  return quantiteInitiale - totalMortalites - totalAutoconsommation;
};



// Calcule les événements à afficher dans le calendrier
const obtenirEvenements = () => {
 return lots.flatMap(lot =>
   lot.evenements.map(evenement => ({
    date: new Date(evenement.date).toISOString(),
     title: evenement.title,
     lotId: lot.id,
     couleur: lot.couleur,
   }))
 );
};
useEffect(() => {
 console.log("Le calendrier a été mis à jour !");
}, [lots]);  

// Fonction pour marquer les événements dans le calendrier
const formatUTCDate = (d: Date) =>
  `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;

const marquerEvenements = (date: Date) => {
 const eventsOnThisDate = obtenirEvenements().filter(evenement => {
   const eventDate = new Date(evenement.date);
   return formatUTCDate(eventDate) === formatUTCDate(date);
 });
  return (
   <div className="space-y-1">
     {eventsOnThisDate.map(evenement => (
       <div
         key={evenement.lotId + evenement.title}
         style={{
           backgroundColor: evenement.couleur,
           color: 'white',
           padding: '2px 4px',
           borderRadius: '4px',
           fontSize: '0.75rem',
           marginBottom: '2px',
         }}
       >
         {evenement.title}
       </div>
     ))}
   </div>
 );
};

 // Fonction pour ajouter une nouvelle livraison
 const addLivraison = () => {
  setLivraisons([...livraisons, { date: '', quantite: '', poids: '' }]);
};

// Fonction pour gérer les changements dans un champ spécifique d'une livraison
type Livraison = {
  date: string;
  quantite: string;
  poids: string;
};

type LivraisonKey = keyof Livraison; // "date" | "quantite" | "poids"

const handleInputChange = (
  index: number,
  field: LivraisonKey,
  value: string
) => {
  const updatedLivraisons = [...livraisons];
  updatedLivraisons[index][field] = value;
  setLivraisons(updatedLivraisons);
};


// Fonction pour enregistrer les livraisons
const handleSaveLivraison = async () => {
  if (saving) return false;
  if (!selectedLot || !selectedLot.id) {
    console.error("Aucun lot sélectionné pour la livraison.");
    toast.error('Sélectionnez un lot.');
    return false;
  }

  const hasValidLivraison = livraisons.some((livraison) =>
    livraison.date &&
    Number(livraison.quantite) > 0 &&
    Number(livraison.poids) > 0
  );

  if (!hasValidLivraison) {
    toast.error('Renseignez au moins une livraison complète.');
    return false;
  }

  try {
    setSaving(true);
    const livraisonFields = Object.fromEntries(
      livraisons.flatMap((livraison, index) => [
        [`livraison_${index + 1}_date`, livraison.date || null],
        [`livraison_${index + 1}_quantite`, livraison.quantite ? parseFloat(livraison.quantite) : 0],
        [`livraison_${index + 1}_poids`, livraison.poids ? parseFloat(livraison.poids) : 0],
      ])
    );

    const livraisonData = {
      id: selectedLot.id,
      nom: selectedLot.nom, 
      quantite: selectedLot.quantite,
      date_arrivee: selectedLot.dateArrivee,
      batiment: selectedLot.batiment,
      ...livraisonFields,
    };

    const { data, error } = await supabase
      .from('lots_volailles')
      .upsert([livraisonData]);

    if (error) {
      console.error('Erreur Supabase:', error);
      toast.error("La livraison n'a pas pu être enregistrée.");
      return false;
    } else {
      console.log('Livraisons enregistrées:', data);
      toast.success('Livraison enregistrée.');
      return true;
    }
  } catch (error) {
    console.error("Erreur lors de l'enregistrement de la livraison", error);
    toast.error("La livraison n'a pas pu être enregistrée.");
    return false;
  } finally {
    setSaving(false);
  }
};

// Fonction pour archiver un lot
const archiverLot = async (lotId: string) => {
  if (saving) return;
  try {
    setSaving(true);
    const { error } = await supabase
      .from('lots_volailles')
      .update({ is_active: false })
      .eq('id', lotId);

    if (error) {
      toast.error("Le lot n'a pas pu être archivé.");
      return;
    }

    setLots((prevLots) => prevLots.filter((lot) => lot.id !== lotId));

    toast.success('Lot archivé.');

  } catch (err) {
    console.error("Erreur inconnue lors de l'archivage :", err);
    toast.error("Le lot n'a pas pu être archivé.");
  } finally {
    setSaving(false);
  }
};

// Fonction pour enregister autoconsommation 
const handleSaveAutoconsommation = async () => {
  if (saving) return;
  if (!selectedLot || !quantiteAutoconsommationInput) {
    toast.error('Sélectionnez un lot et une quantité.');
    return;
  }

  const autoconsommation = parseFloat(quantiteAutoconsommationInput);
  if (!Number.isFinite(autoconsommation) || autoconsommation <= 0) {
    toast.error('La quantité doit être positive.');
    return;
  }

  setSaving(true);
  const quantite = selectedLot.quantite || 0;
  const nb_morts = selectedLot.nb_morts || 0;
  const sujets_restants = quantite - nb_morts - autoconsommation;

  const { data, error } = await supabase
    .from('lots_volailles')
    .update({
      autoconsommation,
      sujets_restants
    })
    .eq('id', selectedLot.id)
    .select('*');

  if (error) {
    console.error("Erreur lors de l'enregistrement de l'autoconsommation", error);
    toast.error("L'autoconsommation n'a pas pu être enregistrée.");
  } else if (data && data.length > 0) {
    const updatedLot = data[0];

    setLots((prevLots) =>
      prevLots.map((lot) =>
        lot.id === updatedLot.id ? { ...lot, ...updatedLot } : lot
      )
    );

    setShowAutoconsommationModal(false);
    setSelectedLot(null);
    setQuantiteAutoconsommationInput('');
    toast.success('Autoconsommation enregistrée.');
  }
  setSaving(false);
};


// Fonction pour enregistrer vente un lot
const handleEnregistrerVente = async () => {
  if (saving) return;
  if (!selectedLot || !selectedLot.id) {
    console.error("Aucun lot sélectionné.");
    toast.error('Sélectionnez un lot.');
    return;
  }

  if (!resultatBrut || Number(resultatBrut) <= 0) {
    toast.error('Indiquez un montant brut positif.');
    return;
  }

  try {
    setSaving(true);
    const { data, error } = await supabase
      .from('lots_volailles')
      .update({
        facture_date: factureDate || null,
        resultat_brut: resultatBrut ? parseFloat(resultatBrut) : null,
      })
      .eq('id', selectedLot.id);

    if (error) {
      console.error('Erreur enregistrement vente :', error.message);
      toast.error("La vente n'a pas pu être enregistrée.");
    } else {
      console.log('Vente enregistrée :', data);
      setVenteModalOpen(false);
      toast.success('Vente enregistrée.');
    }
  } catch (err) {
    console.error('Erreur inattendue :', err);
    toast.error("La vente n'a pas pu être enregistrée.");
  } finally {
    setSaving(false);
  }
};

const totalInitial = lots.reduce((sum, lot) => sum + (lot.quantite || 0), 0);
const totalRestants = lots.reduce((sum, lot) => sum + calculerSujetsRestants(lot), 0);
const totalMorts = lots.reduce((sum, lot) => {
  const mortalites = Array.isArray(lot.mortalites) ? lot.mortalites : [];
  return sum + mortalites.reduce((mortSum, mort) => mortSum + (mort.nombre || 0), 0);
}, 0);


return (
 <div className="p-4 space-y-6">
   <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
     <div>
       <h1 className="text-2xl font-bold">Gestion des Volailles</h1>
       <p className="text-sm text-gray-600">Lots actifs, planning sanitaire, livraisons et ventes.</p>
     </div>
     <div className="flex flex-wrap gap-2">
       <button className="bg-green-500 text-black px-4 py-2 rounded" onClick={() => setShowAutoconsommationModal(true)}>Autoconsommation</button>
       <button className="bg-slate-700 text-white px-4 py-2 rounded" onClick={() => exportToExcel(filteredLots)}>
         Exporter en Excel
       </button>
     </div>
   </div>

   <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
     <div className="rounded-lg border bg-white p-4 shadow-sm">
       <div className="text-xs uppercase text-gray-500">Lots actifs</div>
       <div className="mt-1 text-2xl font-bold">{lots.length}</div>
     </div>
     <div className="rounded-lg border bg-white p-4 shadow-sm">
       <div className="text-xs uppercase text-gray-500">Sujets initiaux</div>
       <div className="mt-1 text-2xl font-bold">{totalInitial}</div>
     </div>
     <div className="rounded-lg border bg-white p-4 shadow-sm">
       <div className="text-xs uppercase text-gray-500">Sujets restants</div>
       <div className="mt-1 text-2xl font-bold">{totalRestants}</div>
     </div>
     <div className="rounded-lg border bg-white p-4 shadow-sm">
       <div className="text-xs uppercase text-gray-500">Mortalités</div>
       <div className="mt-1 text-2xl font-bold">{totalMorts}</div>
     </div>
   </div>

   {/* Formulaire ajout */}
   <div className="rounded-lg border bg-white p-4 shadow-sm">
     <h2 className="mb-3 text-lg font-semibold">Nouveau lot</h2>
     <div className="grid gap-3 md:grid-cols-5">
       <label className="text-left text-sm font-medium text-gray-700">
         Nom
         <input type="text" placeholder="Ex. Lot 12" value={nom} onChange={e => setNom(e.target.value)} className="mt-1 w-full border p-2 rounded" />
       </label>
       <label className="text-left text-sm font-medium text-gray-700">
         Quantité
         <input type="number" min={1} placeholder="0" value={quantite} onChange={e => setQuantite(+e.target.value)} className="mt-1 w-full border p-2 rounded" />
       </label>
       <label className="text-left text-sm font-medium text-gray-700">
         Date arrivée
         <input type="date" value={dateArrivee} onChange={e => setDateArrivee(e.target.value)} className="mt-1 w-full border p-2 rounded" />
       </label>
       <label className="text-left text-sm font-medium text-gray-700">
         Bâtiment
         <input type="text" placeholder="Ex. B1" value={batiment} onChange={e => setBatiment(e.target.value)} className="mt-1 w-full border p-2 rounded" />
       </label>
       <button onClick={ajouterLot} disabled={saving} className="self-end bg-blue-600 text-white p-2 rounded disabled:opacity-60">
       {saving ? 'Enregistrement...' : 'Ajouter Lot'}
       </button>
     </div>
   </div>


  <div className="rounded-lg border bg-white p-4 shadow-sm">
    <h2 className="mb-3 text-lg font-semibold">Calendrier des lots</h2>
  <div className="flex flex-col md:flex-row md:items-center gap-8 mx-auto">
    {/* Calendrier */}
    <div className="w-full md:w-3/4">
      <Calendar
        tileContent={({ date }) => (
          <div>{marquerEvenements(date)}</div>
        )}
      />
    </div>
  </div>
  </div>



{/* Tableaux et autres fonctionnalités */}
<div className="rounded-lg border bg-white p-4 shadow-sm">
  <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
    <h2 className="text-lg font-semibold">Lots en cours</h2>
    <div className="flex flex-col md:flex-row gap-3 md:w-2/3">
    <input
      type="text"
      placeholder="Rechercher par nom"
      value={searchNom}
      onChange={e => setSearchNom(e.target.value)}
      className="border p-2 rounded w-full"
    />
    <input
      type="text"
      placeholder="Rechercher par bâtiment"
      value={searchBatiment}
      onChange={e => setSearchBatiment(e.target.value)}
      className="border p-2 rounded w-full"
    />
    </div>
  </div>

<div className="overflow-x-auto border rounded">   
<table className="min-w-full table-auto border-collapse text-sm">
 <thead className="bg-gray-100">
   <tr>
     <th className="border p-2">Couleur</th>
     <th onClick={() => handleSort('nom')} className="border p-2 cursor-pointer">Nom</th>
     <th onClick={() => handleSort('dateArrivee')} className="border p-2 cursor-pointer">Date Arrivée</th>
     <th className="border p-2">Âge (jours)</th>
     <th onClick={() => handleSort('quantite')} className="border p-2 cursor-pointer">Quantité</th>
     <th className="border p-2">Sujets restants</th>
     <th onClick={() => handleSort('batiment')} className="border p-2 cursor-pointer">Bâtiment</th>
     <th className="border p-2">Actions</th>
   </tr>
 </thead>
 <tbody>
   {sortedLots.length === 0 && (
     <tr>
       <td className="border p-6 text-center text-gray-500" colSpan={8}>
         Aucun lot actif à afficher.
       </td>
     </tr>
   )}
   {sortedLots.map(lot => {
     const sujetsRestants = calculerSujetsRestants(lot);
     const ratio = sujetsRestants / lot.quantite;     

     let badgeColor = 'bg-green-500';
     if (ratio < 0.25) badgeColor = 'bg-red-500';
     else if (ratio < 0.5) badgeColor = 'bg-orange-500';


     // Calcul de l'âge en jours
     const ageJours = Math.floor(
      (new Date().getTime() - new Date(lot.dateArrivee).getTime()) / (1000 * 60 * 60 * 24)
    );    


     return (
       <tr key={lot.id} className="odd:bg-white even:bg-gray-50">
         <td
           className="border p-2"
           style={{
             backgroundColor: lot.couleur?.trim() || '#999999',
           }}
           title={lot.couleur || 'Couleur non définie'}
         ></td>
         <td className="border p-2">{lot.nom}</td>
         <td className="border p-2">{lot.dateArrivee}</td>
         <td className="border p-2">{ageJours}</td>
         <td className="border p-2">{lot.quantite}</td>
         <td className="border p-2">
           <span className={`text-white px-2 py-1 rounded text-xs ${badgeColor}`}>
             {sujetsRestants}
           </span>
         </td>
         <td className="border p-2">{lot.batiment}</td>
         <td className="border p-2">
          <div className="flex flex-wrap gap-2">
         <button onClick={() => ouvrirMortaliteModal(lot.id)} className="bg-green-600 text-white px-3 py-2 rounded" title="Ajouter une mortalité">
            Mortalité
           </button>
           <button onClick={() => ouvrirMortaliteDetailsModal(lot.id)} className="bg-purple-600 text-white px-3 py-2 rounded" title="Voir les mortalités">
           Détails
           </button>
          <button onClick={() => {
                setSelectedLot(lot);
                setLivraisons([{ date: '', quantite: '', poids: '' }]);
                setShowLivraisonModal(true);
              }}
              className="bg-sky-600 text-white px-3 py-2 rounded"
              title="Ajouter une livraison"
            >
                Livraison
          </button>
           <button onClick={() => {setSelectedLot(lot);setVenteModalOpen(true);}}
            className="bg-yellow-500 text-black px-3 py-2 rounded"
            title="Enregistrer une vente"
          >
            Vente
          </button>

            <button
              onClick={() => archiverLot(lot.id)}
              disabled={saving}
              className="bg-gray-700 text-white px-3 py-2 rounded disabled:opacity-60"
              title="Archiver le lot"
            >
              Archiver
            </button>
            </div>
         </td>
       </tr>
     );
   })}
 </tbody>
</table>

</div>
</div>

   {/* Modale pour enregistrer les livraisons */}
{showLivraisonModal && (
  <div className="fixed inset-0 bg-gray-500 bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-xl max-h-[90vh] overflow-y-auto">
      <h2 className="text-xl font-semibold mb-1">Ajouter une ou plusieurs livraisons</h2>
      {selectedLot && <p className="mb-4 text-sm text-gray-600">{selectedLot.nom}</p>}

      {livraisons.map((livraison, index) => (
        <div key={index} className="mb-4 border-b pb-4">
          <label className="block mb-1">Date de livraison</label>
          <input
            type="date"
            value={livraison.date}
            onChange={(e) => handleInputChange(index, 'date', e.target.value)}
            className="border p-2 rounded mb-2 w-full"
          />

          <label className="block mb-1">Quantité (unités)</label>
          <input
            type="number"
            step="1"
            value={livraison.quantite}
            onChange={(e) => handleInputChange(index, 'quantite', e.target.value)}
            className="border p-2 rounded mb-2 w-full"
          />

          <label className="block mb-1">Poids (kg)</label>
          <input
            type="number"
            step="0.01"
            value={livraison.poids}
            onChange={(e) => handleInputChange(index, 'poids', e.target.value)}
            className="border p-2 rounded w-full"
          />
        </div>
      ))}

      <button
        onClick={addLivraison}
        className="bg-green-500 text-black p-2 rounded w-full mb-2"
      >
        + Ajouter une livraison
      </button>

      <button
        onClick={async () => {
          const saved = await handleSaveLivraison();
          if (saved) setShowLivraisonModal(false);
        }}
        disabled={saving}
        className="bg-blue-500 text-black p-2 rounded w-full disabled:opacity-60"
      >
        {saving ? 'Enregistrement...' : '💾 Enregistrer les livraisons'}
      </button>

      <button onClick={() => setShowLivraisonModal(false)} className="bg-gray-500 text-black p-2 rounded w-full mt-2">
        Annuler
      </button>
    </div>
  </div>
)}



   {/* Modale pour saisir une mortalité */}
   {mortaliteModalOpen && (
     <div className="fixed inset-0 bg-gray-500 bg-opacity-50 flex items-center justify-center p-4">
       <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
         <h2 className="text-xl font-semibold mb-1">Ajouter une mortalité</h2>
         <p className="mb-4 text-sm text-gray-600">{lots.find((lot) => lot.id === mortaliteLotId)?.nom}</p>
         <input type="date" value={mortaliteDate} onChange={e => setMortaliteDate(e.target.value)} className="border p-2 rounded mb-2 w-full" />
         <input type="number" value={mortaliteNombre} onChange={e => setMortaliteNombre(+e.target.value)} className="border p-2 rounded mb-4 w-full" />
         <button onClick={enregistrerMortalite} disabled={saving} className="bg-blue-500 text-black p-2 rounded w-full disabled:opacity-60">
           {saving ? 'Enregistrement...' : 'Enregistrer'}
         </button>
         <button onClick={() => setMortaliteModalOpen(false)} className="bg-gray-500 text-black p-2 rounded w-full mt-2">Annuler</button>
       </div>
     </div>
   )}


   {/* Modale pour afficher les détails de la mortalité */}
{mortaliteDetailsModalOpen && mortaliteDetailsLotId && (
 <div className="fixed inset-0 bg-gray-500 bg-opacity-50 flex items-center justify-center z-50 p-4">
   <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-3xl max-h-[80vh] overflow-auto">
     <h2 className="text-xl font-semibold mb-1">Détails des Mortalités</h2>
     <p className="mb-4 text-sm text-gray-600">{lots.find((lot) => lot.id === mortaliteDetailsLotId)?.nom}</p>
     <table className="w-full border-collapse">
       <thead>
         <tr className="bg-gray-100">
           <th className="border px-4 py-2 text-left">Date</th>
           <th className="border px-4 py-2 text-left">Nombre</th>
         </tr>
       </thead>
       <tbody>
         {lots
           .find(lot => lot.id === mortaliteDetailsLotId)?.mortalites
           .map((mortalite, index) => (
             <tr key={index} className="hover:bg-gray-50">
               <td className="border px-4 py-2">{mortalite.date}</td>
               <td className="border px-4 py-2">{mortalite.nombre}</td>
             </tr>
           ))}
         {/* Ligne de total */}
         <tr className="bg-gray-200 font-semibold">
           <td className="border px-4 py-2">Total</td>
           <td className="border px-4 py-2">
             {
               lots.find(lot => lot.id === mortaliteDetailsLotId)?.mortalites
                 .reduce((total, mort) => total + mort.nombre, 0)
             }
           </td>
         </tr>
       </tbody>
     </table>


     <button
       onClick={fermerMortaliteDetailsModal}
       className="bg-gray-700 text-white mt-6 px-4 py-2 rounded hover:bg-gray-800"
     >
       Fermer
     </button>
   </div>
 </div>
)}
   {/* Modale pour enregistrer la vente*/}
{venteModalOpen && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div className="bg-white p-6 rounded-lg shadow-md w-full max-w-md">
      <h2 className="text-xl font-semibold mb-1">Enregistrer la vente du lot</h2>
      {selectedLot && <p className="mb-4 text-sm text-gray-600">{selectedLot.nom}</p>}
      <input
        type="date"
        value={factureDate}
        onChange={(e) => setFactureDate(e.target.value)}
        className="w-full p-2 mb-4 border rounded"
        placeholder="Date de facture"
      />
      <input
        type="number"
        value={resultatBrut}
        onChange={(e) => setResultatBrut(e.target.value)}
        className="w-full p-2 mb-4 border rounded"
        placeholder="Montant brut (€)"
      />
      <button
        onClick={handleEnregistrerVente}
        disabled={saving}
        className="w-full bg-green-500 text-black py-2 rounded mb-2 disabled:opacity-60"
      >
        {saving ? 'Enregistrement...' : 'Enregistrer'}
      </button>
      <button
        onClick={() => setVenteModalOpen(false)}
        className="w-full bg-gray-300 text-black py-2 rounded"
      >
        Annuler
      </button>
    </div>
  </div>
)}

{/* Modale Autoconsommation */}
{showAutoconsommationModal && (
  <div className="fixed inset-0 bg-gray-500 bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
      <h2 className="text-lg font-bold mb-4">Saisir la Quantité en Autoconsommation</h2>
      
      <label className="block mb-2 text-sm font-medium text-gray-700">Sélectionner un lot</label>
      <select
        className="w-full p-2 border rounded mb-4"
        value={selectedLot?.id || ''}
        onChange={(e) => {
          const lot = lots.find((l) => l.id === e.target.value);
          setSelectedLot(lot || null);
        }}
      >
        <option value="">-- Choisir un lot --</option>
        {lots.map((lot) => (
          <option key={lot.id} value={lot.id}>
            {lot.nom} (Arrivé le {new Date(lot.dateArrivee).toLocaleDateString('fr-FR', { timeZone: 'UTC' })})
          </option>
        ))}
      </select>

      {selectedLot && (
        <>
          <label className="block mb-2 text-sm font-medium text-gray-700">Quantité Autoconsommée</label>
          <input
            type="number"
            step="0.01"
            placeholder="Quantité autoconsommée"
            value={quantiteAutoconsommationInput}
            onChange={(e) => setQuantiteAutoconsommationInput(e.target.value)}
            className="border p-2 rounded w-full mb-4"
          />
          <button
            onClick={handleSaveAutoconsommation}
            disabled={saving}
            className="bg-green-600 text-black p-2 rounded w-full disabled:opacity-60"
          >
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </>
      )}

      <button
        onClick={() => {
          setShowAutoconsommationModal(false);
          setSelectedLot(null);
          setQuantiteAutoconsommationInput('');
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


export default Volailles;
