import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Pencil, Plus, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useSim } from "@/lib/sim/store";
import { saveTemplate } from "@/lib/sim/actions";
import { MOCK_PROVIDER, renderTemplate, runTemplate } from "@/lib/sim/ai";
import type { PromptTemplate, TemplateKind } from "@/lib/sim/types";
import { Empty, Field, PageHeader, Panel, Pill, Select } from "@/components/app/kit";
import { SimpleDialog } from "@/components/app/forms";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/prompts")({
  head: () => seo("Prompt Templates", "Prompt Builder simulation: create, preview and run templates against case data."),
  component: Prompts,
});

type TInput = Omit<PromptTemplate, "id">;

function Prompts() {
  const { state, run } = useSim();
  const [sel, setSel] = useState(state.templates[0]?.id ?? "");
  const [caseId, setCaseId] = useState("case-1001");
  const [out, setOut] = useState("");
  const [dlg, setDlg] = useState<{ id?: string; f: TInput } | null>(null);
  const t = state.templates.find((x) => x.id === sel);
  const c = state.cases.find((x) => x.id === caseId);
  return (
    <>
      <PageHeader title="Prompt Templates" description={`Prompt Builder simulation. Merge fields like {{case.subject}} resolve from local records. Provider: ${MOCK_PROVIDER}.`}
        actions={<Button onClick={() => setDlg({ f: { name: "", recordType: "Case", kind: "custom", body: "", active: true } })}><Plus className="h-4 w-4" /> New template</Button>} />
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Panel bodyClass="p-0">
          <ul>{state.templates.map((x) => (
            <li key={x.id} className={`flex items-center justify-between gap-2 border-b px-4 py-3 ${sel === x.id ? "bg-accent" : ""}`}>
              <button className="min-w-0 flex-1 text-left" onClick={() => { setSel(x.id); setOut(""); }}><div className="truncate text-sm font-medium">{x.name}</div><div className="text-xs text-muted-foreground">{x.recordType} · {x.kind}</div></button>
              <Switch aria-label="Active" checked={x.active} onCheckedChange={(v) => { const { id, ...f } = x; run(saveTemplate, { ...f, active: v }, id); }} />
            </li>))}</ul>
        </Panel>
        {t ? (
          <Panel title={<span className="flex items-center gap-2">{t.name} {t.active ? <Pill t="green">Active</Pill> : <Pill>Inactive</Pill>}</span>}
            actions={<Button size="sm" variant="outline" onClick={() => { const { id, ...f } = t; setDlg({ id, f }); }}><Pencil className="h-4 w-4" /> Edit</Button>}>
            <Field label="Template body"><pre className="whitespace-pre-wrap rounded-md bg-muted p-3 font-mono text-xs">{t.body}</pre></Field>
            <div className="mt-4 flex flex-wrap items-end gap-2">
              <div className="w-80"><Field label="Preview with case"><Select value={caseId} onChange={(v) => { setCaseId(v); setOut(""); }} options={state.cases.map((x) => ({ value: x.id, label: `${x.number} · ${x.subject}` }))} /></Field></div>
              <Button disabled={!t.active || !c} onClick={() => c && setOut(runTemplate(state, t, c))}><Play className="h-4 w-4" /> Generate simulated output</Button>
            </div>
            {!t.active && <p className="mt-2 text-xs text-warning-foreground">Activate the template to generate output.</p>}
            {c && <div className="mt-4"><div className="mb-1 text-xs font-semibold">Resolved prompt</div><pre className="whitespace-pre-wrap rounded-md border p-3 text-xs">{renderTemplate(state, t, c)}</pre></div>}
            {out && <div className="mt-4"><div className="mb-1 flex items-center gap-2 text-xs font-semibold text-ai">Simulated output <Pill t="violet">Mock — no LLM called</Pill></div><pre className="whitespace-pre-wrap rounded-md border border-ai/20 bg-ai/5 p-3 font-sans text-sm">{out}</pre></div>}
          </Panel>
        ) : <Panel><Empty title="No template selected" /></Panel>}
      </div>
      {dlg && <SimpleDialog open onOpenChange={(o) => !o && setDlg(null)} title={dlg.id ? "Edit template" : "New template"} onSubmit={() => { if (run(saveTemplate, dlg.f, dlg.id).ok) setDlg(null); }}>
        <Field label="Name" required><Input value={dlg.f.name} onChange={(e) => setDlg({ ...dlg, f: { ...dlg.f, name: e.target.value } })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Record type"><Select value={dlg.f.recordType} onChange={(v) => setDlg({ ...dlg, f: { ...dlg.f, recordType: v as TInput["recordType"] } })} options={["Case", "Warranty Claim"]} /></Field>
          <Field label="Output type"><Select value={dlg.f.kind} onChange={(v) => setDlg({ ...dlg, f: { ...dlg.f, kind: v as TemplateKind } })} options={["summary", "response", "warranty", "escalation", "custom"]} /></Field>
        </div>
        <Field label="Prompt body" required hint="Merge fields: {{case.number}}, {{case.subject}}, {{case.status}}, {{case.priority}}, {{customer.name}}, {{order.number}}, {{order.tracking}}, {{product.name}}"><Textarea rows={6} value={dlg.f.body} onChange={(e) => setDlg({ ...dlg, f: { ...dlg.f, body: e.target.value } })} /></Field>
      </SimpleDialog>}
    </>
  );
}
