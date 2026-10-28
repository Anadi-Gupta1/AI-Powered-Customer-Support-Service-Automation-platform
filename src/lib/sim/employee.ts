/**
 * AI Employee Simulation — workflow engine.
 * Controller (UI) → executeStep (atomic, with rollback) → step.run → real business actions in ./actions
 * → store (AppState) → verification inside each step → outcome + narration → UI.
 * Steps are written to be idempotent against stored state, so a refreshed or repeated run never
 * duplicates records or re-applies an approval decision.
 */
import type { AppState, Approval, Category, Priority, Result, SupportCase } from "./types";
import { can, caseSla, countBy, currentUser, fmtDuration, isOpen, nowIso, routeQueue } from "./rules";
import { applyAI, audit, caseResolutionHours, createCase, decideApproval, escalate, addNote, generateAI, loadScenario, requestApproval, runCaseAssignment, setStatus, switchUser, updateCase } from "./actions";
import { MOCK_PROVIDER, searchKnowledge } from "./ai";
import { dashboardMetrics } from "./metrics";
import { SCENARIO_1, SCENARIO_2 } from "./seed";

export type StepStatus = "Not Started" | "Running" | "Completed" | "Waiting for Approval" | "Failed" | "Skipped";
export type ScenarioKey = "primary" | "full";
export type PresetKey = "full" | "two-minute";
export type Speed = "slow" | "normal" | "fast";
export type ViewKey = "overview" | "customer" | "case" | "queue" | "assistant" | "knowledge" | "sla" | "approval" | "resolve" | "verify" | "dashboard" | "report";
export type StepId = "init" | "understand" | "classify" | "assign" | "summary" | "knowledge" | "sla" | "approval" | "resolve" | "verify" | "reports" | "final";

export const SPEED_MS: Record<Speed, number> = { slow: 5000, normal: 2000, fast: 500 };
export const TWO_MINUTE_DELAY_MS = 8000;
export const TWO_MINUTE_INTRO_MS = 10000;
export const DEFAULT_RESOLUTION_NOTES = "Customer provided with Bluetooth troubleshooting instructions. Resolution outcome recorded for demonstration.";

export const SCENARIOS: Record<ScenarioKey, { name: string; description: string }> = {
  primary: { name: "Defective Wireless Headphones — Customer Support Journey", description: "Priya Sharma's AuraSound Pro headphones will not connect over Bluetooth (case CS-1001). Approval stage is skipped." },
  full: { name: "Headphones Journey + Delayed Order Refund Approval", description: "Everything in the primary journey, plus a refund approval for the delayed tablet order CS-1004 that a human approver must decide." },
};

export interface Narration {
  what: string; why: string; data: [string, string][]; rule: string; action: string; result: string; changes: string[]; next: string;
}
export interface StepOutcome {
  status: Exclude<StepStatus, "Not Started" | "Running">;
  level: "success" | "warning" | "failure";
  narration: Narration;
  view: ViewKey;
  spot?: string;
  payload?: Record<string, unknown>;
}
export interface Activity extends StepOutcome { n: number; stepId: StepId; title: string; at: string; simAt: string }
export interface StoredOutcome extends StepOutcome { at: string; simAt: string; attempt: number }
export interface SimRun {
  version: 1; scenario: ScenarioKey; preset: PresetKey; mode: "guided" | "autonomous"; speed: Speed;
  statuses: Record<StepId, StepStatus>; outcomes: Partial<Record<StepId, StoredOutcome>>; activity: Activity[];
  cursor: number; selected: number; startedAt?: string; finishedAt?: string; resolutionNotes: string;
}
export interface StepCtx { scenario: ScenarioKey; resolutionNotes: string; run: Pick<SimRun, "statuses" | "outcomes" | "activity" | "startedAt" | "scenario"> }
export interface StepDef { id: StepId; title: string; summary: string; view: ViewKey; prerequisites: StepId[]; inTwoMinute: boolean; run: (s: AppState, ctx: StepCtx) => StepOutcome }

const CASE_ID = SCENARIO_1.caseId;
const findCase = (s: AppState, id = CASE_ID) => s.cases.find((c) => c.id === id);
const userName = (s: AppState, id?: string) => s.users.find((u) => u.id === id)?.name ?? "Unassigned";
const queueName = (s: AppState, id?: string) => s.queues.find((q) => q.id === id)?.name ?? "No queue";

function out(status: StepOutcome["status"], view: ViewKey, n: Narration, extra: Partial<StepOutcome> = {}): StepOutcome {
  const level = status === "Failed" ? "failure" : status === "Completed" ? "success" : "warning";
  return { status, level, view, narration: n, ...extra };
}
function failed(view: ViewKey, what: string, why: string, action: string, error: string, data: [string, string][] = []): StepOutcome {
  return out("Failed", view, { what, why, data, rule: "A step is only marked successful when the underlying record change is confirmed.", action, result: `FAILED — ${error}`, changes: ["No changes were kept (step rolled back)."], next: "Review the error, then use Run Current Step to retry." });
}

export function metricsSnapshot(s: AppState) {
  const m = dashboardMetrics(s, null);
  return { total: m.total, open: m.open, resolved: m.resolved, escalated: m.escalated, breaches: m.breaches, avgRes: m.avgRes == null ? null : +m.avgRes.toFixed(2), csat: m.csat == null ? null : +m.csat.toFixed(2), byStatus: Object.fromEntries(countBy(m.cases, (c) => c.status).map((x) => [x.name, x.value])) as Record<string, number> };
}
export type Snapshot = ReturnType<typeof metricsSnapshot>;

