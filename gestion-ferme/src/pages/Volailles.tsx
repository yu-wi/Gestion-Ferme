import { useState, useEffect  } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from "../supabaseClient";
import { exportToExcel } from "../outils/exportToExcel"
import toast from 'react-hot-toast';
import ModalCloseButton from '../components/ModalCloseButton';
import {
  chargerLotsAvecMouvements,
  supprimerLotEtDonnees,
  type LivraisonVolaille,
  type MortaliteVolaille,
} from '../volailles/volaillesData';

type Mortalite = MortaliteVolaille;
interface Evenement { title: string; date: Date; }
interface LotVolaille {
id: string; nom: string; quantite: number; dateArrivee: string;
batiment: string; mortalites: Mortalite[]; evenements: Evenement[];
couleur: string; age: number; autoconsommation?: number;
is_active?: boolean;
livraisons: LivraisonVolaille[];
facture_date?: string;
resultat_brut?: number;
nb_morts?: number;
sujets_restants?: number;
}


function Volailles() {
const [lots, setLots] = useState<LotVolaille[]>([]);
const [nom, setNom] = useState('');
const [quantite, setQuantite] = useState<number>(0);
const [dateArrivee, setDateArrivee] = useState('');
const [batiment, setBatiment] = useState('');
const [searchNom, setSearchNom] = useState('');
const [searchBatiment, setSearchBatiment] = useState('');
const [showOnlyAlertLots, setShowOnlyAlertLots] = useState(false);
const [nouveauLotModalOpen, setNouveauLotModalOpen] = useState(false);


const [mortaliteModalOpen, setMortaliteModalOpen] = useState(false);
const [mortaliteLotId, setMortaliteLotId] = useState<string | null>(null);
const [mortaliteDate, setMortaliteDate] = useState('');
const [mortaliteNombre, setMortaliteNombre] = useState(0);
const [mortaliteEnModification, setMortaliteEnModification] = useState<Mortalite | null>(null);
const [livraisonEnModification, setLivraisonEnModification] = useState<LivraisonVolaille | null>(null);


const [sortColumn, setSortColumn] = useState<string>('nom');
const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

const [selectedLot, setSelectedLot] = useState<any>(null);
const [detailLot, setDetailLot] = useState<LotVolaille | null>(null);
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
   try {
     const data = await chargerLotsAvecMouvements(true);
     const lotsTransformés = data.map((lot: any) => ({
       ...lot,
       evenements: (lot.evenements || []).map((e: any) => ({
         ...e,
         date: new Date(e.date),
       })),
       dateArrivee: lot.date_arrivee,
     }));
     setLots(lotsTransformés as LotVolaille[]);
   } catch (error) {
     console.error('Erreur chargement des lots', error);
     toast.error("Les lots n'ont pas pu être chargés.");
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
 const sujetsRestants = calculerSujetsRestants(lot);
 const ratio = lot.quantite > 0 ? sujetsRestants / lot.quantite : 0;
 if (showOnlyAlertLots && ratio >= 0.5) return false;
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
   livraisons: [],
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
   setNouveauLotModalOpen(false);
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
  const sujetsDisponibles = calculerSujetsRestants(lot);
  if (mortaliteNombre > sujetsDisponibles) {
    toast.error(`Il ne reste que ${sujetsDisponibles} sujets dans ce lot.`);
    return;
  }
  setSaving(true);

  const totalMortalites = lot.mortalites.reduce((sum, m) => sum + m.nombre, 0) + mortaliteNombre;
  const sujetsRestants = lot.quantite - totalMortalites - (lot.autoconsommation || 0); // si autoconsommation existe

  const { data, error } = await supabase
    .from('mortalites_volailles')
    .insert({
      lot_id: mortaliteLotId,
      date: mortaliteDate,
      nombre: mortaliteNombre,
    })
    .select('id, lot_id, date, nombre')
    .single();

  if (error) {
    console.error('Erreur ajout mortalité Supabase:', error);
    toast.error("La mortalité n'a pas pu être enregistrée.");
  } else if (data) {
    const nouvelleMortalite = { ...data, nombre: Number(data.nombre) || 0 };
    setLots((prevLots) =>
      prevLots.map((l) => (
        l.id === mortaliteLotId
          ? {
              ...l,
              mortalites: [...l.mortalites, nouvelleMortalite],
              nb_morts: totalMortalites,
              sujets_restants: sujetsRestants,
            }
          : l
      ))
    );
    setDetailLot((current) => {
      if (!current || current.id !== mortaliteLotId) {
        return current;
      }

      return {
        ...current,
        mortalites: [...current.mortalites, nouvelleMortalite],
        nb_morts: totalMortalites,
        sujets_restants: sujetsRestants,
      };
    });

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


const appliquerMortalitesLocales = (
  lotId: string,
  nouvellesMortalites: Mortalite[]
) => {
  const mettreAJour = (lot: LotVolaille): LotVolaille => {
    const totalMortalites = nouvellesMortalites.reduce(
      (total, mortalite) => total + mortalite.nombre,
      0
    );

    return {
      ...lot,
      mortalites: nouvellesMortalites,
      nb_morts: totalMortalites,
      sujets_restants: lot.quantite - totalMortalites - (lot.autoconsommation || 0),
    };
  };

  setLots((lotsActuels) =>
    lotsActuels.map((lot) => (lot.id === lotId ? mettreAJour(lot) : lot))
  );
  setDetailLot((lotActuel) => {
    if (!lotActuel || lotActuel.id !== lotId) return lotActuel;
    return mettreAJour(lotActuel);
  });
};

const enregistrerModificationMortalite = async () => {
  if (saving || !mortaliteEnModification) return;
  if (!mortaliteEnModification.date || mortaliteEnModification.nombre <= 0) {
    toast.error('Indiquez une date et un nombre positif.');
    return;
  }

  const lot = lots.find((item) => item.id === mortaliteEnModification.lot_id);
  if (!lot) return;
  const ancienneMortalite = lot.mortalites.find(
    (item) => item.id === mortaliteEnModification.id
  );
  const maximumAutorise =
    calculerSujetsRestants(lot) + (ancienneMortalite?.nombre || 0);
  if (mortaliteEnModification.nombre > maximumAutorise) {
    toast.error(`Le maximum disponible est de ${maximumAutorise} sujets.`);
    return;
  }

  setSaving(true);
  const { data, error } = await supabase
    .from('mortalites_volailles')
    .update({
      date: mortaliteEnModification.date,
      nombre: mortaliteEnModification.nombre,
    })
    .eq('id', mortaliteEnModification.id)
    .select('id, lot_id, date, nombre')
    .single();

  if (error) {
    console.error('Erreur modification mortalité:', error);
    toast.error("La mortalité n'a pas pu être modifiée.");
  } else if (data) {
    const mortaliteModifiee: Mortalite = {
      ...data,
      nombre: Number(data.nombre) || 0,
    };
    const nouvellesMortalites = lot.mortalites.map((mortalite) =>
      mortalite.id === mortaliteModifiee.id ? mortaliteModifiee : mortalite
    );
    appliquerMortalitesLocales(lot.id, nouvellesMortalites);
    setMortaliteEnModification(null);
    toast.success('Mortalité modifiée.');
  }
  setSaving(false);
};

const supprimerMortalite = async (mortalite: Mortalite) => {
  if (saving || !window.confirm('Supprimer cette mortalité ?')) return;
  const lot = lots.find((item) => item.id === mortalite.lot_id);
  if (!lot) return;

  setSaving(true);
  const { error } = await supabase
    .from('mortalites_volailles')
    .delete()
    .eq('id', mortalite.id);

  if (error) {
    console.error('Erreur suppression mortalité:', error);
    toast.error("La mortalité n'a pas pu être supprimée.");
  } else {
    const nouvellesMortalites = lot.mortalites.filter((item) => item.id !== mortalite.id);
    appliquerMortalitesLocales(lot.id, nouvellesMortalites);
    toast.success('Mortalité supprimée.');
  }
  setSaving(false);
};

const appliquerLivraisonsLocales = (
  lotId: string,
  nouvellesLivraisons: LivraisonVolaille[]
) => {
  const mettreAJour = (lot: LotVolaille): LotVolaille => ({
    ...lot,
    livraisons: nouvellesLivraisons,
  });

  setLots((lotsActuels) =>
    lotsActuels.map((lot) => (lot.id === lotId ? mettreAJour(lot) : lot))
  );
  setDetailLot((lotActuel) => {
    if (!lotActuel || lotActuel.id !== lotId) return lotActuel;
    return mettreAJour(lotActuel);
  });
};

const enregistrerModificationLivraison = async () => {
  if (saving || !livraisonEnModification) return;
  if (
    !livraisonEnModification.date ||
    livraisonEnModification.quantite <= 0 ||
    livraisonEnModification.poids <= 0
  ) {
    toast.error('Complétez la date, la quantité et le poids.');
    return;
  }

  const lot = lots.find((item) => item.id === livraisonEnModification.lot_id);
  if (!lot) return;

  setSaving(true);
  const { data, error } = await supabase
    .from('livraisons_volailles')
    .update({
      date: livraisonEnModification.date,
      quantite: livraisonEnModification.quantite,
      poids: livraisonEnModification.poids,
    })
    .eq('id', livraisonEnModification.id)
    .select('id, lot_id, date, quantite, poids')
    .single();

  if (error) {
    console.error('Erreur modification livraison:', error);
    toast.error("La livraison n'a pas pu être modifiée.");
  } else if (data) {
    const livraisonModifiee: LivraisonVolaille = {
      ...data,
      quantite: Number(data.quantite) || 0,
      poids: Number(data.poids) || 0,
    };
    appliquerLivraisonsLocales(
      lot.id,
      lot.livraisons.map((livraison) =>
        livraison.id === livraisonModifiee.id ? livraisonModifiee : livraison
      )
    );
    setLivraisonEnModification(null);
    toast.success('Livraison modifiée.');
  }
  setSaving(false);
};

const supprimerLivraison = async (livraison: LivraisonVolaille) => {
  if (saving || !window.confirm('Supprimer cette livraison ?')) return;
  const lot = lots.find((item) => item.id === livraison.lot_id);
  if (!lot) return;

  setSaving(true);
  const { error } = await supabase
    .from('livraisons_volailles')
    .delete()
    .eq('id', livraison.id);

  if (error) {
    console.error('Erreur suppression livraison:', error);
    toast.error("La livraison n'a pas pu être supprimée.");
  } else {
    appliquerLivraisonsLocales(
      lot.id,
      lot.livraisons.filter((item) => item.id !== livraison.id)
    );
    toast.success('Livraison supprimée.');
  }
  setSaving(false);
};

// Affiche les sujets restants
function calculerSujetsRestants(lot: LotVolaille) {
  const quantiteInitiale = lot.quantite ?? 0;
  const totalMortalites = Array.isArray(lot.mortalites)
    ? lot.mortalites.reduce((sum, m) => sum + (m.nombre ?? 0), 0)
    : 0;
  const totalAutoconsommation = lot.autoconsommation ?? 0;

  return quantiteInitiale - totalMortalites - totalAutoconsommation;
}

function calculerAgeLot(lot: LotVolaille) {
  const dateArriveeLot = new Date(`${lot.dateArrivee}T00:00:00`);

  if (Number.isNaN(dateArriveeLot.getTime())) {
    return 0;
  }

  return Math.max(
    0,
    Math.floor((Date.now() - dateArriveeLot.getTime()) / 86400000)
  );
}



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
    const livraisonsValides = livraisons
      .filter((livraison) => (
        livraison.date &&
        Number(livraison.quantite) > 0 &&
        Number(livraison.poids) > 0
      ))
      .map((livraison) => ({
        lot_id: selectedLot.id,
        date: livraison.date,
        quantite: Number(livraison.quantite),
        poids: Number(livraison.poids),
      }));

    const { data, error } = await supabase
      .from('livraisons_volailles')
      .insert(livraisonsValides)
      .select('id, lot_id, date, quantite, poids');

    if (error) {
      console.error('Erreur Supabase:', error);
      toast.error("La livraison n'a pas pu être enregistrée.");
      return false;
    } else {
      const nouvellesLivraisons = (data || []).map((livraison) => ({
        ...livraison,
        quantite: Number(livraison.quantite) || 0,
        poids: Number(livraison.poids) || 0,
      }));
      setLots((prevLots) => prevLots.map((lot) => (
        lot.id === selectedLot.id
          ? { ...lot, livraisons: [...lot.livraisons, ...nouvellesLivraisons] }
          : lot
      )));
      setDetailLot((current) => {
        if (!current || current.id !== selectedLot.id) {
          return current;
        }

        return {
          ...current,
          livraisons: [...current.livraisons, ...nouvellesLivraisons],
        };
      });
      toast.success(
        nouvellesLivraisons.length > 1
          ? `${nouvellesLivraisons.length} livraisons enregistrées.`
          : 'Livraison enregistrée.'
      );
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
    const lot = lots.find((item) => item.id === lotId);
    if (!lot) return;
    const datesLivraison = lot.livraisons
      .map((livraison) => livraison.date)
      .filter(Boolean)
      .sort();
    const dateCloture =
      datesLivraison[datesLivraison.length - 1] ||
      new Date().toISOString().split('T')[0];
    const ageCloture = Math.max(
      0,
      Math.floor(
        (new Date(`${dateCloture}T00:00:00`).getTime() -
          new Date(`${lot.dateArrivee}T00:00:00`).getTime()) /
          86400000
      )
    );
    const { error } = await supabase
      .from('lots_volailles')
      .update({ is_active: false, age: ageCloture })
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

const supprimerLot = async (lot: LotVolaille) => {
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
    setLots((lotsActuels) =>
      lotsActuels.filter((item) => item.id !== lot.id)
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

  const maximumDisponible =
    (selectedLot.quantite || 0) - (selectedLot.nb_morts || 0);
  if (autoconsommation > maximumDisponible) {
    toast.error(`Le maximum disponible est de ${maximumDisponible} sujets.`);
    return;
  }

  setSaving(true);

  const { data, error } = await supabase
    .from('lots_volailles')
    .update({
      autoconsommation
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
const totalPoidsLivre = lots.reduce(
  (sum, lot) =>
    sum +
    lot.livraisons.reduce(
      (total, livraison) => total + (Number(livraison.poids) || 0),
      0
    ),
  0
);
const totalResultatBrut = lots.reduce(
  (sum, lot) => sum + (Number(lot.resultat_brut) || 0),
  0
);
const tauxMortaliteGlobal =
  totalInitial > 0 ? (totalMorts / totalInitial) * 100 : 0;
const batiments = Array.from(
  lots.reduce((map, lot) => {
    const nomBatiment = lot.batiment?.trim() || "Non renseigné";
    map.set(
      nomBatiment,
      (map.get(nomBatiment) || 0) + calculerSujetsRestants(lot)
    );
    return map;
  }, new Map<string, number>())
).sort((a, b) => b[1] - a[1]);
const totalBatiments = Math.max(
  1,
  batiments.reduce((total, [, effectif]) => total + effectif, 0)
);
const couleursBatiments = ["#16853d", "#f3ad00", "#3479bd", "#8b98a5", "#7c3aed"];
const anglesBatiments = batiments.reduce(
  (acc, [, effectif], index) => {
    const debut = acc.fin;
    const fin =
      index === batiments.length - 1
        ? 360
        : debut + (effectif / totalBatiments) * 360;
    acc.segments.push(
      `${couleursBatiments[index % couleursBatiments.length]} ${debut}deg ${fin}deg`
    );
    acc.fin = fin;
    return acc;
  },
  { segments: [] as string[], fin: 0 }
).segments;
const lotsAlerteMortalite = lots
  .map((lot) => {
    const morts = lot.mortalites.reduce(
      (total, mortalite) => total + mortalite.nombre,
      0
    );
    return {
      lot,
      taux: lot.quantite > 0 ? (morts / lot.quantite) * 100 : 0,
    };
  })
  .filter((item) => item.taux >= 3)
  .sort((a, b) => b.taux - a.taux);
const lotsFaibles = lots.filter(
  (lot) =>
    lot.quantite > 0 && calculerSujetsRestants(lot) / lot.quantite < 0.5
);
const prochaineLivraison = lots
  .map((lot) => {
    const date = new Date(`${lot.dateArrivee}T00:00:00`);
    date.setDate(date.getDate() + 70);
    return { lot, date };
  })
  .filter((item) => item.date.getTime() >= new Date().setHours(0, 0, 0, 0))
  .sort((a, b) => a.date.getTime() - b.date.getTime())[0];


return (
 <>
 <div className="poultry-page">
   <header className="poultry-heading">
     <div>
       <h1>Volailles <span>♧</span></h1>
       <p>Suivi des lots, performances et production.</p>
     </div>
     <div className="poultry-heading-actions">
       <button type="button" onClick={() => exportToExcel(filteredLots)}>
         ⇩ Exporter
       </button>
       <button
         type="button"
         className="poultry-primary-button"
         onClick={() => setNouveauLotModalOpen(true)}
       >
         ＋ Nouveau lot
       </button>
     </div>
   </header>

   <nav className="poultry-tabs" aria-label="Sections volailles">
     <a href="#vue-ensemble" className="poultry-tab-active">Vue d’ensemble</a>
     <a href="#lots-en-cours">Lots en cours</a>
     <Link to="/volailles/historique">Lots terminés</Link>
     <a href="#batiments">Bâtiments</a>
     <a href="#alertes">Mortalité</a>
     <Link to="/volailles/analyse">Performances</Link>
   </nav>

   <section id="vue-ensemble" className="poultry-kpis">
     <PoultryKpi icon="▣" tone="green" label="Lots en cours" value={String(lots.length)} note={`${totalRestants} sujets`} />
     <PoultryKpi icon="▥" tone="blue" label="Poids total livré" value={`${totalPoidsLivre.toFixed(2)} kg`} note={`${lots.reduce((total, lot) => total + lot.livraisons.length, 0)} livraisons`} />
     <PoultryKpi icon="€" tone="orange" label="Résultat brut" value={`${totalResultatBrut.toFixed(2)} €`} note="Lots actifs" />
     <PoultryKpi icon="♥" tone="red" label="Taux de mortalité" value={`${tauxMortaliteGlobal.toFixed(2)} %`} note={`${totalMorts} mortalités`} />
   </section>

   <section className="poultry-overview-grid">
     <article id="batiments" className="poultry-panel poultry-buildings">
       <div className="poultry-panel-heading">
         <h2>Répartition par bâtiment</h2>
         <span>{batiments.length} bâtiment(s)</span>
       </div>
       {batiments.length === 0 ? (
         <div className="poultry-empty">Aucun bâtiment renseigné.</div>
       ) : (
         <div className="poultry-building-content">
           <div
             className="poultry-building-ring"
             style={{ background: `conic-gradient(${anglesBatiments.join(", ")})` }}
           >
             <div><strong>{totalRestants}</strong><span>sujets</span></div>
           </div>
           <div className="poultry-building-list">
             {batiments.map(([nomBatiment, effectif], index) => (
               <div key={nomBatiment}>
                 <i style={{ backgroundColor: couleursBatiments[index % couleursBatiments.length] }} />
                 <span><strong>{nomBatiment}</strong><small>{effectif} sujets</small></span>
                 <b>{((effectif / totalBatiments) * 100).toFixed(0)}%</b>
               </div>
             ))}
           </div>
         </div>
       )}
     </article>

     <article id="alertes" className="poultry-panel poultry-alerts">
       <div className="poultry-panel-heading">
         <h2>Alertes</h2>
         <span>{lotsAlerteMortalite.length + lotsFaibles.length + (prochaineLivraison ? 1 : 0)}</span>
       </div>
       <div className="poultry-alert-list">
         {lotsAlerteMortalite.slice(0, 1).map(({ lot, taux }) => (
           <button key={lot.id} type="button" className="poultry-alert poultry-alert-danger" onClick={() => ouvrirMortaliteModal(lot.id)}>
             <span>!</span><div><strong>Mortalité élevée</strong><small>{lot.nom} · {taux.toFixed(1)} %</small></div>
           </button>
         ))}
         {lotsFaibles.slice(0, 1).map((lot) => (
           <button key={lot.id} type="button" className="poultry-alert poultry-alert-warning" onClick={() => setDetailLot(lot)}>
             <span>◫</span><div><strong>Effectif faible</strong><small>{lot.nom} · {calculerSujetsRestants(lot)} restants</small></div>
           </button>
         ))}
         {prochaineLivraison && (
           <button type="button" className="poultry-alert poultry-alert-success" onClick={() => {
             setSelectedLot(prochaineLivraison.lot);
             setLivraisons([{ date: '', quantite: '', poids: '' }]);
             setShowLivraisonModal(true);
           }}>
             <span>□</span><div><strong>Livraison prévue</strong><small>{prochaineLivraison.lot.nom} · {prochaineLivraison.date.toLocaleDateString("fr-FR")}</small></div>
           </button>
         )}
         {!lotsAlerteMortalite.length && !lotsFaibles.length && !prochaineLivraison && (
           <div className="poultry-empty">Aucune alerte actuellement.</div>
         )}
       </div>
     </article>
   </section>

   <section className="poultry-main-grid">
     <article id="lots-en-cours" className="poultry-panel poultry-lots-panel">
       <div className="poultry-lots-toolbar">
         <h2>Lots en cours</h2>
         <div>
           <input
             type="search"
             placeholder="Rechercher un lot..."
             value={searchNom}
             onChange={(event) => setSearchNom(event.target.value)}
           />
           <input
             type="search"
             placeholder="Bâtiment"
             value={searchBatiment}
             onChange={(event) => setSearchBatiment(event.target.value)}
           />
           <label>
             <input
               type="checkbox"
               checked={showOnlyAlertLots}
               onChange={(event) => setShowOnlyAlertLots(event.target.checked)}
             />
             À surveiller
           </label>
         </div>
       </div>

       <div className="poultry-mobile-lots">
         {sortedLots.map((lot) => {
           const sujetsRestants = calculerSujetsRestants(lot);
           const mortalitesLot = lot.mortalites.reduce((sum, mort) => sum + mort.nombre, 0);
           const taux = lot.quantite > 0 ? (mortalitesLot / lot.quantite) * 100 : 0;
           const age = calculerAgeLot(lot);
           return (
             <article key={lot.id} className="poultry-mobile-card">
               <div className="poultry-mobile-card-heading">
                 <div><strong>{lot.nom}</strong><span>{lot.batiment} · {age} jours</span></div>
                 <span className="poultry-status">En cours</span>
               </div>
               <div className="poultry-mobile-values">
                 <span>Effectif <b>{sujetsRestants}</b></span>
                 <span>Mortalité <b className={taux >= 3 ? "poultry-danger-text" : ""}>{taux.toFixed(1)} %</b></span>
                 <span>Poids <b>{lot.livraisons.reduce((sum, livraison) => sum + livraison.poids, 0).toFixed(1)} kg</b></span>
               </div>
               <div className="poultry-card-actions">
                 <button type="button" onClick={() => setDetailLot(lot)}>Fiche</button>
                 <button type="button" onClick={() => ouvrirMortaliteModal(lot.id)}>＋ Mortalité</button>
                 <button type="button" onClick={() => {
                   setSelectedLot(lot);
                   setLivraisons([{ date: '', quantite: '', poids: '' }]);
                   setShowLivraisonModal(true);
                 }}>＋ Livraison</button>
               </div>
             </article>
           );
         })}
         {!sortedLots.length && <div className="poultry-empty">Aucun lot actif à afficher.</div>}
       </div>

       <div className="poultry-table-wrap">
         <table className="poultry-table">
           <thead>
             <tr>
               <th onClick={() => handleSort('nom')}>N° lot</th>
               <th onClick={() => handleSort('batiment')}>Bâtiment</th>
               <th onClick={() => handleSort('dateArrivee')}>Date début</th>
               <th>Âge</th>
               <th>Effectif</th>
               <th>Poids total</th>
               <th>Mortalité</th>
               <th>Résultat brut</th>
               <th>Statut</th>
               <th>Actions</th>
             </tr>
           </thead>
           <tbody>
             {sortedLots.map((lot) => {
               const sujetsRestants = calculerSujetsRestants(lot);
               const mortalitesLot = lot.mortalites.reduce((sum, mort) => sum + mort.nombre, 0);
               const taux = lot.quantite > 0 ? (mortalitesLot / lot.quantite) * 100 : 0;
               const age = calculerAgeLot(lot);
               const poids = lot.livraisons.reduce((sum, livraison) => sum + livraison.poids, 0);
               return (
                 <tr key={lot.id}>
                   <td><button type="button" className="poultry-lot-link" onClick={() => setDetailLot(lot)}>{lot.nom}</button></td>
                   <td>{lot.batiment}</td>
                   <td>{new Date(`${lot.dateArrivee}T00:00:00`).toLocaleDateString("fr-FR")}</td>
                   <td>{age} jours</td>
                   <td>{sujetsRestants}</td>
                   <td>{poids.toFixed(2)} kg</td>
                   <td className={taux >= 3 ? "poultry-danger-text" : "poultry-success-text"}>{taux.toFixed(2)} %</td>
                   <td>{(Number(lot.resultat_brut) || 0).toFixed(2)} €</td>
                   <td><span className="poultry-status">En cours</span></td>
                   <td>
                     <div className="poultry-row-actions">
                       <button type="button" title="Voir la fiche" onClick={() => setDetailLot(lot)}>◉</button>
                       <button type="button" title="Mortalité" onClick={() => ouvrirMortaliteModal(lot.id)}>♥</button>
                       <button type="button" title="Livraison" onClick={() => {
                         setSelectedLot(lot);
                         setLivraisons([{ date: '', quantite: '', poids: '' }]);
                         setShowLivraisonModal(true);
                       }}>▣</button>
                       <button type="button" title="Vente" onClick={() => { setSelectedLot(lot); setVenteModalOpen(true); }}>€</button>
                       <button type="button" title="Archiver" disabled={saving} onClick={() => archiverLot(lot.id)}>↓</button>
                       <button type="button" title="Supprimer" disabled={saving} onClick={() => supprimerLot(lot)}>×</button>
                     </div>
                   </td>
                 </tr>
               );
             })}
             {!sortedLots.length && (
               <tr><td colSpan={10}><div className="poultry-empty">Aucun lot actif à afficher.</div></td></tr>
             )}
           </tbody>
         </table>
       </div>
     </article>

     <aside className="poultry-quick-actions">
       <h2>Actions rapides</h2>
       <button type="button" onClick={() => setNouveauLotModalOpen(true)}><span>＋</span><div><strong>Nouveau lot</strong><small>Créer un nouveau lot</small></div></button>
       <button type="button" onClick={() => setShowAutoconsommationModal(true)}><span>♧</span><div><strong>Autoconsommation</strong><small>Enregistrer une sortie</small></div></button>
       <Link to="/volailles/alimentation"><span>◫</span><div><strong>Suivi de l’alimentation</strong><small>Consommations et stock</small></div></Link>
       <Link to="/volailles/historique"><span>☷</span><div><strong>Voir tous les lots</strong><small>Accéder à l’historique</small></div></Link>
     </aside>
   </section>
 </div>

{nouveauLotModalOpen && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
    <div className="relative w-full max-w-xl rounded-lg bg-white p-6 shadow-lg">
      <ModalCloseButton
        onClick={() => setNouveauLotModalOpen(false)}
        disabled={saving}
      />
      <h2 className="pr-12 text-xl font-semibold">Nouveau lot</h2>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
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
      </div>
      <button
        onClick={ajouterLot}
        disabled={saving}
        className="mt-5 w-full rounded !bg-blue-600 p-2 !text-white disabled:opacity-60"
      >
        {saving ? 'Enregistrement...' : 'Ajouter le lot'}
      </button>
    </div>
  </div>
)}

{detailLot && (() => {
  const lotDetail = detailLot;
  const sujetsRestants = calculerSujetsRestants(lotDetail);
  const totalMortalitesLot = Array.isArray(lotDetail.mortalites)
    ? lotDetail.mortalites.reduce((sum, mort) => sum + (mort.nombre || 0), 0)
    : 0;
  const tauxMortaliteLot = lotDetail.quantite > 0 ? (totalMortalitesLot / lotDetail.quantite) * 100 : 0;
  const ageJours = calculerAgeLot(lotDetail);
  const livraisonsExistantes = lotDetail.livraisons || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-white p-6 shadow-lg">
        <ModalCloseButton onClick={() => setDetailLot(null)} disabled={saving} />
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="pr-12">
            <h2 className="text-2xl font-bold">{lotDetail.nom}</h2>
            <p className="text-sm text-gray-600">
              {lotDetail.batiment} · arrivé le {lotDetail.dateArrivee} · {ageJours} jours
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="rounded border p-3">
            <div className="text-xs uppercase text-gray-500">Quantité initiale</div>
            <div className="text-xl font-bold">{lotDetail.quantite}</div>
          </div>
          <div className="rounded border p-3">
            <div className="text-xs uppercase text-gray-500">Restants</div>
            <div className="text-xl font-bold">{sujetsRestants}</div>
          </div>
          <div className="rounded border p-3">
            <div className="text-xs uppercase text-gray-500">Mortalités</div>
            <div className="text-xl font-bold">{totalMortalitesLot}</div>
          </div>
          <div className="rounded border p-3">
            <div className="text-xs uppercase text-gray-500">Taux mortalité</div>
            <div className="text-xl font-bold">{tauxMortaliteLot.toFixed(1)} %</div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <section className="rounded border p-4">
            <h3 className="font-semibold">Livraisons</h3>
            {livraisonsExistantes.length === 0 ? (
              <p className="mt-2 text-sm text-gray-500">Aucune livraison enregistrée.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {livraisonsExistantes.map((livraison, index) => (
                  <div key={livraison.id} className="rounded bg-gray-50 p-3 text-sm">
                    <div className="font-medium">Livraison {index + 1}</div>
                    <div>Date : {livraison.date || '-'}</div>
                    <div>Quantité : {livraison.quantite || 0}</div>
                    <div>Poids : {livraison.poids || 0} kg</div>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => setLivraisonEnModification({ ...livraison })}
                        className="!bg-blue-600 !text-white rounded px-3 py-1 text-xs"
                      >
                        Modifier
                      </button>
                      <button
                        onClick={() => supprimerLivraison(livraison)}
                        disabled={saving}
                        className="!bg-red-600 !text-white rounded px-3 py-1 text-xs disabled:opacity-60"
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded border p-4">
            <h3 className="font-semibold">Mortalités</h3>
            {lotDetail.mortalites?.length ? (
              <div className="mt-3 max-h-48 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="py-2 text-left">Date</th>
                      <th className="py-2 text-left">Nombre</th>
                      <th className="py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lotDetail.mortalites.map((mortalite) => (
                      <tr key={mortalite.id} className="border-b">
                        <td className="py-2">{mortalite.date}</td>
                        <td className="py-2">{mortalite.nombre}</td>
                        <td className="py-2 text-right">
                          <button
                            onClick={() => setMortaliteEnModification({ ...mortalite })}
                            className="!bg-blue-600 !text-white rounded px-2 py-1 text-xs"
                          >
                            Modifier
                          </button>
                          <button
                            onClick={() => supprimerMortalite(mortalite)}
                            disabled={saving}
                            className="ml-2 !bg-red-600 !text-white rounded px-2 py-1 text-xs disabled:opacity-60"
                          >
                            Supprimer
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-2 text-sm text-gray-500">Aucune mortalité enregistrée.</p>
            )}
          </section>
        </div>

        <div className="mt-5 rounded border p-4">
          <h3 className="font-semibold">Vente et autoconsommation</h3>
          <div className="mt-3 grid gap-3 text-sm md:grid-cols-3">
            <div>Date facture : {lotDetail.facture_date || '-'}</div>
            <div>Résultat brut : {lotDetail.resultat_brut ?? '-'} €</div>
            <div>Autoconsommation : {lotDetail.autoconsommation ?? 0}</div>
          </div>
        </div>

      </div>
    </div>
  );
})()}

   {/* Modale pour enregistrer les livraisons */}
{showLivraisonModal && (
  <div className="fixed inset-0 bg-gray-500 bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div className="relative bg-white p-6 rounded-lg shadow-lg w-full max-w-xl max-h-[90vh] overflow-y-auto">
      <ModalCloseButton onClick={() => setShowLivraisonModal(false)} disabled={saving} />
      <h2 className="pr-12 text-xl font-semibold mb-1">Ajouter une ou plusieurs livraisons</h2>
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
        className="!bg-emerald-600 !text-white p-2 rounded w-full mb-2"
      >
        + Ajouter une livraison
      </button>

      <button
        onClick={async () => {
          const saved = await handleSaveLivraison();
          if (saved) setShowLivraisonModal(false);
        }}
        disabled={saving}
        className="!bg-blue-600 !text-white p-2 rounded w-full disabled:opacity-60"
      >
        {saving ? 'Enregistrement...' : '💾 Enregistrer les livraisons'}
      </button>

      <button onClick={() => setShowLivraisonModal(false)} className="!bg-gray-200 !text-gray-900 p-2 rounded w-full mt-2">
        Annuler
      </button>
    </div>
  </div>
)}



   {/* Modale pour saisir une mortalité */}
   {mortaliteModalOpen && (
     <div className="fixed inset-0 bg-gray-500 bg-opacity-50 flex items-center justify-center p-4">
       <div className="relative bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
         <ModalCloseButton onClick={() => setMortaliteModalOpen(false)} disabled={saving} />
         <h2 className="pr-12 text-xl font-semibold mb-1">Ajouter une mortalité</h2>
         <p className="mb-4 text-sm text-gray-600">{lots.find((lot) => lot.id === mortaliteLotId)?.nom}</p>
         <input type="date" value={mortaliteDate} onChange={e => setMortaliteDate(e.target.value)} className="border p-2 rounded mb-2 w-full" />
         <input type="number" value={mortaliteNombre} onChange={e => setMortaliteNombre(+e.target.value)} className="border p-2 rounded mb-4 w-full" />
         <button onClick={enregistrerMortalite} disabled={saving} className="!bg-blue-600 !text-white p-2 rounded w-full disabled:opacity-60">
           {saving ? 'Enregistrement...' : 'Enregistrer'}
         </button>
         <button onClick={() => setMortaliteModalOpen(false)} className="!bg-gray-200 !text-gray-900 p-2 rounded w-full mt-2">Annuler</button>
       </div>
     </div>
   )}

{mortaliteEnModification && (
  <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-50 p-4">
    <div className="relative w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
      <ModalCloseButton onClick={() => setMortaliteEnModification(null)} disabled={saving} />
      <h2 className="pr-12 text-xl font-semibold">Modifier la mortalité</h2>
      <div className="mt-4 space-y-3">
        <label className="block text-sm font-medium text-gray-700">
          Date
          <input
            type="date"
            value={mortaliteEnModification.date}
            onChange={(event) =>
              setMortaliteEnModification({
                ...mortaliteEnModification,
                date: event.target.value,
              })
            }
            className="mt-1 w-full rounded border p-2"
          />
        </label>
        <label className="block text-sm font-medium text-gray-700">
          Nombre
          <input
            type="number"
            min={1}
            value={mortaliteEnModification.nombre}
            onChange={(event) =>
              setMortaliteEnModification({
                ...mortaliteEnModification,
                nombre: Number(event.target.value),
              })
            }
            className="mt-1 w-full rounded border p-2"
          />
        </label>
      </div>
      <button
        onClick={enregistrerModificationMortalite}
        disabled={saving}
        className="mt-5 w-full !bg-blue-600 !text-white rounded p-2 disabled:opacity-60"
      >
        {saving ? 'Enregistrement...' : 'Enregistrer la modification'}
      </button>
      <button
        onClick={() => setMortaliteEnModification(null)}
        disabled={saving}
        className="mt-2 w-full !bg-gray-200 !text-gray-900 rounded p-2 disabled:opacity-60"
      >
        Annuler
      </button>
    </div>
  </div>
)}

{livraisonEnModification && (
  <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-50 p-4">
    <div className="relative w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
      <ModalCloseButton onClick={() => setLivraisonEnModification(null)} disabled={saving} />
      <h2 className="pr-12 text-xl font-semibold">Modifier la livraison</h2>
      <div className="mt-4 space-y-3">
        <label className="block text-sm font-medium text-gray-700">
          Date
          <input
            type="date"
            value={livraisonEnModification.date}
            onChange={(event) =>
              setLivraisonEnModification({
                ...livraisonEnModification,
                date: event.target.value,
              })
            }
            className="mt-1 w-full rounded border p-2"
          />
        </label>
        <label className="block text-sm font-medium text-gray-700">
          Quantité
          <input
            type="number"
            min={1}
            value={livraisonEnModification.quantite}
            onChange={(event) =>
              setLivraisonEnModification({
                ...livraisonEnModification,
                quantite: Number(event.target.value),
              })
            }
            className="mt-1 w-full rounded border p-2"
          />
        </label>
        <label className="block text-sm font-medium text-gray-700">
          Poids (kg)
          <input
            type="number"
            min={0.01}
            step="0.01"
            value={livraisonEnModification.poids}
            onChange={(event) =>
              setLivraisonEnModification({
                ...livraisonEnModification,
                poids: Number(event.target.value),
              })
            }
            className="mt-1 w-full rounded border p-2"
          />
        </label>
      </div>
      <button
        onClick={enregistrerModificationLivraison}
        disabled={saving}
        className="mt-5 w-full !bg-blue-600 !text-white rounded p-2 disabled:opacity-60"
      >
        {saving ? 'Enregistrement...' : 'Enregistrer la modification'}
      </button>
      <button
        onClick={() => setLivraisonEnModification(null)}
        disabled={saving}
        className="mt-2 w-full !bg-gray-200 !text-gray-900 rounded p-2 disabled:opacity-60"
      >
        Annuler
      </button>
    </div>
  </div>
)}

   {/* Modale pour enregistrer la vente*/}
{venteModalOpen && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div className="relative bg-white p-6 rounded-lg shadow-md w-full max-w-md">
      <ModalCloseButton onClick={() => setVenteModalOpen(false)} disabled={saving} />
      <h2 className="pr-12 text-xl font-semibold mb-1">Enregistrer la vente du lot</h2>
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
        className="w-full !bg-emerald-600 !text-white py-2 rounded mb-2 disabled:opacity-60"
      >
        {saving ? 'Enregistrement...' : 'Enregistrer'}
      </button>
      <button
        onClick={() => setVenteModalOpen(false)}
        className="w-full !bg-gray-200 !text-gray-900 py-2 rounded"
      >
        Annuler
      </button>
    </div>
  </div>
)}

{/* Modale Autoconsommation */}
{showAutoconsommationModal && (
  <div className="fixed inset-0 bg-gray-500 bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div className="relative bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
      <ModalCloseButton
        onClick={() => {
          setShowAutoconsommationModal(false);
          setSelectedLot(null);
          setQuantiteAutoconsommationInput('');
        }}
        disabled={saving}
      />
      <h2 className="pr-12 text-lg font-bold mb-4">Saisir la Quantité en Autoconsommation</h2>
      
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
            className="!bg-emerald-600 !text-white p-2 rounded w-full disabled:opacity-60"
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
        className="mt-2 p-2 w-full !bg-gray-200 !text-gray-900 rounded"
      >
        Annuler
      </button>
    </div>
  </div>
)}



 </>
);
}

function PoultryKpi({
  icon,
  tone,
  label,
  value,
  note,
}: {
  icon: string;
  tone: "green" | "blue" | "orange" | "red";
  label: string;
  value: string;
  note: string;
}) {
  return (
    <article className="poultry-kpi">
      <span className={`poultry-kpi-icon poultry-kpi-${tone}`}>{icon}</span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
        <em>{note}</em>
      </div>
    </article>
  );
}


export default Volailles;
