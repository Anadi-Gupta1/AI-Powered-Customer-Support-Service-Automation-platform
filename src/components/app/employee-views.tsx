import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, XCircle, Copy, Pencil, Sparkles, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useSim } from "@/lib/sim/store";
import { applyAI } from "@/lib/sim/actions";
import { caseSla, currentUser, fmtDuration, isOpen } from "@/lib/sim/rules";
import { MOCK_PROVIDER } from "@/lib/sim/ai";
import { SCENARIO_1 } from "@/lib/sim/seed";
import { PROJECT_OVERVIEW, SCENARIOS, STEPS, type Report, type SimRun, type Snapshot, type StepId, type ViewKey } from "@/lib/sim/employee";
import { fmtDateTime, Pill, PriorityBadge, SlaBadge, StatusBadge } from "./kit";

export const spotCls = (on: boolean) => (on ? "rounded-md ring-2 ring-primary ring-offset-2 ring-offset-card bg-primary/5 transition-shadow" : "");

function F({ label, children, spot }: { label: string; children: ReactNode; spot?: boolean }) {
  return <div className={cn("p-2", spotCls(!!spot))}><div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div><div className="mt-0.5 text-sm">{children}</div></div>;
}
function Box({ title, children, action, className }: { title: string; children: ReactNode; action?: ReactNode; className?: string }) {
  return <section className={cn("rounded-lg border bg-card shadow-card", className)}><header className="flex items-center justify-between border-b px-4 py-2.5"><h3 className="text-sm font-semibold">{title}</h3>{action}</header><div className="p-4">{children}</div></section>;
}
const Open = ({ to, params, children }: { to: string; params?: Record<string, string>; children: ReactNode }) => (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  <Button size="sm" variant="ghost" asChild><Link to={to as any} params={params as any}>{children} <ExternalLink className="h-3 w-3" /></Link></Button>
);

export function CaseCard({ spot }: { spot?: string }) {
  const { state } = useSim();
  const c = state.cases.find((x) => x.id === SCENARIO_1.caseId);
  if (!c) return <Box title="Case">Case CS-1001 not found.</Box>;
  const sla = caseSla(state, c);
  return (
    <Box title={`Case ${c.number} — live record`} action={<Open to="/cases/$id" params={{ id: c.id }}>Open case</Open>}>
      <p className="mb-3 text-sm font-medium">{c.subject}</p>
      <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
        <F label="Status" spot={spot === "status"}><StatusBadge status={c.status} /></F>
        <F label="Priority" spot={spot === "priority"}><PriorityBadge p={c.priority} /></F>
        <F label="Category" spot={spot === "priority"}>{c.category}</F>
        <F label="SLA" spot={spot === "sla"}><SlaBadge state={sla.state} ms={sla.msRemaining} /></F>
        <F label="Queue" spot={spot === "queue"}>{state.queues.find((q) => q.id === c.queueId)?.name ?? "No queue"}</F>
        <F label="Agent" spot={spot === "queue"}>{state.users.find((u) => u.id === c.agentId)?.name ?? "Unassigned"}</F>
        <F label="Created">{fmtDateTime(c.createdAt)}</F>
        <F label="Resolved" spot={spot === "status"}>{fmtDateTime(c.resolvedAt)}</F>
      </div>
      {c.resolutionNotes && <div className={cn("mt-2", spotCls(spot === "status"))}><F label="Resolution notes">{c.resolutionNotes}</F></div>}
    </Box>
  );
}

function Overview({ run }: { run: SimRun }) {
  const { state } = useSim();
  const me = currentUser(state);
  return (
    <div className="space-y-4">
      <Box title="Simulation environment">
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
          <F label="Mode">Local simulation · enabled</F><F label="Scenario">{SCENARIOS[run.scenario].name}</F><F label="Acting user">{me.name} ({me.role})</F>
          <F label="Customers">{state.customers.length}</F><F label="Products / Orders">{state.products.length} / {state.orders.length}</F><F label="Cases / Queues">{state.cases.length} / {state.queues.length}</F>
        </div>
      </Box>
      <Box title="Project overview">
        <ol className="grid gap-3 sm:grid-cols-2">{PROJECT_OVERVIEW.map((p, i) => <li key={p.title} className="text-sm"><span className="font-medium">{i + 1}. {p.title}.</span> <span className="text-muted-foreground">{p.body}</span></li>)}</ol>
      </Box>
    </div>
  );
}

