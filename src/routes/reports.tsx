import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSim } from "@/lib/sim/store";
import { avgResolutionHours, caseSla, countBy, csat, toCsv } from "@/lib/sim/rules";
import { CASE_STATUSES, CATEGORIES, PRIORITIES } from "@/lib/sim/types";
import { download, Empty, PageHeader, Panel, Select, TableWrap, Td, Th } from "@/components/app/kit";
import { BarC, COLORS, PieC } from "@/components/app/charts";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/reports")({
  head: () => seo("Reports & Analytics", "Case, SLA, warranty, approval, satisfaction and automation reports with CSV export."),
  component: Reports,
});

const REPORTS = ["Cases by Status", "Cases by Priority", "Cases by Category", "Cases by Support Agent", "Average Resolution Time", "SLA Breach Report", "Warranty Claims by Status", "Refund Approval Outcomes", "Customer Satisfaction", "Automation Execution Results"] as const;
type Row = Record<string, string | number>;

function Reports() {
  const { state } = useSim();
  const [rep, setRep] = useState<(typeof REPORTS)[number]>("Cases by Status");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const inR = (iso?: string) => !!iso && (!from || iso.slice(0, 10) >= from) && (!to || iso.slice(0, 10) <= to);
  const { rows, chart, pie } = useMemo((): { rows: Row[]; chart: { name: string; value: number }[]; pie?: boolean } => {
    const cases = state.cases.filter((c) => inR(c.createdAt));
    const agent = (id?: string) => state.users.find((u) => u.id === id)?.name ?? "Unassigned";
    const ord = (names: string[], d: { name: string; value: number }[]) => names.map((n) => ({ name: n, value: d.find((x) => x.name === n)?.value ?? 0 }));
    const simple = (d: { name: string; value: number }[], label: string) => ({ rows: d.map((x) => ({ [label]: x.name, Count: x.value })), chart: d });
    switch (rep) {
      case "Cases by Status": return simple(ord(CASE_STATUSES, countBy(cases, (c) => c.status)), "Status");
      case "Cases by Priority": return { ...simple(ord(PRIORITIES, countBy(cases, (c) => c.priority)), "Priority"), pie: true };
      case "Cases by Category": return simple(ord(CATEGORIES, countBy(cases, (c) => c.category)), "Category");
      case "Cases by Support Agent": return simple(countBy(cases, (c) => agent(c.agentId)), "Agent");
      case "Average Resolution Time": {
        const groups = PRIORITIES.map((p) => { const g = cases.filter((c) => c.priority === p); const a = avgResolutionHours(g); return { Priority: p, "Resolved cases": g.filter((c) => c.resolvedAt).length, "Avg hours": a == null ? "—" : +a.toFixed(1) }; });
        return { rows: groups, chart: groups.map((g) => ({ name: g.Priority, value: typeof g["Avg hours"] === "number" ? g["Avg hours"] : 0 })) };
      }
      case "SLA Breach Report": {
        const r = cases.map((c) => ({ c, s: caseSla(state, c) })).filter((x) => x.s.state === "Breached");
        return { rows: r.map(({ c }) => ({ Case: c.number, Subject: c.subject, Priority: c.priority, Status: c.status, Deadline: c.slaDeadline.slice(0, 16).replace("T", " "), Agent: agent(c.agentId) })), chart: ord(PRIORITIES, countBy(r, (x) => x.c.priority)) };
      }
      case "Warranty Claims by Status": {
        const cl = state.claims.filter((w) => inR(w.claimDate));
        return { rows: cl.map((w) => ({ Claim: w.number, Eligibility: w.warrantyStatus, Approval: w.approvalStatus, Reason: w.eligibilityReason ?? "" })), chart: countBy(cl, (w) => w.warrantyStatus), pie: true };
      }
      case "Refund Approval Outcomes": {
        const ap = state.approvals.filter((a) => (a.type === "Refund" || a.type === "Cancellation") && inR(a.createdAt));
        return { rows: ap.map((a) => ({ Type: a.type, Status: a.status, Approver: agent(a.approverId), Reason: a.reason, Comments: a.comments ?? "" })), chart: countBy(ap, (a) => a.status), pie: true };
      }
      case "Customer Satisfaction": {
        const rated = cases.filter((c) => c.rating != null);
        const d = [1, 2, 3, 4, 5].map((n) => ({ name: `${n} star`, value: rated.filter((c) => c.rating === n).length }));
        const avg = csat(cases);
        return { rows: [...rated.map((c) => ({ Case: c.number, Rating: c.rating!, Agent: agent(c.agentId) })), ...(avg != null ? [{ Case: "AVERAGE", Rating: +avg.toFixed(2), Agent: `${rated.length} ratings` }] : [])], chart: d };
      }
      case "Automation Execution Results": {
        const l = state.logs.filter((x) => inR(x.at));
        const names = [...new Set(l.map((x) => x.automation))];
        return { rows: names.map((n) => ({ Automation: n, Success: l.filter((x) => x.automation === n && x.status === "Success").length, Skipped: l.filter((x) => x.automation === n && x.status === "Skipped").length, Failed: l.filter((x) => x.automation === n && x.status === "Failed").length })), chart: countBy(l, (x) => x.status) };
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, rep, from, to]);
  const cols = rows[0] ? Object.keys(rows[0]) : [];
  return (
    <>
      <PageHeader title="Reports & Analytics" description="Every report is calculated live from stored records."
        actions={<Button variant="outline" disabled={!rows.length} onClick={() => download(`${rep.toLowerCase().replace(/\W+/g, "-")}.csv`, toCsv(rows))}><Download className="h-4 w-4" /> Export CSV</Button>} />
      <div className="mb-4 flex flex-wrap gap-2 rounded-lg border bg-card p-3 shadow-card">
        <Select className="w-64" ariaLabel="Report" value={rep} onChange={(v) => setRep(v as typeof rep)} options={[...REPORTS]} />
        <Input type="date" className="w-40" aria-label="From" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input type="date" className="w-40" aria-label="To" value={to} onChange={(e) => setTo(e.target.value)} />
        {(from || to) && <Button variant="ghost" onClick={() => { setFrom(""); setTo(""); }}>Clear dates</Button>}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={rep}>{pie ? <PieC data={chart.filter((d) => d.value)} height={280} /> : <BarC data={chart} height={280} color={COLORS[0]} />}</Panel>
        <Panel title="Data" bodyClass="p-0">
          {rows.length === 0 ? <Empty title="No records for this report and date range" /> : <div className="max-h-[340px] overflow-y-auto"><TableWrap><thead><tr>{cols.map((c) => <Th key={c}>{c}</Th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={i}>{cols.map((c) => <Td key={c} className="text-xs">{String(r[c] ?? "—")}</Td>)}</tr>)}</tbody></TableWrap></div>}
        </Panel>
      </div>
    </>
  );
}
