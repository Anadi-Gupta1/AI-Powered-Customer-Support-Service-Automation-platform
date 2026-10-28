import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, CheckCircle2, Copy, Pencil, RotateCcw, Sparkles, Trash2, Workflow, Lock, Send, BookOpen, Star, Receipt } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSim } from "@/lib/sim/store";
import { caseSla, fmtDuration, isOpen } from "@/lib/sim/rules";
import { caseKnowledge, nextAction } from "@/lib/sim/ai";
import { addNote, applyAI, assignCase, caseResolutionHours, deleteCase, escalate, generateAI, rateCase, requestApproval, runCaseAssignment, setStatus } from "@/lib/sim/actions";
import { CASE_STATUSES, type ApprovalType, type CaseStatus } from "@/lib/sim/types";
import { AutoPill, Confirm, Empty, Field, fmtDate, fmtDateTime, money, PageHeader, Panel, Pill, PriorityBadge, RecordLink, Select, SlaBadge, StatusBadge } from "@/components/app/kit";
import { CaseFormDialog, SimpleDialog } from "@/components/app/forms";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/cases/$id")({
  head: () => seo("Case Detail", "Case record with customer context, AI copilot, assignment, approvals and history."),
  component: CaseDetail,
});

function CaseDetail() {
  const { id } = Route.useParams();
  const { state, run } = useSim();
  const navigate = useNavigate();
  const c = state.cases.find((x) => x.id === id);
  const [edit, setEdit] = useState(false);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [escOpen, setEscOpen] = useState(false);
  const [apOpen, setApOpen] = useState(false);
  const [resNotes, setResNotes] = useState("");
  const [escReason, setEscReason] = useState("");
  const [apType, setApType] = useState<ApprovalType>("Refund");
  const [apReason, setApReason] = useState("");
  const [noteText, setNoteText] = useState("");
  const [draft, setDraft] = useState<{ kind: "summary" | "response"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  if (!c) return <Panel><Empty title="Case not found" hint="It may have been deleted or the demo was reset." action={<Button asChild size="sm"><Link to="/cases">Back to cases</Link></Button>} /></Panel>;
  const customer = state.customers.find((x) => x.id === c.customerId);
  const order = state.orders.find((x) => x.id === c.orderId);
  const product = state.products.find((x) => x.id === c.productId);
  const queue = state.queues.find((q) => q.id === c.queueId);
  const sla = caseSla(state, c);
  const na = nextAction(state, c);
  const kb = caseKnowledge(state, c);
  const approvals = state.approvals.filter((a) => a.caseId === c.id);
  const logs = state.logs.filter((l) => l.recordId === c.id);
  const audits = state.audit.filter((a) => a.recordId === c.id);
  const resH = caseResolutionHours(c);
  const open = isOpen(c);
  const userName = (uid?: string) => state.users.find((u) => u.id === uid)?.name ?? "System";

  const gen = (kind: "summary" | "response") => {
    setBusy(true);
    setTimeout(() => { const r = run(generateAI, c.id, kind); if (r.ok) setDraft({ kind, text: r.data as string }); setBusy(false); }, 450);
  };
  const changeStatus = (s: CaseStatus) => {
    if (s === "Resolved") { setResNotes(c.resolutionNotes ?? ""); setResolveOpen(true); return; }
    if (s === "Escalated") { setEscOpen(true); return; }
    run(setStatus, c.id, s);
  };

  return (
    <>
      <PageHeader crumbs={[{ label: "Cases", to: "/cases" }, { label: c.number }]} title={`${c.number} · ${c.subject}`}
        description={`${c.category} · ${c.origin} · opened ${fmtDateTime(c.createdAt)}`}
        actions={<>
          <Button variant="outline" size="sm" onClick={() => setEdit(true)}><Pencil className="h-4 w-4" /> Edit</Button>
          {open ? <>
            <Button variant="outline" size="sm" onClick={() => setEscOpen(true)} disabled={c.status === "Escalated"}><AlertTriangle className="h-4 w-4" /> Escalate</Button>
            <Button size="sm" onClick={() => { setResNotes(c.resolutionNotes ?? ""); setResolveOpen(true); }}><CheckCircle2 className="h-4 w-4" /> Resolve</Button>
          </> : <>
            {c.status === "Resolved" && <Confirm trigger={<Button variant="outline" size="sm"><Lock className="h-4 w-4" /> Close</Button>} title="Close this case?" description="Closed cases are final until reopened." onConfirm={() => run(setStatus, c.id, "Closed")} />}
            <Confirm trigger={<Button variant="outline" size="sm"><RotateCcw className="h-4 w-4" /> Reopen</Button>} title="Reopen case?" description="The resolution timestamp, follow-up and rating will be cleared." onConfirm={() => run(setStatus, c.id, "Working")} />
          </>}
          <Confirm destructive trigger={<Button variant="ghost" size="sm" aria-label="Delete case"><Trash2 className="h-4 w-4" /></Button>} title={`Delete ${c.number}?`} description="This permanently removes the case and any pending approval tied to it. Administrators only." confirmLabel="Delete"
            onConfirm={() => { if (run(deleteCase, c.id).ok) navigate({ to: "/cases" }); }} />
        </>} />

      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border bg-card px-4 py-3 shadow-card">
        <StatusBadge status={c.status} /><PriorityBadge p={c.priority} /><SlaBadge state={sla.state} ms={sla.msRemaining} />
        {c.urgent && <Pill t="red">Urgent flag</Pill>}{c.escalated && <Pill t="red">Escalated</Pill>}
        <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          Status
          <Select ariaLabel="Change status" className="h-8 w-48" value={c.status} onChange={(v) => changeStatus(v as CaseStatus)} options={CASE_STATUSES} />
        </span>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Panel title="Customer-reported issue" description="Provided by the customer">
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{c.description}</p>
          </Panel>

          <Panel className="border-ai/30" title={<span className="flex items-center gap-1.5"><Sparkles className="h-4 w-4 text-ai" /> AI Copilot <Pill t="violet">Simulated</Pill></span>}
            description="Deterministic mock AI using this case's stored data. Outputs are drafts until an agent applies them."
            actions={<><Button size="sm" variant="outline" disabled={busy} onClick={() => gen("summary")}>Generate summary</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => gen("response")}>Generate response</Button></>}>
            <div className="mb-3 rounded-md border border-ai/20 bg-ai/5 p-3 text-sm">
              <div className="text-xs font-semibold text-ai">Recommended next action</div>
              <div className="mt-0.5 font-medium">{na.action}</div><div className="text-xs text-muted-foreground">{na.reason}</div>
            </div>
            {busy && <p className="animate-pulse text-xs text-muted-foreground">Generating draft with local mock provider…</p>}
            {draft && (
              <div className="space-y-2">
                <div className="flex items-center justify-between"><span className="text-xs font-semibold">AI {draft.kind} draft — editable</span><Pill t="amber">Requires human review</Pill></div>
                <Textarea rows={8} value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} className="font-mono text-xs" />
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => { if (run(applyAI, c.id, draft.kind, draft.text).ok) setDraft(null); }}><Send className="h-4 w-4" /> Apply to case</Button>
                  <Button size="sm" variant="outline" onClick={() => { navigator.clipboard?.writeText(draft.text); toast.success("Copied to clipboard"); }}><Copy className="h-4 w-4" /> Copy</Button>
                  <Button size="sm" variant="outline" onClick={() => gen(draft.kind)}>Regenerate</Button>
                  <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>Discard</Button>
                </div>
              </div>
            )}
            {!draft && (c.aiSummary || c.aiResponse) && (
              <div className="grid gap-3 md:grid-cols-2">
                {c.aiSummary && <div><div className="mb-1 text-xs font-semibold">Applied AI summary</div><pre className="whitespace-pre-wrap rounded-md bg-muted p-3 font-sans text-xs">{c.aiSummary}</pre></div>}
                {c.aiResponse && <div><div className="mb-1 text-xs font-semibold">AI response (logged, not sent)</div><pre className="whitespace-pre-wrap rounded-md bg-muted p-3 font-sans text-xs">{c.aiResponse}</pre></div>}
              </div>
            )}
          </Panel>

          <Panel title="Activity" bodyClass="p-0">
            <Tabs defaultValue="timeline">
              <TabsList className="m-3"><TabsTrigger value="timeline">Timeline ({c.notes.length})</TabsTrigger><TabsTrigger value="automation">Automation logs ({logs.length})</TabsTrigger><TabsTrigger value="audit">Audit ({audits.length})</TabsTrigger></TabsList>
              <TabsContent value="timeline" className="px-4 pb-4">
                <div className="mb-3 flex gap-2"><Textarea rows={2} placeholder="Add an internal note…" value={noteText} onChange={(e) => setNoteText(e.target.value)} /><Button className="self-end" onClick={() => { if (run(addNote, c.id, noteText).ok) setNoteText(""); }}>Add</Button></div>
                {c.notes.length === 0 ? <Empty title="No activity yet" /> : (
                  <ol className="space-y-3 border-l pl-4">{[...c.notes].reverse().map((n) => (
                    <li key={n.id} className="relative text-sm"><span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-primary" />
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><Pill t={n.kind === "system" ? "neutral" : n.kind === "resolution" ? "green" : n.kind === "reply" ? "violet" : "blue"}>{n.kind}</Pill>{userName(n.by)} · {fmtDateTime(n.at)}</div>
                      <p className="mt-1 whitespace-pre-wrap">{n.text}</p></li>))}
                  </ol>)}
              </TabsContent>
              <TabsContent value="automation" className="px-4 pb-4">
                {logs.length === 0 ? <Empty title="No automation runs for this case" /> : <ul className="space-y-2">{logs.map((l) => <li key={l.id} className="rounded-md border p-2 text-xs"><div className="flex justify-between gap-2"><span className="font-medium">{l.automation} · {l.trigger}</span><AutoPill v={l.status} /></div><p className="mt-1 text-muted-foreground">{l.details}</p><p className="text-[10px] text-muted-foreground">{fmtDateTime(l.at)}</p></li>)}</ul>}
              </TabsContent>
              <TabsContent value="audit" className="px-4 pb-4">
                {audits.length === 0 ? <Empty title="No audit entries" /> : <ul className="space-y-1.5">{audits.map((a) => <li key={a.id} className="flex flex-wrap items-center gap-2 text-xs"><span className="text-muted-foreground">{fmtDateTime(a.at)}</span><span className="font-medium">{a.action}</span><AutoPill v={a.outcome} /><span className="text-muted-foreground">{userName(a.userId)} — {a.details}</span></li>)}</ul>}
              </TabsContent>
            </Tabs>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Assignment" actions={<Button size="sm" variant="outline" onClick={() => run(runCaseAssignment, c.id)}><Workflow className="h-4 w-4" /> Auto-assign</Button>}>
            <AssignBox caseId={c.id} queueId={c.queueId} agentId={c.agentId} onSave={(q, a) => run(assignCase, c.id, q, a)} />
            <p className="mt-2 text-xs text-muted-foreground">Current: {queue?.name ?? "No queue"} / {userName(c.agentId) === "System" ? "Unassigned" : userName(c.agentId)}</p>
          </Panel>

          <Panel title="Customer & order context" description="Existing system data">
            {customer ? <div className="text-sm"><RecordLink to="/customers/$id" params={{ id: customer.id }}>{customer.name}</RecordLink><div className="text-xs text-muted-foreground">{customer.email} · {customer.phone}</div><div className="text-xs text-muted-foreground">{customer.country} · {customer.type}</div></div> : <p className="text-xs text-muted-foreground">No customer</p>}
            <div className="my-3 border-t" />
            {order ? <div className="space-y-1 text-sm"><div className="flex items-center justify-between"><RecordLink to="/orders/$id" params={{ id: order.id }}>{order.number}</RecordLink><AutoPill v={order.shipping} /></div><div className="text-xs text-muted-foreground">Placed {fmtDate(order.date)} · {money(order.total)} · {order.payment}</div><div className="text-xs text-muted-foreground">Tracking {order.tracking}</div></div> : <p className="text-xs text-muted-foreground">No linked order</p>}
            {product && <div className="mt-3 rounded-md bg-muted p-2 text-xs"><div className="font-medium">{product.name}</div><div className="text-muted-foreground">{product.sku} · {product.warrantyMonths}-month warranty</div></div>}
          </Panel>

          <Panel title="SLA & resolution">
            <dl className="grid grid-cols-2 gap-y-2 text-xs">
              <dt className="text-muted-foreground">SLA deadline</dt><dd>{fmtDateTime(c.slaDeadline)}</dd>
              <dt className="text-muted-foreground">SLA status</dt><dd>{sla.state}{sla.state === "Breached" && sla.msRemaining < 0 ? ` (${fmtDuration(sla.msRemaining)})` : ""}</dd>
              <dt className="text-muted-foreground">First response</dt><dd>{fmtDateTime(c.firstResponseAt)}</dd>
              <dt className="text-muted-foreground">Resolved</dt><dd>{fmtDateTime(c.resolvedAt)}</dd>
              <dt className="text-muted-foreground">Resolution time</dt><dd>{resH == null ? "—" : `${resH.toFixed(1)}h`}</dd>
              <dt className="text-muted-foreground">Follow-up</dt><dd>{c.followUpAt ? `${c.followUpDone ? "Done" : "Scheduled"} ${fmtDateTime(c.followUpAt)}` : "—"}</dd>
            </dl>
            {c.resolutionNotes && <div className="mt-3 rounded-md border border-success/25 bg-success/5 p-2 text-xs"><span className="font-semibold">Resolution notes:</span> {c.resolutionNotes}</div>}
            {!open && (
              <div className="mt-3"><div className="mb-1 text-xs font-medium">Customer satisfaction (simulated follow-up)</div>
                <div className="flex gap-1">{[1, 2, 3, 4, 5].map((n) => <button key={n} aria-label={`Rate ${n}`} onClick={() => run(rateCase, c.id, n)}><Star className={`h-5 w-5 ${c.rating && n <= c.rating ? "fill-warning text-warning" : "text-muted-foreground"}`} /></button>)}</div>
              </div>)}
          </Panel>

          <Panel title="Approvals" actions={open ? <Button size="sm" variant="outline" onClick={() => { setApReason(""); setApOpen(true); }}><Receipt className="h-4 w-4" /> Request</Button> : undefined}>
            {approvals.length === 0 ? <p className="text-xs text-muted-foreground">No approval requests. Refunds and cancellations require approval — AI never bypasses this.</p> : (
              <ul className="space-y-2">{approvals.map((a) => <li key={a.id} className="text-xs"><div className="flex items-center justify-between"><span className="font-medium">{a.type}</span><AutoPill v={a.status} /></div><p className="text-muted-foreground">{a.reason}</p><p className="text-muted-foreground">Approver: {userName(a.approverId)}{a.comments ? ` — “${a.comments}”` : ""}</p></li>)}</ul>)}
            <Link to="/approvals" className="mt-2 block text-xs text-primary hover:underline">Open approval requests →</Link>
          </Panel>

          <Panel title={<span className="flex items-center gap-1.5"><BookOpen className="h-4 w-4" /> Suggested articles</span>}>
            {kb.length === 0 ? <p className="text-xs text-muted-foreground">No matching articles.</p> : <ul className="space-y-2">{kb.map((a) => <li key={a.id}><Link to="/knowledge" hash={a.id} className="text-sm font-medium text-primary hover:underline">{a.title}</Link><p className="line-clamp-2 text-xs text-muted-foreground">{a.content}</p></li>)}</ul>}
          </Panel>
        </div>
      </div>

      <CaseFormDialog open={edit} onOpenChange={setEdit} existing={c} />
      <SimpleDialog open={resolveOpen} onOpenChange={setResolveOpen} title={`Resolve ${c.number}`} description="Resolution notes are required. The Case Resolution Flow records the timestamp and schedules a simulated satisfaction follow-up." submitLabel="Resolve case"
        onSubmit={() => { if (run(setStatus, c.id, "Resolved", resNotes).ok) setResolveOpen(false); }}>
        <Field label="Resolution notes" required error={!resNotes.trim() ? "Required" : undefined}><Textarea rows={4} value={resNotes} onChange={(e) => setResNotes(e.target.value)} placeholder="What fixed the issue and how was it confirmed?" /></Field>
      </SimpleDialog>
      <SimpleDialog open={escOpen} onOpenChange={setEscOpen} title={`Escalate ${c.number}`} description="Escalated cases are reviewed first by the Support Manager. An in-app notification is posted." submitLabel="Escalate"
        onSubmit={() => { if (run(escalate, c.id, escReason).ok) { setEscOpen(false); setEscReason(""); } }}>
        <Field label="Escalation reason" required><Textarea rows={3} value={escReason} onChange={(e) => setEscReason(e.target.value)} placeholder="e.g. Business-critical delay, SLA breached" /></Field>
      </SimpleDialog>
      <SimpleDialog open={apOpen} onOpenChange={setApOpen} title="Submit approval request" description="Routed to the designated approver (Meera Kapoor). Nothing is refunded until approved." submitLabel="Submit"
        onSubmit={() => { if (run(requestApproval, c.id, apType, apReason).ok) setApOpen(false); }}>
        <Field label="Request type" required><Select value={apType} onChange={(v) => setApType(v as ApprovalType)} options={["Refund", "Cancellation"]} /></Field>
        <Field label="Reason" required><Textarea rows={3} value={apReason} onChange={(e) => setApReason(e.target.value)} /></Field>
      </SimpleDialog>
    </>
  );
}

function AssignBox({ caseId, queueId, agentId, onSave }: { caseId: string; queueId?: string; agentId?: string; onSave: (q: string, a?: string) => void }) {
  const { state } = useSim();
  const [q, setQ] = useState(queueId ?? "");
  const [a, setA] = useState(agentId ?? "");
  const [key, setKey] = useState(caseId + queueId + agentId);
  if (key !== caseId + queueId + agentId) { setKey(caseId + queueId + agentId); setQ(queueId ?? ""); setA(agentId ?? ""); }
  const members = state.queues.find((x) => x.id === q)?.members ?? [];
  return (
    <div className="space-y-2">
      <Select ariaLabel="Queue" value={q} onChange={(v) => { setQ(v); setA(""); }} placeholder="Select queue…" options={state.queues.map((x) => ({ value: x.id, label: x.name }))} />
      <Select ariaLabel="Agent" value={a} onChange={setA} placeholder="Queue only (no agent)" options={state.users.filter((u) => members.includes(u.id) && u.active).map((u) => ({ value: u.id, label: u.name }))} />
      <Button size="sm" className="w-full" disabled={!q} onClick={() => onSave(q, a || undefined)}>Save assignment</Button>
    </div>
  );
}
