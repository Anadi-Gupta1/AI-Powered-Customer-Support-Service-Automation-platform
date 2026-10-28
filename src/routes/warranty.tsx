import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, RefreshCw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSim } from "@/lib/sim/store";
import { createClaim, recheckClaim, submitClaim } from "@/lib/sim/actions";
import { now, warrantyEligibility } from "@/lib/sim/rules";
import { AutoPill, Empty, Field, fmtDate, PageHeader, Panel, Pill, RecordLink, Select, TableWrap, Td, Th } from "@/components/app/kit";
import { SimpleDialog } from "@/components/app/forms";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/warranty")({
  head: () => seo("Warranty Claims", "Warranty claims with automatic eligibility checks and approval routing."),
  component: Warranty,
});

function Warranty() {
  const { state, run } = useSim();
  const [filter, setFilter] = useState("");
  const [dlg, setDlg] = useState(false);
  const today = now(state).toISOString().slice(0, 10);
  const [f, setF] = useState({ customerId: "", orderId: "", productId: "", purchaseDate: "", claimDate: today, reason: "" });
  const orders = state.orders.filter((o) => o.customerId === f.customerId);
  const order = orders.find((o) => o.id === f.orderId);
  const preview = f.orderId && f.productId && f.purchaseDate && f.claimDate ? warrantyEligibility(state, f) : null;
  const list = useMemo(() => state.claims.filter((w) => !filter || w.warrantyStatus === filter || w.approvalStatus === filter), [state.claims, filter]);
  const name = (id: string) => state.customers.find((c) => c.id === id)?.name ?? "—";
  return (
    <>
      <PageHeader title="Warranty Claims" description={`Eligibility = claim date within purchase date + product warranty months. Claims up to ${state.settings.warrantyGraceDays} days past expiry need manual review (configurable in Settings).`}
        actions={<Button onClick={() => { setF({ customerId: "", orderId: "", productId: "", purchaseDate: "", claimDate: today, reason: "" }); setDlg(true); }}><Plus className="h-4 w-4" /> New claim</Button>} />
      <Panel bodyClass="p-0">
        <div className="border-b p-4"><Select className="w-52" ariaLabel="Filter" value={filter} onChange={setFilter} placeholder="All claims" options={["Eligible", "Ineligible", "Requires Review", "Pending Check", "Not Submitted", "Pending", "Approved", "Rejected"]} /></div>
        {list.length === 0 ? <Empty title="No claims" /> : <TableWrap>
          <thead><tr><Th>Claim</Th><Th>Customer</Th><Th>Product</Th><Th>Purchase / Claim</Th><Th>Eligibility</Th><Th>Approval</Th><Th /></tr></thead>
          <tbody>{list.map((w) => (
            <tr key={w.id}>
              <Td className="font-medium">{w.number}<div className="text-xs font-normal text-muted-foreground">{w.reason}</div></Td>
              <Td><RecordLink to="/customers/$id" params={{ id: w.customerId }}>{name(w.customerId)}</RecordLink></Td>
              <Td className="text-xs">{state.products.find((p) => p.id === w.productId)?.name}</Td>
              <Td className="text-xs">{fmtDate(w.purchaseDate)}<div className="text-muted-foreground">{fmtDate(w.claimDate)}</div></Td>
              <Td className="max-w-[260px]"><AutoPill v={w.warrantyStatus} />{w.eligibilityReason && <p className="mt-1 text-xs text-muted-foreground">{w.eligibilityReason}</p>}</Td>
              <Td><AutoPill v={w.approvalStatus} />{w.decisionNotes && <p className="mt-1 text-xs text-muted-foreground">{w.decisionNotes}</p>}</Td>
              <Td className="whitespace-nowrap text-right">
                <Button size="sm" variant="ghost" onClick={() => run(recheckClaim, w.id)}><RefreshCw className="h-3.5 w-3.5" /> Check</Button>
                {w.approvalStatus === "Not Submitted" && <Button size="sm" variant="outline" disabled={w.warrantyStatus === "Ineligible"} onClick={() => run(submitClaim, w.id)}><Send className="h-3.5 w-3.5" /> Submit</Button>}
                {w.approvalStatus === "Pending" && <Button size="sm" variant="outline" asChild><Link to="/approvals">Decide</Link></Button>}
              </Td>
            </tr>))}
          </tbody></TableWrap>}
      </Panel>
      <SimpleDialog open={dlg} onOpenChange={setDlg} title="New warranty claim" description="The Warranty Claim Flow checks eligibility automatically." submitLabel="Create claim"
        onSubmit={() => { if (run(createClaim, f).ok) setDlg(false); }}>
        <Field label="Customer" required><Select value={f.customerId} onChange={(v) => setF({ ...f, customerId: v, orderId: "", productId: "" })} placeholder="Select…" options={state.customers.map((c) => ({ value: c.id, label: c.name }))} /></Field>
        <Field label="Order" required><Select value={f.orderId} onChange={(v) => { const o = state.orders.find((x) => x.id === v); setF({ ...f, orderId: v, productId: o?.lines[0]?.productId ?? "", purchaseDate: o?.date.slice(0, 10) ?? "" }); }} placeholder="Select…" options={orders.map((o) => ({ value: o.id, label: o.number }))} /></Field>
        <Field label="Product" required><Select value={f.productId} onChange={(v) => setF({ ...f, productId: v })} placeholder="Select…" options={(order ? state.products.filter((p) => order.lines.some((l) => l.productId === p.id)) : []).map((p) => ({ value: p.id, label: `${p.name} (${p.warrantyMonths} mo)` }))} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Purchase date" required><Input type="date" value={f.purchaseDate} onChange={(e) => setF({ ...f, purchaseDate: e.target.value })} /></Field>
          <Field label="Claim date" required><Input type="date" value={f.claimDate} onChange={(e) => setF({ ...f, claimDate: e.target.value })} /></Field>
        </div>
        <Field label="Reason" required><Input value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="Describe the fault" /></Field>
        {preview && <div className="rounded-md border p-3 text-xs"><Pill t={preview.status === "Eligible" ? "green" : preview.status === "Ineligible" ? "red" : "amber"}>{preview.status}</Pill><p className="mt-1 text-muted-foreground">{preview.reason}</p></div>}
      </SimpleDialog>
    </>
  );
}