function Customer() {
  const { state } = useSim();
  const cust = state.customers.find((x) => x.id === SCENARIO_1.customerId);
  const order = state.orders.find((x) => x.id === SCENARIO_1.orderId);
  const product = state.products.find((x) => x.id === SCENARIO_1.productId);
  const hist = state.cases.filter((c) => c.customerId === SCENARIO_1.customerId);
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Box title="Customer" action={cust && <Open to="/customers/$id" params={{ id: cust.id }}>Open</Open>}>{cust ? <><p className="font-medium">{cust.name}</p><p className="text-xs text-muted-foreground">{cust.email} · {cust.phone}</p><div className="mt-2 flex gap-1"><Pill>{cust.type}</Pill><Pill>{cust.country}</Pill></div></> : "Missing"}</Box>
        <Box title="Order" action={order && <Open to="/orders/$id" params={{ id: order.id }}>Open</Open>}>{order ? <><p className="font-medium">{order.number}</p><p className="text-xs text-muted-foreground">{order.date.slice(0, 10)} · {order.shipping} · {order.payment}</p></> : "None"}</Box>
        <Box title="Product">{product ? <><p className="font-medium">{product.name}</p><p className="text-xs text-muted-foreground">{product.sku} · {product.warrantyMonths}-month warranty</p></> : "None"}</Box>
      </div>
      <Box title="Support history">{hist.map((c) => <div key={c.id} className="flex items-center justify-between border-b py-1.5 text-sm last:border-0"><span>{c.number} · {c.subject}</span><StatusBadge status={c.status} /></div>)}</Box>
      <CaseCard spot="case" />
    </div>
  );
}

function Queue({ spot }: { spot?: string }) {
  const { state } = useSim();
  const q = state.queues.find((x) => x.id === "q-tech")!;
  return (
    <div className="space-y-4">
      <Box title={`Queue: ${q.name}`} action={<Open to="/queues">Open queues</Open>}>
        <p className="text-xs text-muted-foreground">Rule: {q.rule}</p>
        <ul className="mt-2 space-y-1">{q.members.map((m) => { const u = state.users.find((x) => x.id === m); return <li key={m} className="flex justify-between text-sm"><span>{u?.name} <span className="text-xs text-muted-foreground">({u?.role})</span></span><span className="text-xs">{state.cases.filter((c) => c.agentId === m && isOpen(c)).length} open cases</span></li>; })}</ul>
      </Box>
      <CaseCard spot={spot} />
    </div>
  );
}

function Assistant({ text }: { text?: string }) {
  const { state } = useSim();
  const c = state.cases.find((x) => x.id === SCENARIO_1.caseId);
  const t = c?.aiSummary ?? text;
  return (
    <div className="space-y-4">
      <Box title="AI Summary" className={spotCls(!!t)} action={<Pill t="violet"><Sparkles className="mr-1 inline h-3 w-3" />Simulated AI</Pill>}>
        {t ? <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{t}</pre> : <p className="text-sm text-muted-foreground">Not generated yet.</p>}
        <p className="mt-3 text-xs text-muted-foreground">Provider: {MOCK_PROVIDER}</p>
      </Box>
      <CaseCard />
    </div>
  );
}

function Knowledge({ payload }: { payload?: Record<string, unknown> }) {
  const { state, run } = useSim();
  const c = state.cases.find((x) => x.id === SCENARIO_1.caseId);
  const ids = (payload?.articleIds as string[]) ?? [];
  const scores = (payload?.scores as number[]) ?? [];
  const sel = state.articles.find((a) => a.id === payload?.articleId);
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState(c?.aiResponse ?? "");
  const text = c?.aiResponse ?? (payload?.text as string) ?? "";
  return (
    <div className="space-y-4">
      <Box title="Knowledge search results" action={<Open to="/knowledge">Knowledge Base</Open>}>
        {ids.length ? <ul className="space-y-1">{ids.map((id, i) => { const a = state.articles.find((x) => x.id === id); return <li key={id} className={cn("flex justify-between rounded-md px-2 py-1 text-sm", id === sel?.id && "bg-accent font-medium")}><span>{a?.title}</span><span className="text-xs text-muted-foreground">score {scores[i]}</span></li>; })}</ul> : <p className="text-sm text-muted-foreground">Run this step to search.</p>}
        {sel && <blockquote className="mt-3 border-l-2 border-primary pl-3 text-sm text-muted-foreground">{sel.content}</blockquote>}
      </Box>
      <Box title="Draft customer response" className={spotCls(!!text)} action={text && <div className="flex gap-1">
        <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard?.writeText(text); toast.success("Copied"); }}><Copy className="h-3.5 w-3.5" /> Copy</Button>
        <Button size="sm" variant="ghost" onClick={() => { setDraft(text); setEdit(!edit); }}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
      </div>}>
        {!text ? <p className="text-sm text-muted-foreground">Not drafted yet.</p> : edit ? (
          <div className="space-y-2"><Textarea rows={9} value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Edit response" />
            <Button size="sm" onClick={() => { const r = run(applyAI, SCENARIO_1.caseId, "response", draft); if (r.ok) setEdit(false); }}>Apply Response</Button></div>
        ) : <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{text}</pre>}
        <p className="mt-3 text-xs text-muted-foreground">Logged to the case conversation only — no email is sent.</p>
      </Box>
    </div>
  );
}

