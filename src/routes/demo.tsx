import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, RotateCcw, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSim } from "@/lib/sim/store";
import { buildSeed } from "@/lib/sim/seed";
import { generateAI, loadScenario, runCaseAssignment, switchUser } from "@/lib/sim/actions";
import { caseSla } from "@/lib/sim/rules";
import { Confirm, PageHeader, Panel, Pill, StatusBadge } from "@/components/app/kit";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/demo")({
  head: () => seo("Demo Mode", "Guided two-minute presentation of the end-to-end support workflow."),
  component: Demo,
});

const STEPS = [
  { title: "Dashboard Overview", to: "/", say: "Open the Overview. Every KPI and chart is calculated from stored records — point out open cases, SLA breaches and CSAT." },
  { title: "Customer and Case Details", to: "/cases/case-1001", say: "Open CS-1001: Priya Sharma reports AuraSound Pro headphones that won't pair. Show customer, order ORD-50211 and product context." },
  { title: "Automated Case Assignment", to: "/cases/case-1001", say: "Click Auto-assign (or use the button here). The Case Assignment Flow routes Product Defect → Technical Support and assigns the least-loaded agent." },
  { title: "AI Summary and Suggested Response", to: "/assistant", say: "Generate a summary and a response. Output uses the real case data, is clearly labelled simulated, and must be approved before applying." },
  { title: "Knowledge Base Recommendation", to: "/knowledge#kb-05", say: "Open “Resolving headphone pairing issues” — the article the AI suggested from the case keywords." },
  { title: "Approval or Escalation Workflow", to: "/approvals", say: "Load scenario 2: delayed tablet order CS-1004 is escalated and refund request for CS-1005 is pending. Switch to Meera Kapoor (Approver) and approve or reject." },
  { title: "Case Resolution", to: "/cases/case-1001", say: "Set status, add resolution notes and Resolve. The Resolution Flow timestamps it and schedules the simulated satisfaction follow-up. Then record a rating." },
  { title: "Updated Reports and Audit History", to: "/reports", say: "Show reports and the audit log — every step you just performed is recorded and the metrics have updated." },
] as const;

function Demo() {
  const { state, run, replace } = useSim();
  const [step, setStep] = useState(0);
  const s = STEPS[step];
  const c1 = state.cases.find((c) => c.id === "case-1001");
  const helpers: Record<number, ReactNode> = {
    1: <Button size="sm" variant="outline" onClick={() => run(loadScenario, 1)}>Load Demo Scenario (no duplicates)</Button>,
    2: <Button size="sm" variant="outline" onClick={() => run(runCaseAssignment, "case-1001")}>Run assignment on CS-1001</Button>,
    3: <Button size="sm" variant="outline" onClick={() => run(generateAI, "case-1001", "summary")}>Generate CS-1001 summary</Button>,
    5: <><Button size="sm" variant="outline" onClick={() => run(loadScenario, 2)}>Load scenario 2</Button><Button size="sm" variant="outline" onClick={() => run(switchUser, "u-appr")}>Act as Approver</Button><Button size="sm" variant="ghost" onClick={() => run(switchUser, "u-admin")}>Back to Admin</Button></>,
  };
  return (
    <>
      <PageHeader title="Demo Mode" description="Scenario: “Defective Wireless Headphones — Customer Support Journey”. Steps are guidance only — jump to any step."
        actions={<Confirm trigger={<Button variant="outline"><RotateCcw className="h-4 w-4" /> Reset Demo</Button>} title="Reset the demo?" description="Restores all seeded records so the scenario can be presented again." onConfirm={() => { replace(buildSeed(), "Demo reset — scenario preloaded"); setStep(0); }} />} />
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Panel bodyClass="p-2">
          <ol>{STEPS.map((x, i) => (
            <li key={x.title}><button onClick={() => setStep(i)} className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm ${i === step ? "bg-accent font-medium text-accent-foreground" : "hover:bg-muted"}`}>
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${i < step ? "bg-success text-success-foreground" : i === step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{i < step ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}</span>{x.title}</button></li>))}
          </ol>
        </Panel>
        <Panel title={`Step ${step + 1} of ${STEPS.length}: ${s.title}`}>
          <p className="text-base leading-relaxed">{s.say}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button asChild><a href={s.to}>Open this screen</a></Button>
            {helpers[step]}
          </div>
          {c1 && <div className="mt-6 flex flex-wrap items-center gap-2 rounded-md border p-3 text-xs"><span className="font-semibold">CS-1001 live state:</span><StatusBadge status={c1.status} /><Pill>{state.queues.find((q) => q.id === c1.queueId)?.name ?? "No queue"}</Pill><Pill>{state.users.find((u) => u.id === c1.agentId)?.name ?? "Unassigned"}</Pill><Pill>SLA {caseSla(state, c1).state}</Pill>{c1.aiSummary && <Pill t="violet">AI summary applied</Pill>}{c1.rating && <Pill t="green">Rated {c1.rating}/5</Pill>}</div>}
          <div className="mt-8 flex justify-between border-t pt-4">
            <Button variant="outline" disabled={step === 0} onClick={() => setStep(step - 1)}><ArrowLeft className="h-4 w-4" /> Previous</Button>
            {step < STEPS.length - 1 ? <Button onClick={() => setStep(step + 1)}>Next Demo Step <ArrowRight className="h-4 w-4" /></Button> : <Button asChild variant="outline"><Link to="/audit">Finish at audit log</Link></Button>}
          </div>
        </Panel>
      </div>
    </>
  );
}
