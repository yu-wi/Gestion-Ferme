import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import ModalCloseButton from "../components/ModalCloseButton";
import { formatMontant, formatNombre } from "../outils/formatNombre";
import { supabase } from "../supabaseClient";

type DirectLot = {
  id: string;
  name: string;
  species: "poulet" | "pintade";
  arrival_date: string;
  initial_quantity: number;
  remaining_quantity: number;
  mortality_count: number;
  location: string | null;
  status: "elevage" | "pret" | "termine";
  notes: string | null;
};

type DirectCustomer = {
  id: string;
  name: string;
  phone: string | null;
  notes: string | null;
};

type DirectOrder = {
  id: string;
  customer_id: string;
  lot_id: string | null;
  delivery_date: string;
  species: "poulet" | "pintade";
  quantity_ordered: number;
  target_weight: number | null;
  pricing_mode: "kg" | "unite";
  unit_price: number;
  status: "a_preparer" | "prete" | "livree" | "annulee";
  notes: string | null;
};

type DirectDelivery = {
  id: string;
  order_id: string | null;
  customer_id: string;
  lot_id: string;
  delivery_date: string;
  quantity_delivered: number;
  total_weight: number | null;
  pricing_mode: "kg" | "unite";
  unit_price: number;
  amount_invoiced: number;
  amount_paid: number;
  payment_date: string | null;
  payment_method: string | null;
};

const todayIso = () => {
  const date = new Date();
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
};

const formatDate = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString("fr-FR");

const speciesLabel = (species: DirectLot["species"]) =>
  species === "pintade" ? "Pintades" : "Poulets";

const lotStatusLabel: Record<DirectLot["status"], string> = {
  elevage: "En élevage",
  pret: "Prêt à vendre",
  termine: "Terminé",
};