function Sla() {
  const { state } = useSim();
  const c = state.cases.find((x) => x.id === SCENARIO_1.caseId);
  if (!c) return null;
  const sla = caseSla(state, c);
  return (
    <div className="space-y-4">
      <Box title="SLA evaluation" className={spotCls(true)}>
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
          <F label="Target">{state.settings.sla[c.priority]} min ({c.priority})</F><F label="State"><SlaBadge state={sla.state} ms={sla.msRemaining} /></F>
          <F label={sla.msRemaining < 0 ? "Overdue" : "Margin"}>{fmtDuration(sla.msRemaining)}</F><F label="Escalated">{c.escalated ? "Yes" : "No"}</F>
        </div>
      </Box>
      <CaseCard spot="sla" />
    </div>
  );
}

function Approval({ payload, waiting, onDecide }: { payload?: Record<string, unknown>; waiting: boolean; onDecide: (approve: boolean, comments: string) => void }) {
  const { state } = useSim();
  const [comments, setComments] = useState("");
  const ap = state.approvals.find((a) => a.id === payload?.approvalId);
  if (!ap) return <Box title="Approval Requests">No approval request in this run. The refund stage runs only in the full scenario.</Box>;
  const c = state.cases.find((x) => x.id === ap.caseId);
  const me = currentUser(state);
  return (
    <div className="space-y-4">
      <Box title="Refund approval request" action={<Open to="/approvals">Approval Requests</Open>}>
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
          <F label="Case">{c?.number} · {c?.subject}</F><F label="Type">{ap.type}</F><F label="Status"><Pill t={ap.status === "Approved" ? "green" : ap.status === "Rejected" ? "red" : "amber"}>{ap.status}</Pill></F>
          <F label="Approver">{state.users.find((u) => u.id === ap.approverId)?.name}</F><F label="Acting user">{me.name} ({me.role})</F><F label="Comments">{ap.comments ?? "—"}</F>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{ap.reason}</p>
      </Box>
      {waiting && ap.status === "Pending" && (
        <Box title="Human approval required" className={spotCls(true)}>
          <p className="mb-2 text-sm">Please approve or reject this request to continue. Comments are required when rejecting.</p>
          <Textarea rows={3} value={comments} onChange={(e) => setComments(e.target.value)} placeholder="Decision comments" aria-label="Decision comments" />
          <div className="mt-3 flex gap-2">
            <Button onClick={() => onDecide(true, comments)}><CheckCircle2 className="h-4 w-4" /> Approve</Button>
            <Button variant="outline" onClick={() => onDecide(false, comments)}><XCircle className="h-4 w-4" /> Reject</Button>
          </div>
        </Box>
      )}
    </div>
  );
}

function Resolve({ run, setNotes, editable }: { run: SimRun; setNotes: (v: string) => void; editable: boolean }) {
  return (
    <div className="space-y-4">
      {editable && <Box title="Resolution notes (confirm or edit before running this step)"><Textarea rows={3} value={run.resolutionNotes} onChange={(e) => setNotes(e.target.value)} aria-label="Resolution notes" /><p className="mt-1 text-xs text-muted-foreground">Minimum 15 characters.</p></Box>}
      <CaseCard spot="status" />
    </div>
  );
}

function Verify({ payload }: { payload?: Record<string, unknown> }) {
  const checks = (payload?.checks as { label: string; pass: boolean; detail: string }[]) ?? [];
  return (
    <Box title="Verification checklist">
      {!checks.length ? <p className="text-sm text-muted-foreground">Not run yet.</p> : <ul className="space-y-1.5">{checks.map((c) => (
        <li key={c.label} className="flex items-start gap-2 text-sm">{c.pass ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />}<span className="flex-1">{c.label}</span><span className="text-xs text-muted-foreground">{c.detail}</span></li>))}</ul>}
    </Box>
  );
}

