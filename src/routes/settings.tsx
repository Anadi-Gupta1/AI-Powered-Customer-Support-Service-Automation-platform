import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Database, Download, RotateCcw, Trash2, Upload, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSim, validateState, STORAGE_KEY } from "@/lib/sim/store";
import { buildSeed } from "@/lib/sim/seed";
import { updateSettings } from "@/lib/sim/actions";
import { can, currentUser } from "@/lib/sim/rules";
import { PRIORITIES, type Priority } from "@/lib/sim/types";
import { AutoPill, Confirm, download, Field, fmtDateTime, PageHeader, Panel, Pill } from "@/components/app/kit";
import { toast } from "sonner";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/settings")({
  head: () => seo("Settings", "Simulation status, demo data management, SLA and warranty configuration."),
  component: SettingsPage,
});

function SettingsPage() {
  const { state, run, replace } = useSim();
  const file = useRef<HTMLInputElement>(null);
  const [sla, setSla] = useState(state.settings.sla);
  const [grace, setGrace] = useState(state.settings.warrantyGraceDays);
  const [rem, setRem] = useState(state.settings.reminderDays);
  const isAdmin = can(state, "admin");
  const needAdmin = (fn: () => void) => () => { if (!isAdmin) { toast.error(`Access denied: the ${currentUser(state).role} role cannot manage demo data.`); return; } fn(); };

  const importJson = async (f: File) => {
    try {
      const v = validateState(JSON.parse(await f.text()));
      if (!v.ok) { toast.error(`Import rejected: ${v.error}`); return; }
      replace(v.state, "Data imported successfully");
    } catch { toast.error("Import rejected: file is not valid JSON."); }
  };
  const clearRecords = () => { const s = buildSeed(); replace({ ...s, customers: [], products: [], orders: [], cases: [], claims: [], approvals: [], logs: [], audit: [], notifications: [] }, "Demo records cleared"); };

  return (
    <>
      <PageHeader title="Settings" description="Manage the local simulation environment." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={<span className="flex items-center gap-2"><FlaskConical className="h-4 w-4" /> Simulation mode</span>}>
          <Pill t="amber">SIMULATION MODE — NO LIVE SALESFORCE CONNECTION</Pill>
          <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
            <li>• Data stored in this browser (localStorage key <code className="text-xs">{STORAGE_KEY}</code>), versioned and validated on load.</li>
            <li>• AI output comes from a deterministic local mock provider — no external model is called.</li>
            <li>• No emails, SMS, payments or Salesforce API calls are made.</li>
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">{state.cases.length} cases · {state.customers.length} customers · {state.orders.length} orders · {state.audit.length} audit entries</p>
        </Panel>
        <Panel title={<span className="flex items-center gap-2"><Database className="h-4 w-4" /> Demo data</span>} description={isAdmin ? "Administrator actions" : "Switch to Administrator to manage demo data."}>
          <div className="grid gap-2 sm:grid-cols-2">
            <Confirm trigger={<Button variant="outline" disabled={!isAdmin}><Database className="h-4 w-4" /> Seed demo data</Button>} title="Seed demo data?" description="Replaces all current records with the original seeded dataset." onConfirm={needAdmin(() => replace(buildSeed(), "Demo data seeded"))} />
            <Confirm trigger={<Button variant="outline" disabled={!isAdmin}><RotateCcw className="h-4 w-4" /> Reset demo environment</Button>} title="Reset demo environment?" description="Restores the original scenario, resets the demo clock and clears all your changes." onConfirm={needAdmin(() => replace(buildSeed(), "Demo environment reset"))} />
            <Button variant="outline" onClick={() => download(`support-sim-export-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(state, null, 2), "application/json")}><Download className="h-4 w-4" /> Export JSON</Button>
            <Button variant="outline" disabled={!isAdmin} onClick={() => file.current?.click()}><Upload className="h-4 w-4" /> Import JSON</Button>
            <input ref={file} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importJson(f); e.target.value = ""; }} />
            <Confirm destructive trigger={<Button variant="outline" className="sm:col-span-2" disabled={!isAdmin}><Trash2 className="h-4 w-4" /> Clear demo records</Button>} title="Clear all demo records?" description="Removes customers, products, orders, cases, claims, approvals and logs. Users, queues, articles and templates are kept. You can re-seed afterwards." confirmLabel="Clear records" onConfirm={needAdmin(clearRecords)} />
          </div>
        </Panel>
        <Panel title="SLA targets (first response, minutes)" description="Demo configuration values, not contractual commitments. Applies to new cases and priority changes.">
          <div className="grid grid-cols-2 gap-3">{PRIORITIES.map((p) => <Field key={p} label={p}><Input type="number" min={1} value={sla[p]} onChange={(e) => setSla({ ...sla, [p as Priority]: Math.max(1, Number(e.target.value)) })} /></Field>)}</div>
          <Button className="mt-3" onClick={() => run(updateSettings, { sla })}>Save SLA targets</Button>
        </Panel>
        <Panel title="Warranty & reminder rules">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Warranty grace window (days)" hint="Claims within this many days after expiry → Requires Review"><Input type="number" min={0} value={grace} onChange={(e) => setGrace(Number(e.target.value))} /></Field>
            <Field label="Order reminder after (days)"><Input type="number" min={1} value={rem} onChange={(e) => setRem(Number(e.target.value))} /></Field>
          </div>
          <Button className="mt-3" onClick={() => run(updateSettings, { warrantyGraceDays: grace, reminderDays: rem })}>Save rules</Button>
        </Panel>
        <Panel className="lg:col-span-2" title="Latest automation executions">
          <ul className="divide-y">{state.logs.slice(0, 8).map((l) => <li key={l.id} className="flex flex-wrap items-center gap-2 py-2 text-xs"><span className="w-28 text-muted-foreground">{fmtDateTime(l.at)}</span><span className="font-medium">{l.automation}</span><AutoPill v={l.status} /><span className="text-muted-foreground">{l.details}</span></li>)}
            {state.logs.length === 0 && <li className="py-2 text-xs text-muted-foreground">No executions yet.</li>}</ul>
        </Panel>
      </div>
    </>
  );
}