/* ---------- Deterministic rule-based classification ---------- */
const CAT_RULES: { cat: Category; kw: string[] }[] = [
  { cat: "Refund", kw: ["refund", "money back"] },
  { cat: "Shipping Delay", kw: ["delayed", "late", "delay"] },
  { cat: "Order Tracking", kw: ["tracking", "where is my"] },
  { cat: "Warranty", kw: ["warranty"] },
  { cat: "Product Defect", kw: ["will not", "won't", "stopped", "broken", "defect", "faulty", "crackl", "cuts out", "pairing"] },
  { cat: "Technical", kw: ["bluetooth", "firmware", "sensor", "app", "software"] },
];
const PRIO_RULES: { p: Priority; kw: string[]; label: string }[] = [
  { p: "Critical", kw: ["urgent", "urgently", "office", "onboarding", "safety", "fire"], label: "Business impact or urgency language → Critical" },
  { p: "High", kw: ["will not", "won't", "stopped", "never", "not working", "dead"], label: "Device completely unusable → High" },
  { p: "Medium", kw: ["intermittent", "cuts out", "sometimes", "crackl", "inaccurate"], label: "Partial malfunction → Medium" },
];
export function classifyCase(c: Pick<SupportCase, "subject" | "description">) {
  const t = `${c.subject} ${c.description}`.toLowerCase();
  const cr = CAT_RULES.find((r) => r.kw.some((k) => t.includes(k)));
  const pr = PRIO_RULES.find((r) => r.kw.some((k) => t.includes(k)));
  const category: Category = cr?.cat ?? "General";
  const priority: Priority = pr?.p ?? "Low";
  return {
    category, priority, queueId: routeQueue(category),
    categoryKeywords: cr ? cr.kw.filter((k) => t.includes(k)) : [],
    priorityKeywords: pr ? pr.kw.filter((k) => t.includes(k)) : [],
    priorityRule: pr?.label ?? "No severity keywords → Low",
  };
}

