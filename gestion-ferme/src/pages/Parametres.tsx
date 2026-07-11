import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { supabase } from "../supabaseClient";
import { formatNombre } from "../outils/formatNombre";

type FeedReference = {
  id: string;
  feed_type: string;
  daily_consumption_g: number;
  age_min_days: number;
  age_max_days: number;
  feed_price_ht: number;
};

const emptyForm = {
  feed_type: "",
  age_min_days: "",
  age_max_days: "",
  daily_consumption_g: "",
  feed_price_ht: "",
};

type FeedReferenceForm = typeof emptyForm;

const settingsRoadmap = [
  {
    title: "Volailles",
    detail: "Seuil mortalité, âges des alertes planning, règles de vigilance.",
  },
  {
    title: "Inventaire",
    detail: "Prix de valorisation, grilles de poids et règles de calcul.",
  },
  {
    title: "Aquaponie",
    detail: "Seuils pH, température, nitrates, alertes bassins et cuves.",
  },
];

function normalizeReference(row: Record<string, unknown>): FeedReference {
  return {
    id: String(row.id || ""),
    feed_type: String(row.feed_type || ""),
    daily_consumption_g: Number(row.daily_consumption_g) || 0,
    age_min_days: Number(row.age_min_days) || 0,
    age_max_days: Number(row.age_max_days) || 0,
    feed_price_ht: Number(row.feed_price_ht) || 0,
  };
}

