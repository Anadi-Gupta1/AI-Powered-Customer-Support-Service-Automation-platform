import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSim } from "@/lib/sim/store";
import { createOrder } from "@/lib/sim/actions";
import type { Order } from "@/lib/sim/types";
import { AutoPill, Empty, Field, fmtDate, money, PageHeader, Panel, RecordLink, Select, TableWrap, Td, Th, usePaged, useSort } from "@/components/app/kit";
import { SimpleDialog } from "@/components/app/forms";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/orders/")({
  head: () => seo("Orders", "Orders with payment, shipping status and simulated tracking."),
  component: Orders,
});

function Orders() {
  const { state, run } = useSim();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [ship, setShip] = useState("");
  const [pay, setPay] = useState("");
  const [dlg, setDlg] = useState(false);
  const [cust, setCust] = useState("");
  const [prod, setProd] = useState("");
  const [qty, setQty] = useState(1);
  const name = (id: string) => state.customers.find((c) => c.id === id)?.name ?? "—";
  const list = useMemo(() => state.orders.filter((o) => `${o.number} ${o.tracking} ${name(o.customerId)}`.toLowerCase().includes(q.toLowerCase()) && (!ship || o.shipping === ship) && (!pay || o.payment === pay)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, q, ship, pay]);
  const { sorted, th } = useSort(list, { key: "date", dir: "desc" }, { number: (o) => o.number, date: (o) => o.date, total: (o) => o.total, customer: (o) => name(o.customerId) });
  const { slice, pager } = usePaged(sorted, 12);
  return (
    <>
      <PageHeader title="Orders" description="Shipping events are simulated — no carrier is contacted." actions={<Button onClick={() => setDlg(true)}><Plus className="h-4 w-4" /> New order</Button>} />
      <Panel bodyClass="p-0">
        <div className="flex flex-wrap gap-2 border-b p-4">
          <Input className="max-w-xs" placeholder="Search order, tracking, customer…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search orders" />
          <Select className="w-40" ariaLabel="Shipping" value={ship} onChange={setShip} placeholder="All shipping" options={["Confirmed", "Processing", "Shipped", "In Transit", "Delayed", "Delivered", "Cancelled"]} />
          <Select className="w-40" ariaLabel="Payment" value={pay} onChange={setPay} placeholder="All payment" options={["Paid", "Pending", "Refund Pending", "Refunded"]} />
        </div>
        {sorted.length === 0 ? <Empty title="No orders found" /> : <TableWrap>
          <thead><tr><Th {...th("number")}>Order</Th><Th {...th("customer")}>Customer</Th><Th {...th("date")}>Date</Th><Th {...th("total")}>Total</Th><Th>Payment</Th><Th>Shipping</Th><Th>Tracking</Th></tr></thead>
          <tbody>{slice.map((o) => <tr key={o.id}><Td><RecordLink to="/orders/$id" params={{ id: o.id }}>{o.number}</RecordLink></Td><Td>{name(o.customerId)}</Td><Td className="text-xs">{fmtDate(o.date)}</Td><Td>{money(o.total)}</Td><Td><AutoPill v={o.payment} /></Td><Td><AutoPill v={o.shipping} /></Td><Td className="font-mono text-xs">{o.tracking}</Td></tr>)}</tbody>
        </TableWrap>}
        {pager}
      </Panel>
      <SimpleDialog open={dlg} onOpenChange={setDlg} title="Create order" description="Creates a simulated order (no payment is processed)." submitLabel="Create order"
        onSubmit={() => { const r = run(createOrder, cust, [{ productId: prod, qty }]); if (r.ok) { setDlg(false); navigate({ to: "/orders/$id", params: { id: (r.data as Order).id } }); } }}>
        <Field label="Customer" required><Select value={cust} onChange={setCust} placeholder="Select…" options={state.customers.map((c) => ({ value: c.id, label: c.name }))} /></Field>
        <Field label="Product" required><Select value={prod} onChange={setProd} placeholder="Select…" options={state.products.filter((p) => p.status === "Active").map((p) => ({ value: p.id, label: `${p.name} · ${money(p.price)}` }))} /></Field>
        <Field label="Quantity" required><Input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} /></Field>
      </SimpleDialog>
    </>
  );
}
