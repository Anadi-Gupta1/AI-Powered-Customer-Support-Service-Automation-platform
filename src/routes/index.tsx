import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, Clock, FolderOpen, Inbox, RefreshCw, Smile, Sparkles, TimerOff, Plus, UserPlus, Workflow, Download, PlayCircle, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSim } from "@/lib/sim/store";
import { caseSla, countBy, isOpen, fmtDuration, toCsv } from "@/lib/sim/rules";
import { byAgent, dashboardMetrics, trend } from "@/lib/sim/metrics";
import { loadScenario, runAll } from "@/lib/sim/actions";
import { CATEGORIES, CASE_STATUSES, PRIORITIES } from "@/lib/sim/types";
import { AutoPill, download, Empty, fmtDateTime, Kpi, PageHeader, Panel, PriorityBadge, RecordLink, Select, SlaBadge, StatusBadge, TableWrap, Td, Th } from "@/components/app/kit";
import { BarC, COLORS, LineC, PieC } from "@/components/app/charts";
import { CaseFormDialog, CustomerFormDialog } from "@/components/app/forms";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/")({
  head: () => seo("Overview Dashboard", "Live support KPIs, SLA alerts, automation activity and AI summary for the simulated service desk."),
  component: Dashboard,
});

function Dashboard() {
  const { state, run } = useSim();
  const navigate = useNavigate();
  const [range, setRange] = useState("30");
  const [newCase, setNewCase] = useState(false);
  const [newCust, setNewCust] = useState(false);
  const days = range === "all" ? null : Number(range);
  const m = dashboardMetrics(state, days);
  const t = trend(state, m.cases, days ?? 30);
  const urgent = state.cases.filter((c) => isOpen(c) && (c.priority === "Critical" || c.priority === "High" || c.status === "Escalated"));
  const upcoming = state.cases.filter(isOpen).map((c) => ({ c, sla: caseSla(state, c) })).filter((x) => x.sla.state === "At Risk" || x.sla.state === "On Track" || x.sla.state === "Breached").sort((a, b) => a.sla.msRemaining - b.sla.msRemaining).slice(0, 6);
  const aiLogs = state.audit.filter((a) => a.action.startsWith("AI "));
  const aiDrafts = state.cases.filter((c) => c.aiResponse || c.aiSummary).length;
  const recent = [...state.cases].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6);
  const order = (names: string[]) => (d: { name: string; value: number }[]) => names.map((n) => ({ name: n, value: d.find((x) => x.name === n)?.value ?? 0 }));

  const exportKpis = () => download("dashboard-kpis.csv", toCsv([{ range: days ? `${days} days` : "All time", total: m.total, open: m.open, resolved: m.resolved, escalated: m.escalated, createdToday: m.today, avgResolutionHours: m.avgRes?.toFixed(1) ?? "", slaBreaches: m.breaches, csat: m.csat?.toFixed(2) ?? "" }]));

  return (
    <>
      <PageHeader title="Service Overview" description="Live metrics calculated from the records stored in this simulation."
        actions={<>
          <Button size="sm" className="h-9" asChild><Link to="/employee"><Bot className="h-4 w-4" /> ▶ Run Full Project Simulation</Link></Button>
          <Select ariaLabel="Date range" className="w-36" value={range} onChange={setRange} options={[{ value: "7", label: "Last 7 days" }, { value: "30", label: "Last 30 days" }, { value: "90", label: "Last 90 days" }, { value: "all", label: "All time" }]} />
          <Button variant="outline" size="sm" className="h-9" onClick={() => navigate({ to: "/" })} aria-label="Refresh"><RefreshCw className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" className="h-9" onClick={exportKpis}><Download className="h-4 w-4" /> Export</Button>
        </>} />

      <div className="mb-6 flex flex-wrap gap-2 rounded-lg border bg-card p-3 shadow-card">
        <span className="mr-2 self-center text-xs font-medium text-muted-foreground">Quick actions</span>
        <Button size="sm" onClick={() => setNewCase(true)}><Plus className="h-4 w-4" /> Create Case</Button>
        <Button size="sm" variant="outline" onClick={() => setNewCust(true)}><UserPlus className="h-4 w-4" /> Add Customer</Button>
        <Button size="sm" variant="outline" asChild><Link to="/assistant"><Sparkles className="h-4 w-4 text-ai" /> Generate AI Response</Link></Button>
        <Button size="sm" variant="outline" onClick={() => run(runAll)}><Workflow className="h-4 w-4" /> Run Automations</Button>
        <Button size="sm" variant="ghost" onClick={() => { const r = run(loadScenario, 1); if (r.ok) navigate({ to: "/cases/$id", params: { id: r.data as string } }); }}><PlayCircle className="h-4 w-4" /> Load Demo Scenario</Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Total Cases" value={m.total} icon={<FolderOpen className="h-4 w-4" />} hint={days ? `Created in last ${days} days` : "All time"} />
        <Kpi label="Open Cases" value={m.open} icon={<Inbox className="h-4 w-4" />} t="sky" hint="New, Working, Escalated, Waiting" />
        <Kpi label="Resolved Cases" value={m.resolved} icon={<CheckCircle2 className="h-4 w-4" />} t="green" hint="Resolved or Closed" />
        <Kpi label="Escalated" value={m.escalated} icon={<AlertTriangle className="h-4 w-4" />} t="red" />
        <Kpi label="Created Today" value={m.today} icon={<Activity className="h-4 w-4" />} hint="By demo clock date" />
        <Kpi label="Avg Resolution Time" value={m.avgRes == null ? "—" : `${m.avgRes.toFixed(1)}h`} icon={<Clock className="h-4 w-4" />} hint={m.avgRes == null ? "No resolved cases yet" : "Mean of resolvedAt − createdAt"} />
        <Kpi label="SLA Breaches" value={m.breaches} icon={<TimerOff className="h-4 w-4" />} t="amber" hint="First-response target missed" />
        <Kpi label="Customer Satisfaction" value={m.csat == null ? "—" : `${m.csat.toFixed(1)} / 5`} icon={<Smile className="h-4 w-4" />} t="green" hint={m.csat == null ? "No ratings yet" : `Mean of ${m.rated} rating(s)`} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel title="Cases by Status"><BarC data={order(CASE_STATUSES)(countBy(m.cases, (c) => c.status))} /></Panel>
        <Panel title="Cases by Priority"><PieC data={order(PRIORITIES)(countBy(m.cases, (c) => c.priority)).filter((d) => d.value)} /></Panel>
        <Panel title="Cases Created vs. Resolved" description="Daily counts, last 30 days max"><LineC data={t} lines={[{ key: "Created", name: "Created", color: COLORS[0] }, { key: "Resolved", name: "Resolved", color: COLORS[2] }]} /></Panel>
        <Panel title="Cases by Category"><BarC horizontal data={order(CATEGORIES)(countBy(m.cases, (c) => c.category))} color={COLORS[1]} /></Panel>
        <Panel title="Cases by Support Agent"><BarC data={byAgent(state, m.cases)} color={COLORS[5]} /></Panel>
        <Panel title="Customer Satisfaction Trend" description="Average rating of cases resolved per day (1–5)">
          {t.some((d) => d.CSAT != null) ? <LineC data={t} lines={[{ key: "CSAT", name: "Avg rating", color: COLORS[2] }]} /> : <Empty title="No ratings in this period" />}
        </Panel>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <Panel className="xl:col-span-2" title="Recent Cases" bodyClass="p-0" actions={<Button size="sm" variant="ghost" asChild><Link to="/cases">View all</Link></Button>}>
          <TableWrap>
            <thead><tr><Th>Case</Th><Th>Customer</Th><Th>Priority</Th><Th>Status</Th><Th>SLA</Th><Th>Updated</Th></tr></thead>
            <tbody>
              {recent.map((c) => { const sla = caseSla(state, c); return (
                <tr key={c.id}>
                  <Td><RecordLink to="/cases/$id" params={{ id: c.id }}>{c.number}</RecordLink><div className="max-w-[240px] truncate text-xs text-muted-foreground">{c.subject}</div></Td>
                  <Td>{state.customers.find((x) => x.id === c.customerId)?.name}</Td>
                  <Td><PriorityBadge p={c.priority} /></Td><Td><StatusBadge status={c.status} /></Td>
                  <Td><SlaBadge state={sla.state} ms={sla.msRemaining} /></Td><Td className="text-xs text-muted-foreground">{fmtDateTime(c.updatedAt)}</Td>
                </tr>); })}
            </tbody>
          </TableWrap>
        </Panel>
        <Panel title="Urgent Cases" description="Critical, High or Escalated & open">
          {urgent.length === 0 ? <Empty title="No urgent cases" /> : (
            <ul className="space-y-2">{urgent.slice(0, 6).map((c) => (
              <li key={c.id} className="flex items-start justify-between gap-2 rounded-md border p-2">
                <div className="min-w-0"><RecordLink to="/cases/$id" params={{ id: c.id }}>{c.number}</RecordLink><p className="truncate text-xs text-muted-foreground">{c.subject}</p></div>
                <div className="flex shrink-0 flex-col items-end gap-1"><PriorityBadge p={c.priority} /><StatusBadge status={c.status} /></div>
              </li>))}
            </ul>)}
        </Panel>
        <Panel title="Upcoming SLA Deadlines" description="Open cases without a first response">
          {upcoming.filter((x) => !x.c.firstResponseAt).length === 0 ? <Empty title="All open cases have been responded to" /> : (
            <ul className="space-y-2">{upcoming.filter((x) => !x.c.firstResponseAt).map(({ c, sla }) => (
              <li key={c.id} className="flex items-center justify-between gap-2 text-sm">
                <RecordLink to="/cases/$id" params={{ id: c.id }}>{c.number}</RecordLink>
                <span className="text-xs text-muted-foreground">{sla.msRemaining < 0 ? `${fmtDuration(sla.msRemaining)} overdue` : `${fmtDuration(sla.msRemaining)} left`}</span>
                <SlaBadge state={sla.state} ms={sla.msRemaining} />
              </li>))}
            </ul>)}
        </Panel>
        <Panel title="Recent Automation Executions" actions={<Button size="sm" variant="ghost" asChild><Link to="/automation">Open</Link></Button>}>
          {state.logs.length === 0 ? <Empty title="No executions yet" /> : (
            <ul className="space-y-2">{state.logs.slice(0, 6).map((l) => (
              <li key={l.id} className="text-xs"><div className="flex items-center justify-between gap-2"><span className="font-medium">{l.automation}</span><AutoPill v={l.status} /></div><p className="mt-0.5 line-clamp-2 text-muted-foreground">{l.details}</p></li>))}
            </ul>)}
        </Panel>
        <Panel title={<span className="flex items-center gap-1.5"><Sparkles className="h-4 w-4 text-ai" /> AI Activity Summary</span>} description="Simulated AI — local mock provider">
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="rounded-md border border-ai/20 bg-ai/5 p-3"><div className="text-xl font-semibold text-ai">{aiLogs.filter((a) => a.action === "AI summary generated").length}</div><div className="text-xs text-muted-foreground">Summaries generated</div></div>
            <div className="rounded-md border border-ai/20 bg-ai/5 p-3"><div className="text-xl font-semibold text-ai">{aiLogs.filter((a) => a.action === "AI response generated").length}</div><div className="text-xs text-muted-foreground">Responses drafted</div></div>
            <div className="col-span-2 rounded-md border p-3 text-xs text-muted-foreground">{aiDrafts} case(s) hold AI output awaiting or after agent review.</div>
          </div>
        </Panel>
      </div>
      <CaseFormDialog open={newCase} onOpenChange={setNewCase} onSaved={(id) => navigate({ to: "/cases/$id", params: { id } })} />
      <CustomerFormDialog open={newCust} onOpenChange={setNewCust} onSaved={(id) => navigate({ to: "/customers/$id", params: { id } })} />
    </>
  );
}
