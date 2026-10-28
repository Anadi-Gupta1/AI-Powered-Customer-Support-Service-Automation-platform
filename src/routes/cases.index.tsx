import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus, Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSim } from "@/lib/sim/store";
import { caseSla, toCsv } from "@/lib/sim/rules";
import { CASE_STATUSES, CATEGORIES, PRIORITIES } from "@/lib/sim/types";
import { download, Empty, fmtDateTime, PageHeader, Panel, PriorityBadge, RecordLink, Select, SlaBadge, StatusBadge, TableWrap, Td, Th, usePaged, useSort } from "@/components/app/kit";
import { CaseFormDialog } from "@/components/app/forms";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/cases/")({
  head: () => seo("Cases", "Search, filter and manage customer support cases."),
  component: CasesPage,
});

const PRESETS = [
  { label: "All", f: {} },
  { label: "My open", f: { mine: "1" } },
  { label: "Escalated", f: { status: "Escalated" } },
  { label: "Unassigned", f: { agent: "none" } },
  { label: "Critical", f: { priority: "Critical" } },
] as const;

function CasesPage() {
  const { state } = useSim();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [f, setF] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  const cust = (id: string) => state.customers.find((c) => c.id === id)?.name ?? "—";
  const agentName = (id?: string) => state.users.find((u) => u.id === id)?.name ?? "Unassigned";

  const filtered = useMemo(() => state.cases.filter((c) => {
    const t = q.toLowerCase();
    if (t && !`${c.number} ${c.subject} ${cust(c.customerId)}`.toLowerCase().includes(t)) return false;
    if (f.status && c.status !== f.status) return false;
    if (f.priority && c.priority !== f.priority) return false;
    if (f.category && c.category !== f.category) return false;
    if (f.queue && c.queueId !== f.queue) return false;
    if (f.agent === "none" && c.agentId) return false;
    if (f.agent && f.agent !== "none" && c.agentId !== f.agent) return false;
    if (f.mine && (c.agentId !== state.currentUserId || c.status === "Resolved" || c.status === "Closed")) return false;
    if (f.from && c.createdAt.slice(0, 10) < f.from) return false;
    if (f.to && c.createdAt.slice(0, 10) > f.to) return false;
    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [state, q, f]);
  const prioRank = { Critical: 0, High: 1, Medium: 2, Low: 3 };
  const { sorted, th } = useSort(filtered, { key: "updated", dir: "desc" }, {
    number: (c) => parseInt(c.number.slice(3)), customer: (c) => cust(c.customerId), priority: (c) => -prioRank[c.priority], status: (c) => c.status,
    category: (c) => c.category, agent: (c) => agentName(c.agentId), sla: (c) => caseSla(state, c).msRemaining, updated: (c) => c.updatedAt,
  });
  const { slice, pager, setPage } = usePaged(sorted, 12);
  const active = Object.values(f).filter(Boolean).length + (q ? 1 : 0);

  const exportCsv = () => download("cases.csv", toCsv(sorted.map((c) => ({ number: c.number, subject: c.subject, customer: cust(c.customerId), category: c.category, priority: c.priority, status: c.status, queue: state.queues.find((x) => x.id === c.queueId)?.name ?? "", agent: agentName(c.agentId), sla: caseSla(state, c).state, created: c.createdAt, resolved: c.resolvedAt ?? "", rating: c.rating ?? "" }))));

  return (
    <>
      <PageHeader title="Cases" description={`${state.cases.length} cases in the simulated service desk.`}
        actions={<><Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4" /> Export CSV</Button><Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New case</Button></>} />
      <Panel bodyClass="p-0">
        <div className="space-y-3 border-b p-4">
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <Button key={p.label} size="sm" variant={JSON.stringify(f) === JSON.stringify(p.f) ? "default" : "outline"} className="h-7 text-xs" onClick={() => { setF({ ...p.f }); setPage(1); }}>{p.label}</Button>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
            <Input className="xl:col-span-2" placeholder="Search number, subject, customer…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} aria-label="Search cases" />
            <Select ariaLabel="Status" value={f.status ?? ""} onChange={(v) => set("status", v)} placeholder="All statuses" options={CASE_STATUSES} />
            <Select ariaLabel="Priority" value={f.priority ?? ""} onChange={(v) => set("priority", v)} placeholder="All priorities" options={PRIORITIES} />
            <Select ariaLabel="Category" value={f.category ?? ""} onChange={(v) => set("category", v)} placeholder="All categories" options={CATEGORIES} />
            <Select ariaLabel="Queue" value={f.queue ?? ""} onChange={(v) => set("queue", v)} placeholder="All queues" options={state.queues.map((x) => ({ value: x.id, label: x.name }))} />
            <Select ariaLabel="Agent" value={f.agent ?? ""} onChange={(v) => set("agent", v)} placeholder="All agents" options={[{ value: "none", label: "Unassigned" }, ...state.users.filter((u) => u.role === "Support Agent" || u.role === "Warranty Specialist").map((u) => ({ value: u.id, label: u.name }))]} />
            <div className="flex gap-1"><Input type="date" aria-label="Created from" value={f.from ?? ""} onChange={(e) => set("from", e.target.value)} /><Input type="date" aria-label="Created to" value={f.to ?? ""} onChange={(e) => set("to", e.target.value)} /></div>
          </div>
          {active > 0 && <div className="flex items-center gap-2 text-xs text-muted-foreground">{sorted.length} result(s)<button className="inline-flex items-center gap-1 text-primary hover:underline" onClick={() => { setF({}); setQ(""); }}><X className="h-3 w-3" /> Clear filters</button></div>}
        </div>
        {sorted.length === 0 ? <Empty title="No cases match these filters" hint="Adjust or clear the filters, or create a new case." action={<Button size="sm" onClick={() => setOpen(true)}>New case</Button>} /> : (
          <TableWrap>
            <thead><tr>
              <Th {...th("number")}>Case</Th><Th {...th("customer")}>Customer</Th><Th {...th("priority")}>Priority</Th><Th {...th("status")}>Status</Th>
              <Th {...th("category")} className="hidden md:table-cell">Category</Th><Th {...th("agent")} className="hidden lg:table-cell">Assigned</Th><Th {...th("sla")}>SLA</Th><Th {...th("updated")} className="hidden md:table-cell">Updated</Th>
            </tr></thead>
            <tbody>
              {slice.map((c) => { const sla = caseSla(state, c); return (
                <tr key={c.id} className="cursor-pointer" onClick={(e) => { if ((e.target as HTMLElement).closest("a")) return; navigate({ to: "/cases/$id", params: { id: c.id } }); }}>
                  <Td><RecordLink to="/cases/$id" params={{ id: c.id }}>{c.number}</RecordLink><div className="max-w-[280px] truncate text-xs text-muted-foreground">{c.subject}</div></Td>
                  <Td>{cust(c.customerId)}</Td><Td><PriorityBadge p={c.priority} /></Td><Td><StatusBadge status={c.status} /></Td>
                  <Td className="hidden text-xs md:table-cell">{c.category}</Td>
                  <Td className="hidden text-xs lg:table-cell">{agentName(c.agentId)}<div className="text-muted-foreground">{state.queues.find((x) => x.id === c.queueId)?.name ?? "No queue"}</div></Td>
                  <Td><SlaBadge state={sla.state} ms={sla.msRemaining} /></Td><Td className="hidden text-xs text-muted-foreground md:table-cell">{fmtDateTime(c.updatedAt)}</Td>
                </tr>); })}
            </tbody>
          </TableWrap>
        )}
        {pager}
      </Panel>
      <CaseFormDialog open={open} onOpenChange={setOpen} onSaved={(id) => navigate({ to: "/cases/$id", params: { id } })} />
    </>
  );
}
