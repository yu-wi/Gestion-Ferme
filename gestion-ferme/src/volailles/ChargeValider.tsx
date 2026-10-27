import StatutCharge from "./StatutCharge";
import { useState } from "react";
import { formatMontant } from "../outils/formatNombre";

export default function ChargeValider({ label, montant, enregistree, detail, disabled, onSave }: {
  label: string;
  montant: number;
  enregistree: boolean;
  detail: string;
  disabled: boolean;
  onSave: (montant: number) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [valeur, setValeur] = useState(String(montant));
  const invalide = !valeur.trim() || !Number.isFinite(Number(valeur)) || Number(valeur) < 0;
  const enregistrer = async () => {
    if (disabled || (editing && invalide)) return;
    if (await onSave(editing ? Number(valeur) : montant)) setEditing(false);
  };
  return <div className="lot-charge-validation">
    <div className="lot-charge-value"><span>{label} (TTC)</span>
      {editing ? <label className="lot-charge-input">Montant TTC (€)
        <input autoFocus type="number" min="0" step="0.01" value={valeur} disabled={disabled}
          onChange={(event) => setValeur(event.target.value)} />
      </label> : <b>{formatMontant(montant)}</b>}
    </div>
    <small><StatutCharge statut={enregistree ? "enregistre" : "estime"} />{!enregistree && <span className="lot-charge-detail">{detail}</span>}</small>
    <div className="lot-charge-actions">
      {(!enregistree || editing) ? <button type="button" className="lot-charge-confirm" title="Valider et enregistrer la charge"
        aria-label={`Valider ${label.toLowerCase()}`} disabled={disabled || (editing && invalide)} onClick={enregistrer}>✓</button>
        : <span className="lot-charge-saved" aria-label="Charge enregistrée">✓</span>}
      {!editing ? <button type="button" title="Modifier le montant TTC" aria-label={`Modifier ${label.toLowerCase()}`}
        disabled={disabled} onClick={() => { setValeur(String(montant)); setEditing(true); }}>✎</button>
        : <button type="button" disabled={disabled} onClick={() => setEditing(false)}>Annuler</button>}
    </div>
  </div>;
}
