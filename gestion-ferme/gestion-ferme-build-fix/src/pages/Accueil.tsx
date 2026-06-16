import { useState, useEffect} from 'react';
import { Link } from "react-router-dom";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import { supabase } from '../supabaseClient';
import { v4 as uuidv4 } from "uuid";
import frLocale from '@fullcalendar/core/locales/fr';
import timeGridPlugin from '@fullcalendar/timegrid';
import AddEventModal from "../outils/AddEventModal";


export default function Accueil() {
 const [events, setEvents] = useState<any[]>([]);
 const [isOpen, setIsOpen] = useState(false);
 const [isEdit, setIsEdit] = useState(false);
 const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
 const [newEvent, setNewEvent] = useState({
  title: '',
  start: '',
  end: '',
  category: '',
 });

 useEffect(() => {
  const fetchAllEvents = async () => {
    const [eventRes, volaillesRes] = await Promise.all([
      supabase.from("evenements").select("*"),
      supabase.from("lots_volailles").select("*"),
    ]);

    const eventData = eventRes.data || [];
    const lotData = volaillesRes.data || [];

    if (eventRes.error) console.error("Erreur événements :", eventRes.error);
    if (volaillesRes.error) console.error("Erreur lots volailles :", volaillesRes.error);

    // Génération des événements volailles
    const volaillesEvents = lotData.flatMap((lot: any) => {
      const dateArrivee = lot.date_arrivee || lot.date;
      if (!dateArrivee) return [];

      const events = [];

      const formatDate = (date: Date) => date.toISOString().split("T")[0];

      const date = new Date(dateArrivee);

      events.push({
        id: `reception-${lot.id}`,
        title: `Réception - ${lot.nom || "Lot"}`,
        start: formatDate(date),
        end: formatDate(date),
        category: "volailles",
      });

      const poussiniere = new Date(date);
      poussiniere.setDate(poussiniere.getDate() + 3);
      events.push({
        id: `poussiniere-${lot.id}`,
        title: `Ouverture poussinière - ${lot.nom || "Lot"}`,
        start: formatDate(poussiniere),
        end: formatDate(poussiniere),
        category: "volailles",
      });

      const vaccination = new Date(date);
      vaccination.setDate(vaccination.getDate() + 15);
      events.push({
        id: `vaccination-${lot.id}`,
        title: `Vaccination - ${lot.nom || "Lot"}`,
        start: formatDate(vaccination),
        end: formatDate(vaccination),
        category: "volailles",
      });

      const analyse = new Date(date);
      analyse.setDate(analyse.getDate() + 46);
      events.push({
        id: `analyse-${lot.id}`,
        title: `Analyse - ${lot.nom || "Lot"}`,
        start: formatDate(analyse),
        end: formatDate(analyse),
        category: "volailles",
      });

      const livraison = new Date(date);
      livraison.setDate(livraison.getDate() + 70);
      events.push({
        id: `livraison-${lot.id}`,
        title: `Livraison - ${lot.nom || "Lot"}`,
        start: formatDate(livraison),
        end: formatDate(livraison),
        category: "volailles",
      });

      return events;
    });

    // Combine les deux
    setEvents([...eventData, ...volaillesEvents]);
  };

  fetchAllEvents();
}, []);


 const resetModal = () => {
   setNewEvent({ title: "", start: "", end: "", category: "volailles" });
   setIsOpen(false);
   setIsEdit(false);
   setSelectedEventId(null);
 };


 const handleDateClick = (arg: any) => {
   setNewEvent({
     title: "",
     start: new Date(arg.date).toISOString(),
      end: new Date(arg.date).toISOString(),
     category: "volailles",
   });
   setIsEdit(false);
   setIsOpen(true);
 };


 const handleEventClick = (clickInfo: any) => {
   const { id, title, start, end, extendedProps } = clickInfo.event;
   setSelectedEventId(id);
   setNewEvent({
     title,
     start: start.toISOString(),
      end: end ? end.toISOString() : start.toISOString(),
     category: extendedProps.category || "volailles",
   });
   setIsEdit(true);
   setIsOpen(true);
 };


 const handleAddOrUpdateEvent = async () => {
  if (isEdit && selectedEventId) {
    // 🔄 Mettre à jour dans Supabase
    const { error } = await supabase
      .from("evenements")
      .update({
        title: newEvent.title,
        start: newEvent.start,
        end: newEvent.end,
        category: newEvent.category
      })
      .eq("id", selectedEventId);

    if (error) {
      console.error("Erreur lors de la mise à jour :", error);
      return;
    }

    setEvents((prev) =>
      prev.map((event) =>
        event.id === selectedEventId ? { ...event, ...newEvent } : event
      )
    );
  } else {
    const id = uuidv4();
    const { error } = await supabase.from("evenements").insert([
      {
        id,
        title: newEvent.title,
        start: newEvent.start,
        end: newEvent.end,
        category: newEvent.category
      }
    ]);

    if (error) {
      console.error("Erreur lors de l'ajout :", error);
      return;
    }

    setEvents([...events, { ...newEvent, id }]);
  }

  resetModal();
};

const handleDeleteEvent = async () => {
  if (selectedEventId) {
    const { error } = await supabase
      .from("evenements")
      .delete()
      .eq("id", selectedEventId);

    if (error) {
      console.error("Erreur suppression :", error);
      return;
    }

    setEvents(events.filter((e) => e.id !== selectedEventId));
  }

  resetModal();
};

 const [filterCategory, setFilterCategory] = useState("all");  // Par défaut, tous les événements sont visibles

 return (
   <div className="space-y-8">
     {/* Titre */}
     <h1 className="text-3xl font-bold text-center">La Ferme de Bernard</h1>

     {/* Logos */}
     <div className="logo-container grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
       {[
       ].map(({ to, img, label }) => (
         <Link to={to} key={to} className="logo-card">
           <div className="bg-white rounded-xl p-4 shadow-md text-center hover:bg-gray-100">
             <img src={img} className="logo mx-auto" alt={`${label} logo`} />
             <p className="mt-2 font-semibold">{label}</p>
           </div>
         </Link>
       ))}
     </div>

     {/* Planning mensuel */}
     <div className="bg-white p-4 rounded-xl shadow-xl">
       <h2 className="text-xl font-semibold mb-4 text-center">Planning mensuel</h2>
       <div className="mb-4 text-center">
 <label className="text-lg font-semibold">Filtrer par catégorie</label>
 <select
   value={filterCategory}
   onChange={(e) => setFilterCategory(e.target.value)}
   className="mt-2 px-4 py-2 border rounded-md"
 >
   <option value="all">Tous</option>
   <option value="volailles">Volailles</option>
   <option value="aquaponie">Aquaponie</option>
   <option value="cultures">Cultures</option>
   <option value="ovins">Ovins</option>
   <option value="ovins">Administratif</option>
 </select>
</div>
       <FullCalendar
 plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
 locale={frLocale}
 initialView="dayGridMonth"
 firstDay={1}
 timeZone="America/Martinique"
 headerToolbar={{
  left: 'prev,next today',
  center: 'title',
  right: 'dayGridMonth,timeGridWeek,timeGridDay' // boutons affichés
}}
 events={events.filter(event => filterCategory === "all" || event.category === filterCategory).map(event => ({
   id: event.id,
   title: event.title,
   start: event.start,
   end: event.end,
   className: getClassByCategory(event.category), 
   extendedProps: {
     category: event.category,
   },
 }))}
 dateClick={handleDateClick}
 eventClick={handleEventClick}
 height="auto"
/>
     </div>

    

     {/* Modal d'ajout/édition */}
     <AddEventModal
  isOpen={isOpen}
  onClose={resetModal}
  isEdit={isEdit}
  newEvent={newEvent}
  setNewEvent={setNewEvent}
  onSubmit={handleAddOrUpdateEvent}
  onDelete={handleDeleteEvent}
/>
   </div>
 );
}


// 🔵 Couleurs par catégorie
function getClassByCategory(category: string) {
 switch (category) {
   case "volailles":
     return "event-volailles";
   case "aquaponie":
     return "event-aquaponie";
   case "cultures":
     return "event-cultures";
   case "ovins":
     return "event-ovins";
    case "administratif":
     return "event-administratif";
   default:
     return "";
 }
}