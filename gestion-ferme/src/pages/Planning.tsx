import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { supabase } from "../supabaseClient";
import { dateDepuisArrivee, REGLES_SUIVI_VOLAILLES } from "../outils/evenementsVolailles";

type ManualEvent = {
  id: string;
  title: string;
  start: string;
  end: string | null;
  category: string;
};

type SicaLot = {
  id: string;
  nom: string;
  batiment: string | null;
  date_arrivee: string;
  is_active: boolean;
};

type PlanningItem = {
  id: string;
  title: string;
  detail: string;
  date: Date;
  tone: "info" | "warning" | "neutral";
  to: string;
};

const formatDate = (date: Date) =>
  date.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });

const todayStart = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};

export default function Planning() {
  const [events, setEvents] = useState<ManualEvent[]>([]);
  const [lots, setLots] = useState<SicaLot[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [eventsResult, lotsResult] = await Promise.all([
        supabase.from("evenements").select("*").order("start", { ascending: true }),
        supabase
          .from("lots_volailles")
          .select("id, nom, batiment, date_arrivee, is_active")
          .eq("is_active", true)
          .order("date_arrivee", { ascending: false }),
      ]);

      if (eventsResult.error || lotsResult.error) {
        console.error("Erreur chargement planning :", eventsResult.error || lotsResult.error);
        toast.error("Le planning n'a pas pu être chargé.");
      } else {
        setEvents((eventsResult.data || []) as ManualEvent[]);
        setLots((lotsResult.data || []) as SicaLot[]);
      }
      setLoading(false);
    };
    load();
  }, []);

  const planningItems = useMemo(() => {
    const now = todayStart();
    const limit = new Date(now);
    limit.setDate(limit.getDate() + 21);

    const manualItems: PlanningItem[] = events
      .map((event) => ({
        id: event.id,
        title: event.title,
        detail: event.category || "Événement manuel",
        date: new Date(event.start),
        tone: "neutral" as const,
        to: "/",
      }))
      .filter((item) => item.date >= now && item.date <= limit);

    const lotItems: PlanningItem[] = lots.flatMap((lot) =>
      REGLES_SUIVI_VOLAILLES.map((regle) => {
        const date = dateDepuisArrivee(lot.date_arrivee, regle.jour);
        return {
          id: `${lot.id}-${regle.key}`,
          title: regle.title,
          detail: `${lot.nom}${lot.batiment ? ` · ${lot.batiment}` : ""}`,
          date,
          tone: regle.tone,
          to: "/volailles/sica",
        };
      })
    ).filter((item) => item.date >= now && item.date <= limit);

    return [...manualItems, ...lotItems]
      .filter((item) => filter === "all" || item.tone === filter)
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [events, filter, lots]);

  if (loading) {
    return <div className="dashboard-loading">Chargement du planning...</div>;
  }

  return (
    <div className="dashboard-page planning-page">
      <header className="dashboard-heading">
        <div>
          <h1>Planning</h1>
          <p>Événements manuels et suivis volailles à venir.</p>
        </div>
        <div className="planning-filters">
          <button type="button" className={filter === "all" ? "planning-filter-active" : ""} onClick={() => setFilter("all")}>Tous</button>
          <button type="button" className={filter === "warning" ? "planning-filter-active" : ""} onClick={() => setFilter("warning")}>Vigilance</button>
          <button type="button" className={filter === "info" ? "planning-filter-active" : ""} onClick={() => setFilter("info")}>Livraisons</button>
        </div>
      </header>

      <section className="dashboard-panel planning-list-panel">
        <div className="poultry-panel-heading">
          <h2>Prochains événements</h2>
          <span>21 jours</span>
        </div>
        <div className="planning-list">
          {planningItems.map((item) => (
            <Link key={item.id} to={item.to} className={`planning-row planning-row-${item.tone}`}>
              <span>{formatDate(item.date)}</span>
              <div><strong>{item.title}</strong><small>{item.detail}</small></div>
            </Link>
          ))}
          {planningItems.length === 0 && (
            <div className="poultry-empty">Aucun événement à venir sur les 21 prochains jours.</div>
          )}
        </div>
      </section>
    </div>
  );
}