/* ---------- Steps ---------- */
export const STEPS: StepDef[] = [
  {
    id: "init", title: "Initialize the simulation", summary: "Verify demo data, user permissions and load the scenario without duplicates.", view: "overview", prerequisites: [], inTwoMinute: true,
    run(s, ctx) {
      const changes: string[] = [];
      const prevUser = currentUser(s);
      if (!can(s, "case.assign") || !can(s, "case.edit")) {
        const r = switchUser(s, "u-admin");
        if (!r.ok) return failed("overview", "Switch to an authorised demo user", "The workflow needs case edit and assign permissions.", "switchUser()", r.message);
        changes.push(`Acting user: ${prevUser.name} (${prevUser.role}) → Alex Morgan (Administrator)`);
      }
      const missingBefore = [
        !s.customers.some((c) => c.id === SCENARIO_1.customerId) && "Customer Priya Sharma",
        !s.orders.some((o) => o.id === SCENARIO_1.orderId) && "Order ORD-50211",
        !s.products.some((p) => p.id === SCENARIO_1.productId) && "Product AuraSound Pro",
        !findCase(s) && "Case CS-1001",
      ].filter(Boolean) as string[];
      const casesBefore = s.cases.length;
      const r1 = loadScenario(s, 1);
      if (!r1.ok) return failed("overview", "Load the demo scenario", "Records are required for the journey.", "loadScenario(1)", r1.message);
      changes.push("Scenario records refreshed in place (upsert by ID — existing records are replaced, never duplicated).");
      if (ctx.scenario === "full") {
        const removed = s.approvals.filter((a) => a.caseId === SCENARIO_2.caseId).length;
        s.approvals = s.approvals.filter((a) => a.caseId !== SCENARIO_2.caseId);
        const r2 = loadScenario(s, 2);
        if (!r2.ok) return failed("overview", "Load the secondary scenario", "The refund stage needs the delayed order case.", "loadScenario(2)", r2.message);
        changes.push(`Secondary scenario CS-1004 refreshed${removed ? `; ${removed} approval(s) from a previous run cleared` : ""}.`);
      }
      const c = findCase(s);
      const missingAfter = [!c && "Case CS-1001", !s.queues.some((q) => q.id === "q-tech") && "Technical Support queue"].filter(Boolean) as string[];
      if (missingAfter.length) return failed("overview", "Verify prerequisites", "All records must exist.", "loadScenario()", `Missing: ${missingAfter.join(", ")}`);
      audit(s, "AI Employee simulation started", "Case", CASE_ID, "Success", SCENARIOS[ctx.scenario].name);
      const me = currentUser(s);
      return out("Completed", "overview", {
        what: "I'm preparing my workspace: confirming simulation mode, checking that the demo records exist, and loading the scenario.",
        why: "Every later step works on real stored records. If something is missing the results would be meaningless, so I check first.",
        data: [
          ["Simulation mode", "Enabled — local browser simulation, no external systems"],
          ["Scenario", SCENARIOS[ctx.scenario].name],
          ["Acting user", `${me.name} (${me.role})`],
          ["Customers / Products / Orders", `${s.customers.length} / ${s.products.length} / ${s.orders.length}`],
          ["Cases / Queues", `${s.cases.length} / ${s.queues.length}`],
          ["Missing before load", missingBefore.length ? missingBefore.join(", ") : "None"],
        ],
        rule: "Scenario loading is idempotent: records are matched by stable ID and replaced, so repeated runs never create duplicates.",
        action: `loadScenario(1)${ctx.scenario === "full" ? " + loadScenario(2)" : ""}${changes[0]?.startsWith("Acting") ? " + switchUser(Administrator)" : ""}`,
        result: `Scenario ready. Case count ${casesBefore} → ${s.cases.length}. CS-1001 is ${c!.status}.`,
        changes,
        next: "Open Priya Sharma's customer profile and gather context for her request.",
      }, { payload: { baseline: metricsSnapshot(s), startedSim: nowIso(s) } });
    },
  },
  {
    id: "understand", title: "Understand the business request", summary: "Open the customer, order, product and case records.", view: "customer", prerequisites: ["init"], inTwoMinute: true,
    run(s) {
      let c = findCase(s);
      const changes: string[] = [];
      if (!c) {
        const r = createCase(s, { subject: "Wireless headphones will not connect over Bluetooth", description: "My AuraSound Pro headphones stopped pairing with my phone. The LED blinks red.", customerId: SCENARIO_1.customerId, origin: "Email", category: "Product Defect", priority: "High", orderId: SCENARIO_1.orderId, productId: SCENARIO_1.productId });
        if (!r.ok || !r.data) return failed("customer", "Create the support case", "No case existed for the complaint.", "createCase()", r.message);
        c = r.data; changes.push(`Created case ${c.number} through the case service.`);
      }
      const cust = s.customers.find((x) => x.id === c!.customerId);
      const order = s.orders.find((x) => x.id === c!.orderId);
      const product = s.products.find((x) => x.id === c!.productId);
      if (!cust) return failed("customer", "Open the customer profile", "The case must belong to a customer.", "lookup customer", "Customer not found");
      const history = s.cases.filter((x) => x.customerId === cust.id && x.id !== c!.id);
      return out("Completed", "customer", {
        what: `I'm reading the request: "${cust.name} reports that her wireless headphones are not connecting to Bluetooth after purchase." I've opened her profile, order, product and case.`,
        why: "The customer profile tells me who I'm helping, the order proves the purchase, the product tells me the warranty and model, and the case holds the complaint itself.",
        data: [
          ["Customer", `${cust.name} · ${cust.email} · ${cust.type} · ${cust.country}`],
          ["Support history", history.length ? history.map((h) => `${h.number} (${h.status})`).join(", ") : "No previous cases"],
          ["Order", order ? `${order.number} · ${order.date.slice(0, 10)} · ${order.shipping} · ${order.payment}` : "No order linked"],
          ["Product", product ? `${product.name} (${product.sku}) · ${product.warrantyMonths}-month warranty` : "No product linked"],
          ["Case", `${c.number} · "${c.subject}" · ${c.status}`],
        ],
        rule: "Related records are linked by ID (Case → Customer, Order, Product), like lookup fields in Salesforce.",
        action: "Read Customer, Order, Product and Case records from the data store",
        result: `All four records found for ${c.number}.`,
        changes: changes.length ? changes : ["Read-only step — no records changed."],
        next: "Analyse the complaint text and classify the case.",
      }, { spot: "case", payload: { caseId: c.id } });
    },
  },
  {
    id: "classify", title: "Analyze and classify the case", summary: "Detect category and priority with deterministic rules; check duplicates.", view: "case", prerequisites: ["understand"], inTwoMinute: true,
    run(s) {
      const c = findCase(s);
      if (!c) return failed("case", "Classify the case", "", "classifyCase()", "Case not found");
      const k = classifyCase(c);
      const before = { category: c.category, priority: c.priority };
      const changes: string[] = [];
      if (k.category !== c.category || k.priority !== c.priority) {
        const r = updateCase(s, c.id, { category: k.category, priority: k.priority });
        if (!r.ok) return failed("case", "Apply classification", "", "updateCase()", r.message);
        const after = findCase(s)!;
        if (after.category !== k.category || after.priority !== k.priority) return failed("case", "Apply classification", "", "updateCase()", "Record did not update");
        if (before.category !== k.category) changes.push(`Category: ${before.category} → ${k.category}`);
        if (before.priority !== k.priority) changes.push(`Priority: ${before.priority} → ${k.priority}`);
      }
      const dups = s.cases.filter((x) => x.id !== c.id && isOpen(x) && x.customerId === c.customerId && x.productId === c.productId);
      return out("Completed", "case", {
        what: "I'm reading the complaint and classifying it with the configured rules — no guesswork.",
        why: "Category decides which team handles the case; priority decides how fast we must respond (the SLA).",
        data: [
          ["Customer complaint", c.description],
          ["Detected category", `${k.category} → handled by ${queueName(s, k.queueId)}`],
          ["Category keywords", k.categoryKeywords.join(", ") || "none"],
          ["Priority", `${k.priority} (keywords: ${k.priorityKeywords.join(", ") || "none"})`],
          ["Current status", c.status],
          ["Duplicate check", dups.length ? `Possible duplicates: ${dups.map((d) => d.number).join(", ")}` : "No other open case for this customer and product"],
        ],
        rule: `Category rules match keywords in order (Refund → Shipping Delay → Tracking → Warranty → Product Defect → Technical). Priority rule applied: ${k.priorityRule}.`,
        action: "classifyCase() (deterministic) + updateCase() only if the stored values differ",
        result: changes.length ? `Classification applied: ${k.category} / ${k.priority}.` : `Stored classification confirmed: ${k.category} / ${k.priority} — no change needed.`,
        changes: changes.length ? changes : ["None — stored values already match the rules."],
        next: `Route the case to ${queueName(s, k.queueId)} with the Case Assignment Flow.`,
      }, { spot: "priority", payload: { ...k, duplicates: dups.map((d) => d.number) } });
    },
  },
  {
    id: "assign", title: "Assign to the right team", summary: "Run the Case Assignment Flow and confirm the stored queue and agent.", view: "queue", prerequisites: ["classify"], inTwoMinute: true,
    run(s) {
      const c = findCase(s);
      if (!c) return failed("queue", "Assign case", "", "runCaseAssignment()", "Case not found");
      const before = { queue: queueName(s, c.queueId), agent: userName(s, c.agentId) };
      const r = runCaseAssignment(s, c.id);
      if (!r.ok) return failed("queue", "Run the Case Assignment Flow", "", "runCaseAssignment()", r.message);
      const after = findCase(s)!;
      const expected = routeQueue(after.category);
      if (after.queueId !== expected) return failed("queue", "Verify assignment", "", "runCaseAssignment()", `Stored queue is ${queueName(s, after.queueId)}, expected ${queueName(s, expected)}`);
      const log = s.logs.find((l) => l.recordId === c.id && l.automation === "Case Assignment Flow");
      const q = s.queues.find((x) => x.id === expected)!;
      const load = (id: string) => s.cases.filter((x) => x.agentId === id && isOpen(x)).length;
      const noAgent = !after.agentId;
      return out(noAgent ? "Skipped" : "Completed", "queue", {
        what: `I'm running the Case Assignment Flow to route ${c.number} to the correct queue and pick an available agent.`,
        why: "Routing by category gets the case to specialists immediately, and least-loaded assignment balances work fairly.",
        data: [
          ["Category", after.category],
          ["Queue rule", `${q.name}: ${q.rule}`],
          ["Eligible agents (open cases)", q.members.map((m) => `${userName(s, m)} (${load(m)})`).join(", ") || "none"],
          ["Previous assignment", `${before.queue} / ${before.agent}`],
        ],
        rule: "Route by category; assign the active queue member with the fewest open cases (ties broken by ID).",
        action: "runCaseAssignment() → flowAssign() (Case Assignment Flow)",
        result: noAgent ? `Routed to ${q.name}, but no eligible agent is available — the case waits in the queue.` : `Assigned to ${q.name} / ${userName(s, after.agentId)}. ${log ? `Flow log: "${log.details}"` : ""}`,
        changes: [`Queue: ${before.queue} → ${queueName(s, after.queueId)}`, `Agent: ${before.agent} → ${userName(s, after.agentId)}`],
        next: "Generate an AI case summary for the assigned agent.",
      }, { spot: "queue", payload: { before, after: { queue: queueName(s, after.queueId), agent: userName(s, after.agentId) } } });
    },
  },
  {
    id: "summary", title: "Generate the AI case summary", summary: "Use the case's real fields to draft a summary, then save it to the case.", view: "assistant", prerequisites: ["assign"], inTwoMinute: true,
    run(s) {
      const c = findCase(s);
      if (!c) return failed("assistant", "Summarize case", "", "generateAI()", "Case not found");
      const g = generateAI(s, c.id, "summary");
      if (!g.ok || !g.data) return failed("assistant", "Generate summary", "", "generateAI(summary)", g.message);
      const a = applyAI(s, c.id, "summary", g.data);
      if (!a.ok) return failed("assistant", "Save summary", "", "applyAI(summary)", a.message);
      if (findCase(s)!.aiSummary !== g.data) return failed("assistant", "Save summary", "", "applyAI(summary)", "Summary not stored on the case");
      const cust = s.customers.find((x) => x.id === c.customerId);
      return out("Completed", "assistant", {
        what: "I'm asking the AI Assistant to summarise the case so any agent can understand it in seconds.",
        why: "A short, structured summary saves the agent from reading every record and highlights the recommended next action.",
        data: [
          ["Complaint", c.subject], ["Customer", cust?.name ?? "—"], ["Status / Priority", `${c.status} / ${c.priority}`],
          ["Queue / Agent", `${queueName(s, c.queueId)} / ${userName(s, c.agentId)}`], ["AI provider", MOCK_PROVIDER],
        ],
        rule: "AI output is a draft. It is saved to the case only after the apply action succeeds (agent-in-the-loop).",
        action: "generateAI(summary) → applyAI(summary)",
        result: "Summary generated from stored fields and saved to the case's AI Summary field (simulated AI).",
        changes: ["AI Summary: (empty) → saved summary"],
        next: "Search the Knowledge Base and prepare a customer response.",
      }, { spot: "summary", payload: { text: g.data } });
    },
  },
  {
    id: "knowledge", title: "Find knowledge & prepare a response", summary: "Search published articles and draft a grounded reply.", view: "knowledge", prerequisites: ["summary"], inTwoMinute: true,
    run(s) {
      const c = findCase(s);
      if (!c) return failed("knowledge", "Find knowledge", "", "searchKnowledge()", "Case not found");
      const results = searchKnowledge(s, `${c.subject} ${c.description}`, 4);
      const top = results[0];
      const g = generateAI(s, c.id, "response");
      if (!g.ok || !g.data) return failed("knowledge", "Draft response", "", "generateAI(response)", g.message);
      const a = applyAI(s, c.id, "response", g.data);
      if (!a.ok) return failed("knowledge", "Apply response", "", "applyAI(response)", a.message);
      return out(top ? "Completed" : "Skipped", "knowledge", {
        what: "I'm searching the Knowledge Base for Bluetooth troubleshooting and drafting a reply based on the customer's actual issue.",
        why: "Answers grounded in approved articles are consistent and accurate; the reply must not promise refunds or invent order facts.",
        data: [
          ["Search text", c.subject], ["Results", results.map((r) => `${r.title} (score ${r.score})`).join("; ") || "No published article matched"],
          ["Selected article", top ? top.title : "None"], ["Excerpt", top ? top.content.slice(0, 180) + "…" : "—"],
        ],
        rule: "Only published articles are searched; ranking = keyword match ×3 + text match ×1. Replies never commit to refunds or replacements.",
        action: "searchKnowledge() → generateAI(response) → applyAI(response)",
        result: `${top ? `Selected "${top.title}". ` : "No article found. "}Draft logged to the case conversation (not sent externally).`,
        changes: ["AI Response: saved draft", "Case conversation: reply entry logged", ...(c.firstResponseAt ? [] : ["First response time recorded"])],
        next: "Check the SLA target and decide whether escalation is required.",
      }, { spot: "response", payload: { articleIds: results.map((r) => r.id), scores: results.map((r) => r.score), articleId: top?.id, text: g.data } });
    },
  },
  {
    id: "sla", title: "Evaluate SLA & escalation", summary: "Compare response time with the target and apply escalation rules only if triggered.", view: "sla", prerequisites: ["knowledge"], inTwoMinute: false,
    run(s) {
      const c = findCase(s);
      if (!c) return failed("sla", "Evaluate SLA", "", "caseSla()", "Case not found");
      const sla = caseSla(s, c);
      const target = s.settings.sla[c.priority];
      const breach = sla.state === "Breached" && !c.escalated && isOpen(c);
      const critical = c.priority === "Critical" && !c.escalated && isOpen(c);
      const changes: string[] = [];
      if (breach || critical) {
        const reason = breach ? `First-response SLA breached by ${fmtDuration(sla.msRemaining)}` : "Critical priority requires senior attention";
        const r = escalate(s, c.id, reason);
        if (!r.ok) return failed("sla", "Escalate", "", "escalate()", r.message);
        changes.push(`Status: ${c.status} → Escalated`);
      } else {
        const r = addNote(s, c.id, `SLA check: ${sla.state} (target ${target} min). No escalation required.`);
        if (!r.ok) return failed("sla", "Record SLA outcome", "", "addNote()", r.message);
        changes.push("Internal note added: SLA check outcome");
      }
      return out("Completed", "sla", {
        what: "I'm checking the first-response SLA on the simulation clock and applying the escalation rule only if it is triggered.",
        why: "SLAs protect the customer experience; escalation brings in senior help — but forcing it without cause wastes their time.",
        data: [
          ["Priority", c.priority], ["SLA target", `${target} minutes to first response`], ["SLA state", sla.state],
          [sla.msRemaining < 0 ? "Overdue by" : "Margin", fmtDuration(sla.msRemaining)], ["Already escalated", c.escalated ? "Yes" : "No"],
        ],
        rule: "Escalate when the SLA is breached without a response, or the case is Critical. Otherwise record that it is within target.",
        action: breach || critical ? "escalate()" : "caseSla() + addNote()",
        result: breach || critical ? "Escalation applied." : `No escalation required — ${sla.state === "Met" ? "first response was logged within target" : "case is within its target"}.`,
        changes,
        next: "Handle the refund approval stage (if part of the selected scenario).",
      }, { spot: "sla", payload: { state: sla.state, ms: sla.msRemaining, target, escalated: breach || critical } });
    },
  },
  {
    id: "approval", title: "Handle a refund approval", summary: "Optional: submit a refund request for the delayed order; a human must decide.", view: "approval", prerequisites: ["sla"], inTwoMinute: false,
    run(s, ctx) {
      if (ctx.scenario === "primary") {
        return out("Skipped", "approval", {
          what: "The headphone case is a troubleshooting request, so no refund is involved.",
          why: "Refunds are never created automatically. The refund approval stage is demonstrated in the full scenario.",
          data: [["Scenario", SCENARIOS.primary.name]], rule: "Refund approvals are only raised for refund requests and always require a human approver.",
          action: "None", result: "Skipped — not part of this scenario (available in the full demonstration).", changes: ["None"], next: "Resolve the customer case.",
        });
      }
      const c = findCase(s, SCENARIO_2.caseId);
      if (!c) return failed("approval", "Open delayed order case", "", "lookup", "Case CS-1004 not found");
      const existing = s.approvals.find((a) => a.caseId === c.id && a.type === "Refund");
      let ap: Approval | undefined = existing;
      const changes: string[] = [];
      if (existing && existing.status !== "Pending") {
        return out("Completed", "approval", {
          what: "A refund decision already exists for this case, so I'm not repeating it.", why: "Approval decisions must never be applied twice.",
          data: [["Request", existing.reason], ["Decision", `${existing.status} by ${userName(s, existing.decidedBy)}`]], rule: "Non-idempotent actions are never replayed.",
          action: "Read approval", result: `Refund already ${existing.status.toLowerCase()}.`, changes: ["None"], next: "Resolve the customer case.",
        }, { spot: "decision", payload: { approvalId: existing.id } });
      }
      if (!ap) {
        const r = requestApproval(s, c.id, "Refund", "Customer requests a refund because order delivery is more than a week late and the tablets are needed for onboarding.");
        if (!r.ok) return failed("approval", "Submit refund approval", "", "requestApproval()", r.message);
        ap = r.data as Approval;
        changes.push(`Approval ${ap.id} created (Pending)`, "Order payment: Paid → Refund Pending");
      }
      const prev = currentUser(s);
      if (prev.id !== ap.approverId) {
        const r = switchUser(s, ap.approverId);
        if (!r.ok) return failed("approval", "Switch to approver", "", "switchUser()", r.message);
        changes.push(`Acting user: ${prev.name} → ${userName(s, ap.approverId)} (Approver)`);
      }
      return out("Waiting for Approval", "approval", {
        what: `I've opened delayed-order case ${c.number} and submitted a refund request through the Refund Approval Flow. Human approval required. Please approve or reject this request to continue.`,
        why: "Refunds move money, so a designated human approver must decide. I will never approve a refund myself.",
        data: [["Case", `${c.number} · ${c.subject}`], ["Reason", ap.reason], ["Designated approver", userName(s, ap.approverId)], ["Status", ap.status]],
        rule: "Refunds require approval by the designated approver or an administrator; rejecting requires comments.",
        action: existing ? "Reused existing pending request + switchUser(Approver)" : "requestApproval() → flowRefund() + switchUser(Approver)",
        result: "Pending — waiting for a human decision.",
        changes: changes.length ? changes : ["None — pending request reused"],
        next: "Approve or reject with comments in the centre panel.",
      }, { spot: "decision", payload: { approvalId: ap.id } });
    },
  },
  {
    id: "resolve", title: "Resolve the customer case", summary: "Validate resolution notes and mark the case Resolved.", view: "resolve", prerequisites: ["approval"], inTwoMinute: true,
    run(s, ctx) {
      const c = findCase(s);
      if (!c) return failed("resolve", "Resolve case", "", "setStatus()", "Case not found");
      if (!isOpen(c)) return out("Skipped", "resolve", { what: `${c.number} is already ${c.status}.`, why: "Resolving twice would corrupt resolution metrics.", data: [["Resolved at", c.resolvedAt ?? "—"]], rule: "Only open cases can be resolved.", action: "None", result: "Skipped — already resolved.", changes: ["None"], next: "Verify results." }, { spot: "status" });
      const notes = ctx.resolutionNotes.trim();
      if (notes.length < 15) return failed("resolve", "Validate resolution notes", "Notes document what was done for the customer.", "validation", "Resolution notes must be at least 15 characters.", [["Notes", notes || "(empty)"]]);
      const prev = c.status;
      const r = setStatus(s, c.id, "Resolved", notes);
      if (!r.ok) return failed("resolve", "Resolve case", "", "setStatus(Resolved)", r.message);
      const after = findCase(s)!;
      if (after.status !== "Resolved" || !after.resolvedAt) return failed("resolve", "Verify resolution", "", "setStatus(Resolved)", "Stored case is not resolved");
      const hrs = caseResolutionHours(after);
      return out("Completed", "resolve", {
        what: `I'm resolving ${c.number} with resolution notes describing what was provided to the customer.`,
        why: "Resolution notes create an audit trail and feed resolution-time reporting; the Case Resolution Flow schedules the satisfaction follow-up.",
        data: [["Resolution notes", notes], ["Previous status", prev]],
        rule: "Resolution notes are required (min. 15 characters); the Case Resolution Flow timestamps the case and schedules a follow-up.",
        action: "setStatus(Resolved) → flowResolution() (Case Resolution Flow)",
        result: `Resolved. Resolution time ${hrs == null ? "—" : `${hrs.toFixed(2)} h`}. Follow-up scheduled (simulated).`,
        changes: [`Status: ${prev} → Resolved`, `Resolved at: ${after.resolvedAt}`, "Resolution notes saved"],
        next: "Re-read the records and verify every change.",
      }, { spot: "status", payload: { prev, hours: hrs } });
    },
  },
  {
    id: "verify", title: "Verify the results", summary: "Re-read records and check every expected change.", view: "verify", prerequisites: ["resolve"], inTwoMinute: true,
    run(s, ctx) {
      const c = findCase(s);
      const start = (ctx.run.outcomes.init?.payload?.startedSim as string) ?? "";
      const cust = s.customers.find((x) => x.id === c?.customerId);
      const logs = s.logs.filter((l) => l.recordId === CASE_ID && l.at >= start);
      const auditN = s.audit.filter((a) => a.recordId === CASE_ID && a.at >= start).length;
      const approvalId = ctx.run.outcomes.approval?.payload?.approvalId as string | undefined;
      const ap = approvalId ? s.approvals.find((a) => a.id === approvalId) : undefined;
      const checks: { label: string; pass: boolean; detail: string }[] = [
        { label: "Case status is Resolved", pass: c?.status === "Resolved", detail: c?.status ?? "missing" },
        { label: "Assigned to Technical Support queue", pass: c?.queueId === "q-tech", detail: queueName(s, c?.queueId) },
        { label: "Agent assigned", pass: !!c?.agentId, detail: userName(s, c?.agentId) },
        { label: "AI summary saved and uses case data", pass: !!c?.aiSummary && !!cust && c.aiSummary.includes(cust.name), detail: c?.aiSummary ? "Mentions " + (cust?.name ?? "?") : "empty" },
        { label: "Resolution notes recorded", pass: !!c?.resolutionNotes?.trim(), detail: c?.resolutionNotes ? `${c.resolutionNotes.length} chars` : "empty" },
        { label: "Resolution timestamp recorded", pass: !!c?.resolvedAt, detail: c?.resolvedAt ?? "missing" },
        { label: "Approval state", pass: ctx.scenario === "primary" || (!!ap && ap.status !== "Pending"), detail: ctx.scenario === "primary" ? "Not applicable to this scenario" : ap ? ap.status : "no request found" },
        { label: "Case Assignment Flow executed", pass: logs.some((l) => l.automation === "Case Assignment Flow" && l.status === "Success"), detail: `${logs.filter((l) => l.automation === "Case Assignment Flow").length} log(s)` },
        { label: "Case Resolution Flow executed", pass: logs.some((l) => l.automation === "Case Resolution Flow" && l.status === "Success"), detail: `${logs.filter((l) => l.automation === "Case Resolution Flow").length} log(s)` },
        { label: "Activity log entries written", pass: auditN > 0, detail: `${auditN} audit entr${auditN === 1 ? "y" : "ies"} this run` },
      ];
      const bad = checks.filter((x) => !x.pass);
      return out(bad.length ? "Failed" : "Completed", "verify", {
        what: "I'm re-reading the stored records to confirm every change actually happened.",
        why: "Trust but verify — a report is only reliable if each claim is checked against the data.",
        data: checks.map((x) => [x.label, `${x.pass ? "Passed" : "FAILED"} — ${x.detail}`]),
        rule: "An item is marked Passed only after its stored value has been checked.",
        action: "Read Case, Approval, Automation Log and Audit records",
        result: bad.length ? `${bad.length} check(s) failed: ${bad.map((b) => b.label).join(", ")}.` : `All ${checks.length} checks passed.`,
        changes: ["Read-only step — no records changed."],
        next: bad.length ? "Fix the failing step and retry verification." : "Recalculate dashboard metrics and reports.",
      }, { payload: { checks } });
    },
  },
  {
    id: "reports", title: "Update dashboard & reports", summary: "Recalculate KPIs from stored records and compare with the starting values.", view: "dashboard", prerequisites: ["verify"], inTwoMinute: true,
    run(s, ctx) {
      const before = ctx.run.outcomes.init?.payload?.baseline as Snapshot | undefined;
      const after = metricsSnapshot(s);
      const c = findCase(s);
      const start = (ctx.run.outcomes.init?.payload?.startedSim as string) ?? "";
      const autoRuns = s.logs.filter((l) => l.at >= start).length;
      const fmt = (v: number | null | undefined) => (v == null ? "—" : String(v));
      const rows: [string, string][] = (["total", "open", "resolved", "escalated", "breaches", "avgRes", "csat"] as const).map((k) => [k, `${fmt(before?.[k])} → ${fmt(after[k])}`]);
      return out(c?.status === "Resolved" ? "Completed" : "Skipped", "dashboard", {
        what: "I'm recalculating the dashboard KPIs and reports from the stored records.",
        why: "Managers rely on dashboards; they must reflect what actually happened to the case.",
        data: [...rows, ["Automation executions this run", String(autoRuns)]],
        rule: "Every KPI is computed live from stored cases (e.g. Resolved = status Resolved or Closed). No numbers are invented.",
        action: "dashboardMetrics() + countBy(status) + automation log query",
        result: c?.status === "Resolved" ? `Resolved cases ${fmt(before?.resolved)} → ${after.resolved}; open cases ${fmt(before?.open)} → ${after.open}.` : "Case is not resolved, so metrics did not change.",
        changes: ["Read-only step — dashboards recalculate automatically from records."],
        next: "Generate the final execution report.",
      }, { spot: "resolved", payload: { before, after, autoRuns } });
    },
  },
  {
    id: "final", title: "Generate the final report", summary: "Summarise the actual run: outcomes, AI outputs, automations and verification.", view: "report", prerequisites: ["reports"], inTwoMinute: true,
    run(s, ctx) {
      const r = buildReport(s, ctx.run);
      audit(s, "AI Employee simulation completed", "Case", CASE_ID, "Success", `${r.successful} succeeded, ${r.failed} failed, ${r.skipped} skipped`);
      return out("Completed", "report", {
        what: "I'm compiling the execution report from this run's actual results.", why: "Evaluators and managers need a factual record of what was done.",
        data: [["Actions attempted", String(r.attempted)], ["Successful", String(r.successful)], ["Failed", String(r.failed)], ["Skipped", String(r.skipped)], ["Final case status", r.finalStatus]],
        rule: "The report is built only from recorded step outcomes and stored records.", action: "buildReport()",
        result: "Execution report ready — export as JSON or CSV.", changes: ["Audit entry: simulation completed"], next: "Simulation complete. Restart to run it again.",
      });
    },
  },
];

