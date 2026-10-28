import { createFileRoute, Link } from "@tanstack/react-router";
import { Truck, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSim } from "@/lib/sim/store";
import { advanceTracking, markDelayed } from "@/lib/sim/actions";
import { AutoPill, Empty, fmtDate, fmtDateTime, money, PageHeader, Panel, RecordLink, StatusBadge } from "@/components/app/kit";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/orders/$id")({
  head: () => seo("Order Detail", "Order line items, payment and tracking timeline."),
  component: OrderDetail,
});

function OrderDetail() {
  const { id } = Route.useParams();
  const { state, run } = useSim();
  const o = state.orders.find((x) => x.id === id);
  if (!o) return <Panel><Empty title="Order not found" action={<Button asChild size="sm"><Link to="/orders">Back</Link></Button>} /></Panel>;
  const c = state.customers.find((x) => x.id === o.customerId);
  const cases = state.cases.filter((x) => x.orderId === id);
  const done = o.shipping === "Delivered" || o.shipping === "Cancelled";
  return (
    <>
      <PageHeader crumbs={[{ label: "Orders", to: "/orders" }, { label: o.number }]} title={o.number} description={`Placed ${fmtDate(o.date)} · ETA ${fmtDate(o.eta)} · tracking ${o.tracking}`}
        actions={<><Button size="sm" variant="outline" disabled={done} onClick={() => run(markDelayed, id)}><AlertTriangle className="h-4 w-4" /> Mark delayed</Button><Button size="sm" disabled={done} onClick={() => run(advanceTracking, id)}><Truck className="h-4 w-4" /> Simulate next tracking update</Button></>} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Summary">
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Customer</dt><dd>{c && <RecordLink to="/customers/$id" params={{ id: c.id }}>{c.name}</RecordLink>}</dd>
            <dt className="text-muted-foreground">Payment</dt><dd><AutoPill v={o.payment} /></dd>
            <dt className="text-muted-foreground">Shipping</dt><dd><AutoPill v={o.shipping} /></dd>
            <dt className="text-muted-foreground">Total</dt><dd className="font-semibold">{money(o.total)}</dd>
          </dl>
          <div className="mt-4 border-t pt-3">
            {o.lines.map((l) => { const p = state.products.find((x) => x.id === l.productId); return <div key={l.productId} className="flex justify-between text-sm"><span>{p?.name} × {l.qty}</span><span>{money((p?.price ?? 0) * l.qty)}</span></div>; })}
          </div>
        </Panel>
        <Panel title="Tracking timeline" description="Simulated carrier events">
          <ol className="space-y-3 border-l pl-4">{[...o.events].reverse().map((e, i) => (
            <li key={i} className="relative"><span className={`absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full ${i === 0 ? "bg-primary" : "bg-border"}`} /><div className="text-sm font-medium">{e.status}</div><div className="text-xs text-muted-foreground">{e.note} · {fmtDateTime(e.at)}</div></li>))}
          </ol>
          {o.reminderSentAt && <p className="mt-3 text-xs text-muted-foreground">Three-day reminder issued {fmtDateTime(o.reminderSentAt)} (in-app only).</p>}
        </Panel>
        <Panel title="Related cases">
          {cases.length === 0 ? <Empty title="No cases for this order" /> : <ul className="space-y-2">{cases.map((x) => <li key={x.id} className="flex items-center justify-between gap-2 text-sm"><RecordLink to="/cases/$id" params={{ id: x.id }}>{x.number}</RecordLink><StatusBadge status={x.status} /></li>)}</ul>}
        </Panel>
      </div>
    </>
  );
}
