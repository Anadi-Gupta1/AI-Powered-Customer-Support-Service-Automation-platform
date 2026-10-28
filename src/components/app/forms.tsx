import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSim } from "@/lib/sim/store";
import { createCase, saveCustomer, updateCase, validateCase, validateCustomer, type CaseInput, type CustomerInput } from "@/lib/sim/actions";
import { CATEGORIES, ORIGINS, PRIORITIES, type Customer, type SupportCase } from "@/lib/sim/types";
import { Field, Select } from "./kit";

export function CaseFormDialog({ open, onOpenChange, existing, defaultCustomerId, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; existing?: SupportCase; defaultCustomerId?: string; onSaved?: (id: string) => void }) {
  const { state, run } = useSim();
  const blank: CaseInput = { subject: "", description: "", customerId: defaultCustomerId ?? "", origin: "Web", category: "General", priority: "Medium", orderId: "", productId: "" };
  const [f, setF] = useState<CaseInput>(blank);
  const [errs, setErrs] = useState<Record<string, string>>({});
  useEffect(() => {
    if (open) { setF(existing ? { subject: existing.subject, description: existing.description, customerId: existing.customerId, origin: existing.origin, category: existing.category, priority: existing.priority, orderId: existing.orderId ?? "", productId: existing.productId ?? "" } : blank); setErrs({}); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existing?.id]);
  const set = <K extends keyof CaseInput>(k: K, v: CaseInput[K]) => setF((p) => ({ ...p, [k]: v }));
  const orders = state.orders.filter((o) => o.customerId === f.customerId);
  const order = orders.find((o) => o.id === f.orderId);
  const products = order ? state.products.filter((p) => order.lines.some((l) => l.productId === p.id)) : state.products;

  const submit = () => {
    const e = validateCase(state, f);
    setErrs(e);
    if (Object.keys(e).length) return;
    const r = existing ? run(updateCase, existing.id, f) : run(createCase, f);
    if (r.ok) { onOpenChange(false); onSaved?.(existing?.id ?? (r.data as SupportCase).id); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{existing ? `Edit ${existing.number}` : "Create case"}</DialogTitle>
          <DialogDescription>{existing ? "Changes to priority or category re-run the relevant automations." : "New cases are routed automatically by the Case Assignment Flow."}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field label="Subject" required error={errs.subject}><Input value={f.subject} onChange={(e) => set("subject", e.target.value)} placeholder="e.g. Headphones won't pair over Bluetooth" /></Field></div>
          <div className="sm:col-span-2"><Field label="Description" required error={errs.description}><Textarea rows={4} value={f.description} onChange={(e) => set("description", e.target.value)} placeholder="What did the customer report?" /></Field></div>
          <Field label="Customer" required error={errs.customerId}>
            <Select value={f.customerId} onChange={(v) => setF((p) => ({ ...p, customerId: v, orderId: "", productId: "" }))} placeholder="Select customer…" options={state.customers.map((c) => ({ value: c.id, label: `${c.name} · ${c.email}` }))} />
          </Field>
          <Field label="Related order" error={errs.orderId} hint={f.customerId && !orders.length ? "This customer has no orders." : undefined}>
            <Select value={f.orderId ?? ""} onChange={(v) => setF((p) => ({ ...p, orderId: v, productId: "" }))} placeholder="None" options={orders.map((o) => ({ value: o.id, label: `${o.number} · ${o.shipping}` }))} />
          </Field>
          <Field label="Product" error={errs.productId}>
            <Select value={f.productId ?? ""} onChange={(v) => set("productId", v)} placeholder="None" options={products.map((p) => ({ value: p.id, label: p.name }))} />
          </Field>
          <Field label="Category" required><Select value={f.category} onChange={(v) => set("category", v as CaseInput["category"])} options={CATEGORIES} /></Field>
          <Field label="Priority" required><Select value={f.priority} onChange={(v) => set("priority", v as CaseInput["priority"])} options={PRIORITIES} /></Field>
          <Field label="Origin" required><Select value={f.origin} onChange={(v) => set("origin", v as CaseInput["origin"])} options={ORIGINS} /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit}>{existing ? "Save changes" : "Create case"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CustomerFormDialog({ open, onOpenChange, existing, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; existing?: Customer; onSaved?: (id: string) => void }) {
  const { state, run } = useSim();
  const blank: CustomerInput = { name: "", email: "", phone: "", country: "", type: "Individual", since: new Date().toISOString().slice(0, 10), status: "Active" };
  const [f, setF] = useState<CustomerInput>(blank);
  const [errs, setErrs] = useState<Record<string, string>>({});
  useEffect(() => {
    if (open) { setF(existing ? { name: existing.name, email: existing.email, phone: existing.phone, country: existing.country, type: existing.type, since: existing.since, status: existing.status } : blank); setErrs({}); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existing?.id]);
  const set = <K extends keyof CustomerInput>(k: K, v: CustomerInput[K]) => setF((p) => ({ ...p, [k]: v }));
  const submit = () => {
    const e = validateCustomer(state, f, existing?.id);
    setErrs(e);
    if (Object.keys(e).length) return;
    const r = run(saveCustomer, f, existing?.id);
    if (r.ok) { onOpenChange(false); onSaved?.((r.data as Customer).id); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{existing ? "Edit customer" : "Add customer"}</DialogTitle><DialogDescription>Fictional demo data only.</DialogDescription></DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field label="Full name" required error={errs.name}><Input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Jane Doe" /></Field></div>
          <Field label="Email" required error={errs.email}><Input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="jane@example.com" /></Field>
          <Field label="Phone" required error={errs.phone}><Input value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+1 555 0100" /></Field>
          <Field label="Country" required error={errs.country}><Input value={f.country} onChange={(e) => set("country", e.target.value)} /></Field>
          <Field label="Customer since"><Input type="date" value={f.since} onChange={(e) => set("since", e.target.value)} /></Field>
          <Field label="Type"><Select value={f.type} onChange={(v) => set("type", v as CustomerInput["type"])} options={["Individual", "Business", "VIP"]} /></Field>
          <Field label="Status"><Select value={f.status} onChange={(v) => set("status", v as CustomerInput["status"])} options={["Active", "Inactive"]} /></Field>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={submit}>Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SimpleDialog({ open, onOpenChange, title, description, children, onSubmit, submitLabel = "Save" }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: string; children: ReactNode; onSubmit: () => void; submitLabel?: string }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>{title}</DialogTitle>{description && <DialogDescription>{description}</DialogDescription>}</DialogHeader>
        <div className="space-y-4">{children}</div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={onSubmit}>{submitLabel}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
