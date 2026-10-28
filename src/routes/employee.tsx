import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bot, ChevronDown, ChevronLeft, ChevronRight, Circle, CheckCircle2, Clock, Download, Expand, FileJson, Loader2, LogOut, PanelLeftClose, PanelRightClose, Pause, Play, PlayCircle, RotateCcw, SkipForward, Shrink, XCircle, MinusCircle, Hand } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSim } from "@/lib/sim/store";
import { nowIso, toCsv } from "@/lib/sim/rules";
import { loadScenario, switchUser } from "@/lib/sim/actions";
import { SCENARIO_2 } from "@/lib/sim/seed";
import type { AppState, Result } from "@/lib/sim/types";
import {
  applyOutcome, buildReport, decideStepApproval, executeStep, isDone, newRun, nextPending, PROJECT_OVERVIEW, restoreRun, SCENARIOS, SPEED_MS, STEPS,
  TWO_MINUTE_DELAY_MS, TWO_MINUTE_INTRO_MS, type Activity, type PresetKey, type ScenarioKey, type SimRun, type Speed, type StepOutcome, type StepStatus,
} from "@/lib/sim/employee";
import { Confirm, download, Pill, Select } from "@/components/app/kit";
import { ReportView, StageView } from "@/components/app/employee-views";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/employee")({
  head: () => seo("AI Employee Simulation", "Watch an AI support employee run the full case workflow end to end using the app's real simulation services."),
  component: EmployeePage,
});

const RUN_KEY = "support-sim:employee:v1";

const STATUS_UI: Record<StepStatus, { icon: typeof Circle; cls: string; tone: "neutral" | "blue" | "green" | "amber" | "red" }> = {
  "Not Started": { icon: Circle, cls: "text-muted-foreground", tone: "neutral" },
  Running: { icon: Loader2, cls: "text-primary animate-spin", tone: "blue" },
  Completed: { icon: CheckCircle2, cls: "text-success", tone: "green" },
  "Waiting for Approval": { icon: Hand, cls: "text-warning", tone: "amber" },
  Failed: { icon: XCircle, cls: "text-destructive", tone: "red" },
  Skipped: { icon: MinusCircle, cls: "text-muted-foreground", tone: "neutral" },
};

/** Reset scenario records in place (no duplicates) and clear approvals created by earlier runs. */
function resetScenario(s: AppState): Result {
  s.approvals = s.approvals.filter((a) => a.caseId !== SCENARIO_2.caseId);
  const a = loadScenario(s, 1); if (!a.ok) return a;
  const b = loadScenario(s, 2); if (!b.ok) return b;
  if (s.currentUserId !== "u-admin") switchUser(s, "u-admin");
  return { ok: true, message: "Demo scenario restored" };
}