export const STEP_IDS = STEPS.map((x) => x.id);
export const stepIndex = (id: StepId) => STEP_IDS.indexOf(id);
export const isDone = (st: StepStatus) => st === "Completed" || st === "Skipped";

/** Atomic step execution: runs on a clone, commits only if not Failed. */
export function executeStep(s: AppState, id: StepId, ctx: StepCtx): Result<StepOutcome> {
  const def = STEPS.find((x) => x.id === id);
  if (!def) return { ok: false, message: "Unknown step" };
  const missing = def.prerequisites.filter((p) => !isDone(ctx.run.statuses[p]));
  if (missing.length) {
    const o = failed(def.view, def.title, "Steps must run in order.", "prerequisite check", `Complete first: ${missing.map((m) => STEPS.find((x) => x.id === m)!.title).join(", ")}`);
    return { ok: true, message: o.narration.result, data: o };
  }
  const draft = structuredClone(s);
  let o: StepOutcome;
  try { o = def.run(draft, ctx); } catch (e) { o = failed(def.view, def.title, "", "step execution", e instanceof Error ? e.message : "Unexpected error"); }
  if (o.status !== "Failed") Object.assign(s, draft);
  else audit(s, "AI Employee step failed", "Case", CASE_ID, "Failed", `${def.title}: ${o.narration.result}`);
  return { ok: true, message: o.narration.result, data: o };
}

