import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSim } from "@/lib/sim/store";
import { avgResolutionHours, csat, isOpen } from "@/lib/sim/rules";
import { customerRelations, deleteCustomer } from "@/lib/sim/actions";
import { AutoPill, Confirm, Empty, fmtDate, Kpi, money, PageHeader, Panel, PriorityBadge, RecordLink, StatusBadge, TableWrap, Td, Th } from "@/components/app/kit";
import { CaseFormDialog, CustomerFormDialog } from "@/components/app/forms";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/customers/$id")({
  head: () => seo("Customer Profile", "Customer profile, support history, orders and satisfaction."),
  component: CustomerDetail,
});

function CustomerDetail() {
  const { id } = Route.useParams();
  const { state, run } = useSim();
  const navigate = useNavigate();
  const [edit, setEdit] = useState(false);
  const [newCase, setNewCase] = useState(false);
  const c = state.customers.find((x) => x.id === id);
  if (!c) return <Panel><Empty title="Customer not found" action={<Button asChild size="sm"><Link to="/customers">Back</Link></Button>} /></Panel>;
  const cases = state.cases.filter((x) => x.customerId === id);
  const orders = state.orders.filter((x) => x.customerId === id);
  const claims = state.claims.filter((x) => x.customerId === id);
  const rel = customerRelations(state, id);
  const hasRel = rel.cases + rel.orders + rel.claims > 0;
  const sat = csat(cases), avg = avgResolutionHours(cases);
  return (
    <>
      <PageHeader crumbs={[{ label: "Customers", to: "/customers" }, { label: c.name }]} title={c.name} description={`${c.email} · ${c.phone} · ${c.country} · ${c.type} · customer since ${fmtDate(c.since)}`}
        actions={<>
          <Button size="sm" onClick={() => setNewCase(true)}><Plus className="h-4 w-4" /> New case</Button>
          <Button size="sm" variant="outline" onClick={() => setEdit(true)}><Pencil className="h-4 w-4" /> Edit</Button>
          <Confirm destructive trigger={<Button size="sm" variant="ghost" aria-label="Delete customer"><Trash2 className="h-4 w-4" /></Button>} title={`Delete ${c.name}?`}
            description={hasRel ? `Warning: this customer has ${rel.cases} case(s), ${rel.orders} order(s) and ${rel.claims} claim(s). Deletion will be blocked to protect related records — set the customer to Inactive instead.` : "This customer has no related records and will be permanently deleted."}
            confirmLabel="Delete" onConfirm={() => { if (run(deleteCustomer, id).ok) navigate({ to: "/customers" }); }} />
        </>} />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Total cases" value={cases.length} /><Kpi label="Open cases" value={cases.filter(isOpen).length} t="sky" />
        <Kpi label="Avg resolution" value={avg == null ? "—" : `${avg.toFixed(1)}h`} /><Kpi label="Satisfaction" value={sat == null ? "—" : `${sat.toFixed(1)} / 5`} t="green" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel className="lg:col-span-2" title="Support history" bodyClass="p-0">
          {cases.length === 0 ? <Empty title="No cases" /> : <TableWrap><thead><tr><Th>Case</Th><Th>Priority</Th><Th>Status</Th><Th>Created</Th><Th>Rating</Th></tr></thead><tbody>
            {cases.map((x) => <tr key={x.id}><Td><RecordLink to="/cases/$id" params={{ id: x.id }}>{x.number}</RecordLink><div className="text-xs text-muted-foreground">{x.subject}</div></Td><Td><PriorityBadge p={x.priority} /></Td><Td><StatusBadge status={x.status} /></Td><Td className="text-xs">{fmtDate(x.createdAt)}</Td><Td>{x.rating ? `${x.rating}/5` : "—"}</Td></tr>)}
          </tbody></TableWrap>}
        </Panel>
        <Panel title="Orders" bodyClass="p-0">
          {orders.length === 0 ? <Empty title="No orders" /> : <TableWrap><thead><tr><Th>Order</Th><Th>Total</Th><Th>Shipping</Th></tr></thead><tbody>
            {orders.map((o) => <tr key={o.id}><Td><RecordLink to="/orders/$id" params={{ id: o.id }}>{o.number}</RecordLink><div className="text-xs text-muted-foreground">{fmtDate(o.date)}</div></Td><Td>{money(o.total)}</Td><Td><AutoPill v={o.shipping} /></Td></tr>)}
          </tbody></TableWrap>}
        </Panel>
        <Panel title="Warranty claims" bodyClass="p-0">
          {claims.length === 0 ? <Empty title="No claims" /> : <TableWrap><thead><tr><Th>Claim</Th><Th>Eligibility</Th><Th>Approval</Th></tr></thead><tbody>
            {claims.map((w) => <tr key={w.id}><Td><Link to="/warranty" className="font-medium text-primary hover:underline">{w.number}</Link><div className="text-xs text-muted-foreground">{w.reason}</div></Td><Td><AutoPill v={w.warrantyStatus} /></Td><Td><AutoPill v={w.approvalStatus} /></Td></tr>)}
          </tbody></TableWrap>}
        </Panel>
      </div>
      <CustomerFormDialog open={edit} onOpenChange={setEdit} existing={c} />
      <CaseFormDialog open={newCase} onOpenChange={setNewCase} defaultCustomerId={id} onSaved={(cid) => navigate({ to: "/cases/$id", params: { id: cid } })} />
    </>
  );
}