function EmployeePage() {
  const { state, runQuiet, run: runLoud } = useSim();
  const navigate = useNavigate();
  const [run, setRun] = useState<SimRun | null>(null);
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [restored, setRestored] = useState(false);
  const [full, setFull] = useState(false);
  const [showLeft, setShowLeft] = useState(true);
  const [showRight, setShowRight] = useState(true);
  const [overviewOpen, setOverviewOpen] = useState(true);
  const busyRef = useRef(false);
  const runRef = useRef<SimRun | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const consoleRef = useRef<HTMLDivElement>(null);

  // Load persisted progress after hydration.
  useEffect(() => {
    let r: SimRun | null = null;
    try { r = restoreRun(JSON.parse(localStorage.getItem(RUN_KEY) ?? "null")); } catch { r = null; }
    if (r && r.activity.length) setRestored(true);
    setRun(r ?? newRun());
  }, []);
  useEffect(() => { runRef.current = run; if (run) try { localStorage.setItem(RUN_KEY, JSON.stringify(run)); } catch { /* ignore */ } }, [run]);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);
  useEffect(() => { consoleRef.current?.scrollTo({ top: consoleRef.current.scrollHeight, behavior: "smooth" }); }, [run?.activity.length]);

  const clearTimer = () => { if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; } };

  const execute = useCallback((idx: number) => {
    const cur = runRef.current;
    if (!cur || busyRef.current) return; // duplicate-execution guard
    const id = STEPS[idx].id;
    if (isDone(cur.statuses[id]) || cur.statuses[id] === "Waiting for Approval") return;
    busyRef.current = true; setBusy(true);
    setRun((r) => r && { ...r, cursor: idx, selected: idx, startedAt: r.startedAt ?? new Date().toISOString(), statuses: { ...r.statuses, [id]: "Running" } });
    timerRef.current = setTimeout(() => {
      const latest = runRef.current!;
      const res = runQuiet(executeStep, id, { scenario: latest.scenario, resolutionNotes: latest.resolutionNotes, run: latest });
      const o: StepOutcome = res.data ?? { status: "Failed", level: "failure", view: STEPS[idx].view, narration: { what: STEPS[idx].title, why: "", data: [], rule: "", action: "", result: `FAILED — ${res.message}`, changes: [], next: "Retry" } };
      setRun((r) => r && applyOutcome(r, id, o, new Date().toISOString(), nowIso(state)));
      busyRef.current = false; setBusy(false);
      if (o.status === "Waiting for Approval") { setPlaying(false); setRun((r) => r && { ...r, mode: "guided" }); toast.warning("Human approval required. Please approve or reject this request to continue."); }
      if (o.status === "Failed") { setPlaying(false); toast.error(`${STEPS[idx].title} failed — see the activity console.`); }
    }, 350);
  }, [runQuiet, state]);

  const delay = run ? (run.preset === "two-minute" ? (nextPending(run) === 0 ? TWO_MINUTE_INTRO_MS : TWO_MINUTE_DELAY_MS) : SPEED_MS[run.speed]) : 2000;

  // Autonomous loop: one timer at a time, cleaned up on every change.
  useEffect(() => {
    if (!playing || busy || !run) return;
    const next = nextPending(run);
    if (next < 0) { setPlaying(false); return; }
    const st = run.statuses[STEPS[next].id];
    if (st === "Failed" || st === "Waiting for Approval") { setPlaying(false); return; }
    timerRef.current = setTimeout(() => execute(next), delay);
    return clearTimer;
  }, [playing, busy, run, delay, execute]);

  if (!run) return <div className="p-8 text-sm text-muted-foreground">Loading simulation…</div>;

  const started = run.activity.length > 0 || !!run.startedAt;
  const doneCount = STEPS.filter((s) => isDone(run.statuses[s.id])).length;
  const pct = Math.round((doneCount / STEPS.length) * 100);
  const next = nextPending(run);
  const selStep = STEPS[run.selected];
  const selOutcome = run.outcomes[selStep.id];
  const waiting = run.statuses.approval === "Waiting for Approval";
  const finished = !!run.finishedAt;
  const report = buildReport(state, run);

  const update = (p: Partial<SimRun>) => setRun((r) => r && { ...r, ...p });
  const start = (autonomous: boolean) => {
    if (playing || busyRef.current) return;
    setOverviewOpen(false);
    update({ mode: autonomous ? "autonomous" : "guided" });
    if (autonomous) setPlaying(true); else if (next >= 0) execute(next);
  };
  const pause = () => { clearTimer(); setPlaying(false); };
  const resume = () => { if (!waiting) { update({ mode: "autonomous" }); setPlaying(true); } };
  const nextStep = () => { if (playing) return; if (next >= 0) execute(next); };
  const runCurrent = () => { if (playing) return; const st = run.statuses[selStep.id]; if (st === "Not Started" || st === "Failed") execute(run.selected); };
  const prevStep = () => update({ selected: Math.max(0, run.selected - 1) });
  const fwdView = () => update({ selected: Math.min(STEPS.length - 1, run.selected + 1) });
  const reset = (preset: PresetKey = run.preset, scenario: ScenarioKey = run.scenario) => {
    pause(); busyRef.current = false; setBusy(false);
    runQuiet(resetScenario);
    const r = newRun(scenario, preset); r.speed = run.speed;
    setRun(r); setRestored(false); setOverviewOpen(true);
    toast.success("Simulation reset — scenario records restored without duplicates.");
  };
  const decide = (approve: boolean, comments: string) => {
    const id = run.outcomes.approval?.payload?.approvalId as string | undefined;
    if (!id) return;
    const res = runLoud(decideStepApproval, id, approve, comments);
    if (res.ok && res.data) setRun((r) => r && applyOutcome(r, "approval", res.data!, new Date().toISOString(), nowIso(state)));
  };
  const exit = () => { pause(); setFull(false); navigate({ to: "/" }); };
  const exportJson = () => download("ai-employee-report.json", JSON.stringify({ report, activity: run.activity }, null, 2), "application/json");
  const exportCsv = () => download("ai-employee-report.csv", toCsv(run.activity.map((a) => ({ step: a.n, stage: a.title, status: a.status, result: a.narration.result, action: a.narration.action, changes: a.narration.changes.join(" | "), at: a.at, simAt: a.simAt }))));

  const reportNode = <ReportView report={report} actions={<>
    <Button size="sm" variant="outline" onClick={() => { setShowRight(true); consoleRef.current?.scrollTo({ top: 0 }); }}>View Full Execution Log</Button>
    <Button size="sm" variant="outline" asChild><Link to="/cases/$id" params={{ id: "case-1001" }}>Open Resolved Case</Link></Button>
    <Button size="sm" variant="outline" asChild><Link to="/">Open Dashboard</Link></Button>
    <Button size="sm" variant="outline" onClick={exportJson}><FileJson className="h-4 w-4" /> Export JSON</Button>
    <Button size="sm" variant="outline" onClick={exportCsv}><Download className="h-4 w-4" /> Export CSV</Button>
    <Button size="sm" onClick={() => reset()}><RotateCcw className="h-4 w-4" /> Restart Simulation</Button>
  </>} />;

  const cols = cn("grid gap-4", showLeft && showRight ? "lg:grid-cols-[250px_minmax(0,1fr)_380px]" : showLeft ? "lg:grid-cols-[250px_minmax(0,1fr)]" : showRight ? "lg:grid-cols-[minmax(0,1fr)_380px]" : "");

  return (
    <div className={cn(full && "fixed inset-0 z-50 overflow-auto bg-background p-4")}>
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight"><Bot className="h-5 w-5 text-primary" /> AI Employee Simulation</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Welcome to the AI Employee Simulation. Watch how our AI-powered customer support system manages customer inquiries, analyzes cases, routes requests, generates AI-assisted responses, processes approvals, resolves cases, and updates operational reports.</p>
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => setShowLeft(!showLeft)} aria-label="Toggle workflow panel"><PanelLeftClose className="h-4 w-4" /></Button>
          <Button size="sm" variant="ghost" onClick={() => setShowRight(!showRight)} aria-label="Toggle activity console"><PanelRightClose className="h-4 w-4" /></Button>
          <Button size="sm" variant="ghost" onClick={() => setFull(!full)} aria-label="Presentation mode">{full ? <Shrink className="h-4 w-4" /> : <Expand className="h-4 w-4" />}</Button>
        </div>
      </div>

      {restored && <div className="mb-3 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs">Restored your previous run at step {Math.min(next < 0 ? STEPS.length : next + 1, STEPS.length)} of {STEPS.length}. It is paused — completed actions will not be repeated.</div>}

      {/* Info + setup */}
      <div className="mb-4 rounded-lg border bg-card p-4 shadow-card">
        <div className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 xl:grid-cols-6">
          <div><div className="text-[11px] uppercase text-muted-foreground">Project</div>AI-Powered Customer Support &amp; Service Automation</div>
          <div className="xl:col-span-2"><div className="text-[11px] uppercase text-muted-foreground">Objective</div>Show how cases are captured, routed, AI-assisted, approved, resolved and reported.</div>
          <div><div className="text-[11px] uppercase text-muted-foreground">Simulation mode</div><Pill t="green">Enabled · local</Pill></div>
          <div><div className="text-[11px] uppercase text-muted-foreground">Est. duration</div>{run.preset === "two-minute" ? "≈ 2 minutes" : run.scenario === "full" ? "4–6 min (guided)" : "3–5 min (guided)"}</div>
          <div><div className="text-[11px] uppercase text-muted-foreground">Stages</div>{STEPS.length} workflow stages</div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
          <Select ariaLabel="Preset" className="w-52" value={run.preset} onChange={(v) => { if (!started) setRun(newRun(run.scenario, v as PresetKey)); else toast.info("Reset the simulation to change the preset."); }} options={[{ value: "full", label: "Full workflow" }, { value: "two-minute", label: "Two-minute presentation" }]} />
          <Select ariaLabel="Scenario" className="w-72" value={run.scenario} onChange={(v) => { if (!started && run.preset === "full") setRun({ ...newRun(v as ScenarioKey, "full"), speed: run.speed }); else toast.info(run.preset === "two-minute" ? "The two-minute preset uses the primary scenario." : "Reset the simulation to change the scenario."); }} options={[{ value: "primary", label: "Primary: Defective headphones" }, { value: "full", label: "Full: + refund approval" }]} />
          {run.preset === "full" && <Select ariaLabel="Speed" className="w-40" value={run.speed} onChange={(v) => update({ speed: v as Speed })} options={[{ value: "slow", label: "Slow · 5s" }, { value: "normal", label: "Normal · 2s" }, { value: "fast", label: "Fast · 0.5s" }]} />}
          <Pill t={run.mode === "autonomous" ? "blue" : "neutral"}>{run.mode === "autonomous" ? "Autonomous Demo Mode" : "Guided Mode"}</Pill>
          <span className="text-xs text-muted-foreground">{SCENARIOS[run.scenario].description}</span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">All operations are simulated. No real emails, refunds or external Salesforce actions are performed.{run.preset === "two-minute" && " The refund approval stage is available in the full demonstration."}</p>
      </div>

      {/* Control bar */}
      <div className="sticky top-0 z-10 mb-4 flex flex-wrap items-center gap-2 rounded-lg border bg-card/95 p-2 shadow-card backdrop-blur">
        {!started ? <>
          <Button size="sm" onClick={() => start(run.preset === "two-minute")}><PlayCircle className="h-4 w-4" /> Start Simulation</Button>
          {run.preset === "full" && <Button size="sm" variant="outline" onClick={() => start(true)}><Play className="h-4 w-4" /> Run Full Workflow</Button>}
        </> : <>
          {playing ? <Button size="sm" variant="outline" onClick={pause}><Pause className="h-4 w-4" /> Pause</Button>
            : <Button size="sm" variant="outline" onClick={resume} disabled={finished || waiting || next < 0}><Play className="h-4 w-4" /> Resume</Button>}
          <Button size="sm" variant="outline" onClick={prevStep} disabled={run.selected === 0}><ChevronLeft className="h-4 w-4" /> Previous Step</Button>
          <Button size="sm" onClick={nextStep} disabled={playing || busy || next < 0 || waiting}><SkipForward className="h-4 w-4" /> Next Step</Button>
          <Button size="sm" variant="outline" onClick={runCurrent} disabled={playing || busy || !["Not Started", "Failed"].includes(run.statuses[selStep.id])}>Run Current Step</Button>
          <Button size="sm" variant="outline" onClick={() => { if (!playing) { update({ mode: "autonomous" }); setPlaying(true); } }} disabled={playing || busy || waiting || next < 0}><Play className="h-4 w-4" /> Run Full Workflow</Button>
        </>}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Step {Math.min(run.selected + 1, STEPS.length)} of {STEPS.length}</span>
          <Confirm trigger={<Button size="sm" variant="ghost"><RotateCcw className="h-4 w-4" /> Reset</Button>} title="Reset the simulation?" description="Clears simulation progress and restores the scenario records (CS-1001, CS-1004 and related) in place. Other data is untouched." onConfirm={() => reset()} />
          <Button size="sm" variant="ghost" onClick={exit}><LogOut className="h-4 w-4" /> Exit Demo</Button>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} /></div>
      </div>

      {/* Project overview */}
      <div className="mb-4 rounded-lg border bg-card shadow-card">
        <button className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm font-semibold" onClick={() => setOverviewOpen(!overviewOpen)} aria-expanded={overviewOpen}>
          Project Overview — what you are about to see <ChevronDown className={cn("h-4 w-4 transition-transform", overviewOpen && "rotate-180")} />
        </button>
        {overviewOpen && <ol className="grid gap-3 border-t p-4 sm:grid-cols-2 xl:grid-cols-3">{PROJECT_OVERVIEW.map((p, i) => <li key={p.title} className="text-sm"><span className="font-medium">{i + 1}. {p.title}.</span> <span className="text-muted-foreground">{p.body}</span></li>)}</ol>}
      </div>

      <div className={cols}>
        {showLeft && (
          <aside className="rounded-lg border bg-card p-2 shadow-card lg:sticky lg:top-20 lg:self-start" aria-label="Workflow stages">
            <div className="px-2 pb-2 pt-1 text-xs text-muted-foreground">{doneCount}/{STEPS.length} complete · {pct}%</div>
            <ol>{STEPS.map((s, i) => { const st = run.statuses[s.id]; const U = STATUS_UI[st]; return (
              <li key={s.id}><button onClick={() => update({ selected: i })} className={cn("flex w-full items-start gap-2.5 rounded-md px-2 py-2 text-left text-sm", i === run.selected ? "bg-accent text-accent-foreground" : "hover:bg-muted")}>
                <U.icon className={cn("mt-0.5 h-4 w-4 shrink-0", U.cls)} />
                <span className="min-w-0 flex-1"><span className="block truncate font-medium">{i + 1}. {s.title}</span><span className="text-[11px] text-muted-foreground">{st}{run.preset === "two-minute" && !s.inTwoMinute ? " · brief" : ""}</span></span>
              </button></li>); })}</ol>
          </aside>
        )}

        <main className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold">Stage {run.selected + 1}: {selStep.title}</h2>
            <div className="flex items-center gap-2"><Pill t={STATUS_UI[run.statuses[selStep.id]].tone}>{run.statuses[selStep.id]}</Pill>
              <Button size="sm" variant="ghost" onClick={fwdView} disabled={run.selected >= STEPS.length - 1} aria-label="View next stage"><ChevronRight className="h-4 w-4" /></Button></div>
          </div>
          {selOutcome && <div className={cn("mb-3 rounded-md border px-3 py-2 text-sm", selOutcome.level === "failure" ? "border-destructive/40 bg-destructive/5" : selOutcome.level === "warning" ? "border-warning/40 bg-warning/10" : "border-success/30 bg-success/5")}><span className="font-medium">Result: </span>{selOutcome.narration.result}</div>}
          <StageView view={selOutcome?.view ?? selStep.view} stepId={selStep.id} run={run} spot={selOutcome?.spot} payload={selOutcome?.payload} executed={!!selOutcome} waiting={waiting && selStep.id === "approval"} onDecide={decide} setNotes={(v) => update({ resolutionNotes: v })} report={reportNode} />
        </main>

        {showRight && (
          <aside className="flex max-h-[80vh] flex-col rounded-lg border bg-card shadow-card lg:sticky lg:top-20 lg:self-start" aria-label="AI Employee activity console">
            <div className="flex items-center gap-2 border-b px-4 py-2.5 text-sm font-semibold"><Bot className="h-4 w-4 text-primary" /> AI Employee activity
              {playing && <span className="ml-auto flex items-center gap-1 text-xs font-normal text-muted-foreground"><Clock className="h-3 w-3" /> next in {delay / 1000}s</span>}</div>
            <div ref={consoleRef} className="flex-1 space-y-3 overflow-y-auto p-3">
              {run.activity.length === 0 ? <p className="p-2 text-sm text-muted-foreground">No actions yet. Press Start Simulation — each action will be explained here.</p>
                : run.activity.map((a) => <ActivityItem key={a.n} a={a} onSelect={() => update({ selected: STEPS.findIndex((s) => s.id === a.stepId) })} />)}
              {busy && <div className="flex items-center gap-2 rounded-md border p-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Working on {STEPS[run.cursor].title}…</div>}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

function ActivityItem({ a, onSelect }: { a: Activity; onSelect: () => void }) {
  const [open, setOpen] = useState(a.status !== "Completed" || false);
  const n = a.narration;
  const tone = a.level === "failure" ? "red" : a.level === "warning" ? "amber" : "green";
  const H = ({ children }: { children: string }) => <div className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{children}</div>;
  return (
    <article className="rounded-md border p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <button onClick={onSelect} className="text-left font-semibold hover:underline">Action {String(a.n).padStart(2, "0")}: {a.title}</button>
        <Pill t={tone}>{a.status}</Pill>
      </div>
      <div className="text-[11px] text-muted-foreground">{new Date(a.at).toLocaleTimeString()} · sim clock {new Date(a.simAt).toLocaleString()}</div>
      <H>What I am doing</H><p>{n.what}</p>
      <H>Result</H><p className={a.level === "failure" ? "text-destructive" : ""}>{n.result}</p>
      <button onClick={() => setOpen(!open)} className="mt-2 text-xs font-medium text-primary hover:underline">{open ? "Hide details" : "Show details"}</button>
      {open && <div>
        <H>Why this matters</H><p className="text-muted-foreground">{n.why}</p>
        <H>Data I am using</H>
        <dl className="mt-1 space-y-0.5 text-xs">{n.data.map(([k, v]) => <div key={k} className="grid grid-cols-[110px_1fr] gap-2"><dt className="text-muted-foreground">{k}</dt><dd className="break-words">{v}</dd></div>)}</dl>
        <H>Business rule</H><p className="text-xs">{n.rule}</p>
        <H>Action executed</H><code className="text-xs">{n.action}</code>
        <H>Record changes</H><ul className="list-disc pl-4 text-xs">{n.changes.map((c, i) => <li key={i}>{c}</li>)}</ul>
        <H>Next step</H><p className="text-xs">{n.next}</p>
      </div>}
    </article>
  );
}