export default function VenteDirecte() {
  const [lots, setLots] = useState<DirectLot[]>([]);
  const [customers, setCustomers] = useState<DirectCustomer[]>([]);
  const [orders, setOrders] = useState<DirectOrder[]>([]);
  const [deliveries, setDeliveries] = useState<DirectDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [databaseMissing, setDatabaseMissing] = useState(false);
  const [lotModal, setLotModal] = useState(false);
  const [customerModal, setCustomerModal] = useState(false);
  const [orderModal, setOrderModal] = useState(false);
  const [deliveryModal, setDeliveryModal] = useState(false);
  const [paymentModal, setPaymentModal] = useState(false);
  const [mortalityModal, setMortalityModal] = useState(false);
  const [selectedLotId, setSelectedLotId] = useState("");
  const [selectedDeliveryId, setSelectedDeliveryId] = useState("");
  const [lotForm, setLotForm] = useState({
    name: "",
    species: "poulet" as DirectLot["species"],
    arrival_date: todayIso(),
    initial_quantity: "",
    location: "",
    notes: "",
  });
  const [customerForm, setCustomerForm] = useState({
    name: "",
    phone: "",
    notes: "",
  });
  const [orderForm, setOrderForm] = useState({
    customer_id: "",
    lot_id: "",
    delivery_date: todayIso(),
    species: "poulet" as DirectOrder["species"],
    quantity_ordered: "",
    target_weight: "",
    pricing_mode: "kg" as DirectOrder["pricing_mode"],
    unit_price: "",
    notes: "",
  });
  const [deliveryForm, setDeliveryForm] = useState({
    order_id: "",
    customer_id: "",
    lot_id: "",
    delivery_date: todayIso(),
    quantity_delivered: "",
    total_weight: "",
    pricing_mode: "kg" as DirectDelivery["pricing_mode"],
    unit_price: "",
    amount_paid: "",
    payment_method: "",
  });
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    payment_date: todayIso(),
    payment_method: "",
  });
  const [mortalityCount, setMortalityCount] = useState("");

  const loadData = async () => {
    setLoading(true);
    const [lotsResult, customersResult, ordersResult, deliveriesResult] =
      await Promise.all([
        supabase
          .from("direct_sale_lots")
          .select("*")
          .order("arrival_date", { ascending: false }),
        supabase
          .from("direct_sale_customers")
          .select("*")
          .order("name"),
        supabase
          .from("direct_sale_orders")
          .select("*")
          .order("delivery_date", { ascending: true }),
        supabase
          .from("direct_sale_deliveries")
          .select("*")
          .order("delivery_date", { ascending: false }),
      ]);
    const error =
      lotsResult.error ||
      customersResult.error ||
      ordersResult.error ||
      deliveriesResult.error;
    if (error) {
      console.error("Erreur chargement vente directe :", error);
      setDatabaseMissing(error.code === "42P01" || error.code === "PGRST205");
      toast.error("Les données de vente directe n'ont pas pu être chargées.");
    } else {
      setDatabaseMissing(false);
      setLots(
        (lotsResult.data || []).map((lot) => ({
          ...lot,
          initial_quantity: Number(lot.initial_quantity) || 0,
          remaining_quantity: Number(lot.remaining_quantity) || 0,
          mortality_count: Number(lot.mortality_count) || 0,
        })) as DirectLot[]
      );
      setCustomers((customersResult.data || []) as DirectCustomer[]);
      setOrders(
        (ordersResult.data || []).map((order) => ({
          ...order,
          quantity_ordered: Number(order.quantity_ordered) || 0,
          target_weight:
            order.target_weight == null ? null : Number(order.target_weight),
          unit_price: Number(order.unit_price) || 0,
        })) as DirectOrder[]
      );
      setDeliveries(
        (deliveriesResult.data || []).map((delivery) => ({
          ...delivery,
          quantity_delivered: Number(delivery.quantity_delivered) || 0,
          total_weight:
            delivery.total_weight == null
              ? null
              : Number(delivery.total_weight),
          unit_price: Number(delivery.unit_price) || 0,
          amount_invoiced: Number(delivery.amount_invoiced) || 0,
          amount_paid: Number(delivery.amount_paid) || 0,
        })) as DirectDelivery[]
      );
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const activeLots = lots.filter((lot) => lot.status !== "termine");
  const availableSubjects = activeLots.reduce(
    (total, lot) => total + Number(lot.remaining_quantity || 0),
    0
  );
  const pendingOrders = orders.filter(
    (order) => order.status === "a_preparer" || order.status === "prete"
  );
  const invoicedTotal = deliveries.reduce(
    (total, delivery) => total + Number(delivery.amount_invoiced || 0),
    0
  );
  const paidTotal = deliveries.reduce(
    (total, delivery) => total + Number(delivery.amount_paid || 0),
    0
  );
  const outstandingTotal = Math.max(0, invoicedTotal - paidTotal);

  const customerById = useMemo(
    () => new Map(customers.map((customer) => [customer.id, customer])),
    [customers]
  );
  const lotById = useMemo(
    () => new Map(lots.map((lot) => [lot.id, lot])),
    [lots]
  );

  const saveLot = async () => {
    const initialQuantity = Number(lotForm.initial_quantity);
    if (
      !lotForm.name.trim() ||
      !lotForm.arrival_date ||
      !Number.isInteger(initialQuantity) ||
      initialQuantity <= 0
    ) {
      toast.error("Complétez le nom, la date et un effectif valide.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("direct_sale_lots").insert({
      name: lotForm.name.trim(),
      species: lotForm.species,
      arrival_date: lotForm.arrival_date,
      initial_quantity: initialQuantity,
      remaining_quantity: initialQuantity,
      location: lotForm.location.trim() || null,
      notes: lotForm.notes.trim() || null,
    });
    if (error) {
      console.error("Erreur ajout lot vente directe :", error);
      toast.error("Le lot n'a pas pu être enregistré.");
    } else {
      toast.success("Petit lot enregistré.");
      setLotModal(false);
      setLotForm({
        name: "",
        species: "poulet",
        arrival_date: todayIso(),
        initial_quantity: "",
        location: "",
        notes: "",
      });
      await loadData();
    }
    setSaving(false);
  };

  const saveCustomer = async () => {
    if (!customerForm.name.trim()) {
      toast.error("Indiquez le nom du boucher.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("direct_sale_customers").insert({
      name: customerForm.name.trim(),
      phone: customerForm.phone.trim() || null,
      notes: customerForm.notes.trim() || null,
    });
    if (error) {
      console.error("Erreur ajout client :", error);
      toast.error("Le client n'a pas pu être enregistré.");
    } else {
      toast.success("Boucher enregistré.");
      setCustomerModal(false);
      setCustomerForm({ name: "", phone: "", notes: "" });
      await loadData();
    }
    setSaving(false);
  };

  const saveOrder = async () => {
    const quantity = Number(orderForm.quantity_ordered);
    if (
      !orderForm.customer_id ||
      !orderForm.delivery_date ||
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {
      toast.error("Sélectionnez un client, une date et une quantité.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("direct_sale_orders").insert({
      customer_id: orderForm.customer_id,
      lot_id: orderForm.lot_id || null,
      delivery_date: orderForm.delivery_date,
      species: orderForm.species,
      quantity_ordered: quantity,
      target_weight: orderForm.target_weight
        ? Number(orderForm.target_weight)
        : null,
      pricing_mode: orderForm.pricing_mode,
      unit_price: Number(orderForm.unit_price) || 0,
      notes: orderForm.notes.trim() || null,
    });
    if (error) {
      console.error("Erreur ajout commande :", error);
      toast.error("La commande n'a pas pu être enregistrée.");
    } else {
      toast.success("Commande enregistrée.");
      setOrderModal(false);
      setOrderForm({
        customer_id: "",
        lot_id: "",
        delivery_date: todayIso(),
        species: "poulet",
        quantity_ordered: "",
        target_weight: "",
        pricing_mode: "kg",
        unit_price: "",
        notes: "",
      });
      await loadData();
    }
    setSaving(false);
  };

  const prepareDelivery = (order?: DirectOrder) => {
    setDeliveryForm({
      order_id: order?.id || "",
      customer_id: order?.customer_id || "",
      lot_id: order?.lot_id || "",
      delivery_date: order?.delivery_date || todayIso(),
      quantity_delivered: order ? String(order.quantity_ordered) : "",
      total_weight: "",
      pricing_mode: order?.pricing_mode || "kg",
      unit_price: order?.unit_price ? String(order.unit_price) : "",
      amount_paid: "",
      payment_method: "",
    });
    setDeliveryModal(true);
  };

  const saveDelivery = async () => {
    const quantity = Number(deliveryForm.quantity_delivered);
    const lot = lotById.get(deliveryForm.lot_id);
    if (
      !deliveryForm.customer_id ||
      !lot ||
      !deliveryForm.delivery_date ||
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {
      toast.error("Complétez le client, le lot, la date et la quantité.");
      return;
    }
    if (quantity > lot.remaining_quantity) {
      toast.error(`Il ne reste que ${lot.remaining_quantity} sujet(s) dans ce lot.`);
      return;
    }
    const totalWeight = Number(deliveryForm.total_weight) || 0;
    const unitPrice = Number(deliveryForm.unit_price) || 0;
    if (deliveryForm.pricing_mode === "kg" && totalWeight <= 0) {
      toast.error("Indiquez le poids total livré.");
      return;
    }
    const amountInvoiced =
      deliveryForm.pricing_mode === "kg"
        ? totalWeight * unitPrice
        : quantity * unitPrice;
    const amountPaid = Number(deliveryForm.amount_paid) || 0;
    if (amountPaid > amountInvoiced) {
      toast.error("Le montant réglé ne peut pas dépasser le montant facturé.");
      return;
    }
    setSaving(true);
    const { data: insertedDelivery, error: deliveryError } = await supabase
      .from("direct_sale_deliveries")
      .insert({
        order_id: deliveryForm.order_id || null,
        customer_id: deliveryForm.customer_id,
        lot_id: deliveryForm.lot_id,
        delivery_date: deliveryForm.delivery_date,
        quantity_delivered: quantity,
        total_weight: totalWeight || null,
        pricing_mode: deliveryForm.pricing_mode,
        unit_price: unitPrice,
        amount_invoiced: amountInvoiced,
        amount_paid: amountPaid,
        payment_date: deliveryForm.amount_paid ? deliveryForm.delivery_date : null,
        payment_method: deliveryForm.payment_method.trim() || null,
      })
      .select("id")
      .single();
    if (deliveryError) {
      console.error("Erreur ajout livraison directe :", deliveryError);
      toast.error("La livraison n'a pas pu être enregistrée.");
      setSaving(false);
      return;
    }

    const remainingQuantity = lot.remaining_quantity - quantity;
    const { error: lotError } = await supabase
      .from("direct_sale_lots")
      .update({
        remaining_quantity: remainingQuantity,
        status: remainingQuantity === 0 ? "termine" : lot.status,
      })
      .eq("id", lot.id);
    if (lotError) {
      console.error("Erreur mise à jour effectif :", lotError);
      if (insertedDelivery?.id) {
        await supabase
          .from("direct_sale_deliveries")
          .delete()
          .eq("id", insertedDelivery.id);
      }
      toast.error("La livraison n'a pas pu mettre à jour l'effectif du lot.");
      setSaving(false);
      return;
    }

    if (deliveryForm.order_id) {
      const { error: orderError } = await supabase
        .from("direct_sale_orders")
        .update({ status: "livree" })
        .eq("id", deliveryForm.order_id);
      if (orderError) console.error("Erreur clôture commande :", orderError);
    }

    toast.success("Livraison enregistrée.");
    setDeliveryModal(false);
    await loadData();
    setSaving(false);
  };

  const openPayment = (delivery: DirectDelivery) => {
    setSelectedDeliveryId(delivery.id);
    setPaymentForm({
      amount: "",
      payment_date: todayIso(),
      payment_method: delivery.payment_method || "",
    });
    setPaymentModal(true);
  };

  const savePayment = async () => {
    const delivery = deliveries.find((item) => item.id === selectedDeliveryId);
    const amount = Number(paymentForm.amount);
    if (!delivery || amount <= 0) {
      toast.error("Indiquez un montant valide.");
      return;
    }
    const outstanding = Math.max(
      0,
      delivery.amount_invoiced - delivery.amount_paid
    );
    if (amount > outstanding) {
      toast.error(`Le solde restant est de ${formatMontant(outstanding)}.`);
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("direct_sale_deliveries")
      .update({
        amount_paid: Number(delivery.amount_paid) + amount,
        payment_date: paymentForm.payment_date,
        payment_method: paymentForm.payment_method.trim() || null,
      })
      .eq("id", delivery.id);
    if (error) {
      toast.error("Le règlement n'a pas pu être enregistré.");
    } else {
      toast.success("Règlement enregistré.");
      setPaymentModal(false);
      await loadData();
    }
    setSaving(false);
  };

  const updateLotStatus = async (lot: DirectLot, status: DirectLot["status"]) => {
    const { error } = await supabase
      .from("direct_sale_lots")
      .update({ status })
      .eq("id", lot.id);
    if (error) toast.error("Le statut n'a pas pu être modifié.");
    else {
      toast.success("Statut du lot modifié.");
      await loadData();
    }
  };

  const openMortality = (lot: DirectLot) => {
    setSelectedLotId(lot.id);
    setMortalityCount("");
    setMortalityModal(true);
  };

  const saveMortality = async () => {
    const lot = lotById.get(selectedLotId);
    const count = Number(mortalityCount);
    if (!lot || !Number.isInteger(count) || count <= 0) {
      toast.error("Indiquez un nombre de mortalités valide.");
      return;
    }
    if (count > lot.remaining_quantity) {
      toast.error(`Il ne reste que ${lot.remaining_quantity} sujet(s) dans ce lot.`);
      return;
    }
    const remainingQuantity = lot.remaining_quantity - count;
    setSaving(true);
    const { error } = await supabase
      .from("direct_sale_lots")
      .update({
        mortality_count: lot.mortality_count + count,
        remaining_quantity: remainingQuantity,
        status: remainingQuantity === 0 ? "termine" : lot.status,
      })
      .eq("id", lot.id);
    if (error) {
      toast.error("Les mortalités n'ont pas pu être enregistrées.");
    } else {
      toast.success("Mortalités enregistrées.");
      setMortalityModal(false);
      await loadData();
    }
    setSaving(false);
  };

  const updateOrderStatus = async (
    order: DirectOrder,
    status: DirectOrder["status"]
  ) => {
    const { error } = await supabase
      .from("direct_sale_orders")
      .update({ status })
      .eq("id", order.id);
    if (error) toast.error("Le statut de la commande n'a pas pu être modifié.");
    else {
      toast.success("Statut de la commande modifié.");
      await loadData();
    }
  };

  if (loading) {
    return <div className="dashboard-loading">Chargement de la vente directe...</div>;
  }

  return (
    <div className="direct-sale-page">
      <header className="direct-sale-heading">
        <div>
          <h1><span>◎</span> Vente directe</h1>
          <p>Petits lots, commandes des bouchers, livraisons et règlements.</p>
        </div>
        <div>
          <button type="button" className="direct-sale-secondary" onClick={() => setCustomerModal(true)}>
            ＋ Boucher
          </button>
          <button type="button" className="direct-sale-primary" onClick={() => setLotModal(true)}>
            ＋ Petit lot
          </button>
        </div>
      </header>

      <nav className="poultry-tabs" aria-label="Sections volailles">
        <Link to="/volailles">Vue d’ensemble</Link>
        <Link to="/volailles/vente-directe" className="poultry-tab-active">Vente directe</Link>
        <Link to="/volailles/alimentation">Alimentation</Link>
        <Link to="/volailles/historique">Lots terminés</Link>
        <Link to="/volailles/analyse">Performances</Link>
      </nav>

      {databaseMissing && (
        <div className="direct-sale-setup">
          <strong>Installation Supabase nécessaire</strong>
          <span>Exécutez le fichier <code>supabase/vente-directe.sql</code> dans l’éditeur SQL.</span>
        </div>
      )}

      <section className="direct-sale-kpis">
        <DirectKpi icon="◉" tone="green" label="Petits lots actifs" value={formatNombre(activeLots.length)} note={`${formatNombre(availableSubjects)} sujets disponibles`} />
        <DirectKpi icon="▤" tone="blue" label="Commandes à préparer" value={formatNombre(pendingOrders.length)} note="À venir" />
        <DirectKpi icon="€" tone="orange" label="Chiffre d’affaires" value={formatMontant(invoicedTotal)} note="Livraisons enregistrées" />
        <DirectKpi icon="!" tone="red" label="Paiements attendus" value={formatMontant(outstandingTotal)} note="Solde restant" />
      </section>

      <section className="direct-sale-panel">
        <div className="direct-sale-panel-heading">
          <div><h2>Petits lots</h2><span>Poulets et pintades destinés à la vente directe.</span></div>
          <button type="button" className="direct-sale-primary" onClick={() => setLotModal(true)}>＋ Nouveau lot</button>
        </div>
        <div className="direct-sale-lot-grid">
          {lots.map((lot) => (
            <article key={lot.id} className="direct-sale-lot-card">
              <div className="direct-sale-lot-title">
                <span>{lot.species === "pintade" ? "◇" : "♧"}</span>
                <div><strong>{lot.name}</strong><small>{speciesLabel(lot.species)} · Arrivé le {formatDate(lot.arrival_date)}</small></div>
                <em className={`direct-sale-status direct-sale-status-${lot.status}`}>{lotStatusLabel[lot.status]}</em>
              </div>
              <div className="direct-sale-lot-values">
                <span>Restants<strong>{formatNombre(lot.remaining_quantity)}</strong></span>
                <span>Effectif initial<strong>{formatNombre(lot.initial_quantity)}</strong></span>
                <span>Mortalités<strong>{formatNombre(lot.mortality_count)}</strong></span>
              </div>
              <div className="direct-sale-lot-actions">
                <select value={lot.status} onChange={(event) => updateLotStatus(lot, event.target.value as DirectLot["status"])}>
                  <option value="elevage">En élevage</option>
                  <option value="pret">Prêt à vendre</option>
                  <option value="termine">Terminé</option>
                </select>
                <button type="button" onClick={() => openMortality(lot)} title="Enregistrer des mortalités">†</button>
              </div>
              <small className="direct-sale-location">{lot.location || "Emplacement non renseigné"}</small>
            </article>
          ))}
          {lots.length === 0 && <div className="direct-sale-empty">Aucun petit lot enregistré.</div>}
        </div>
      </section>

      <section className="direct-sale-grid">
        <article className="direct-sale-panel">
          <div className="direct-sale-panel-heading">
            <div><h2>Commandes des bouchers</h2><span>Préparation et dates de livraison.</span></div>
            <button type="button" className="direct-sale-primary" onClick={() => setOrderModal(true)}>＋ Commande</button>
          </div>
          <div className="direct-sale-list">
            {pendingOrders.map((order) => (
              <div className="direct-sale-order-row" key={order.id}>
                <span className="direct-sale-row-icon">▤</span>
                <div>
                  <strong>{customerById.get(order.customer_id)?.name || "Client"}</strong>
                  <small>{speciesLabel(order.species)} · {formatNombre(order.quantity_ordered)} sujets · {formatDate(order.delivery_date)}</small>
                </div>
                <select
                  className={`direct-sale-order-status direct-sale-order-${order.status}`}
                  value={order.status}
                  onChange={(event) =>
                    updateOrderStatus(
                      order,
                      event.target.value as DirectOrder["status"]
                    )
                  }
                  aria-label={`Statut de la commande de ${customerById.get(order.customer_id)?.name || "ce client"}`}
                >
                  <option value="a_preparer">À préparer</option>
                  <option value="prete">Prête</option>
                  <option value="annulee">Annulée</option>
                </select>
                <button type="button" title="Enregistrer la livraison" onClick={() => prepareDelivery(order)}>🚚</button>
              </div>
            ))}
            {pendingOrders.length === 0 && <div className="direct-sale-empty">Aucune commande à préparer.</div>}
          </div>
        </article>

        <article className="direct-sale-panel">
          <div className="direct-sale-panel-heading">
            <div><h2>Livraisons et règlements</h2><span>Facturation et paiements reçus.</span></div>
            <button type="button" className="direct-sale-secondary" onClick={() => prepareDelivery()}>＋ Livraison</button>
          </div>
          <div className="direct-sale-list">
            {deliveries.slice(0, 8).map((delivery) => {
              const outstanding = Math.max(0, delivery.amount_invoiced - delivery.amount_paid);
              return (
                <div className="direct-sale-delivery-row" key={delivery.id}>
                  <span className="direct-sale-row-icon">🚚</span>
                  <div>
                    <strong>{customerById.get(delivery.customer_id)?.name || "Client"}</strong>
                    <small>{lotById.get(delivery.lot_id)?.name || "Lot"} · {formatDate(delivery.delivery_date)} · {formatNombre(delivery.quantity_delivered)} sujets</small>
                  </div>
                  <div className="direct-sale-money">
                    <strong>{formatMontant(delivery.amount_invoiced)}</strong>
                    <small>{outstanding > 0 ? `Reste ${formatMontant(outstanding)}` : "Payée"}</small>
                  </div>
                  {outstanding > 0 ? (
                    <button type="button" title="Enregistrer un règlement" onClick={() => openPayment(delivery)}>€</button>
                  ) : <span className="direct-sale-paid">✓</span>}
                </div>
              );
            })}
            {deliveries.length === 0 && <div className="direct-sale-empty">Aucune livraison enregistrée.</div>}
          </div>
        </article>
      </section>

      <section className="direct-sale-panel direct-sale-customers">
        <div className="direct-sale-panel-heading">
          <div><h2>Répertoire des bouchers</h2><span>{customers.length} client(s) enregistré(s).</span></div>
          <button type="button" className="direct-sale-secondary" onClick={() => setCustomerModal(true)}>＋ Ajouter</button>
        </div>
        <div className="direct-sale-customer-grid">
          {customers.map((customer) => (
            <article key={customer.id}>
              <span>♙</span>
              <div><strong>{customer.name}</strong><small>{customer.phone || "Téléphone non renseigné"}</small></div>
            </article>
          ))}
          {customers.length === 0 && <div className="direct-sale-empty">Aucun boucher enregistré.</div>}
        </div>
      </section>

      {lotModal && (
        <DirectModal title="Ajouter un petit lot" subtitle="Ce lot restera séparé des lots destinés à la coopérative." icon="♧" onClose={() => setLotModal(false)}>
          <div className="direct-sale-form-grid">
            <label>Nom du lot<input value={lotForm.name} onChange={(event) => setLotForm({ ...lotForm, name: event.target.value })} placeholder="Ex. Pintades juillet" /></label>
            <label>Espèce<select value={lotForm.species} onChange={(event) => setLotForm({ ...lotForm, species: event.target.value as DirectLot["species"] })}><option value="poulet">Poulets</option><option value="pintade">Pintades</option></select></label>
            <label>Date d’arrivée<input type="date" value={lotForm.arrival_date} onChange={(event) => setLotForm({ ...lotForm, arrival_date: event.target.value })} /></label>
            <label>Effectif initial<input type="number" min="1" value={lotForm.initial_quantity} onChange={(event) => setLotForm({ ...lotForm, initial_quantity: event.target.value })} placeholder="Ex. 80" /></label>
            <label className="direct-sale-field-wide">Emplacement<input value={lotForm.location} onChange={(event) => setLotForm({ ...lotForm, location: event.target.value })} placeholder="Ex. Parc 1" /></label>
            <label className="direct-sale-field-wide">Note<textarea value={lotForm.notes} onChange={(event) => setLotForm({ ...lotForm, notes: event.target.value })} /></label>
          </div>
          <ModalActions saving={saving} onCancel={() => setLotModal(false)} onSave={saveLot} label="Enregistrer le lot" />
        </DirectModal>
      )}

      {customerModal && (
        <DirectModal title="Ajouter un boucher" subtitle="Le client sera proposé dans les commandes et les livraisons." icon="♙" onClose={() => setCustomerModal(false)}>
          <div className="direct-sale-form-grid">
            <label className="direct-sale-field-wide">Nom<input value={customerForm.name} onChange={(event) => setCustomerForm({ ...customerForm, name: event.target.value })} placeholder="Nom du boucher ou de l’établissement" /></label>
            <label className="direct-sale-field-wide">Téléphone<input value={customerForm.phone} onChange={(event) => setCustomerForm({ ...customerForm, phone: event.target.value })} placeholder="Numéro de téléphone" /></label>
            <label className="direct-sale-field-wide">Note<textarea value={customerForm.notes} onChange={(event) => setCustomerForm({ ...customerForm, notes: event.target.value })} /></label>
          </div>
          <ModalActions saving={saving} onCancel={() => setCustomerModal(false)} onSave={saveCustomer} label="Enregistrer le boucher" />
        </DirectModal>
      )}

      {orderModal && (
        <DirectModal title="Nouvelle commande" subtitle="Planifiez ce que le boucher attend et la date souhaitée." icon="▤" onClose={() => setOrderModal(false)}>
          <div className="direct-sale-form-grid">
            <label>Client<select value={orderForm.customer_id} onChange={(event) => setOrderForm({ ...orderForm, customer_id: event.target.value })}><option value="">Choisir un boucher</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>
            <label>Date souhaitée<input type="date" value={orderForm.delivery_date} onChange={(event) => setOrderForm({ ...orderForm, delivery_date: event.target.value })} /></label>
            <label>Espèce<select value={orderForm.species} onChange={(event) => setOrderForm({ ...orderForm, species: event.target.value as DirectOrder["species"], lot_id: "" })}><option value="poulet">Poulets</option><option value="pintade">Pintades</option></select></label>
            <label>Lot prévu<select value={orderForm.lot_id} onChange={(event) => setOrderForm({ ...orderForm, lot_id: event.target.value })}><option value="">À déterminer</option>{activeLots.filter((lot) => lot.species === orderForm.species).map((lot) => <option key={lot.id} value={lot.id}>{lot.name} · {lot.remaining_quantity} restants</option>)}</select></label>
            <label>Quantité commandée<input type="number" min="1" value={orderForm.quantity_ordered} onChange={(event) => setOrderForm({ ...orderForm, quantity_ordered: event.target.value })} /></label>
            <label>Poids cible par sujet (kg)<input type="number" min="0" step="0.01" value={orderForm.target_weight} onChange={(event) => setOrderForm({ ...orderForm, target_weight: event.target.value })} /></label>
            <label>Mode de prix<select value={orderForm.pricing_mode} onChange={(event) => setOrderForm({ ...orderForm, pricing_mode: event.target.value as DirectOrder["pricing_mode"] })}><option value="kg">Prix au kilogramme</option><option value="unite">Prix à l’unité</option></select></label>
            <label>Prix convenu (€)<input type="number" min="0" step="0.01" value={orderForm.unit_price} onChange={(event) => setOrderForm({ ...orderForm, unit_price: event.target.value })} /></label>
            <label className="direct-sale-field-wide">Note<textarea value={orderForm.notes} onChange={(event) => setOrderForm({ ...orderForm, notes: event.target.value })} /></label>
          </div>
          <ModalActions saving={saving} onCancel={() => setOrderModal(false)} onSave={saveOrder} label="Enregistrer la commande" />
        </DirectModal>
      )}

      {deliveryModal && (
        <DirectModal title="Enregistrer une livraison" subtitle="La livraison réduit automatiquement l’effectif restant du lot." icon="🚚" onClose={() => setDeliveryModal(false)}>
          <div className="direct-sale-form-grid">
            <label>Client<select value={deliveryForm.customer_id} onChange={(event) => setDeliveryForm({ ...deliveryForm, customer_id: event.target.value })}><option value="">Choisir un boucher</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>
            <label>Lot<select value={deliveryForm.lot_id} onChange={(event) => setDeliveryForm({ ...deliveryForm, lot_id: event.target.value })}><option value="">Choisir un lot</option>{activeLots.map((lot) => <option key={lot.id} value={lot.id}>{lot.name} · {lot.remaining_quantity} restants</option>)}</select></label>
            <label>Date de livraison<input type="date" value={deliveryForm.delivery_date} onChange={(event) => setDeliveryForm({ ...deliveryForm, delivery_date: event.target.value })} /></label>
            <label>Quantité livrée<input type="number" min="1" value={deliveryForm.quantity_delivered} onChange={(event) => setDeliveryForm({ ...deliveryForm, quantity_delivered: event.target.value })} /></label>
            <label>Mode de prix<select value={deliveryForm.pricing_mode} onChange={(event) => setDeliveryForm({ ...deliveryForm, pricing_mode: event.target.value as DirectDelivery["pricing_mode"] })}><option value="kg">Prix au kilogramme</option><option value="unite">Prix à l’unité</option></select></label>
            {deliveryForm.pricing_mode === "kg" && <label>Poids total (kg)<input type="number" min="0" step="0.01" value={deliveryForm.total_weight} onChange={(event) => setDeliveryForm({ ...deliveryForm, total_weight: event.target.value })} /></label>}
            <label>Prix {deliveryForm.pricing_mode === "kg" ? "par kg" : "par unité"} (€)<input type="number" min="0" step="0.01" value={deliveryForm.unit_price} onChange={(event) => setDeliveryForm({ ...deliveryForm, unit_price: event.target.value })} /></label>
            <label>Montant déjà réglé (€)<input type="number" min="0" step="0.01" value={deliveryForm.amount_paid} onChange={(event) => setDeliveryForm({ ...deliveryForm, amount_paid: event.target.value })} /></label>
            <label className="direct-sale-field-wide">Moyen de paiement<input value={deliveryForm.payment_method} onChange={(event) => setDeliveryForm({ ...deliveryForm, payment_method: event.target.value })} placeholder="Ex. Virement, chèque, espèces" /></label>
          </div>
          <ModalActions saving={saving} onCancel={() => setDeliveryModal(false)} onSave={saveDelivery} label="Enregistrer la livraison" />
        </DirectModal>
      )}

      {paymentModal && (
        <DirectModal title="Enregistrer un règlement" subtitle="Le montant s’ajoutera aux paiements déjà reçus." icon="€" onClose={() => setPaymentModal(false)}>
          <div className="direct-sale-form-grid">
            <label>Montant reçu (€)<input type="number" min="0" step="0.01" value={paymentForm.amount} onChange={(event) => setPaymentForm({ ...paymentForm, amount: event.target.value })} /></label>
            <label>Date du règlement<input type="date" value={paymentForm.payment_date} onChange={(event) => setPaymentForm({ ...paymentForm, payment_date: event.target.value })} /></label>
            <label className="direct-sale-field-wide">Moyen de paiement<input value={paymentForm.payment_method} onChange={(event) => setPaymentForm({ ...paymentForm, payment_method: event.target.value })} placeholder="Ex. Virement, chèque, espèces" /></label>
          </div>
          <ModalActions saving={saving} onCancel={() => setPaymentModal(false)} onSave={savePayment} label="Valider le règlement" />
        </DirectModal>
      )}

      {mortalityModal && (
        <DirectModal title="Enregistrer des mortalités" subtitle={lotById.get(selectedLotId)?.name || "Petit lot"} icon="†" onClose={() => setMortalityModal(false)}>
          <div className="direct-sale-form-grid">
            <label className="direct-sale-field-wide">Nombre de sujets morts<input type="number" min="1" value={mortalityCount} onChange={(event) => setMortalityCount(event.target.value)} /></label>
          </div>
          <ModalActions saving={saving} onCancel={() => setMortalityModal(false)} onSave={saveMortality} label="Enregistrer les mortalités" />
        </DirectModal>
      )}
    </div>
  );
}

function DirectKpi({
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
    <article className="direct-sale-kpi">
      <span className={`direct-sale-kpi-icon direct-sale-kpi-${tone}`}>{icon}</span>
      <div><small>{label}</small><strong>{value}</strong><em>{note}</em></div>
    </article>
  );
}

function DirectModal({
  title,
  subtitle,
  icon,
  onClose,
  children,
}: {
  title: string;
  subtitle: string;
  icon: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="poultry-modal-backdrop" onClick={onClose}>
      <section className="poultry-modal poultry-modal-medium direct-sale-modal" onClick={(event) => event.stopPropagation()}>
        <ModalCloseButton onClick={onClose} />
        <header className="poultry-modal-header">
          <span className="poultry-modal-icon">{icon}</span>
          <div><h2>{title}</h2><p>{subtitle}</p></div>
        </header>
        {children}
      </section>
    </div>
  );
}

function ModalActions({
  saving,
  onCancel,
  onSave,
  label,
}: {
  saving: boolean;
  onCancel: () => void;
  onSave: () => void;
  label: string;
}) {
  return (
    <div className="poultry-modal-actions">
      <button type="button" className="poultry-modal-secondary" onClick={onCancel} disabled={saving}>Annuler</button>
      <button type="button" className="poultry-modal-primary" onClick={onSave} disabled={saving}>{saving ? "Enregistrement..." : label}</button>
    </div>
  );
}
