import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSim } from "@/lib/sim/store";
import { toCsv } from "@/lib/sim/rules";
import { AutoPill, download, Empty, fmtDateTime, PageHeader, Panel, Select, TableWrap, Td, Th, usePaged } from "@/components/app/kit";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/audit")({
  head: () => seo("Activity & Audit Logs", "Searchable chronological history of every important operation."),
  component: Audit,
});

function Audit() {
  const { state } = useSim();
  const [q, setQ] = useState("");
  const [action, setAction] = useState("");
  const [outcome, setOutcome] = useState("");
  const [user, setUser] = useState("");
  const name = (id: string) => state.users.find((u) => u.id === id)?.name ?? id;
  const actions = [...new Set(state.audit.map((a) => a.action))].sort();
  const list = useMemo(() => state.audit.filter((a) => (!action || a.action === action) && (!outcome || a.outcome === outcome) && (!user || a.userId === user) && `${a.action} ${a.recordType} ${a.recordId} ${a.details}`.toLowerCase().includes(q.toLowerCase())), [state.audit, q, action, outcome, user]);
  const { slice, pager } = usePaged(list, 20);
  return (
    <>
      <PageHeader title="Activity & Audit Logs" description="Every create, update, assignment, AI generation, automation, approval and permission denial."
        actions={<Button variant="outline" disabled={!list.length} onClick={() => download("audit-log.csv", toCsv(list.map((a) => ({ timestamp: a.at, action: a.action, recordType: a.recordType, recordId: a.recordId ?? "", user: name(a.userId), outcome: a.outcome, details: a.details }))))}><Download className="h-4 w-4" /> Export CSV</Button>} />
      <Panel bodyClass="p-0">
        <div className="grid gap-2 border-b p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Input placeholder="Search details, record ID…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search audit" />
          <Select ariaLabel="Action" value={action} onChange={setAction} placeholder="All actions" options={actions} />
          <Select ariaLabel="Outcome" value={outcome} onChange={setOutcome} placeholder="All outcomes" options={["Success", "Denied", "Failed"]} />
          <Select ariaLabel="User" value={user} onChange={setUser} placeholder="All users" options={state.users.map((u) => ({ value: u.id, label: u.name }))} />
        </div>
        {list.length === 0 ? <Empty title="No audit entries" hint="Actions you take in the app will appear here." /> : <TableWrap>
          <thead><tr><Th>Timestamp</Th><Th>Action</Th><Th>Record</Th><Th>User</Th><Th>Outcome</Th><Th>Details</Th></tr></thead>
          <tbody>{slice.map((a) => <tr key={a.id}><Td className="whitespace-nowrap text-xs">{fmtDateTime(a.at)}</Td><Td className="text-xs font-medium">{a.action}</Td><Td className="text-xs">{a.recordType}<div className="font-mono text-muted-foreground">{a.recordId ?? ""}</div></Td><Td className="text-xs">{name(a.userId)}</Td><Td><AutoPill v={a.outcome} /></Td><Td className="text-xs text-muted-foreground">{a.details}</Td></tr>)}</tbody>
        </TableWrap>}
        {pager}
      </Panel>
    </>
  );
}
