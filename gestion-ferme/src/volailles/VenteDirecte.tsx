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
  batch_id: string | null;
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
  batch_id: string | null;
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

type OrderLineForm = {
  lot_id: string;
  species: DirectOrder["species"];
  quantity: string;
  target_weight: string;
  pricing_mode: DirectOrder["pricing_mode"];
  unit_price: string;
};

type DeliveryLineForm = {
  order_id: string;
  lot_id: string;
  quantity: string;
  total_weight: string;
  pricing_mode: DirectDelivery["pricing_mode"];
  unit_price: string;
};

const emptyOrderLine = (): OrderLineForm => ({
  lot_id: "",
  species: "poulet",
  quantity: "",
  target_weight: "",
  pricing_mode: "kg",
  unit_price: "",
});

const emptyDeliveryLine = (): DeliveryLineForm => ({
  order_id: "",
  lot_id: "",
  quantity: "",
  total_weight: "",
  pricing_mode: "kg",
  unit_price: "",
});

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
  const [lotDetailModal, setLotDetailModal] = useState(false);
  const [selectedLotId, setSelectedLotId] = useState("");
  const [selectedDeliveryId, setSelectedDeliveryId] = useState("");
  const [editingLotId, setEditingLotId] = useState("");
  const [editingCustomerId, setEditingCustomerId] = useState("");
  const [editingOrderBatch, setEditingOrderBatch] = useState("");
  const [editingDeliveryBatch, setEditingDeliveryBatch] = useState("");
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
    delivery_date: todayIso(),
    notes: "",
  });
  const [orderLines, setOrderLines] = useState<OrderLineForm[]>([
    emptyOrderLine(),
  ]);
  const [deliveryForm, setDeliveryForm] = useState({
    customer_id: "",
    delivery_date: todayIso(),
    amount_paid: "",
    payment_method: "",
  });
  const [deliveryLines, setDeliveryLines] = useState<DeliveryLineForm[]>([
    emptyDeliveryLine(),
  ]);
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
  const orderGroups = useMemo(
    () =>
      Array.from(
        orders.reduce((groups, order) => {
          const key = order.batch_id || order.id;
          groups.set(key, [...(groups.get(key) || []), order]);
          return groups;
        }, new Map<string, DirectOrder[]>())
      ).map(([key, lines]) => ({ key, lines })),
    [orders]
  );
  const pendingOrderGroups = orderGroups.filter(({ lines }) =>
    lines.some(
      (order) => order.status === "a_preparer" || order.status === "prete"
    )
  );
  const deliveryGroups = useMemo(
    () =>
      Array.from(
        deliveries.reduce((groups, delivery) => {
          const key = delivery.batch_id || delivery.id;
          groups.set(key, [...(groups.get(key) || []), delivery]);
          return groups;
        }, new Map<string, DirectDelivery[]>())
      ).map(([key, lines]) => ({ key, lines })),
    [deliveries]
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
    const currentLot = lots.find((lot) => lot.id === editingLotId);
    const usedSubjects = currentLot
      ? currentLot.initial_quantity - currentLot.remaining_quantity
      : 0;
    if (initialQuantity < usedSubjects) {
      toast.error(`L'effectif initial ne peut pas être inférieur à ${usedSubjects}.`);
      setSaving(false);
      return;
    }
    const payload = {
      name: lotForm.name.trim(),
      species: lotForm.species,
      arrival_date: lotForm.arrival_date,
      initial_quantity: initialQuantity,
      remaining_quantity: currentLot
        ? initialQuantity - usedSubjects
        : initialQuantity,
      location: lotForm.location.trim() || null,
      notes: lotForm.notes.trim() || null,
    };
    const { error } = editingLotId
      ? await supabase.from("direct_sale_lots").update(payload).eq("id", editingLotId)
      : await supabase.from("direct_sale_lots").insert(payload);
    if (error) {
      console.error("Erreur ajout lot vente directe :", error);
      toast.error("Le lot n'a pas pu être enregistré.");
    } else {
      toast.success(editingLotId ? "Petit lot modifié." : "Petit lot enregistré.");
      setLotModal(false);
      setEditingLotId("");
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
      toast.error("Indiquez le nom du client.");
      return;
    }
    setSaving(true);
    const payload = {
      name: customerForm.name.trim(),
      phone: customerForm.phone.trim() || null,
      notes: customerForm.notes.trim() || null,
    };
    const { error } = editingCustomerId
      ? await supabase.from("direct_sale_customers").update(payload).eq("id", editingCustomerId)
      : await supabase.from("direct_sale_customers").insert(payload);
    if (error) {
      console.error("Erreur ajout client :", error);
      toast.error("Le client n'a pas pu être enregistré.");
    } else {
      toast.success(editingCustomerId ? "Client modifié." : "Client enregistré.");
      setCustomerModal(false);
      setEditingCustomerId("");
      setCustomerForm({ name: "", phone: "", notes: "" });
      await loadData();
    }
    setSaving(false);
  };

  const openLotForm = (lot?: DirectLot) => {
    setEditingLotId(lot?.id || "");
    setLotForm(
      lot
        ? {
            name: lot.name,
            species: lot.species,
            arrival_date: lot.arrival_date,
            initial_quantity: String(lot.initial_quantity),
            location: lot.location || "",
            notes: lot.notes || "",
          }
        : {
            name: "",
            species: "poulet",
            arrival_date: todayIso(),
            initial_quantity: "",
            location: "",
            notes: "",
          }
    );
    setLotModal(true);
  };

  const openCustomerForm = (customer?: DirectCustomer) => {
    setEditingCustomerId(customer?.id || "");
    setCustomerForm({
      name: customer?.name || "",
      phone: customer?.phone || "",
      notes: customer?.notes || "",
    });
    setCustomerModal(true);
  };

  const deleteLot = async (lot: DirectLot) => {
    if (!window.confirm(`Supprimer définitivement le lot ${lot.name} ?`)) return;
    const { error } = await supabase.from("direct_sale_lots").delete().eq("id", lot.id);
    if (error) toast.error("Ce lot est encore lié à une commande ou une livraison.");
    else {
      toast.success("Petit lot supprimé.");
      setLotDetailModal(false);
      await loadData();
    }
  };

  const deleteCustomer = async (customer: DirectCustomer) => {
    if (!window.confirm(`Supprimer définitivement le client ${customer.name} ?`)) return;
    const { error } = await supabase
      .from("direct_sale_customers")
      .delete()
      .eq("id", customer.id);
    if (error) toast.error("Ce client est encore lié à une commande ou une livraison.");
    else {
      toast.success("Client supprimé.");
      await loadData();
    }
  };

  const saveOrder = async () => {
    if (!orderForm.customer_id || !orderForm.delivery_date) {
      toast.error("Sélectionnez un client et une date.");
      return;
    }
    const invalidLine = orderLines.some(
      (line) =>
        !Number.isInteger(Number(line.quantity)) ||
        Number(line.quantity) <= 0
    );
    if (!orderLines.length || invalidLine) {
      toast.error("Renseignez une quantité valide pour chaque produit.");
      return;
    }
    setSaving(true);
    const batchId = editingOrderBatch || crypto.randomUUID();
    if (editingOrderBatch) {
      const oldLines = orders.filter(
        (order) => (order.batch_id || order.id) === editingOrderBatch
      );
      const { error: deleteError } = await supabase
        .from("direct_sale_orders")
        .delete()
        .in("id", oldLines.map((line) => line.id));
      if (deleteError) {
        toast.error("La commande n'a pas pu être modifiée.");
        setSaving(false);
        return;
      }
    }
    const { error } = await supabase.from("direct_sale_orders").insert(
      orderLines.map((line) => ({
        batch_id: batchId,
        customer_id: orderForm.customer_id,
        lot_id: line.lot_id || null,
        delivery_date: orderForm.delivery_date,
        species: line.species,
        quantity_ordered: Number(line.quantity),
        target_weight: line.target_weight ? Number(line.target_weight) : null,
        pricing_mode: line.pricing_mode,
        unit_price: Number(line.unit_price) || 0,
        notes: orderForm.notes.trim() || null,
      }))
    );
    if (error) {
      console.error("Erreur ajout commande :", error);
      toast.error("La commande n'a pas pu être enregistrée.");
    } else {
      toast.success(editingOrderBatch ? "Commande modifiée." : "Commande enregistrée.");
      setOrderModal(false);
      setEditingOrderBatch("");
      setOrderForm({
        customer_id: "",
        delivery_date: todayIso(),
        notes: "",
      });
      setOrderLines([emptyOrderLine()]);
      await loadData();
    }
    setSaving(false);
  };

  const openOrderForm = (group?: { key: string; lines: DirectOrder[] }) => {
    setEditingOrderBatch(group?.key || "");
    const first = group?.lines[0];
    setOrderForm({
      customer_id: first?.customer_id || "",
      delivery_date: first?.delivery_date || todayIso(),
      notes: first?.notes || "",
    });
    setOrderLines(
      group
        ? group.lines.map((line) => ({
            lot_id: line.lot_id || "",
            species: line.species,
            quantity: String(line.quantity_ordered),
            target_weight:
              line.target_weight == null ? "" : String(line.target_weight),
            pricing_mode: line.pricing_mode,
            unit_price: line.unit_price ? String(line.unit_price) : "",
          }))
        : [emptyOrderLine()]
    );
    setOrderModal(true);
  };

  const deleteOrderGroup = async (group: { key: string; lines: DirectOrder[] }) => {
    if (!window.confirm("Supprimer cette commande et tous ses produits ?")) return;
    const { error } = await supabase
      .from("direct_sale_orders")
      .delete()
      .in("id", group.lines.map((line) => line.id));
    if (error) toast.error("La commande n'a pas pu être supprimée.");
    else {
      toast.success("Commande supprimée.");
      await loadData();
    }
  };

  const prepareDelivery = (group?: { key: string; lines: DirectOrder[] }) => {
    const first = group?.lines[0];
    setEditingDeliveryBatch("");
    setDeliveryForm({
      customer_id: first?.customer_id || "",
      delivery_date: first?.delivery_date || todayIso(),
      amount_paid: "",
      payment_method: "",
    });
    setDeliveryLines(
      group
        ? group.lines.map((line) => ({
            order_id: line.id,
            lot_id: line.lot_id || "",
            quantity: String(line.quantity_ordered),
            total_weight: "",
            pricing_mode: line.pricing_mode,
            unit_price: line.unit_price ? String(line.unit_price) : "",
          }))
        : [emptyDeliveryLine()]
    );
    setDeliveryModal(true);
  };

  const saveDelivery = async () => {
    if (!deliveryForm.customer_id || !deliveryForm.delivery_date) {
      toast.error("Complétez le client et la date.");
      return;
    }
    const parsedLines = deliveryLines.map((line) => ({
      ...line,
      lot: lotById.get(line.lot_id),
      quantityValue: Number(line.quantity),
      weightValue: Number(line.total_weight) || 0,
      priceValue: Number(line.unit_price) || 0,
    }));
    const invalidLine = parsedLines.find(
      (line) =>
        !line.lot ||
        !Number.isInteger(line.quantityValue) ||
        line.quantityValue <= 0 ||
        (line.pricing_mode === "kg" && line.weightValue <= 0)
    );
    if (invalidLine) {
      toast.error("Complétez le lot, la quantité, le poids et le prix de chaque produit.");
      return;
    }
    const quantitiesByLot = parsedLines.reduce((map, line) => {
      map.set(line.lot_id, (map.get(line.lot_id) || 0) + line.quantityValue);
      return map;
    }, new Map<string, number>());
    const oldDeliveryLines = editingDeliveryBatch
      ? deliveries.filter(
          (delivery) =>
            (delivery.batch_id || delivery.id) === editingDeliveryBatch
        )
      : [];
    const restoredByLot = oldDeliveryLines.reduce((map, line) => {
      map.set(
        line.lot_id,
        (map.get(line.lot_id) || 0) + line.quantity_delivered
      );
      return map;
    }, new Map<string, number>());
    for (const [lotId, quantity] of quantitiesByLot) {
      const lot = lotById.get(lotId);
      const available = (lot?.remaining_quantity || 0) + (restoredByLot.get(lotId) || 0);
      if (!lot || quantity > available) {
        toast.error(`Quantité indisponible pour le lot ${lot?.name || ""}.`);
        return;
      }
    }
    const amountInvoiced = parsedLines.reduce(
      (total, line) =>
        total +
        (line.pricing_mode === "kg"
          ? line.weightValue * line.priceValue
          : line.quantityValue * line.priceValue),
      0
    );
    const amountPaid = Number(deliveryForm.amount_paid) || 0;
    if (amountPaid > amountInvoiced) {
      toast.error("Le montant réglé ne peut pas dépasser le montant facturé.");
      return;
    }
    setSaving(true);
    if (oldDeliveryLines.length) {
      const { error: deleteError } = await supabase
        .from("direct_sale_deliveries")
        .delete()
        .in("id", oldDeliveryLines.map((line) => line.id));
      if (deleteError) {
        toast.error("La livraison n'a pas pu être modifiée.");
        setSaving(false);
        return;
      }
      for (const [lotId, quantity] of restoredByLot) {
        const lot = lotById.get(lotId);
        if (lot) {
          await supabase
            .from("direct_sale_lots")
            .update({
              remaining_quantity: lot.remaining_quantity + quantity,
              status: lot.status === "termine" ? "elevage" : lot.status,
            })
            .eq("id", lotId);
        }
      }
      const previousOrderIds = oldDeliveryLines
        .map((line) => line.order_id)
        .filter((id): id is string => Boolean(id));
      if (previousOrderIds.length) {
        await supabase
          .from("direct_sale_orders")
          .update({ status: "a_preparer" })
          .in("id", previousOrderIds);
      }
    }
    const batchId = editingDeliveryBatch || crypto.randomUUID();
    const paymentRatios = parsedLines.map((line) =>
      amountInvoiced > 0
        ? (line.pricing_mode === "kg"
            ? line.weightValue * line.priceValue
            : line.quantityValue * line.priceValue) / amountInvoiced
        : 0
    );
    const { data: insertedDeliveries, error: deliveryError } = await supabase
      .from("direct_sale_deliveries")
      .insert(
        parsedLines.map((line, index) => {
          const lineAmount =
            line.pricing_mode === "kg"
              ? line.weightValue * line.priceValue
              : line.quantityValue * line.priceValue;
          return {
            batch_id: batchId,
            order_id: line.order_id || null,
            customer_id: deliveryForm.customer_id,
            lot_id: line.lot_id,
            delivery_date: deliveryForm.delivery_date,
            quantity_delivered: line.quantityValue,
            total_weight: line.weightValue || null,
            pricing_mode: line.pricing_mode,
            unit_price: line.priceValue,
            amount_invoiced: lineAmount,
            amount_paid: amountPaid * paymentRatios[index],
            payment_date: amountPaid ? deliveryForm.delivery_date : null,
            payment_method: deliveryForm.payment_method.trim() || null,
          };
        })
      )
      .select("id");
    if (deliveryError) {
      console.error("Erreur ajout livraison directe :", deliveryError);
      toast.error("La livraison n'a pas pu être enregistrée.");
      setSaving(false);
      return;
    }

    for (const [lotId, quantity] of quantitiesByLot) {
      const lot = lotById.get(lotId)!;
      const remainingQuantity =
        lot.remaining_quantity + (restoredByLot.get(lotId) || 0) - quantity;
      const { error: lotError } = await supabase
        .from("direct_sale_lots")
        .update({
          remaining_quantity: remainingQuantity,
          status: remainingQuantity === 0 ? "termine" : lot.status,
        })
        .eq("id", lot.id);
      if (lotError) {
        console.error("Erreur mise à jour effectif :", lotError);
        if (insertedDeliveries?.length) {
          await supabase
            .from("direct_sale_deliveries")
            .delete()
            .in("id", insertedDeliveries.map((item) => item.id));
        }
        toast.error("La livraison n'a pas pu mettre à jour les effectifs.");
        setSaving(false);
        return;
      }
    }

    const orderIds = parsedLines.map((line) => line.order_id).filter(Boolean);
    if (orderIds.length) {
      const { error: orderError } = await supabase
        .from("direct_sale_orders")
        .update({ status: "livree" })
        .in("id", orderIds);
      if (orderError) console.error("Erreur clôture commande :", orderError);
    }

    toast.success("Livraison enregistrée.");
    setDeliveryModal(false);
    setEditingDeliveryBatch("");
    await loadData();
    setSaving(false);
  };

  const openPayment = (group: { key: string; lines: DirectDelivery[] }) => {
    const first = group.lines[0];
    setSelectedDeliveryId(group.key);
    setPaymentForm({
      amount: "",
      payment_date: todayIso(),
      payment_method: first.payment_method || "",
    });
    setPaymentModal(true);
  };

  const openDeliveryForm = (group: { key: string; lines: DirectDelivery[] }) => {
    const first = group.lines[0];
    setEditingDeliveryBatch(group.key);
    setDeliveryForm({
      customer_id: first.customer_id,
      delivery_date: first.delivery_date,
      amount_paid: String(
        group.lines.reduce((total, line) => total + line.amount_paid, 0)
      ),
      payment_method: first.payment_method || "",
    });
    setDeliveryLines(
      group.lines.map((line) => ({
        order_id: line.order_id || "",
        lot_id: line.lot_id,
        quantity: String(line.quantity_delivered),
        total_weight: line.total_weight == null ? "" : String(line.total_weight),
        pricing_mode: line.pricing_mode,
        unit_price: String(line.unit_price),
      }))
    );
    setDeliveryModal(true);
  };

  const deleteDeliveryGroup = async (group: {
    key: string;
    lines: DirectDelivery[];
  }) => {
    if (!window.confirm("Supprimer cette livraison et rétablir les effectifs ?")) return;
    const quantitiesByLot = group.lines.reduce((map, line) => {
      map.set(line.lot_id, (map.get(line.lot_id) || 0) + line.quantity_delivered);
      return map;
    }, new Map<string, number>());
    const { error } = await supabase
      .from("direct_sale_deliveries")
      .delete()
      .in("id", group.lines.map((line) => line.id));
    if (error) toast.error("La livraison n'a pas pu être supprimée.");
    else {
      for (const [lotId, quantity] of quantitiesByLot) {
        const lot = lotById.get(lotId);
        if (lot) {
          await supabase
            .from("direct_sale_lots")
            .update({
              remaining_quantity: lot.remaining_quantity + quantity,
              status: lot.status === "termine" ? "elevage" : lot.status,
            })
            .eq("id", lot.id);
        }
      }
      const orderIds = group.lines
        .map((line) => line.order_id)
        .filter((id): id is string => Boolean(id));
      if (orderIds.length) {
        await supabase
          .from("direct_sale_orders")
          .update({ status: "a_preparer" })
          .in("id", orderIds);
      }
      toast.success("Livraison supprimée.");
      await loadData();
    }
  };

  const savePayment = async () => {
    const group = deliveryGroups.find((item) => item.key === selectedDeliveryId);
    const amount = Number(paymentForm.amount);
    if (!group || amount <= 0) {
      toast.error("Indiquez un montant valide.");
      return;
    }
    const outstanding = group.lines.reduce(
      (total, line) =>
        total + Math.max(0, line.amount_invoiced - line.amount_paid),
      0
    );
    if (amount > outstanding) {
      toast.error(`Le solde restant est de ${formatMontant(outstanding)}.`);
      return;
    }
    setSaving(true);
    let remainingPayment = amount;
    let paymentError = false;
    for (const line of group.lines) {
      const lineOutstanding = Math.max(
        0,
        line.amount_invoiced - line.amount_paid
      );
      const linePayment = Math.min(lineOutstanding, remainingPayment);
      if (linePayment <= 0) continue;
      const { error } = await supabase
        .from("direct_sale_deliveries")
        .update({
          amount_paid: line.amount_paid + linePayment,
          payment_date: paymentForm.payment_date,
          payment_method: paymentForm.payment_method.trim() || null,
        })
        .eq("id", line.id);
      if (error) {
        paymentError = true;
        break;
      }
      remainingPayment -= linePayment;
    }
    if (paymentError) toast.error("Le règlement n'a pas pu être enregistré.");
    else {
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
    group: { key: string; lines: DirectOrder[] },
    status: DirectOrder["status"]
  ) => {
    const { error } = await supabase
      .from("direct_sale_orders")
      .update({ status })
      .in("id", group.lines.map((line) => line.id));
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
          <p>Petits lots, commandes clients, livraisons et règlements.</p>
        </div>
        <div>
          <button type="button" className="direct-sale-secondary" onClick={() => openCustomerForm()}>
            ＋ Client
          </button>
          <button type="button" className="direct-sale-primary" onClick={() => openLotForm()}>
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
        <DirectKpi icon="▤" tone="blue" label="Commandes à préparer" value={formatNombre(pendingOrderGroups.length)} note="À venir" />
        <DirectKpi icon="€" tone="orange" label="Chiffre d’affaires" value={formatMontant(invoicedTotal)} note="Livraisons enregistrées" />
        <DirectKpi icon="!" tone="red" label="Paiements attendus" value={formatMontant(outstandingTotal)} note="Solde restant" />
      </section>

      <section className="direct-sale-panel">
        <div className="direct-sale-panel-heading">
          <div><h2>Petits lots</h2><span>Poulets et pintades destinés à la vente directe.</span></div>
          <button type="button" className="direct-sale-primary" onClick={() => openLotForm()}>＋ Nouveau lot</button>
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
              <div className="direct-sale-card-actions">
                <button type="button" onClick={() => { setSelectedLotId(lot.id); setLotDetailModal(true); }} title="Ouvrir la fiche">👁 Fiche</button>
                <button type="button" onClick={() => openLotForm(lot)} title="Modifier">✎</button>
                <button type="button" onClick={() => deleteLot(lot)} title="Supprimer">⌫</button>
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
            <div><h2>Commandes clients</h2><span>Préparation et dates de livraison.</span></div>
            <button type="button" className="direct-sale-primary" onClick={() => openOrderForm()}>＋ Commande</button>
          </div>
          <div className="direct-sale-list">
            {orderGroups.map((group) => {
              const first = group.lines[0];
              const totalQuantity = group.lines.reduce(
                (total, line) => total + line.quantity_ordered,
                0
              );
              return (
              <div className="direct-sale-order-row" key={group.key}>
                <span className="direct-sale-row-icon">▤</span>
                <div>
                  <strong>{customerById.get(first.customer_id)?.name || "Client"}</strong>
                  <small>{group.lines.length} produit(s) · {formatNombre(totalQuantity)} sujets · {formatDate(first.delivery_date)}</small>
                </div>
                <select
                  className={`direct-sale-order-status direct-sale-order-${first.status}`}
                  value={first.status}
                  onChange={(event) =>
                    updateOrderStatus(
                      group,
                      event.target.value as DirectOrder["status"]
                    )
                  }
                  aria-label={`Statut de la commande de ${customerById.get(first.customer_id)?.name || "ce client"}`}
                >
                  <option value="a_preparer">À préparer</option>
                  <option value="prete">Prête</option>
                  <option value="livree">Livrée</option>
                  <option value="annulee">Annulée</option>
                </select>
                <div className="direct-sale-row-actions">
                  {!["livree", "annulee"].includes(first.status) && <button type="button" title="Enregistrer la livraison" onClick={() => prepareDelivery(group)}>🚚</button>}
                  <button type="button" title="Modifier" onClick={() => openOrderForm(group)}>✎</button>
                  <button type="button" title="Supprimer" onClick={() => deleteOrderGroup(group)}>⌫</button>
                </div>
              </div>
            )})}
            {orderGroups.length === 0 && <div className="direct-sale-empty">Aucune commande enregistrée.</div>}
          </div>
        </article>

        <article className="direct-sale-panel">
          <div className="direct-sale-panel-heading">
            <div><h2>Livraisons et règlements</h2><span>Facturation et paiements reçus.</span></div>
            <button type="button" className="direct-sale-secondary" onClick={() => prepareDelivery()}>＋ Livraison</button>
          </div>
          <div className="direct-sale-list">
            {deliveryGroups.slice(0, 8).map((group) => {
              const first = group.lines[0];
              const invoiced = group.lines.reduce((total, line) => total + line.amount_invoiced, 0);
              const paid = group.lines.reduce((total, line) => total + line.amount_paid, 0);
              const quantity = group.lines.reduce((total, line) => total + line.quantity_delivered, 0);
              const outstanding = Math.max(0, invoiced - paid);
              return (
                <div className="direct-sale-delivery-row" key={group.key}>
                  <span className="direct-sale-row-icon">🚚</span>
                  <div>
                    <strong>{customerById.get(first.customer_id)?.name || "Client"}</strong>
                    <small>{group.lines.length} produit(s) · {formatDate(first.delivery_date)} · {formatNombre(quantity)} sujets</small>
                  </div>
                  <div className="direct-sale-money">
                    <strong>{formatMontant(invoiced)}</strong>
                    <small>{outstanding > 0 ? `Reste ${formatMontant(outstanding)}` : "Payée"}</small>
                  </div>
                  <div className="direct-sale-row-actions">
                    {outstanding > 0 ? (
                      <button type="button" title="Enregistrer un règlement" onClick={() => openPayment(group)}>€</button>
                    ) : <span className="direct-sale-paid">✓</span>}
                    <button type="button" title="Modifier" onClick={() => openDeliveryForm(group)}>✎</button>
                    <button type="button" title="Supprimer" onClick={() => deleteDeliveryGroup(group)}>⌫</button>
                  </div>
                </div>
              );
            })}
            {deliveryGroups.length === 0 && <div className="direct-sale-empty">Aucune livraison enregistrée.</div>}
          </div>
        </article>
      </section>

      <section className="direct-sale-panel direct-sale-customers">
        <div className="direct-sale-panel-heading">
          <div><h2>Clients</h2><span>{customers.length} client(s) enregistré(s).</span></div>
          <button type="button" className="direct-sale-secondary" onClick={() => openCustomerForm()}>＋ Ajouter</button>
        </div>
        <div className="direct-sale-customer-grid">
          {customers.map((customer) => (
            <article key={customer.id}>
              <span>♙</span>
              <div><strong>{customer.name}</strong><small>{customer.phone || "Téléphone non renseigné"}</small></div>
              <div className="direct-sale-customer-actions">
                <button type="button" onClick={() => openCustomerForm(customer)} title="Modifier">✎</button>
                <button type="button" onClick={() => deleteCustomer(customer)} title="Supprimer">⌫</button>
              </div>
            </article>
          ))}
          {customers.length === 0 && <div className="direct-sale-empty">Aucun client enregistré.</div>}
        </div>
      </section>

      {lotModal && (
        <DirectModal title={editingLotId ? "Modifier le petit lot" : "Ajouter un petit lot"} subtitle="Ce lot restera séparé des lots destinés à la coopérative." icon="♧" onClose={() => setLotModal(false)}>
          <div className="direct-sale-form-grid">
            <label>Nom du lot<input value={lotForm.name} onChange={(event) => setLotForm({ ...lotForm, name: event.target.value })} placeholder="Ex. Pintades juillet" /></label>
            <label>Espèce<select value={lotForm.species} onChange={(event) => setLotForm({ ...lotForm, species: event.target.value as DirectLot["species"] })}><option value="poulet">Poulets</option><option value="pintade">Pintades</option></select></label>
            <label>Date d’arrivée<input type="date" value={lotForm.arrival_date} onChange={(event) => setLotForm({ ...lotForm, arrival_date: event.target.value })} /></label>
            <label>Effectif initial<input type="number" min="1" value={lotForm.initial_quantity} onChange={(event) => setLotForm({ ...lotForm, initial_quantity: event.target.value })} placeholder="Ex. 80" /></label>
            <label className="direct-sale-field-wide">Emplacement<input value={lotForm.location} onChange={(event) => setLotForm({ ...lotForm, location: event.target.value })} placeholder="Ex. Parc 1" /></label>
            <label className="direct-sale-field-wide">Note<textarea value={lotForm.notes} onChange={(event) => setLotForm({ ...lotForm, notes: event.target.value })} /></label>
          </div>
          <ModalActions saving={saving} onCancel={() => setLotModal(false)} onSave={saveLot} label={editingLotId ? "Enregistrer les modifications" : "Enregistrer le lot"} />
        </DirectModal>
      )}

      {customerModal && (
        <DirectModal title={editingCustomerId ? "Modifier le client" : "Ajouter un client"} subtitle="Le client sera proposé dans les commandes et les livraisons." icon="♙" onClose={() => setCustomerModal(false)}>
          <div className="direct-sale-form-grid">
            <label className="direct-sale-field-wide">Nom<input value={customerForm.name} onChange={(event) => setCustomerForm({ ...customerForm, name: event.target.value })} placeholder="Nom du client ou de l’établissement" /></label>
            <label className="direct-sale-field-wide">Téléphone<input value={customerForm.phone} onChange={(event) => setCustomerForm({ ...customerForm, phone: event.target.value })} placeholder="Numéro de téléphone" /></label>
            <label className="direct-sale-field-wide">Note<textarea value={customerForm.notes} onChange={(event) => setCustomerForm({ ...customerForm, notes: event.target.value })} /></label>
          </div>
          <ModalActions saving={saving} onCancel={() => setCustomerModal(false)} onSave={saveCustomer} label={editingCustomerId ? "Enregistrer les modifications" : "Enregistrer le client"} />
        </DirectModal>
      )}

      {orderModal && (
        <DirectModal title={editingOrderBatch ? "Modifier la commande" : "Nouvelle commande"} subtitle="Ajoutez un ou plusieurs produits pour le même client." icon="▤" onClose={() => setOrderModal(false)}>
          <div className="direct-sale-form-grid">
            <label>Client<select value={orderForm.customer_id} onChange={(event) => setOrderForm({ ...orderForm, customer_id: event.target.value })}><option value="">Choisir un client</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>
            <label>Date souhaitée<input type="date" value={orderForm.delivery_date} onChange={(event) => setOrderForm({ ...orderForm, delivery_date: event.target.value })} /></label>
            <label className="direct-sale-field-wide">Note<textarea value={orderForm.notes} onChange={(event) => setOrderForm({ ...orderForm, notes: event.target.value })} /></label>
          </div>
          <div className="direct-sale-product-lines">
            {orderLines.map((line, index) => (
              <div className="direct-sale-product-line" key={index}>
                <div className="direct-sale-product-line-heading">
                  <strong>Produit {index + 1}</strong>
                  {orderLines.length > 1 && <button type="button" onClick={() => setOrderLines((lines) => lines.filter((_, lineIndex) => lineIndex !== index))}>⌫</button>}
                </div>
                <div className="direct-sale-form-grid">
                  <label>Espèce<select value={line.species} onChange={(event) => setOrderLines((lines) => lines.map((item, lineIndex) => lineIndex === index ? { ...item, species: event.target.value as DirectOrder["species"], lot_id: "" } : item))}><option value="poulet">Poulets</option><option value="pintade">Pintades</option></select></label>
                  <label>Lot prévu<select value={line.lot_id} onChange={(event) => setOrderLines((lines) => lines.map((item, lineIndex) => lineIndex === index ? { ...item, lot_id: event.target.value } : item))}><option value="">À déterminer</option>{activeLots.filter((lot) => lot.species === line.species).map((lot) => <option key={lot.id} value={lot.id}>{lot.name} · {lot.remaining_quantity} restants</option>)}</select></label>
                  <label>Quantité<input type="number" min="1" value={line.quantity} onChange={(event) => setOrderLines((lines) => lines.map((item, lineIndex) => lineIndex === index ? { ...item, quantity: event.target.value } : item))} /></label>
                  <label>Poids cible par sujet (kg)<input type="number" min="0" step="0.01" value={line.target_weight} onChange={(event) => setOrderLines((lines) => lines.map((item, lineIndex) => lineIndex === index ? { ...item, target_weight: event.target.value } : item))} /></label>
                  <label>Mode de prix<select value={line.pricing_mode} onChange={(event) => setOrderLines((lines) => lines.map((item, lineIndex) => lineIndex === index ? { ...item, pricing_mode: event.target.value as DirectOrder["pricing_mode"] } : item))}><option value="kg">Prix au kilogramme</option><option value="unite">Prix à l’unité</option></select></label>
                  <label>Prix convenu (€)<input type="number" min="0" step="0.01" value={line.unit_price} onChange={(event) => setOrderLines((lines) => lines.map((item, lineIndex) => lineIndex === index ? { ...item, unit_price: event.target.value } : item))} /></label>
                </div>
              </div>
            ))}
            <button type="button" className="direct-sale-add-line" onClick={() => setOrderLines((lines) => [...lines, emptyOrderLine()])}>＋ Ajouter un produit</button>
          </div>
          <ModalActions saving={saving} onCancel={() => setOrderModal(false)} onSave={saveOrder} label={editingOrderBatch ? "Enregistrer les modifications" : "Enregistrer la commande"} />
        </DirectModal>
      )}

      {deliveryModal && (
        <DirectModal title={editingDeliveryBatch ? "Modifier la livraison" : "Enregistrer une livraison"} subtitle="Ajoutez plusieurs produits pour le même client si nécessaire." icon="🚚" onClose={() => setDeliveryModal(false)}>
          <div className="direct-sale-form-grid">
            <label>Client<select value={deliveryForm.customer_id} onChange={(event) => setDeliveryForm({ ...deliveryForm, customer_id: event.target.value })}><option value="">Choisir un client</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}</select></label>
            <label>Date de livraison<input type="date" value={deliveryForm.delivery_date} onChange={(event) => setDeliveryForm({ ...deliveryForm, delivery_date: event.target.value })} /></label>
            <label>Montant déjà réglé (€)<input type="number" min="0" step="0.01" value={deliveryForm.amount_paid} onChange={(event) => setDeliveryForm({ ...deliveryForm, amount_paid: event.target.value })} /></label>
            <label className="direct-sale-field-wide">Moyen de paiement<input value={deliveryForm.payment_method} onChange={(event) => setDeliveryForm({ ...deliveryForm, payment_method: event.target.value })} placeholder="Ex. Virement, chèque, espèces" /></label>
          </div>
          <div className="direct-sale-product-lines">
            {deliveryLines.map((line, index) => (
              <div className="direct-sale-product-line" key={index}>
                <div className="direct-sale-product-line-heading">
                  <strong>Produit {index + 1}</strong>
                  {deliveryLines.length > 1 && <button type="button" onClick={() => setDeliveryLines((lines) => lines.filter((_, lineIndex) => lineIndex !== index))}>⌫</button>}
                </div>
                <div className="direct-sale-form-grid">
                  <label>Lot<select value={line.lot_id} onChange={(event) => setDeliveryLines((lines) => lines.map((item, lineIndex) => lineIndex === index ? { ...item, lot_id: event.target.value } : item))}><option value="">Choisir un lot</option>{lots.filter((lot) => lot.status !== "termine" || lot.id === line.lot_id).map((lot) => <option key={lot.id} value={lot.id}>{lot.name} · {lot.remaining_quantity} restants</option>)}</select></label>
                  <label>Quantité livrée<input type="number" min="1" value={line.quantity} onChange={(event) => setDeliveryLines((lines) => lines.map((item, lineIndex) => lineIndex === index ? { ...item, quantity: event.target.value } : item))} /></label>
                  <label>Mode de prix<select value={line.pricing_mode} onChange={(event) => setDeliveryLines((lines) => lines.map((item, lineIndex) => lineIndex === index ? { ...item, pricing_mode: event.target.value as DirectDelivery["pricing_mode"] } : item))}><option value="kg">Prix au kilogramme</option><option value="unite">Prix à l’unité</option></select></label>
                  {line.pricing_mode === "kg" && <label>Poids total (kg)<input type="number" min="0" step="0.01" value={line.total_weight} onChange={(event) => setDeliveryLines((lines) => lines.map((item, lineIndex) => lineIndex === index ? { ...item, total_weight: event.target.value } : item))} /></label>}
                  <label>Prix {line.pricing_mode === "kg" ? "par kg" : "par unité"} (€)<input type="number" min="0" step="0.01" value={line.unit_price} onChange={(event) => setDeliveryLines((lines) => lines.map((item, lineIndex) => lineIndex === index ? { ...item, unit_price: event.target.value } : item))} /></label>
                </div>
              </div>
            ))}
            <button type="button" className="direct-sale-add-line" onClick={() => setDeliveryLines((lines) => [...lines, emptyDeliveryLine()])}>＋ Ajouter un produit</button>
          </div>
          <ModalActions saving={saving} onCancel={() => setDeliveryModal(false)} onSave={saveDelivery} label={editingDeliveryBatch ? "Enregistrer les modifications" : "Enregistrer la livraison"} />
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

      {lotDetailModal && lotById.get(selectedLotId) && (() => {
        const lot = lotById.get(selectedLotId)!;
        const lotOrders = orders.filter((order) => order.lot_id === lot.id);
        const lotDeliveries = deliveries.filter((delivery) => delivery.lot_id === lot.id);
        const delivered = lotDeliveries.reduce((total, delivery) => total + delivery.quantity_delivered, 0);
        const revenue = lotDeliveries.reduce((total, delivery) => total + delivery.amount_invoiced, 0);
        return (
          <DirectModal title={`Fiche du lot ${lot.name}`} subtitle={`${speciesLabel(lot.species)} · Arrivé le ${formatDate(lot.arrival_date)}`} icon={lot.species === "pintade" ? "◇" : "♧"} onClose={() => setLotDetailModal(false)}>
            <div className="direct-sale-detail-kpis">
              <span>Effectif initial<strong>{formatNombre(lot.initial_quantity)}</strong></span>
              <span>Restants<strong>{formatNombre(lot.remaining_quantity)}</strong></span>
              <span>Mortalités<strong>{formatNombre(lot.mortality_count)}</strong></span>
              <span>Livrés<strong>{formatNombre(delivered)}</strong></span>
            </div>
            <div className="direct-sale-detail-grid">
              <section>
                <h3>Informations</h3>
                <p><b>Emplacement :</b> {lot.location || "Non renseigné"}</p>
                <p><b>Statut :</b> {lotStatusLabel[lot.status]}</p>
                <p><b>Notes :</b> {lot.notes || "Aucune note"}</p>
              </section>
              <section>
                <h3>Activité commerciale</h3>
                <p><b>Commandes :</b> {formatNombre(lotOrders.length)}</p>
                <p><b>Livraisons :</b> {formatNombre(lotDeliveries.length)}</p>
                <p><b>Chiffre d’affaires :</b> {formatMontant(revenue)}</p>
              </section>
            </div>
            <div className="direct-sale-detail-actions">
              <button type="button" onClick={() => { setLotDetailModal(false); openLotForm(lot); }}>✎ Modifier</button>
              <button type="button" onClick={() => deleteLot(lot)}>⌫ Supprimer</button>
            </div>
          </DirectModal>
        );
      })()}

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