/** Human decision for the approval step. Never called by the autonomous loop. */
export function decideStepApproval(s: AppState, approvalId: string, approve: boolean, comments: string): Result<StepOutcome> {
  const actor = currentUser(s);
  const r = decideApproval(s, approvalId, approve, comments);
  if (!r.ok) return { ok: false, message: r.message };
  const ap = s.approvals.find((a) => a.id === approvalId)!;
  const c = s.cases.find((x) => x.id === ap.caseId);
  const order = s.orders.find((o) => o.id === c?.orderId);
  switchUser(s, "u-admin");
  const o = out("Completed", "approval", {
    what: `${actor.name} (${actor.role}) recorded a human decision on the refund request.`, why: "Only an authorised human can approve or reject refunds.",
    data: [["Decision", ap.status], ["Comments", ap.comments ?? "—"], ["Decided by", actor.name], ["Order payment", order?.payment ?? "—"]],
    rule: "Designated approver or administrator only; comments required to reject.", action: "decideApproval() + switchUser(Administrator)",
    result: `Refund ${ap.status.toLowerCase()} by ${actor.name}.`, changes: [`Approval: Pending → ${ap.status}`, `Order payment → ${order?.payment ?? "—"}`, "Acting user → Alex Morgan (Administrator)"],
    next: "Resolve the primary customer case.",
  }, { spot: "decision", payload: { approvalId } });
  return { ok: true, message: o.narration.result, data: o };
}

