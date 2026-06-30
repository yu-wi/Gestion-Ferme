import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import ModalCloseButton from "../components/ModalCloseButton";
import { supabase } from "../supabaseClient";
import { formatNombre } from "../outils/formatNombre";

type ManualEvent = {
  id: string;
  title: string | null;
  start: string | null;
  end: string | null;
  category: string | null;
};

type SicaLot = {
  id: string;
  nom: string;
  batiment: string | null;
  date_arrivee: string | null;
  is_active: boolean;
};

type DirectLot = {
  id: string;
  name: string;
  species: "poulet" | "pintade";
  location: string | null;
  arrival_date: string | null;
  status: string;
};

type PlanningEventType =
  | "reception"
  | "vaccination"
  | "livraison"
  | "alerte"
  | "soin"
  | "analyse"
  | "manuel";

type PlanningTone = "green" | "violet" | "blue" | "orange" | "red" | "neutral";

type PlanningEvent = {
  id: string;
  title: string;
  detail: string;
  date: Date;
  iso: string;
  type: PlanningEventType;
  tone: PlanningTone;
  icon: string;
  source: "automatique" | "manuel";
  to?: string;
};

type TrackingRule = {
  key: string;
  title: string;
  offset: number;
  type: PlanningEventType;
  tone: PlanningTone;
  icon: string;
};

const MONTH_LABEL_FORMAT = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric",
});

const DATE_LABEL_FORMAT = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const WEEK_DAYS = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."];

const POULTRY_TRACKING_RULES: TrackingRule[] = [
  { key: "reception", title: "Réception", offset: 0, type: "reception", tone: "green", icon: "▣" },
  { key: "hydrostart-1", title: "Hydrostart", offset: 0, type: "soin", tone: "blue", icon: "💧" },
  { key: "hydrostart-2", title: "Hydrostart", offset: 1, type: "soin", tone: "blue", icon: "💧" },
  { key: "hydrostart-3", title: "Hydrostart", offset: 2, type: "soin", tone: "blue", icon: "💧" },
  { key: "selenium-4", title: "Sélénium + Vit E", offset: 3, type: "soin", tone: "orange", icon: "✚" },
  { key: "vaccin-poulvac", title: "Vaccin POULVAC", offset: 4, type: "vaccination", tone: "violet", icon: "💉" },
  { key: "selenium-6", title: "Sélénium + Vit E", offset: 5, type: "soin", tone: "orange", icon: "✚" },
  { key: "selenium-7", title: "Sélénium + Vit E", offset: 6, type: "soin", tone: "orange", icon: "✚" },
  { key: "vitamines-10", title: "Vitamines", offset: 9, type: "soin", tone: "orange", icon: "✚" },
  { key: "vitamines-11", title: "Vitamines", offset: 10, type: "soin", tone: "orange", icon: "✚" },
  { key: "vaccins-gumboro", title: "Vaccins Gumboro - AVINEW - Nobilis", offset: 13, type: "vaccination", tone: "violet", icon: "💉" },
  { key: "vitamines-18", title: "Vitamines", offset: 17, type: "soin", tone: "orange", icon: "✚" },
  { key: "vitamines-19", title: "Vitamines", offset: 18, type: "soin", tone: "orange", icon: "✚" },
  { key: "rappel-gumboro", title: "Rappel Gumboro", offset: 20, type: "vaccination", tone: "violet", icon: "💉" },
  { key: "vitamines-24", title: "Vitamines", offset: 23, type: "soin", tone: "orange", icon: "✚" },
  { key: "vitamines-25", title: "Vitamines", offset: 24, type: "soin", tone: "orange", icon: "✚" },
  { key: "vitamines-31", title: "Vitamines", offset: 30, type: "soin", tone: "orange", icon: "✚" },
  { key: "vitamines-32", title: "Vitamines", offset: 31, type: "soin", tone: "orange", icon: "✚" },
  { key: "vitamines-37", title: "Vitamines", offset: 36, type: "soin", tone: "orange", icon: "✚" },
  { key: "vitamines-38", title: "Vitamines", offset: 37, type: "soin", tone: "orange", icon: "✚" },
  { key: "vitamines-41", title: "Vitamines", offset: 40, type: "soin", tone: "orange", icon: "✚" },
  { key: "vitamines-42", title: "Vitamines", offset: 41, type: "soin", tone: "orange", icon: "✚" },
  { key: "analyse", title: "Analyse sanitaire", offset: 46, type: "analyse", tone: "orange", icon: "⌕" },
  { key: "vitamines-49", title: "Vitamines", offset: 48, type: "soin", tone: "orange", icon: "✚" },
  { key: "vitamines-50", title: "Vitamines", offset: 49, type: "soin", tone: "orange", icon: "✚" },
  { key: "vitamines-56", title: "Vitamines", offset: 55, type: "soin", tone: "orange", icon: "✚" },
  { key: "vitamines-57", title: "Vitamines", offset: 56, type: "soin", tone: "orange", icon: "✚" },
  { key: "vitamines-63", title: "Vitamines", offset: 62, type: "soin", tone: "orange", icon: "✚" },
  { key: "vitamines-64", title: "Vitamines", offset: 63, type: "soin", tone: "orange", icon: "✚" },
  { key: "livraison", title: "Livraison prévue", offset: 70, type: "livraison", tone: "blue", icon: "🚚" },
];