function Dashboard({ payload }: { payload?: Record<string, unknown> }) {
  const { state } = useSim();
  const b = payload?.before as Snapshot | undefined, a = payload?.after as Snapshot | undefined;
  const rows: [string, keyof Snapshot][] = [["Total cases", "total"], ["Open cases", "open"], ["Resolved cases", "resolved"], ["Escalated", "escalated"], ["SLA breaches", "breaches"], ["Avg resolution (h)", "avgRes"], ["CSAT", "csat"]];
  return (
    <div className="space-y-4">
      <Box title="Dashboard KPIs — before → after" action={<Open to="/">Open dashboard</Open>}>
        {!a ? <p className="text-sm text-muted-foreground">Not recalculated yet.</p> : <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{rows.map(([l, k]) => { const changed = b?.[k] !== a[k]; return (
          <div key={k} className={cn("rounded-md border p-2", spotCls(changed))}><div className="text-[11px] text-muted-foreground">{l}</div><div className="text-lg font-semibold">{String(a[k] ?? "—")}</div><div className="text-[11px] text-muted-foreground">was {String(b?.[k] ?? "—")}</div></div>); })}</div>}
      </Box>
      <Box title="Recent automation executions" action={<Open to="/automation">Automation Center</Open>}>
        <ul className="space-y-1">{state.logs.slice(0, 6).map((l) => <li key={l.id} className="text-xs"><span className="font-medium">{l.automation}</span> · {l.status} — <span className="text-muted-foreground">{l.details}</span></li>)}</ul>
      </Box>
      <Box title="Recent activity" action={<Open to="/audit">Audit log</Open>}>
        <ul className="space-y-1">{state.audit.slice(0, 6).map((l) => <li key={l.id} className="text-xs"><span className="font-medium">{l.action}</span> — <span className="text-muted-foreground">{l.details}</span></li>)}</ul>
      </Box>
    </div>
  );
}

export function ReportView({ report, actions }: { report: Report; actions: ReactNode }) {
  const L = ({ items }: { items: string[] }) => items.length ? <ul className="list-disc space-y-0.5 pl-5 text-xs">{items.map((x, i) => <li key={i}>{x}</li>)}</ul> : <p className="text-xs text-muted-foreground">None</p>;
  return (
    <Box title="Execution report" action={<Pill t="blue">From this run</Pill>}>
      <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
        <F label="Scenario">{report.scenario}</F><F label="Started">{fmtDateTime(report.startedAt ?? undefined)}</F><F label="Finished">{fmtDateTime(report.finishedAt)}</F><F label="Final status">{report.finalStatus}</F>
        <F label="Attempted">{report.attempted}</F><F label="Successful">{report.successful}</F><F label="Failed">{report.failed}</F><F label="Skipped">{report.skipped}</F>
        <F label="Queue / Agent">{report.finalQueue} / {report.finalAgent}</F><F label="Approval">{report.approval}</F>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div><h4 className="mb-1 text-xs font-semibold">AI outputs</h4><L items={report.aiOutputs} /></div>
        <div><h4 className="mb-1 text-xs font-semibold">Outstanding issues</h4><L items={report.outstanding} /></div>
        <div><h4 className="mb-1 text-xs font-semibold">Automation executions</h4><L items={report.automations} /></div>
        <div><h4 className="mb-1 text-xs font-semibold">Verification</h4><L items={report.verification} /></div>
        <div className="md:col-span-2"><h4 className="mb-1 text-xs font-semibold">Limitations</h4><L items={report.limitations} /></div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">{actions}</div>
    </Box>
  );
}

export function StageView(p: { view: ViewKey; stepId: StepId; run: SimRun; spot?: string; payload?: Record<string, unknown>; executed: boolean; waiting: boolean; onDecide: (a: boolean, c: string) => void; setNotes: (v: string) => void; report: ReactNode }) {
  const def = STEPS.find((s) => s.id === p.stepId)!;
  const body = (() => {
    switch (p.view) {
      case "overview": return <Overview run={p.run} />;
      case "customer": return <Customer />;
      case "case": return <CaseCard spot={p.executed ? "priority" : undefined} />;
      case "queue": return <Queue spot={p.executed ? "queue" : undefined} />;
      case "assistant": return <Assistant text={p.payload?.text as string} />;
      case "knowledge": return <Knowledge key={String(p.payload?.text ?? "")} payload={p.payload} />;
      case "sla": return <Sla />;
      case "approval": return <Approval payload={p.payload} waiting={p.waiting} onDecide={p.onDecide} />;
      case "resolve": return <Resolve run={p.run} setNotes={p.setNotes} editable={!p.executed} />;
      case "verify": return <Verify payload={p.payload} />;
      case "dashboard": return <Dashboard payload={p.payload} />;
      case "report": return p.report;
    }
  })();
  return (
    <div className="space-y-3">
      {!p.executed && <div className="rounded-md border border-dashed bg-muted/40 px-3 py-2 text-xs text-muted-foreground">Preview — <span className="font-medium text-foreground">{def.title}</span> has not run yet. {def.summary}</div>}
      {body}
    </div>
  );
}