export function newRun(scenario: ScenarioKey = "primary", preset: PresetKey = "full"): SimRun {
  return {
    version: 1, scenario: preset === "two-minute" ? "primary" : scenario, preset, mode: preset === "two-minute" ? "autonomous" : "guided", speed: "normal",
    statuses: Object.fromEntries(STEP_IDS.map((id) => [id, "Not Started"])) as Record<StepId, StepStatus>,
    outcomes: {}, activity: [], cursor: 0, selected: 0, resolutionNotes: DEFAULT_RESOLUTION_NOTES,
  };
}

/** Restores a persisted run safely: interrupted "Running" steps never committed (execution is atomic), so they revert. */
export function restoreRun(x: unknown): SimRun | null {
  if (!x || typeof x !== "object") return null;
  const r = x as SimRun;
  if (r.version !== 1 || !r.statuses || !Array.isArray(r.activity)) return null;
  for (const id of STEP_IDS) { if (!r.statuses[id]) return null; if (r.statuses[id] === "Running") r.statuses[id] = "Not Started"; }
  return r;
}

export function applyOutcome(r: SimRun, id: StepId, o: StepOutcome, at: string, simAt: string): SimRun {
  const idx = stepIndex(id);
  const attempt = (r.outcomes[id]?.attempt ?? 0) + 1;
  return {
    ...r,
    statuses: { ...r.statuses, [id]: o.status },
    outcomes: { ...r.outcomes, [id]: { ...o, at, simAt, attempt } },
    activity: [...r.activity, { ...o, n: r.activity.length + 1, stepId: id, title: STEPS[idx].title, at, simAt }],
    cursor: idx, selected: idx,
    finishedAt: id === "final" && o.status === "Completed" ? at : r.finishedAt,
  };
}

