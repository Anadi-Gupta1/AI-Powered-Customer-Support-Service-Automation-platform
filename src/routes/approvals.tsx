import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSim } from "@/lib/sim/store";
import { decideApproval } from "@/lib/sim/actions";
import { currentUser } from "@/lib/sim/rules";
import { AutoPill, Empty, Field, fmtDateTime, PageHeader, Panel, Pill, RecordLink } from "@/components/app/kit";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/approvals")({
  head: () => seo("Approval Requests", "Refund, cancellation and warranty approvals with role-based decisions."),
  component: Approvals,
});

function Approvals() {
  const { state, run } = useSim();
  const [tab, setTab] = useState<"Pending" | "Approved" | "Rejected">("Pending");
  const list = state.approvals.filter((a) => a.status === tab);
  const [sel, setSel] = useState<string>("");
  const [comments, setComments] = useState("");
  const a = state.approvals.find((x) => x.id === sel) ?? list[0];
  const me = currentUser(state);
  const name = (id?: string) => state.users.find((u) => u.id === id)?.name ?? "—";
  const c = a?.caseId ? state.cases.find((x) => x.id === a.caseId) : undefined;
  const claim = a?.claimId ? state.claims.find((x) => x.id === a.claimId) : undefined;
  const cust = state.customers.find((x) => x.id === (c?.customerId ?? claim?.customerId));
  const canDecide = a && a.status === "Pending" && (a.approverId === me.id || me.role === "Administrator");
  const decide = (approve: boolean) => { if (a && run(decideApproval, a.id, approve, comments).ok) setComments(""); };
  return (
    <>
      <PageHeader title="Approval Requests" description="Only the designated approver or an administrator can decide. AI recommendations never bypass approval." />
      <Tabs value={tab} onValueChange={(v) => { setTab(v as typeof tab); setSel(""); }} className="mb-4">
        <TabsList>{(["Pending", "Approved", "Rejected"] as const).map((s) => <TabsTrigger key={s} value={s}>{s} ({state.approvals.filter((x) => x.status === s).length})</TabsTrigger>)}</TabsList>
      </Tabs>
      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <Panel bodyClass="p-0">
          {list.length === 0 ? <Empty title={`No ${tab.toLowerCase()} requests`} /> : <ul>{list.map((x) => (
            <li key={x.id}><button onClick={() => setSel(x.id)} className={`w-full border-b px-4 py-3 text-left hover:bg-muted ${a?.id === x.id ? "bg-accent" : ""}`}>
              <div className="flex items-center justify-between"><span className="text-sm font-medium">{x.type}</span><AutoPill v={x.status} /></div>
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{x.reason}</p><p className="mt-1 text-[11px] text-muted-foreground">Approver: {name(x.approverId)} · {fmtDateTime(x.createdAt)}</p></button></li>))}
          </ul>}
        </Panel>
        {a ? (
          <Panel title={`${a.type} request`} description={`Requested by ${name(a.requestedBy)} on ${fmtDateTime(a.createdAt)}`}>
            <dl className="grid gap-y-2 text-sm sm:grid-cols-[160px_1fr]">
              <dt className="text-muted-foreground">Status</dt><dd><AutoPill v={a.status} /></dd>
              <dt className="text-muted-foreground">Reason</dt><dd>{a.reason}</dd>
              <dt className="text-muted-foreground">Designated approver</dt><dd>{name(a.approverId)}</dd>
              {c && <><dt className="text-muted-foreground">Related case</dt><dd><RecordLink to="/cases/$id" params={{ id: c.id }}>{c.number}</RecordLink> — {c.subject}</dd></>}
              {claim && <><dt className="text-muted-foreground">Warranty claim</dt><dd>{claim.number} · <AutoPill v={claim.warrantyStatus} /> <span className="text-xs text-muted-foreground">{claim.eligibilityReason}</span></dd></>}
              {cust && <><dt className="text-muted-foreground">Customer</dt><dd><RecordLink to="/customers/$id" params={{ id: cust.id }}>{cust.name}</RecordLink> · {cust.email}</dd></>}
              {a.decidedAt && <><dt className="text-muted-foreground">Decision</dt><dd>{a.status} by {name(a.decidedBy)} · {fmtDateTime(a.decidedAt)}</dd><dt className="text-muted-foreground">Comments</dt><dd>{a.comments ?? "—"}</dd></>}
            </dl>
            {a.status === "Pending" && (
              <div className="mt-6 border-t pt-4">
                {!canDecide && <div className="mb-3 rounded-md border border-warning/30 bg-warning/10 p-3 text-xs">You are acting as {me.name} ({me.role}). Only {name(a.approverId)} or an Administrator can decide — switch user from the profile menu. Attempts are logged as denied.</div>}
                <Field label="Decision comments" hint="Required when rejecting"><Textarea rows={3} value={comments} onChange={(e) => setComments(e.target.value)} /></Field>
                <div className="mt-3 flex gap-2"><Button onClick={() => decide(true)}><Check className="h-4 w-4" /> Approve</Button><Button variant="outline" onClick={() => decide(false)}><X className="h-4 w-4" /> Reject</Button></div>
              </div>)}
            <div className="mt-6 border-t pt-4"><h3 className="mb-2 text-xs font-semibold">Approval history</h3>
              <ul className="space-y-1 text-xs">{state.audit.filter((x) => x.recordId === a.id).map((x) => <li key={x.id} className="flex flex-wrap gap-2"><span className="text-muted-foreground">{fmtDateTime(x.at)}</span>{x.action}<Pill t={x.outcome === "Denied" ? "red" : "green"}>{x.outcome}</Pill><span className="text-muted-foreground">{x.details}</span></li>)}
                {state.audit.filter((x) => x.recordId === a.id).length === 0 && <li className="text-muted-foreground">Seeded record — no history in this session yet.</li>}</ul>
            </div>
          </Panel>
        ) : <Panel><Empty title="Select a request" /></Panel>}
      </div>
    </>
  );
}
