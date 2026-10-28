import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useSim } from "@/lib/sim/store";
import { assignCase, runAutomation, updateQueueMembers } from "@/lib/sim/actions";
import { isOpen, ROUTING } from "@/lib/sim/rules";
import { PRIORITIES } from "@/lib/sim/types";
import { Empty, PageHeader, Panel, Pill, PriorityBadge, RecordLink, Select, StatusBadge, TableWrap, Td, Th } from "@/components/app/kit";
import { SimpleDialog } from "@/components/app/forms";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/queues")({
  head: () => seo("Queues & Assignment", "Support queues, routing rules, members and agent workload."),
  component: Queues,
});

function Queues() {
  const { state, run } = useSim();
  const [sel, setSel] = useState(state.queues[0].id);
  const [members, setMembers] = useState<string[] | null>(null);
  const q = state.queues.find((x) => x.id === sel)!;
  const qCases = state.cases.filter((c) => c.queueId === sel && isOpen(c));
  const agents = state.users.filter((u) => u.role === "Support Agent" || u.role === "Warranty Specialist");
  const load = (id: string) => state.cases.filter((c) => c.agentId === id && isOpen(c));
  return (
    <>
      <PageHeader title="Queues & Assignment" description="Deterministic routing: category → queue, then least-loaded active member."
        actions={<Button onClick={() => run(runAutomation, "assign")}><Workflow className="h-4 w-4" /> Auto-assign unassigned</Button>} />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {state.queues.map((x) => { const open = state.cases.filter((c) => c.queueId === x.id && isOpen(c)); return (
          <button key={x.id} onClick={() => setSel(x.id)} className={`rounded-lg border bg-card p-4 text-left shadow-card hover:border-primary/40 ${sel === x.id ? "ring-2 ring-primary" : ""}`}>
            <div className="text-sm font-semibold">{x.name}</div><p className="mt-0.5 text-xs text-muted-foreground">{x.description}</p>
            <div className="mt-3 flex gap-4 text-xs"><span><b className="text-base">{open.length}</b> open</span><span><b className="text-base">{open.filter((c) => !c.agentId).length}</b> unassigned</span><span><b className="text-base">{x.members.length}</b> members</span></div>
          </button>); })}
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Panel className="xl:col-span-2" title={`${q.name} — open cases`} description={`Rule: ${q.rule}`} bodyClass="p-0">
          {qCases.length === 0 ? <Empty title="No open cases in this queue" /> : <TableWrap>
            <thead><tr><Th>Case</Th><Th>Priority</Th><Th>Status</Th><Th>Reassign</Th></tr></thead>
            <tbody>{qCases.map((c) => (
              <tr key={c.id}><Td><RecordLink to="/cases/$id" params={{ id: c.id }}>{c.number}</RecordLink><div className="max-w-[260px] truncate text-xs text-muted-foreground">{c.subject}</div></Td><Td><PriorityBadge p={c.priority} /></Td><Td><StatusBadge status={c.status} /></Td>
                <Td><Select className="h-8 w-48" ariaLabel="Assign agent" value={c.agentId ?? ""} onChange={(v) => run(assignCase, c.id, sel, v || undefined)} placeholder="Unassigned" options={state.users.filter((u) => q.members.includes(u.id) && u.active).map((u) => ({ value: u.id, label: u.name }))} /></Td></tr>))}
            </tbody></TableWrap>}
          <div className="border-t p-4"><div className="mb-2 text-xs font-semibold">Priority distribution</div><div className="flex flex-wrap gap-2">{PRIORITIES.map((p) => <span key={p} className="flex items-center gap-1 text-xs"><PriorityBadge p={p} /> {qCases.filter((c) => c.priority === p).length}</span>)}</div></div>
        </Panel>
        <div className="space-y-4">
          <Panel title="Queue members" actions={<Button size="sm" variant="outline" onClick={() => setMembers([...q.members])}>Manage</Button>}>
            {q.members.length === 0 ? <p className="text-xs text-muted-foreground">No members — cases will stay in the queue.</p> : <ul className="space-y-1.5">{q.members.map((m) => { const u = state.users.find((x) => x.id === m); return u && <li key={m} className="flex justify-between text-sm">{u.name}<span className="text-xs text-muted-foreground">{u.active ? u.role : "Inactive"}</span></li>; })}</ul>}
          </Panel>
          <Panel title="Routing rules">
            <ul className="space-y-1 text-xs">{Object.entries(ROUTING).map(([cat, qid]) => <li key={cat} className="flex justify-between"><span>{cat}</span><Pill>{state.queues.find((x) => x.id === qid)?.name}</Pill></li>)}</ul>
          </Panel>
        </div>
      </div>
      <Panel className="mt-4" title="Agent workload" bodyClass="p-0">
        <TableWrap><thead><tr><Th>Agent</Th><Th>Role</Th><Th>Queues</Th><Th>Open cases</Th><Th>Critical/High</Th></tr></thead>
          <tbody>{agents.map((u) => { const l = load(u.id); return <tr key={u.id}><Td className="font-medium">{u.name}{!u.active && <Pill t="red" className="ml-2">Inactive</Pill>}</Td><Td className="text-xs">{u.role}</Td><Td className="text-xs">{state.queues.filter((x) => x.members.includes(u.id)).map((x) => x.name).join(", ") || "—"}</Td><Td>{l.length}<div className="mt-1 h-1.5 w-24 rounded bg-muted"><div className="h-1.5 rounded bg-primary" style={{ width: `${Math.min(100, l.length * 20)}%` }} /></div></Td><Td>{l.filter((c) => c.priority === "Critical" || c.priority === "High").length}</Td></tr>; })}</tbody>
        </TableWrap>
      </Panel>
      {members && <SimpleDialog open onOpenChange={(o) => !o && setMembers(null)} title={`Members of ${q.name}`} onSubmit={() => { if (run(updateQueueMembers, sel, members).ok) setMembers(null); }}>
        {agents.map((u) => <label key={u.id} className="flex items-center gap-2 text-sm"><Checkbox checked={members.includes(u.id)} onCheckedChange={(v) => setMembers(v ? [...members, u.id] : members.filter((m) => m !== u.id))} />{u.name} <span className="text-xs text-muted-foreground">{u.role}</span></label>)}
      </SimpleDialog>}
    </>
  );
}
