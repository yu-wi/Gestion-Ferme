import { useState, useEffect  } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from "../supabaseClient";
import { exportToExcel } from "../outils/exportToExcel"
import toast from 'react-hot-toast';
import ModalCloseButton from '../components/ModalCloseButton';
import { formatNombre } from '../outils/formatNombre';
import {
  dateDepuisArrivee,
  genererEvenementsVolailles,
  REGLES_SUIVI_VOLAILLES,
} from '../outils/evenementsVolailles';
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

function dateLocaleIso() {
  const date = new Date();
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function genererEvenementsLot(dateArrivee: string): Evenement[] {
  return genererEvenementsVolailles(dateArrivee).map(({ title, date }) => ({
    title,
    date,
  }));
}


function Volailles() {
const [lots, setLots] = useState<LotVolaille[]>([]);
const [nom, setNom] = useState('');
const [quantite, setQuantite] = useState('');
const [dateArrivee, setDateArrivee] = useState('');
const [batiment, setBatiment] = useState('');
const [searchNom, setSearchNom] = useState('');
const [searchBatiment, setSearchBatiment] = useState('');
const [showOnlyAlertLots, setShowOnlyAlertLots] = useState(false);
const [nouveauLotModalOpen, setNouveauLotModalOpen] = useState(false);


const [mortaliteModalOpen, setMortaliteModalOpen] = useState(false);
const [mortaliteLotId, setMortaliteLotId] = useState<string | null>(null);
const [mortaliteDate, setMortaliteDate] = useState('');
const [mortaliteNombre, setMortaliteNombre] = useState('');
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

const transformerLots = (data: any[]) =>
  data.map((lot: any) => ({
    ...lot,
    evenements: genererEvenementsLot(lot.date_arrivee),
    dateArrivee: lot.date_arrivee,
  })) as LotVolaille[];

const rechargerLots = async () => {
  const data = await chargerLotsAvecMouvements(true);
  const lotsTransformes = transformerLots(data);
  setLots(lotsTransformes);
  setDetailLot((lotActuel) => {
    if (!lotActuel) return null;
    return lotsTransformes.find((lot) => lot.id === lotActuel.id) || null;
  });
};

// Charger les lots existants
useEffect(() => {
 const fetchLots = async () => {
   try {
     await rechargerLots();
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
 if (showOnlyAlertLots && calculerVigilanceLot(lot).tone === 'normal') return false;
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
 const quantiteNumerique = Number(quantite);
 if (!nom.trim() || quantiteNumerique <= 0 || !dateArrivee || !batiment.trim()) {
   toast.error('Complétez le nom, la quantité, la date et le bâtiment.');
   return;
 }

 setSaving(true);

 const id = crypto.randomUUID();
 const dateArriveeDate = new Date(dateArrivee);
 const couleur = genererCouleurAleatoire();
 const now = new Date();
  const ageCalcule = Math.floor((now.getTime() - dateArriveeDate.getTime()) / (1000 * 60 * 60 * 24));
  const sujetsRestants = quantiteNumerique;


 const nouveauxEvenements = genererEvenementsLot(dateArrivee);


 const nouveauLot: LotVolaille = {
   id,
   nom,
   quantite: quantiteNumerique,
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
   quantite: quantiteNumerique,
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
   setQuantite('');
   setDateArrivee('');
   setBatiment('');
   setNouveauLotModalOpen(false);
   toast.success('Lot enregistré.');
  }
  setSaving(false);
};




const ouvrirMortaliteModal = (lotId: string) => {
 setMortaliteLotId(lotId);
 setMortaliteDate(dateLocaleIso());
 setMortaliteNombre('');
 setMortaliteModalOpen(true);
};


const enregistrerMortalite = async () => {
  if (saving) return;
  const nombreMortalites = Number(mortaliteNombre);
  if (!mortaliteLotId || !mortaliteDate || nombreMortalites <= 0) {
    toast.error('Indiquez une date et un nombre positif.');
    return;
  }

  const lot = lots.find((l) => l.id === mortaliteLotId);
  if (!lot) return;
  const sujetsDisponibles = calculerSujetsRestants(lot);
  if (nombreMortalites > sujetsDisponibles) {
    toast.error(`Il ne reste que ${sujetsDisponibles} sujets dans ce lot.`);
    return;
  }
  setSaving(true);

  const totalMortalites = lot.mortalites.reduce((sum, m) => sum + m.nombre, 0) + nombreMortalites;
  const sujetsRestants = lot.quantite - totalMortalites - (lot.autoconsommation || 0); // si autoconsommation existe

  const { data, error } = await supabase
    .from('mortalites_volailles')
    .insert({
      lot_id: mortaliteLotId,
      date: mortaliteDate,
      nombre: nombreMortalites,
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
    setMortaliteNombre('');
    setMortaliteDate('');
    setMortaliteLotId(null);
    try {
      await rechargerLots();
    } catch (refreshError) {
      console.error('Erreur actualisation après mortalité :', refreshError);
    }
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

type VigilanceLot = {
  label: string;
  tone: 'normal' | 'warning' | 'danger' | 'info';
};

function calculerVigilanceLot(lot: LotVolaille): VigilanceLot {
  const age = calculerAgeLot(lot);
  const mortalites = lot.mortalites.reduce(
    (total, mortalite) => total + (mortalite.nombre ?? 0),
    0
  );
  const tauxMortalite = lot.quantite > 0
    ? (mortalites / lot.quantite) * 100
    : 0;

  if (tauxMortalite > 15) {
    return { label: 'Mortalité élevée', tone: 'danger' };
  }

  const regleLivraison = REGLES_SUIVI_VOLAILLES.find(
    (regle) => regle.key === 'livraison'
  );

  if (regleLivraison && age >= regleLivraison.jour - 2 && lot.livraisons.length === 0) {
    return {
      label: age < regleLivraison.jour
        ? `Livraison dans ${regleLivraison.jour - age} j`
        : 'Livraison à planifier',
      tone: age < regleLivraison.jour ? 'info' : 'danger',
    };
  }

  const prochainEvenement = REGLES_SUIVI_VOLAILLES
    .filter((regle) => regle.key !== 'livraison')
    .find((regle) => {
      const joursRestants = regle.jour - age;
      return joursRestants >= -1 && joursRestants <= 3;
    });

  if (prochainEvenement) {
    const joursRestants = prochainEvenement.jour - age;
    if (joursRestants > 0) {
      return {
        label: `${prochainEvenement.title} dans ${joursRestants} j`,
        tone: 'warning',
      };
    }
    if (joursRestants === 0) {
      return {
        label: `${prochainEvenement.title} aujourd’hui`,
        tone: 'warning',
      };
    }
    return {
      label: `${prochainEvenement.title} à vérifier`,
      tone: 'warning',
    };
  }

  return { label: 'RAS', tone: 'normal' };
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
  .filter((item) => item.taux > 15)
  .sort((a, b) => b.taux - a.taux);
const lotsFaibles = lots.filter(
  (lot) =>
    lot.quantite > 0 && calculerSujetsRestants(lot) / lot.quantite < 0.5
);
const debutAujourdhui = new Date().setHours(0, 0, 0, 0);
const echeancesProches = lots
  .flatMap((lot) =>
    REGLES_SUIVI_VOLAILLES.map((regle) => {
      const date = dateDepuisArrivee(lot.dateArrivee, regle.jour);
      const joursRestants = Math.round(
        (date.getTime() - debutAujourdhui) / 86400000
      );
      return { lot, regle, date, joursRestants };
    })
  )
  .filter(({ joursRestants }) => joursRestants >= 0 && joursRestants <= 3)
  .sort((a, b) => a.date.getTime() - b.date.getTime());
const nombreAlertes =
  lotsAlerteMortalite.length + lotsFaibles.length + echeancesProches.length;


return (
 <>
 <div className="poultry-page">
   <header className="poultry-heading">
     <div>
       <h1>Lots SICA Madras <span>♧</span></h1>
       <p>Suivi des lots coopérative, performances et production.</p>
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
     <Link to="/volailles">Résumé</Link>
     <a href="#vue-ensemble" className="poultry-tab-active">Lots SICA Madras</a>
     <Link to="/volailles/sica/historique">Historique SICA</Link>
     <Link to="/volailles/vente-directe">Vente directe</Link>
     <Link to="/volailles/vente-directe/historique">Historique vente directe</Link>
     <Link to="/volailles/alimentation">Alimentation</Link>
     <Link to="/volailles/analyse/sica">Analyse SICA</Link>
     <Link to="/volailles/analyse/vente-directe">Analyse vente directe</Link>
     <Link to="/volailles/inventaire">Inventaire</Link>
   </nav>

   <section id="vue-ensemble" className="poultry-kpis poultry-kpis-compact">
     <PoultryKpi icon="▣" tone="green" label="Lots SICA Madras" value={formatNombre(lots.length)} note={`${formatNombre(totalRestants)} sujets`} />
     <PoultryKpi icon="♥" tone="red" label="Taux de mortalité" value={`${formatNombre(tauxMortaliteGlobal, 2)} %`} note={`${formatNombre(totalMorts)} mortalités`} />
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
         <span>{nombreAlertes}</span>
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
         {echeancesProches.slice(0, 2).map(({ lot, regle, date, joursRestants }) => (
           <button
             key={`${lot.id}-${regle.key}`}
             type="button"
             className={`poultry-alert poultry-alert-${regle.tone}`}
             onClick={() => {
               if (regle.key === 'livraison') {
                 setSelectedLot(lot);
                 setLivraisons([{ date: '', quantite: '', poids: '' }]);
                 setShowLivraisonModal(true);
               } else {
                 setDetailLot(lot);
               }
             }}
           >
             <span aria-hidden="true">{regle.icon}</span>
             <div>
               <strong>{regle.title}{joursRestants === 0 ? ' aujourd’hui' : ` dans ${joursRestants} j`}</strong>
               <small>{lot.nom} · {date.toLocaleDateString("fr-FR")}</small>
             </div>
           </button>
         ))}
         {!nombreAlertes && (
           <div className="poultry-empty">Aucune alerte actuellement.</div>
         )}
       </div>
     </article>
   </section>

   <section className="poultry-main-grid">
     <article id="lots-en-cours" className="poultry-panel poultry-lots-panel">
       <div className="poultry-lots-toolbar">
         <h2>Lots SICA Madras</h2>
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
           const vigilance = calculerVigilanceLot(lot);
           return (
             <article key={lot.id} className="poultry-mobile-card">
               <div className="poultry-mobile-card-heading">
                 <div><strong>{lot.nom}</strong><span>{lot.batiment} · {age} jours</span></div>
                 <span className={`poultry-vigilance poultry-vigilance-${vigilance.tone}`}>{vigilance.label}</span>
               </div>
               <div className="poultry-mobile-values poultry-mobile-values-compact">
                 <span>Effectif <b>{formatNombre(sujetsRestants)}</b></span>
                 <span>Mortalité <b className={taux > 15 ? "poultry-danger-text" : ""}>{taux.toFixed(1)} %</b></span>
               </div>
               <div className="poultry-card-actions">
                 <button type="button" onClick={() => setDetailLot(lot)}><span aria-hidden="true">👁</span> Fiche</button>
                 <button type="button" className="poultry-action-mortality" onClick={() => ouvrirMortaliteModal(lot.id)}><span aria-hidden="true">✝</span> Mortalité</button>
                 <button type="button" onClick={() => {
                   setSelectedLot(lot);
                   setLivraisons([{ date: '', quantite: '', poids: '' }]);
                   setShowLivraisonModal(true);
                 }}><span aria-hidden="true">🚚</span> Livraison</button>
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
	               <th>Mortalité</th>
	               <th>Vigilance</th>
	               <th>Actions</th>
             </tr>
           </thead>
           <tbody>
             {sortedLots.map((lot) => {
               const sujetsRestants = calculerSujetsRestants(lot);
	               const mortalitesLot = lot.mortalites.reduce((sum, mort) => sum + mort.nombre, 0);
	               const taux = lot.quantite > 0 ? (mortalitesLot / lot.quantite) * 100 : 0;
	               const age = calculerAgeLot(lot);
	               const vigilance = calculerVigilanceLot(lot);
               return (
                 <tr key={lot.id}>
                   <td><button type="button" className="poultry-lot-link" onClick={() => setDetailLot(lot)}>{lot.nom}</button></td>
                   <td>{lot.batiment}</td>
                   <td>{new Date(`${lot.dateArrivee}T00:00:00`).toLocaleDateString("fr-FR")}</td>
	                   <td>{age} jours</td>
                   <td>{formatNombre(sujetsRestants)}</td>
	                   <td className={taux > 15 ? "poultry-danger-text" : "poultry-success-text"}>{taux.toFixed(2)} %</td>
	                   <td><span className={`poultry-vigilance poultry-vigilance-${vigilance.tone}`}>{vigilance.label}</span></td>
                   <td>
                     <div className="poultry-row-actions">
                       <button type="button" title="Voir la fiche" aria-label={`Voir la fiche du lot ${lot.nom}`} onClick={() => setDetailLot(lot)}>👁</button>
                       <button type="button" className="poultry-action-mortality" title="Enregistrer une mortalité" aria-label={`Enregistrer une mortalité pour le lot ${lot.nom}`} onClick={() => ouvrirMortaliteModal(lot.id)}>✝</button>
                       <button type="button" className="poultry-action-delivery" title="Enregistrer une livraison" aria-label={`Enregistrer une livraison pour le lot ${lot.nom}`} onClick={() => {
                         setSelectedLot(lot);
                         setLivraisons([{ date: '', quantite: '', poids: '' }]);
                         setShowLivraisonModal(true);
                       }}>🚚</button>
                       <button type="button" className="poultry-action-sale" title="Enregistrer la vente" aria-label={`Enregistrer la vente du lot ${lot.nom}`} onClick={() => { setSelectedLot(lot); setVenteModalOpen(true); }}>€</button>
                       <button type="button" className="poultry-action-archive" title="Archiver le lot" aria-label={`Archiver le lot ${lot.nom}`} disabled={saving} onClick={() => archiverLot(lot.id)}>🗃</button>
                       <button type="button" className="poultry-action-delete" title="Supprimer le lot" aria-label={`Supprimer le lot ${lot.nom}`} disabled={saving} onClick={() => supprimerLot(lot)}>🗑</button>
                     </div>
                   </td>
                 </tr>
               );
             })}
             {!sortedLots.length && (
	               <tr><td colSpan={8}><div className="poultry-empty">Aucun lot actif à afficher.</div></td></tr>
             )}
           </tbody>
         </table>
       </div>
     </article>

     <aside className="poultry-quick-actions">
       <h2>Actions rapides</h2>
       <button type="button" onClick={() => setNouveauLotModalOpen(true)}><span>＋</span><div><strong>Nouveau lot</strong><small>Créer un nouveau lot</small></div></button>
       <button type="button" onClick={() => setShowAutoconsommationModal(true)}><span aria-hidden="true">🍽</span><div><strong>Autoconsommation</strong><small>Enregistrer une sortie</small></div></button>
       <Link to="/volailles/alimentation"><span aria-hidden="true">▤</span><div><strong>Suivi de l’alimentation</strong><small>Consommations et stock</small></div></Link>
       <Link to="/volailles/sica/historique"><span aria-hidden="true">🗃</span><div><strong>Voir tous les lots</strong><small>Accéder à l’historique SICA</small></div></Link>
     </aside>
   </section>
 </div>

{nouveauLotModalOpen && (
  <div className="poultry-modal-backdrop">
    <div className="poultry-modal poultry-modal-medium">
      <ModalCloseButton
        onClick={() => setNouveauLotModalOpen(false)}
        disabled={saving}
      />
      <div className="poultry-modal-header">
        <span className="poultry-modal-icon">＋</span>
        <div><h2>Nouveau lot</h2><p>Créer un nouveau lot de volailles.</p></div>
      </div>
      <div className="poultry-form-grid">
        <label>
          Nom
          <input type="text" placeholder="Ex. Lot 12" value={nom} onChange={e => setNom(e.target.value)} />
        </label>
        <label>
          Quantité
          <input type="number" min={1} placeholder="Ex. 1 500" value={quantite} onChange={e => setQuantite(e.target.value)} />
        </label>
        <label>
          Date arrivée
          <input type="date" value={dateArrivee} onChange={e => setDateArrivee(e.target.value)} />
        </label>
        <label>
          Bâtiment
          <input type="text" placeholder="Ex. B1" value={batiment} onChange={e => setBatiment(e.target.value)} />
        </label>
      </div>
      <div className="poultry-modal-actions">
        <button type="button" className="poultry-modal-primary" onClick={ajouterLot} disabled={saving}>
          {saving ? 'Enregistrement...' : '＋ Ajouter le lot'}
        </button>
        <button type="button" className="poultry-modal-secondary" onClick={() => setNouveauLotModalOpen(false)}>Annuler</button>
      </div>
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
    <div className="poultry-modal-backdrop">
      <div className="poultry-modal poultry-modal-large poultry-lot-detail">
        <ModalCloseButton onClick={() => setDetailLot(null)} disabled={saving} />
        <div className="poultry-modal-header poultry-detail-heading">
          <span className="poultry-modal-icon">♧</span>
          <div>
            <h2>{lotDetail.nom}</h2>
            <p>
              {lotDetail.batiment} · arrivé le {lotDetail.dateArrivee} · {ageJours} jours
            </p>
          </div>
        </div>

        <div className="poultry-detail-kpis">
          <div>
            <span>▣</span><small>Quantité initiale</small>
            <strong>{lotDetail.quantite}</strong>
          </div>
          <div>
            <span>♟</span><small>Restants</small>
            <strong>{sujetsRestants}</strong>
          </div>
          <div>
            <span className="poultry-detail-danger">✝</span><small>Mortalités</small>
            <strong>{totalMortalitesLot}</strong>
          </div>
          <div>
            <span>%</span><small>Taux mortalité</small>
            <strong>{tauxMortaliteLot.toFixed(1)} %</strong>
          </div>
        </div>

        <div className="poultry-detail-grid">
          <section className="poultry-detail-section">
            <div className="poultry-detail-section-heading">
              <h3><span>🚚</span> Livraisons</h3>
              <button type="button" onClick={() => {
                setSelectedLot(lotDetail);
                setLivraisons([{ date: '', quantite: '', poids: '' }]);
                setShowLivraisonModal(true);
              }}>＋ Ajouter</button>
            </div>
            {livraisonsExistantes.length === 0 ? (
              <p className="poultry-detail-empty">Aucune livraison enregistrée.</p>
            ) : (
              <div className="poultry-detail-list">
                {livraisonsExistantes.map((livraison, index) => (
                  <div key={livraison.id} className="poultry-detail-row">
                    <div><strong>Livraison {index + 1}</strong><small>{livraison.date || '-'} · {livraison.quantite || 0} unités · {livraison.poids || 0} kg</small></div>
                    <div className="poultry-detail-row-actions">
                      <button
                        type="button"
                        title="Modifier la livraison"
                        onClick={() => setLivraisonEnModification({ ...livraison })}
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        title="Supprimer la livraison"
                        onClick={() => supprimerLivraison(livraison)}
                        disabled={saving}
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="poultry-detail-section">
            <div className="poultry-detail-section-heading">
              <h3><span className="poultry-detail-danger">✝</span> Mortalités</h3>
              <button type="button" onClick={() => ouvrirMortaliteModal(lotDetail.id)}>＋ Ajouter</button>
            </div>
            {lotDetail.mortalites?.length ? (
              <div className="poultry-detail-table-wrap">
                <table className="poultry-detail-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Nombre</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lotDetail.mortalites.map((mortalite) => (
                      <tr key={mortalite.id}>
                        <td>{mortalite.date}</td>
                        <td>{mortalite.nombre}</td>
                        <td>
                          <button
                            type="button"
                            title="Modifier la mortalité"
                            onClick={() => setMortaliteEnModification({ ...mortalite })}
                          >
                            ✎
                          </button>
                          <button
                            type="button"
                            title="Supprimer la mortalité"
                            onClick={() => supprimerMortalite(mortalite)}
                            disabled={saving}
                          >
                            🗑
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="poultry-detail-empty">Aucune mortalité enregistrée.</p>
            )}
          </section>
        </div>

        <div className="poultry-detail-section poultry-detail-finance">
          <div className="poultry-detail-section-heading">
            <h3><span>€</span> Vente et autoconsommation</h3>
            <div>
              <button type="button" onClick={() => {
                setSelectedLot(lotDetail);
                setVenteModalOpen(true);
              }}>＋ Vente</button>
              <button type="button" onClick={() => {
                setSelectedLot(lotDetail);
                setShowAutoconsommationModal(true);
              }}>＋ Autoconsommation</button>
            </div>
          </div>
          <div>
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
  <div className="poultry-modal-backdrop">
    <div className="poultry-modal poultry-modal-medium">
      <ModalCloseButton onClick={() => setShowLivraisonModal(false)} disabled={saving} />
      <div className="poultry-modal-header">
        <span className="poultry-modal-icon">🚚</span>
        <div><h2>Ajouter une ou plusieurs livraisons</h2>{selectedLot && <p>{selectedLot.nom}</p>}</div>
      </div>

      {livraisons.map((livraison, index) => (
        <div key={index} className="poultry-form-block">
          {livraisons.length > 1 && <strong>Livraison {index + 1}</strong>}
          <label>Date de livraison
          <input
            type="date"
            value={livraison.date}
            onChange={(e) => handleInputChange(index, 'date', e.target.value)}
          />
          </label>

          <label>Quantité (unités)
          <input
            type="number"
            step="1"
            placeholder="Ex. 150"
            value={livraison.quantite}
            onChange={(e) => handleInputChange(index, 'quantite', e.target.value)}
          />
          </label>

          <label>Poids (kg)
          <input
            type="number"
            step="0.01"
            placeholder="Ex. 187,5"
            value={livraison.poids}
            onChange={(e) => handleInputChange(index, 'poids', e.target.value)}
          />
          </label>
        </div>
      ))}

      <button
        type="button"
        onClick={addLivraison}
        className="poultry-modal-add"
      >
        ＋ Ajouter une autre livraison
      </button>

      <div className="poultry-modal-actions">
        <button type="button" className="poultry-modal-primary" onClick={async () => {
            const saved = await handleSaveLivraison();
            if (saved) setShowLivraisonModal(false);
          }} disabled={saving}>
          {saving ? 'Enregistrement...' : '▣ Enregistrer les livraisons'}
        </button>
        <button type="button" className="poultry-modal-secondary" onClick={() => setShowLivraisonModal(false)}>Annuler</button>
      </div>
    </div>
  </div>
)}



   {/* Modale pour saisir une mortalité */}
   {mortaliteModalOpen && (
     <div className="poultry-modal-backdrop">
       <div className="poultry-modal poultry-modal-small">
         <ModalCloseButton onClick={() => setMortaliteModalOpen(false)} disabled={saving} />
         <div className="poultry-modal-header poultry-modal-header-danger">
           <span className="poultry-modal-icon">✝</span>
           <div><h2>Ajouter une mortalité</h2><p>{lots.find((lot) => lot.id === mortaliteLotId)?.nom}</p></div>
         </div>
         <div className="poultry-form-stack">
           <label>Date<input type="date" value={mortaliteDate} onChange={e => setMortaliteDate(e.target.value)} /></label>
           <label>Nombre de sujets<input type="number" min={1} placeholder="Ex. 2" value={mortaliteNombre} onChange={e => setMortaliteNombre(e.target.value)} /></label>
         </div>
         <div className="poultry-modal-actions">
           <button type="button" className="poultry-modal-primary" onClick={enregistrerMortalite} disabled={saving}>{saving ? 'Enregistrement...' : '▣ Enregistrer'}</button>
           <button type="button" className="poultry-modal-secondary" onClick={() => setMortaliteModalOpen(false)}>Annuler</button>
         </div>
       </div>
     </div>
   )}

{mortaliteEnModification && (
  <div className="poultry-modal-backdrop poultry-modal-backdrop-front">
    <div className="poultry-modal poultry-modal-small">
      <ModalCloseButton onClick={() => setMortaliteEnModification(null)} disabled={saving} />
      <div className="poultry-modal-header poultry-modal-header-danger">
        <span className="poultry-modal-icon">✝</span>
        <div><h2>Modifier la mortalité</h2><p>Corriger les informations enregistrées.</p></div>
      </div>
      <div className="poultry-form-stack">
        <label>
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
          />
        </label>
        <label>
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
          />
        </label>
      </div>
      <div className="poultry-modal-actions">
        <button type="button" className="poultry-modal-primary" onClick={enregistrerModificationMortalite} disabled={saving}>{saving ? 'Enregistrement...' : '▣ Enregistrer la modification'}</button>
        <button type="button" className="poultry-modal-secondary" onClick={() => setMortaliteEnModification(null)} disabled={saving}>Annuler</button>
      </div>
    </div>
  </div>
)}

{livraisonEnModification && (
  <div className="poultry-modal-backdrop poultry-modal-backdrop-front">
    <div className="poultry-modal poultry-modal-small">
      <ModalCloseButton onClick={() => setLivraisonEnModification(null)} disabled={saving} />
      <div className="poultry-modal-header">
        <span className="poultry-modal-icon">🚚</span>
        <div><h2>Modifier la livraison</h2><p>Corriger les informations enregistrées.</p></div>
      </div>
      <div className="poultry-form-stack">
        <label>
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
          />
        </label>
        <label>
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
          />
        </label>
        <label>
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
          />
        </label>
      </div>
      <div className="poultry-modal-actions">
        <button type="button" className="poultry-modal-primary" onClick={enregistrerModificationLivraison} disabled={saving}>{saving ? 'Enregistrement...' : '▣ Enregistrer la modification'}</button>
        <button type="button" className="poultry-modal-secondary" onClick={() => setLivraisonEnModification(null)} disabled={saving}>Annuler</button>
      </div>
    </div>
  </div>
)}

   {/* Modale pour enregistrer la vente*/}
{venteModalOpen && (
  <div className="poultry-modal-backdrop">
    <div className="poultry-modal poultry-modal-small">
      <ModalCloseButton onClick={() => setVenteModalOpen(false)} disabled={saving} />
      <div className="poultry-modal-header">
        <span className="poultry-modal-icon">€</span>
        <div><h2>Enregistrer la vente du lot</h2>{selectedLot && <p>{selectedLot.nom}</p>}</div>
      </div>
      <div className="poultry-form-stack">
        <label>Date de facture<input type="date" value={factureDate} onChange={(e) => setFactureDate(e.target.value)} /></label>
        <label>Montant brut (€)<input type="number" value={resultatBrut} onChange={(e) => setResultatBrut(e.target.value)} placeholder="Ex. 1 250" /></label>
      </div>
      <div className="poultry-modal-actions">
        <button type="button" className="poultry-modal-primary" onClick={handleEnregistrerVente} disabled={saving}>{saving ? 'Enregistrement...' : '▣ Enregistrer la vente'}</button>
        <button type="button" className="poultry-modal-secondary" onClick={() => setVenteModalOpen(false)}>Annuler</button>
      </div>
    </div>
  </div>
)}

{/* Modale Autoconsommation */}
{showAutoconsommationModal && (
  <div className="poultry-modal-backdrop">
    <div className="poultry-modal poultry-modal-small">
      <ModalCloseButton
        onClick={() => {
          setShowAutoconsommationModal(false);
          setSelectedLot(null);
          setQuantiteAutoconsommationInput('');
        }}
        disabled={saving}
      />
      <div className="poultry-modal-header">
        <span className="poultry-modal-icon">🍽</span>
        <div><h2>Saisir une autoconsommation</h2><p>Enregistrer une sortie de sujets.</p></div>
      </div>
      <div className="poultry-form-stack">
        <label>Sélectionner un lot
          <select
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
        </label>

        {selectedLot && (
          <label>Quantité autoconsommée
            <input
              type="number"
              step="0.01"
              placeholder="Ex. 10"
              value={quantiteAutoconsommationInput}
              onChange={(e) => setQuantiteAutoconsommationInput(e.target.value)}
            />
          </label>
        )}
      </div>

      <div className="poultry-modal-actions">
        {selectedLot && <button type="button" className="poultry-modal-primary" onClick={handleSaveAutoconsommation} disabled={saving}>{saving ? 'Enregistrement...' : '▣ Enregistrer'}</button>}
        <button type="button" className="poultry-modal-secondary" onClick={() => {
            setShowAutoconsommationModal(false);
            setSelectedLot(null);
            setQuantiteAutoconsommationInput('');
          }}>Annuler</button>
      </div>
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
