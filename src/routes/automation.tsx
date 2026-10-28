import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Clock, Play, PlayCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSim } from "@/lib/sim/store";
import { AUTOMATIONS, advanceClock, resetClock, runAll, runAutomation } from "@/lib/sim/actions";
import { now } from "@/lib/sim/rules";
import { AutoPill, Empty, fmtDateTime, PageHeader, Panel, Pill, Select, TableWrap, Td, Th, usePaged } from "@/components/app/kit";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/automation")({
  head: () => seo("Automation Center", "Simulated record-triggered and scheduled flows with execution history."),
  component: Automation,
});

function Automation() {
  const { state, run } = useSim();
  const [filter, setFilter] = useState("");
  const logs = state.logs.filter((l) => !filter || l.automation === filter || l.status === filter);
  const { slice, pager } = usePaged(logs, 15);
  const stats = (name: string) => { const l = state.logs.filter((x) => x.automation === name); return { n: l.length, last: l[0] }; };
  return (
    <>
      <PageHeader title="Automation Center" description="Flows run in this browser. Scheduled flows are triggered by Run Now or the demo clock — there is no real background scheduler."
        actions={<Button onClick={() => run(runAll)}><PlayCircle className="h-4 w-4" /> Run all eligible automations</Button>} />
      <Panel className="mb-4" title={<span className="flex items-center gap-2"><Clock className="h-4 w-4" /> Demo clock</span>} description="Advance simulated time to demonstrate SLA breaches and reminders without waiting.">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-2 text-sm">Now: <span className="font-medium">{now(state).toLocaleString()}</span>{state.clockOffset !== 0 && <Pill t="amber" className="ml-2">+{state.clockOffset / 3600000}h</Pill>}</span>
          <Button size="sm" variant="outline" onClick={() => run(advanceClock, 1)}>+1 hour</Button>
          <Button size="sm" variant="outline" onClick={() => run(advanceClock, 4)}>+4 hours</Button>
          <Button size="sm" variant="outline" onClick={() => run(advanceClock, 24)}>+1 day</Button>
          <Button size="sm" variant="outline" onClick={() => run(advanceClock, 72)}>+3 days</Button>
          <Button size="sm" variant="ghost" onClick={() => run(resetClock)}><RotateCcw className="h-4 w-4" /> Real time</Button>
        </div>
      </Panel>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {AUTOMATIONS.map((a) => { const s = stats(a.name); return (
          <div key={a.key} className="flex flex-col rounded-lg border bg-card p-4 shadow-card">
            <div className="flex items-start justify-between gap-2"><h3 className="text-sm font-semibold">{a.name}</h3><Pill t="green">Active</Pill></div>
            <p className="mt-1 text-xs text-muted-foreground">{a.description}</p>
            <p className="mt-2 text-xs"><span className="text-muted-foreground">Trigger:</span> {a.trigger}</p>
            <div className="mt-auto flex items-center justify-between pt-4">
              <span className="text-xs text-muted-foreground">{s.n} run(s){s.last && <> · last <AutoPill v={s.last.status} /></>}</span>
              <Button size="sm" variant="outline" onClick={() => run(runAutomation, a.key)}><Play className="h-3.5 w-3.5" /> Run now</Button>
            </div>
          </div>); })}
      </div>
      <Panel className="mt-4" title="Execution history" bodyClass="p-0" actions={<Select className="h-8 w-56" ariaLabel="Filter logs" value={filter} onChange={setFilter} placeholder="All automations" options={[...AUTOMATIONS.map((a) => a.name), "Prompt Builder (simulated)", "Success", "Skipped", "Failed"]} />}>
        {logs.length === 0 ? <Empty title="No executions" /> : <TableWrap>
          <thead><tr><Th>Time</Th><Th>Automation</Th><Th>Trigger</Th><Th>Record</Th><Th>Status</Th><Th>Details</Th></tr></thead>
          <tbody>{slice.map((l) => <tr key={l.id}><Td className="whitespace-nowrap text-xs">{fmtDateTime(l.at)}</Td><Td className="text-xs font-medium">{l.automation}</Td><Td className="text-xs">{l.trigger}</Td><Td className="font-mono text-xs">{l.recordId ?? "—"}</Td><Td><AutoPill v={l.status} /></Td><Td className="text-xs text-muted-foreground">{l.details}{l.error && <span className="block text-destructive">{l.error}</span>}</Td></tr>)}</tbody>
        </TableWrap>}
        {pager}
      </Panel>
    </>
  );
}