const DIRECT_PINTADE_RULES: TrackingRule[] = [
  { key: "reception", title: "Réception", offset: 0, type: "reception", tone: "green", icon: "▣" },
  { key: "controle-30", title: "Contrôle sanitaire", offset: 29, type: "soin", tone: "orange", icon: "✚" },
  { key: "controle-60", title: "Contrôle sanitaire", offset: 59, type: "soin", tone: "orange", icon: "✚" },
  { key: "pret-vente", title: "Lot prêt à vendre", offset: 99, type: "livraison", tone: "blue", icon: "🚚" },
];

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(isoDate: string, offset: number) {
  const date = new Date(`${isoDate}T00:00:00`);
  date.setDate(date.getDate() + offset);
  return date;
}

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function readIsoDate(value: string | null | undefined) {
  if (!value) return null;
  const iso = value.slice(0, 10);
  const date = new Date(`${iso}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysBetween(from: Date, to: Date) {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86400000);
}

function sameMonth(date: Date, month: Date) {
  return date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth();
}

function buildCalendarDays(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const startOffset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - startOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function relativeLabel(eventDate: Date, today: Date) {
  const days = daysBetween(today, eventDate);
  if (days < 0) return "En retard";
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return "Demain";
  return `Dans ${days} jours`;
}

function eventTypeLabel(type: PlanningEventType) {
  if (type === "reception") return "Réceptions";
  if (type === "vaccination") return "Vaccinations";
  if (type === "livraison") return "Livraisons";
  if (type === "analyse") return "Analyses";
  if (type === "soin") return "Soins";
  if (type === "alerte") return "Alertes";
  return "Autres";
}

function manualEventMeta(category: string | null | undefined): Pick<PlanningEvent, "type" | "tone" | "icon"> {
  if (category === "volailles") return { type: "manuel", tone: "green", icon: "□" };
  if (category === "alimentation") return { type: "livraison", tone: "blue", icon: "🚚" };
  if (category === "sanitaire") return { type: "alerte", tone: "red", icon: "!" };
  return { type: "manuel", tone: "neutral", icon: "•" };
}

export default function Planning() {
  const [manualEvents, setManualEvents] = useState<ManualEvent[]>([]);
  const [sicaLots, setSicaLots] = useState<SicaLot[]>([]);
  const [directLots, setDirectLots] = useState<DirectLot[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<PlanningEventType | "all" | "autres">("all");
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: "",
    date: toIsoDate(new Date()),
    category: "volailles",
  });

  useEffect(() => {
    const loadPlanning = async () => {
      setLoading(true);
      const [eventsResult, sicaResult, directResult] = await Promise.all([
        supabase.from("evenements").select("id, title, start, end, category"),
        supabase
          .from("lots_volailles")
          .select("id, nom, batiment, date_arrivee, is_active")
          .eq("is_active", true)
          .order("date_arrivee", { ascending: false }),
        supabase
          .from("direct_sale_lots")
          .select("id, name, species, location, arrival_date, status")
          .neq("status", "termine")
          .order("arrival_date", { ascending: false }),
      ]);

      if (eventsResult.error) console.error("Erreur planning :", eventsResult.error);
      if (sicaResult.error) console.error("Erreur lots SICA :", sicaResult.error);
      if (directResult.error && directResult.error.code !== "42P01") {
        console.error("Erreur lots vente directe :", directResult.error);
      }

      setManualEvents((eventsResult.data || []) as ManualEvent[]);
      setSicaLots((sicaResult.data || []) as SicaLot[]);
      setDirectLots((directResult.data || []) as DirectLot[]);
      setLoading(false);
    };

    loadPlanning();
  }, []);

  const allEvents = useMemo<PlanningEvent[]>(() => {
    const manual = manualEvents.flatMap((event) => {
      const date = readIsoDate(event.start);
      if (!date) return [];
      const meta = manualEventMeta(event.category);
      return [
        {
          id: `manual-${event.id}`,
          title: event.title || "Événement",
          detail: eventTypeLabel(meta.type),
          date,
          iso: toIsoDate(date),
          type: meta.type,
          tone: meta.tone,
          icon: meta.icon,
          source: "manuel" as const,
        },
      ];
    });

    const sica = sicaLots.flatMap((lot) => {
      if (!lot.date_arrivee) return [];
      return POULTRY_TRACKING_RULES.map((rule) => {
        const date = addDays(lot.date_arrivee!, rule.offset);
        return {
          id: `sica-${lot.id}-${rule.key}`,
          title: `${rule.title} lot ${lot.nom}`,
          detail: lot.batiment ? `${DATE_LABEL_FORMAT.format(date)} · ${lot.batiment}` : DATE_LABEL_FORMAT.format(date),
          date,
          iso: toIsoDate(date),
          type: rule.type,
          tone: rule.tone,
          icon: rule.icon,
          source: "automatique" as const,
          to: "/volailles/sica",
        };
      });
    });

    const direct = directLots.flatMap((lot) => {
      if (!lot.arrival_date) return [];
      const rules = lot.species === "pintade" ? DIRECT_PINTADE_RULES : POULTRY_TRACKING_RULES;
      return rules.map((rule) => {
        const date = addDays(lot.arrival_date!, rule.offset);
        return {
          id: `direct-${lot.id}-${rule.key}`,
          title: `${rule.title} lot ${lot.name}`,
          detail: lot.location
            ? `${DATE_LABEL_FORMAT.format(date)} · ${lot.species} · ${lot.location}`
            : `${DATE_LABEL_FORMAT.format(date)} · ${lot.species}`,
          date,
          iso: toIsoDate(date),
          type: rule.type,
          tone: rule.tone,
          icon: rule.icon,
          source: "automatique" as const,
          to: "/volailles/vente-directe",
        };
      });
    });

    return [...manual, ...sica, ...direct].sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [directLots, manualEvents, sicaLots]);

  const filteredEvents = useMemo(() => {
    if (filter === "all") return allEvents;
    if (filter === "autres") {
      return allEvents.filter((event) =>
        ["alerte", "soin", "analyse", "manuel"].includes(event.type)
      );
    }
    return allEvents.filter((event) => event.type === filter);
  }, [allEvents, filter]);

  const today = useMemo(() => startOfDay(new Date()), []);
  const monthEvents = useMemo(
    () => filteredEvents.filter((event) => sameMonth(event.date, currentMonth)),
    [currentMonth, filteredEvents]
  );
  const calendarDays = useMemo(() => buildCalendarDays(currentMonth), [currentMonth]);
  const upcomingEvents = useMemo(
    () =>
      filteredEvents
        .filter((event) => daysBetween(today, event.date) >= 0)
        .slice(0, 8),
    [filteredEvents, today]
  );

  const reminders = useMemo(
    () =>
      allEvents
        .filter((event) => {
          const diff = daysBetween(today, event.date);
          return diff >= 0 && diff <= 31 && event.type !== "reception";
        })
        .slice(0, 3),
    [allEvents, today]
  );

  const stats = useMemo(() => {
    const currentMonthEvents = allEvents.filter((event) => sameMonth(event.date, currentMonth));
    return {
      receptions: currentMonthEvents.filter((event) => event.type === "reception").length,
      vaccinations: currentMonthEvents.filter((event) => event.type === "vaccination").length,
      livraisons: currentMonthEvents.filter((event) => event.type === "livraison").length,
      alertes: allEvents.filter((event) => {
        const diff = daysBetween(today, event.date);
        return diff >= 0 && diff <= 7 && ["alerte", "analyse"].includes(event.type);
      }).length,
    };
  }, [allEvents, currentMonth, today]);

  const saveManualEvent = async () => {
    if (!newEvent.title.trim()) {
      toast.error("Ajoute un titre pour l'événement.");
      return;
    }

    setSaving(true);
    const payload = {
      id: crypto.randomUUID(),
      title: newEvent.title.trim(),
      start: `${newEvent.date}T09:00:00`,
      end: `${newEvent.date}T09:00:00`,
      category: newEvent.category,
    };
    const { error } = await supabase.from("evenements").insert(payload);
    setSaving(false);

    if (error) {
      console.error("Erreur ajout événement :", error);
      toast.error("L'événement n'a pas pu être enregistré.");
      return;
    }

    setManualEvents((current) => [payload, ...current]);
    setNewEvent({ title: "", date: toIsoDate(new Date()), category: "volailles" });
    setModalOpen(false);
    toast.success("Événement ajouté au planning.");
  };

  if (loading) {
    return <div className="dashboard-loading">Chargement du planning...</div>;
  }

  return (
    <div className="planning-page">
      <header className="planning-heading">
        <div className="planning-heading-main">
          <span className="planning-heading-icon">▦</span>
          <div>
            <h1>Planning de l'exploitation</h1>
            <p>Visualisez et gérez tous les événements à venir.</p>
          </div>
        </div>
        <button type="button" className="planning-add-button" onClick={() => setModalOpen(true)}>
          <span>＋</span> Ajouter un événement
        </button>
      </header>

      <section className="planning-kpis">
        <PlanningKpi icon="▣" label="Réceptions" value={stats.receptions} detail="Ce mois-ci" tone="green" />
        <PlanningKpi icon="💉" label="Vaccinations" value={stats.vaccinations} detail="Ce mois-ci" tone="violet" />
        <PlanningKpi icon="🚚" label="Livraisons" value={stats.livraisons} detail="Ce mois-ci" tone="blue" />
        <PlanningKpi icon="!" label="Alertes" value={stats.alertes} detail="À traiter" tone="red" />
      </section>

      <section className="planning-toolbar">
        <div className="planning-month-nav">
          <button
            type="button"
            aria-label="Mois précédent"
            onClick={() => setCurrentMonth((month) => new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          >
            ‹
          </button>
          <h2>{MONTH_LABEL_FORMAT.format(currentMonth)}</h2>
          <button
            type="button"
            aria-label="Mois suivant"
            onClick={() => setCurrentMonth((month) => new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          >
            ›
          </button>
        </div>
        <div className="planning-filter-tabs" aria-label="Filtrer le planning">
          <button type="button" className={filter === "all" ? "planning-filter-active" : ""} onClick={() => setFilter("all")}>
            ▦ Tous les événements
          </button>
          <button type="button" className={filter === "reception" ? "planning-filter-active" : ""} onClick={() => setFilter("reception")}>
            ▣ Réceptions
          </button>
          <button type="button" className={filter === "vaccination" ? "planning-filter-active" : ""} onClick={() => setFilter("vaccination")}>
            💉 Vaccinations
          </button>
          <button type="button" className={filter === "livraison" ? "planning-filter-active" : ""} onClick={() => setFilter("livraison")}>
            🚚 Livraisons
          </button>
          <button type="button" className={filter === "autres" ? "planning-filter-active" : ""} onClick={() => setFilter("autres")}>
            Autres
          </button>
        </div>
      </section>

      <section className="planning-main-grid">
        <article className="planning-calendar-card">
          <div className="planning-calendar-grid">
            {WEEK_DAYS.map((day) => (
              <div key={day} className="planning-calendar-weekday">{day}</div>
            ))}
            {calendarDays.map((day) => {
              const iso = toIsoDate(day);
              const dayEvents = monthEvents.filter((event) => event.iso === iso);
              return (
                <div
                  key={iso}
                  className={[
                    "planning-calendar-day",
                    sameMonth(day, currentMonth) ? "" : "planning-calendar-day-muted",
                    iso === toIsoDate(today) ? "planning-calendar-day-today" : "",
                  ].filter(Boolean).join(" ")}
                >
                  <span>{day.getDate()}</span>
                  <div className="planning-calendar-events">
                    {dayEvents.slice(0, 2).map((event) => (
                      <PlanningEventChip key={event.id} event={event} />
                    ))}
                    {dayEvents.length > 2 && (
                      <small className="planning-calendar-more">+{dayEvents.length - 2}</small>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </article>

        <aside className="planning-upcoming-card">
          <div className="planning-panel-heading">
            <span>▦</span>
            <div>
              <h2>Prochains événements</h2>
              <p>{formatNombre(upcomingEvents.length)} événement(s) à venir</p>
            </div>
          </div>
          <div className="planning-upcoming-list">
            {upcomingEvents.length === 0 ? (
              <p className="planning-empty">Aucun événement à venir avec le filtre sélectionné.</p>
            ) : (
              upcomingEvents.map((event) => (
                <PlanningUpcomingItem key={event.id} event={event} today={today} />
              ))
            )}
          </div>
          <Link to="/volailles" className="planning-panel-link">
            Voir le résumé volailles <span>→</span>
          </Link>
        </aside>
      </section>

      <section className="planning-reminders-card">
        <div className="planning-panel-heading">
          <span>⌁</span>
          <div>
            <h2>Rappels à venir</h2>
            <p>Les échéances importantes des 31 prochains jours.</p>
          </div>
        </div>
        <div className="planning-reminders-grid">
          {reminders.length === 0 ? (
            <p className="planning-empty">Aucun rappel prévu pour le moment.</p>
          ) : (
            reminders.map((event) => (
              <article key={event.id} className={`planning-reminder planning-event-${event.tone}`}>
                <span>{event.icon}</span>
                <div>
                  <strong>{event.title}</strong>
                  <b>{relativeLabel(event.date, today)}</b>
                  <small>{DATE_LABEL_FORMAT.format(event.date)}</small>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      {modalOpen && (
        <div className="poultry-modal-backdrop" role="dialog" aria-modal="true">
          <section className="poultry-modal poultry-modal-small planning-event-modal">
            <ModalCloseButton onClick={() => setModalOpen(false)} disabled={saving} />
            <div className="poultry-modal-header">
              <span className="poultry-modal-icon">▦</span>
              <div>
                <h2>Ajouter un événement</h2>
                <p>Ajoutez un rappel manuel au planning de l'exploitation.</p>
              </div>
            </div>
            <div className="poultry-form-stack">
              <label>
                Titre
                <input
                  type="text"
                  value={newEvent.title}
                  onChange={(event) => setNewEvent((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Ex. Rendez-vous vétérinaire"
                />
              </label>
              <label>
                Date
                <input
                  type="date"
                  value={newEvent.date}
                  onChange={(event) => setNewEvent((current) => ({ ...current, date: event.target.value }))}
                />
              </label>
              <label>
                Catégorie
                <select
                  value={newEvent.category}
                  onChange={(event) => setNewEvent((current) => ({ ...current, category: event.target.value }))}
                >
                  <option value="volailles">Volailles</option>
                  <option value="alimentation">Alimentation</option>
                  <option value="sanitaire">Sanitaire</option>
                  <option value="administratif">Administratif</option>
                </select>
              </label>
            </div>
            <div className="poultry-modal-actions">
              <button type="button" className="poultry-modal-primary" onClick={saveManualEvent} disabled={saving}>
                Enregistrer l'événement
              </button>
              <button type="button" className="poultry-modal-secondary" onClick={() => setModalOpen(false)} disabled={saving}>
                Annuler
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function PlanningKpi({
  icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: string;
  label: string;
  value: number;
  detail: string;
  tone: PlanningTone;
}) {
  return (
    <article className="planning-kpi">
      <span className={`planning-kpi-icon planning-event-${tone}`}>{icon}</span>
      <div>
        <small>{label}</small>
        <strong>{formatNombre(value)}</strong>
        <em>{detail}</em>
      </div>
    </article>
  );
}

function PlanningEventChip({ event }: { event: PlanningEvent }) {
  const content = (
    <span className={`planning-calendar-event planning-event-${event.tone}`}>
      {event.title}
    </span>
  );
  if (!event.to) return content;
  return <Link to={event.to}>{content}</Link>;
}

function PlanningUpcomingItem({ event, today }: { event: PlanningEvent; today: Date }) {
  const content = (
    <article className={`planning-upcoming-item planning-upcoming-${event.tone}`}>
      <span className={`planning-upcoming-icon planning-event-${event.tone}`}>{event.icon}</span>
      <div>
        <strong>{event.title}</strong>
        <small>{event.detail}</small>
      </div>
      <em>{relativeLabel(event.date, today)}</em>
    </article>
  );

  if (!event.to) return content;
  return <Link to={event.to}>{content}</Link>;
}
