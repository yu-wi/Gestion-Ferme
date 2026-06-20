import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import frLocale from "@fullcalendar/core/locales/fr";
import type { EventClickArg } from "@fullcalendar/core";
import type { DateClickArg } from "@fullcalendar/interaction";
import { v4 as uuidv4 } from "uuid";
import toast from "react-hot-toast";
import { supabase } from "../supabaseClient";
import AddEventModal from "../outils/AddEventModal";
import {
  CLES_EVENEMENTS_VOLAILLES,
  genererEvenementsVolailles,
} from "../outils/evenementsVolailles";

type AccueilProps = {
  userName: string;
};

type DashboardEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  category: string;
};

type LotDashboard = {
  id: string;
  nom: string;
  batiment: string;
  date_arrivee: string;
  quantite: number;
  sujets_restants: number | null;
  nb_morts: number | null;
  resultat_brut: number | null;
  is_active: boolean;
};

type FeedMovement = {
  feed_type: string;
  quantite_kg: number;
  date?: string;
};

const POIDS_SAC_KG = 25;
const formatNombre = (value: number, decimals = 0) =>
  value.toLocaleString("fr-FR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

const formatDate = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString("fr-FR");

const dateDuJour = () =>
  new Date().toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export default function Accueil({ userName }: AccueilProps) {
  const [events, setEvents] = useState<DashboardEvent[]>([]);
  const [lots, setLots] = useState<LotDashboard[]>([]);
  const [consommations, setConsommations] = useState<FeedMovement[]>([]);
  const [livraisonsAliment, setLivraisonsAliment] = useState<FeedMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterCategory, setFilterCategory] = useState("all");
  const [newEvent, setNewEvent] = useState({
    title: "",
    start: "",
    end: "",
    category: "volailles",
  });

  useEffect(() => {
    const chargerTableauDeBord = async () => {
      const [eventRes, lotsRes, consommationsRes, livraisonsRes] =
        await Promise.all([
          supabase.from("evenements").select("*"),
          supabase
            .from("lots_volailles")
            .select(
              "id, nom, batiment, date_arrivee, quantite, sujets_restants, nb_morts, resultat_brut, is_active"
            )
            .order("date_arrivee", { ascending: false }),
          supabase
            .from("consommations_aliment")
            .select("feed_type, quantite_kg, date"),
          supabase
            .from("livraisons_aliment")
            .select("feed_type, quantite_kg, date"),
        ]);

      if (eventRes.error) console.error("Erreur événements :", eventRes.error);
      if (lotsRes.error) console.error("Erreur lots :", lotsRes.error);
      if (consommationsRes.error)
        console.error("Erreur consommations :", consommationsRes.error);
      if (livraisonsRes.error)
        console.error("Erreur livraisons d'aliment :", livraisonsRes.error);

      const lotsData = (lotsRes.data || []) as LotDashboard[];
      const evenementsLots: DashboardEvent[] = lotsData
        .filter((lot) => lot.is_active)
        .flatMap((lot) => {
          if (!lot.date_arrivee) return [];
          return genererEvenementsVolailles(lot.date_arrivee).map((event) => {
            const date = event.date.toISOString().split("T")[0];
            return {
              id: `${event.key}-${lot.id}`,
              title: `${event.title} - ${lot.nom}`,
              start: date,
              end: date,
              category: "volailles",
            };
          });
        });

      const evenementsManuels = (eventRes.data || []).map((event) => ({
        id: String(event.id),
        title: String(event.title || ""),
        start: String(event.start || ""),
        end: String(event.end || event.start || ""),
        category: String(event.category || "administratif"),
      }));

      setEvents([...evenementsManuels, ...evenementsLots]);
      setLots(lotsData);
      setConsommations(
        (consommationsRes.data || []).map((item) => ({
          ...item,
          quantite_kg: Number(item.quantite_kg) || 0,
        })) as FeedMovement[]
      );
      setLivraisonsAliment(
        (livraisonsRes.data || []).map((item) => ({
          ...item,
          quantite_kg: Number(item.quantite_kg) || 0,
        })) as FeedMovement[]
      );
      setLoading(false);
    };

    chargerTableauDeBord();
  }, []);

  const lotsActifs = lots.filter((lot) => lot.is_active);
  const lotsArchives = lots.filter((lot) => !lot.is_active);
  const sujetsInitiaux = lotsActifs.reduce(
    (total, lot) => total + (Number(lot.quantite) || 0),
    0
  );
  const sujetsRestants = lotsActifs.reduce(
    (total, lot) =>
      total +
      (lot.sujets_restants == null
        ? Number(lot.quantite) || 0
        : Number(lot.sujets_restants) || 0),
    0
  );
  const mortalites = lotsActifs.reduce(
    (total, lot) => total + (Number(lot.nb_morts) || 0),
    0
  );
  const resultatBrut = lotsArchives.reduce(
    (total, lot) => total + (Number(lot.resultat_brut) || 0),
    0
  );
  const stockKg =
    livraisonsAliment.reduce((total, item) => total + item.quantite_kg, 0) -
    consommations.reduce((total, item) => total + item.quantite_kg, 0);
  const consommationDuJourKg = consommations
    .filter((item) => item.date === new Date().toISOString().split("T")[0])
    .reduce((total, item) => total + item.quantite_kg, 0);

  const repartition = useMemo(() => {
    const total = Math.max(1, sujetsInitiaux);
    const restants = Math.max(0, sujetsRestants);
    const livresOuSortis = Math.max(0, sujetsInitiaux - restants - mortalites);
    return {
      restants,
      mortalites,
      livresOuSortis,
      angleRestants: (restants / total) * 360,
      angleMortalites: ((restants + mortalites) / total) * 360,
    };
  }, [sujetsInitiaux, sujetsRestants, mortalites]);

  const resetModal = () => {
    setNewEvent({ title: "", start: "", end: "", category: "volailles" });
    setIsOpen(false);
    setIsEdit(false);
    setSelectedEventId(null);
  };

  const handleDateClick = (arg: DateClickArg) => {
    const date = arg.date.toISOString();
    setNewEvent({ title: "", start: date, end: date, category: "volailles" });
    setIsEdit(false);
    setIsOpen(true);
  };

  const handleEventClick = (clickInfo: EventClickArg) => {
    const { id, title, start, end, extendedProps } = clickInfo.event;
    if (
      CLES_EVENEMENTS_VOLAILLES.some((key) =>
        id.startsWith(`${key}-`)
      )
    ) {
      return;
    }
    if (!start) return;
    setSelectedEventId(id);
    setNewEvent({
      title,
      start: start.toISOString(),
      end: (end || start).toISOString(),
      category: extendedProps.category || "volailles",
    });
    setIsEdit(true);
    setIsOpen(true);
  };

  const handleAddOrUpdateEvent = async () => {
    if (saving || !newEvent.title.trim() || !newEvent.start) return;
    setSaving(true);

    if (isEdit && selectedEventId) {
      const { error } = await supabase
        .from("evenements")
        .update(newEvent)
        .eq("id", selectedEventId);
      if (error) {
        toast.error("L'événement n'a pas pu être modifié.");
      } else {
        setEvents((items) =>
          items.map((item) =>
            item.id === selectedEventId ? { ...item, ...newEvent } : item
          )
        );
        toast.success("Événement modifié.");
        resetModal();
      }
    } else {
      const id = uuidv4();
      const { error } = await supabase
        .from("evenements")
        .insert({ id, ...newEvent });
      if (error) {
        toast.error("L'événement n'a pas pu être ajouté.");
      } else {
        setEvents((items) => [...items, { id, ...newEvent }]);
        toast.success("Événement ajouté.");
        resetModal();
      }
    }
    setSaving(false);
  };

  const handleDeleteEvent = async () => {
    if (saving || !selectedEventId) return;
    setSaving(true);
    const { error } = await supabase
      .from("evenements")
      .delete()
      .eq("id", selectedEventId);
    if (error) {
      toast.error("L'événement n'a pas pu être supprimé.");
    } else {
      setEvents((items) => items.filter((item) => item.id !== selectedEventId));
      toast.success("Événement supprimé.");
      resetModal();
    }
    setSaving(false);
  };

  const evenementsFiltres = events
    .filter(
      (event) => filterCategory === "all" || event.category === filterCategory
    )
    .map((event) => ({
      ...event,
      className: `event-${event.category}`,
      extendedProps: { category: event.category },
    }));

  if (loading) {
    return <div className="dashboard-loading">Chargement du tableau de bord...</div>;
  }

  return (
    <div className="dashboard-page">
      <header className="dashboard-heading">
        <div>
          <h1>Bonjour {userName || "à vous"}</h1>
          <p>Voici un aperçu de votre exploitation.</p>
        </div>
        <div className="dashboard-date">
          <span className="dashboard-weather">☀</span>
          <span>{dateDuJour()}</span>
        </div>
      </header>

      <section className="dashboard-kpis">
        <KpiCard icon="▣" tone="green" label="Stock total" value={`${formatNombre(stockKg / POIDS_SAC_KG, 2)} sacs`} note="Disponible" />
        <KpiCard icon="↗" tone="blue" label="Consommé aujourd’hui" value={`${formatNombre(consommationDuJourKg / POIDS_SAC_KG, 2)} sacs`} note="Suivi quotidien" />
        <KpiCard icon="◉" tone="orange" label="Lots actifs" value={`${lotsActifs.length}`} note={`${formatNombre(sujetsRestants)} sujets restants`} />
        <KpiCard icon="€" tone="violet" label="Résultat brut archivé" value={`${formatNombre(resultatBrut, 2)} €`} note={`${lotsArchives.length} lots archivés`} />
      </section>

      <section className="dashboard-grid">
        <article className="dashboard-panel dashboard-production">
          <PanelTitle icon="◔" title="Aperçu de la production" />
          <div className="production-content">
            <div
              className="production-ring"
              style={{
                background: `conic-gradient(#37b45a 0deg ${repartition.angleRestants}deg, #ef4444 ${repartition.angleRestants}deg ${repartition.angleMortalites}deg, #f59e0b ${repartition.angleMortalites}deg 360deg)`,
              }}
            >
              <div className="production-ring-center">
                <span>Lots actifs</span>
                <strong>{lotsActifs.length}</strong>
              </div>
            </div>
            <div className="production-legend">
              <Legend color="#37b45a" label="Sujets restants" value={repartition.restants} />
              <Legend color="#f59e0b" label="Sujets sortis" value={repartition.livresOuSortis} />
              <Legend color="#ef4444" label="Mortalités" value={repartition.mortalites} />
              <Legend color="#4f83cc" label="Sujets initiaux" value={sujetsInitiaux} />
            </div>
          </div>
        </article>

        <article className="dashboard-panel dashboard-finance">
          <PanelTitle icon="€" title="Résultats financiers" />
          <div className="finance-grid">
            <div className="finance-value">
              <span>Résultat brut enregistré</span>
              <strong>{resultatBrut.toFixed(2)} €</strong>
            </div>
            <div className="finance-value">
              <span>Lots clôturés</span>
              <strong>{lotsArchives.length}</strong>
            </div>
          </div>
          <div className="dashboard-information">
            Consultez l’analyse économique pour le détail par lot.
          </div>
          <Link className="dashboard-text-link" to="/volailles/analyse">
            Ouvrir l’analyse →
          </Link>
        </article>

        <article className="dashboard-panel dashboard-calendar">
          <div className="panel-title-row">
            <PanelTitle icon="□" title="Planning" />
            <select
              value={filterCategory}
              onChange={(event) => setFilterCategory(event.target.value)}
              className="dashboard-filter"
            >
              <option value="all">Tous</option>
              <option value="volailles">Volailles</option>
              <option value="aquaponie">Aquaponie</option>
              <option value="cultures">Cultures</option>
              <option value="ovins">Ovins</option>
              <option value="administratif">Administratif</option>
            </select>
          </div>
          <FullCalendar
            plugins={[dayGridPlugin, interactionPlugin]}
            locale={frLocale}
            initialView="dayGridMonth"
            firstDay={1}
            timeZone="America/Martinique"
            headerToolbar={{ left: "prev,next", center: "title", right: "today" }}
            events={evenementsFiltres}
            dateClick={handleDateClick}
            eventClick={handleEventClick}
            height="auto"
          />
        </article>

        <article className="dashboard-panel dashboard-lots">
          <div className="panel-title-row">
            <PanelTitle icon="▤" title="Lots en cours" />
            <Link className="dashboard-primary-link" to="/volailles">
              Gérer les lots →
            </Link>
          </div>
          <div className="dashboard-lot-list">
            {lotsActifs.slice(0, 5).map((lot) => (
              <div className="dashboard-lot-row" key={lot.id}>
                <div>
                  <strong>{lot.nom}</strong>
                  <span>{lot.batiment || "Bâtiment non renseigné"}</span>
                </div>
                <div>
                  <span>Arrivée</span>
                  <strong>{formatDate(lot.date_arrivee)}</strong>
                </div>
                <div>
                  <span>Sujets restants</span>
                  <strong>{formatNombre(lot.sujets_restants == null ? lot.quantite : lot.sujets_restants)}</strong>
                </div>
                <span className={`lot-status ${lot.is_active ? "lot-status-active" : "lot-status-archived"}`}>
                  En cours
                </span>
              </div>
            ))}
            {lotsActifs.length === 0 && (
              <div className="dashboard-empty">Aucun lot en cours.</div>
            )}
          </div>
        </article>

        <aside className="dashboard-side-column">
          <article className="dashboard-panel dashboard-feed-card">
            <PanelTitle icon="▣" title="Alimentation" />
            <span>Stock disponible</span>
            <strong>{formatNombre(stockKg / POIDS_SAC_KG, 2)} sacs</strong>
            <Link to="/volailles/alimentation">Gérer l’alimentation →</Link>
          </article>
          <article className="dashboard-panel dashboard-reminders">
            <PanelTitle icon="!" title="Repères rapides" />
            <Link to="/volailles">{lotsActifs.length} lots actuellement actifs</Link>
            <Link to="/volailles/historique">{lotsArchives.length} lots archivés</Link>
            <Link to="/volailles/analyse">{mortalites} mortalités sur les lots actifs</Link>
          </article>
        </aside>
      </section>

      <AddEventModal
        isOpen={isOpen}
        onClose={resetModal}
        isEdit={isEdit}
        newEvent={newEvent}
        setNewEvent={setNewEvent}
        onSubmit={handleAddOrUpdateEvent}
        onDelete={handleDeleteEvent}
        saving={saving}
      />
    </div>
  );
}

function KpiCard({
  icon,
  tone,
  label,
  value,
  note,
}: {
  icon: string;
  tone: string;
  label: string;
  value: string;
  note: string;
}) {
  return (
    <article className="dashboard-kpi">
      <div className={`dashboard-kpi-icon dashboard-kpi-${tone}`}>{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{note}</small>
      </div>
    </article>
  );
}

function PanelTitle({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="panel-title">
      <span>{icon}</span>
      <h2>{title}</h2>
    </div>
  );
}

function Legend({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: number;
}) {
  return (
    <div className="production-legend-row">
      <i style={{ backgroundColor: color }} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