export function nextPending(r: SimRun) { return STEP_IDS.findIndex((id) => !isDone(r.statuses[id])); }

export function buildReport(s: AppState, run: StepCtx["run"]) {
  const c = findCase(s);
  const start = (run.outcomes.init?.payload?.startedSim as string) ?? "";
  const approvalId = run.outcomes.approval?.payload?.approvalId as string | undefined;
  const ap = approvalId ? s.approvals.find((a) => a.id === approvalId) : undefined;
  const checks = (run.outcomes.verify?.payload?.checks as { label: string; pass: boolean; detail: string }[] | undefined) ?? [];
  const finals = STEP_IDS.map((id) => run.statuses[id]);
  return {
    scenario: SCENARIOS[run.scenario].name,
    startedAt: run.startedAt ?? null,
    finishedAt: new Date().toISOString(),
    attempted: run.activity.length,
    successful: run.activity.filter((a) => a.status === "Completed").length,
    failed: run.activity.filter((a) => a.status === "Failed").length,
    skipped: run.activity.filter((a) => a.status === "Skipped").length,
    finalStatus: c?.status ?? "Case not found",
    finalQueue: queueName(s, c?.queueId),
    finalAgent: userName(s, c?.agentId),
    aiOutputs: [c?.aiSummary ? "Case summary (saved)" : null, c?.aiResponse ? "Customer response draft (logged, not sent)" : null].filter(Boolean) as string[],
    automations: s.logs.filter((l) => l.at >= start && (l.recordId === CASE_ID || l.recordId === SCENARIO_2.caseId)).map((l) => `${l.automation}: ${l.status} — ${l.details}`),
    approval: run.scenario === "primary" ? "Not part of this scenario" : ap ? `${ap.type} ${ap.status}${ap.comments ? ` — ${ap.comments}` : ""}` : "No request recorded",
    verification: checks.map((x) => `${x.pass ? "PASSED" : "FAILED"}: ${x.label} (${x.detail})`),
    outstanding: STEP_IDS.filter((id, i) => !isDone(finals[i]) && id !== "final").map((id) => `${STEPS[stepIndex(id)].title}: ${run.statuses[id]}`),
    limitations: [
      "All data is stored locally in this browser; no Salesforce org is contacted.",
      "AI output comes from a deterministic local mock, not a language model.",
      "No real emails, refunds or external messages are sent.",
      "Roles and permissions are simulated client-side.",
    ],
  };
}
export type Report = ReturnType<typeof buildReport>;