export default function Parametres() {
  const [references, setReferences] = useState<FeedReference[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FeedReferenceForm>(emptyForm);

  const sortedReferences = useMemo(
    () =>
      [...references].sort((a, b) => {
        if (a.age_min_days !== b.age_min_days) return a.age_min_days - b.age_min_days;
        return a.feed_type.localeCompare(b.feed_type);
      }),
    [references]
  );

  const averagePrice = useMemo(() => {
    if (!references.length) return 0;
    return references.reduce((total, reference) => total + reference.feed_price_ht, 0) / references.length;
  }, [references]);

  const loadReferences = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("feed_reference")
      .select("id, feed_type, daily_consumption_g, age_min_days, age_max_days, feed_price_ht")
      .order("age_min_days", { ascending: true });

    if (error) {
      console.error("Erreur chargement paramètres alimentation :", error);
      toast.error("Les paramètres d'alimentation n'ont pas pu être chargés.");
      setReferences([]);
    } else {
      setReferences(((data || []) as unknown as Record<string, unknown>[]).map(normalizeReference));
    }
    setLoading(false);
  };

  useEffect(() => {
    loadReferences();
  }, []);

  const updateField = (field: keyof FeedReferenceForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const editReference = (reference: FeedReference) => {
    setEditingId(reference.id);
    setForm({
      feed_type: reference.feed_type,
      age_min_days: String(reference.age_min_days),
      age_max_days: String(reference.age_max_days),
      daily_consumption_g: String(reference.daily_consumption_g),
      feed_price_ht: String(reference.feed_price_ht),
    });
  };

  const saveReference = async () => {
    const ageMin = Number(form.age_min_days);
    const ageMax = Number(form.age_max_days);
    const consumption = Number(form.daily_consumption_g);
    const price = Number(form.feed_price_ht);

    if (
      saving ||
      !form.feed_type.trim() ||
      !Number.isInteger(ageMin) ||
      !Number.isInteger(ageMax) ||
      ageMin < 0 ||
      ageMax < ageMin ||
      !Number.isFinite(consumption) ||
      consumption <= 0 ||
      !Number.isFinite(price) ||
      price < 0
    ) {
      toast.error("Vérifiez le type d'aliment, les âges, la consommation et le prix.");
      return;
    }

    const overlap = references.some(
      (reference) =>
        reference.id !== editingId &&
        ageMin <= reference.age_max_days &&
        ageMax >= reference.age_min_days
    );
    if (overlap) {
      toast.error("Cette tranche d'âge chevauche une référence existante.");
      return;
    }

    setSaving(true);
    const payload = {
      feed_type: form.feed_type.trim(),
      age_min_days: ageMin,
      age_max_days: ageMax,
      daily_consumption_g: consumption,
      feed_price_ht: price,
    };
    const request = editingId
      ? supabase
          .from("feed_reference")
          .update(payload)
          .eq("id", editingId)
          .select("id, feed_type, daily_consumption_g, age_min_days, age_max_days, feed_price_ht")
          .single()
      : supabase
          .from("feed_reference")
          .insert(payload)
          .select("id, feed_type, daily_consumption_g, age_min_days, age_max_days, feed_price_ht")
          .single();

    const { data, error } = await request;
    if (error) {
      console.error("Erreur sauvegarde référence alimentaire :", error);
      toast.error("La référence n'a pas pu être enregistrée.");
    } else if (data) {
      const savedReference = normalizeReference(data as unknown as Record<string, unknown>);
      setReferences((items) => [
        ...items.filter((item) => item.id !== savedReference.id),
        savedReference,
      ]);
      toast.success(editingId ? "Référence modifiée." : "Référence ajoutée.");
      resetForm();
    }
    setSaving(false);
  };

  const deleteReference = async (reference: FeedReference) => {
    if (
      saving ||
      !window.confirm(
        "Supprimer cette référence alimentaire ? Les anciennes saisies resteront conservées."
      )
    ) {
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("feed_reference")
      .delete()
      .eq("id", reference.id);

    if (error) {
      console.error("Erreur suppression référence alimentaire :", error);
      toast.error("La référence n'a pas pu être supprimée.");
    } else {
      setReferences((items) => items.filter((item) => item.id !== reference.id));
      if (editingId === reference.id) resetForm();
      toast.success("Référence supprimée.");
    }
    setSaving(false);
  };

  return (
    <div className="settings-page">
      <header className="settings-heading">
        <div>
          <span className="settings-heading-icon">⚙</span>
          <div>
            <h1>Paramètres</h1>
            <p>Centralisez les réglages utilisés par l'interface.</p>
          </div>
        </div>
      </header>

      <section className="settings-kpis">
        <article>
          <span>Références</span>
          <strong>{formatNombre(references.length)}</strong>
          <small>Tranches alimentaires</small>
        </article>
        <article>
          <span>Prix moyen</span>
          <strong>{formatNombre(averagePrice, 2)} €</strong>
          <small>Par sac de 25 kg</small>
        </article>
        <article>
          <span>Premier bloc</span>
          <strong>Alimentation</strong>
          <small>Modifiable dès maintenant</small>
        </article>
      </section>

      <section className="settings-panel">
        <div className="settings-panel-heading">
          <div>
            <span>▣</span>
            <div>
              <h2>Références alimentaires</h2>
              <p>Ces valeurs servent aux suggestions de consommation, aux prévisions et à l'inventaire.</p>
            </div>
          </div>
        </div>

        <div className="settings-form">
          <label>
            Type d'aliment
            <input
              value={form.feed_type}
              onChange={(event) => updateField("feed_type", event.target.value)}
              placeholder="Ex. croissance"
            />
          </label>
          <label>
            Âge minimum
            <input
              type="number"
              min="0"
              value={form.age_min_days}
              onChange={(event) => updateField("age_min_days", event.target.value)}
              placeholder="Ex. 22"
            />
          </label>
          <label>
            Âge maximum
            <input
              type="number"
              min="0"
              value={form.age_max_days}
              onChange={(event) => updateField("age_max_days", event.target.value)}
              placeholder="Ex. 28"
            />
          </label>
          <label>
            Consommation / sujet / jour
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.daily_consumption_g}
              onChange={(event) => updateField("daily_consumption_g", event.target.value)}
              placeholder="En grammes"
            />
          </label>
          <label>
            Prix du sac HT
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.feed_price_ht}
              onChange={(event) => updateField("feed_price_ht", event.target.value)}
              placeholder="Ex. 13.60"
            />
          </label>
          <div className="settings-form-actions">
            {editingId && (
              <button type="button" className="settings-secondary-button" onClick={resetForm} disabled={saving}>
                Annuler
              </button>
            )}
            <button type="button" onClick={saveReference} disabled={saving}>
              {saving ? "Enregistrement..." : editingId ? "Modifier" : "Ajouter"}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="settings-empty">Chargement des références...</div>
        ) : !sortedReferences.length ? (
          <div className="settings-empty">Aucune référence alimentaire enregistrée.</div>
        ) : (
          <div className="settings-table-wrap">
            <table className="settings-table">
              <thead>
                <tr>
                  <th>Aliment</th>
                  <th>Âge</th>
                  <th>Consommation</th>
                  <th>Prix sac HT</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedReferences.map((reference) => (
                  <tr key={reference.id}>
                    <td>{reference.feed_type}</td>
                    <td>
                      {reference.age_min_days} à {reference.age_max_days} jours
                    </td>
                    <td>{formatNombre(reference.daily_consumption_g, 2)} g / sujet / jour</td>
                    <td>{formatNombre(reference.feed_price_ht, 2)} €</td>
                    <td>
                      <div className="settings-row-actions">
                        <button type="button" onClick={() => editReference(reference)} disabled={saving} title="Modifier">
                          ✎
                        </button>
                        <button type="button" onClick={() => deleteReference(reference)} disabled={saving} title="Supprimer">
                          ×
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="settings-roadmap">
        {settingsRoadmap.map((item) => (
          <article key={item.title}>
            <span>À venir</span>
            <h2>{item.title}</h2>
            <p>{item.detail}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