export const PROJECT_OVERVIEW: { title: string; body: string }[] = [
  { title: "The business problem", body: "VoltGear sells electronics and receives a steady stream of support requests — broken devices, late orders, warranty questions and refunds." },
  { title: "Why manual support is inefficient", body: "When requests arrive by email and are sorted by hand, cases get lost, routed to the wrong team, answered late and reported inconsistently." },
  { title: "The purpose of this application", body: "It brings every request into one service console, automates the routine steps and lets agents focus on helping customers." },
  { title: "Case management", body: "Each request becomes a Case with a status (New → Working → Resolved/Closed), priority, category, SLA deadline and full history." },
  { title: "Customers, orders and products", body: "Cases are linked to the Customer, the Order that proves purchase and the Product with its warranty period, so agents see full context." },
  { title: "Queues and case assignment", body: "The Case Assignment Flow routes each case to a team queue by category and assigns the least-busy eligible agent." },
  { title: "Automation flows", body: "Seven simulated flows handle assignment, priority escalation, SLA monitoring, reminders, resolution, refund approvals and warranty checks — each logs its execution." },
  { title: "AI case summaries", body: "The AI Assistant condenses a case into the issue, context, status and recommended next action. Here it is a deterministic local simulation." },
  { title: "Suggested customer responses", body: "The assistant drafts a reply grounded in the case and Knowledge Base. Agents review it before it is logged — nothing is sent externally." },
  { title: "Approvals and escalation", body: "Refunds need a designated approver's decision; breached or critical cases escalate for senior attention." },
  { title: "Reports and dashboards", body: "KPIs and charts are calculated live from stored records — open and resolved cases, resolution time, SLA breaches and satisfaction." },
  { title: "Audit logs and simulated security", body: "Role-based permissions are enforced inside every action, and every change or denied attempt is written to the audit log." },
];
