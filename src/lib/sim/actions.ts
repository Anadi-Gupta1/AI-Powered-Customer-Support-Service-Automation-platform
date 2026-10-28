/**
 * All mutating operations. Each takes a draft AppState (mutated in place) and returns a Result.
 * Permission checks live here — not only in the UI.
 */
import type { AppState, Approval, ApprovalType, Article, CaseStatus, Customer, Order, Product, PromptTemplate, Result, SupportCase, User, WarrantyClaim } from "./types";
import { SHIPPING_FLOW } from "./types";
import { can, caseSla, currentUser, DAY, isOpen, nextCaseNumber, nowIso, now, pickAgent, routeQueue, slaDeadlineFor, uid, warrantyEligibility, type Perm } from "./rules";
import { summarize, suggestResponse } from "./ai";
import { buildSeed, SCENARIO_1, SCENARIO_2 } from "./seed";

const ok = <T,>(message: string, data?: T): Result<T> => ({ ok: true, message, data });
const fail = (message: string): Result => ({ ok: false, message });

export function audit(s: AppState, action: string, recordType: string, recordId: string | undefined, outcome: "Success" | "Denied" | "Failed", details: string) {
  s.audit.unshift({ id: uid("au"), at: nowIso(s), action, recordType, recordId, userId: s.currentUserId, outcome, details });
  if (s.audit.length > 1000) s.audit.length = 1000;
}
function guard(s: AppState, perm: Perm, what: string, recordType = "System", recordId?: string): Result | null {
  if (can(s, perm)) return null;
  const role = currentUser(s).role;
  audit(s, "Permission denied", recordType, recordId, "Denied", `${role} attempted to ${what}`);
  return fail(`Access denied: the ${role} role cannot ${what}.`);
}
function log(s: AppState, automation: string, trigger: string, status: "Success" | "Skipped" | "Failed", details: string, recordId?: string, error?: string) {
  s.logs.unshift({ id: uid("lg"), automation, trigger, status, details, recordId, error, at: nowIso(s) });
  if (s.logs.length > 500) s.logs.length = 500;
}
function notify(s: AppState, title: string, body: string, level: "info" | "warning" | "critical" = "info") {
  s.notifications.unshift({ id: uid("n"), at: nowIso(s), title, body, read: false, level });
  if (s.notifications.length > 100) s.notifications.length = 100;
}
const note = (s: AppState, c: SupportCase, text: string, kind: "internal" | "resolution" | "system" | "reply") =>
  c.notes.push({ id: uid("nt"), at: nowIso(s), by: s.currentUserId, text, kind });
const findCase = (s: AppState, id: string) => s.cases.find((c) => c.id === id);
const touch = (s: AppState, c: SupportCase) => { c.updatedAt = nowIso(s); };

/* =================== AUTOMATIONS =================== */
export const AUTOMATIONS = [
  { key: "assign", name: "Case Assignment Flow", trigger: "Case created / reassignment requested", description: "Routes cases to a queue by category and assigns the least-loaded eligible agent." },
  { key: "priority", name: "Priority & Escalation Flow", trigger: "High/Critical case created or priority changed", description: "Flags urgent cases, escalates Critical ones and posts an in-app notification." },
  { key: "sla", name: "SLA Monitoring Flow", trigger: "Scheduled (simulated) check", description: "Evaluates first-response SLA targets and notifies on new breaches." },
  { key: "reminder", name: "Three-Day Reminder Flow", trigger: "Scheduled (simulated) — reminder date reached", description: "Sends in-app reminders for confirmed orders and satisfaction follow-ups, once each." },
  { key: "resolution", name: "Case Resolution Flow", trigger: "Case marked Resolved", description: "Validates notes, records resolution time and schedules a satisfaction follow-up." },
  { key: "refund", name: "Refund Approval Flow", trigger: "Refund or cancellation requested", description: "Creates a pending approval for refund cases that have none." },
  { key: "warranty", name: "Warranty Claim Flow", trigger: "Warranty claim created or updated", description: "Checks purchase date against warranty period and routes the claim." },
] as const;
export type AutomationKey = (typeof AUTOMATIONS)[number]["key"];

export function flowAssign(s: AppState, c: SupportCase, trigger: string, force = false): Result {
  const name = "Case Assignment Flow";
  if (!isOpen(c)) { log(s, name, trigger, "Skipped", `${c.number} is ${c.status}; no assignment needed.`, c.id); return ok("skipped"); }
  const q = routeQueue(c.category);
  if (!force && c.queueId === q && c.agentId) { log(s, name, trigger, "Skipped", `${c.number} already assigned correctly.`, c.id); return ok("skipped"); }
  const queue = s.queues.find((x) => x.id === q);
  if (!queue) { log(s, name, trigger, "Failed", `Queue ${q} not found.`, c.id, "Missing queue"); return fail("Queue missing"); }
  const agent = pickAgent(s, q);
  c.queueId = q;
  c.agentId = agent?.id;
  touch(s, c);
  const details = agent ? `Routed ${c.number} (${c.category}) to ${queue.name}; assigned ${agent.name}.` : `Routed ${c.number} to ${queue.name}; no eligible active agent — left in queue.`;
  note(s, c, details, "system");
  log(s, name, trigger, "Success", details, c.id);
  audit(s, "Case assigned", "Case", c.id, "Success", details);
  return ok(details);
}

export function flowPriority(s: AppState, c: SupportCase, trigger: string): Result {
  const name = "Priority & Escalation Flow";
  if (!isOpen(c) || (c.priority !== "High" && c.priority !== "Critical")) { log(s, name, trigger, "Skipped", `${c.number} is ${c.priority}/${c.status}; not urgent.`, c.id); return ok("skipped"); }
  if (c.urgent) { log(s, name, trigger, "Skipped", `${c.number} already flagged urgent.`, c.id); return ok("skipped"); }
  c.urgent = true;
  let details = `${c.number} flagged urgent (${c.priority}).`;
  if (c.priority === "Critical" || caseSla(s, c).state === "Breached") {
    c.escalated = true;
    c.status = "Escalated";
    details += " Escalated automatically.";
  } else details += " Escalation recommended if no response before SLA deadline.";
  touch(s, c);
  note(s, c, details, "system");
  notify(s, `Urgent case ${c.number}`, details, c.priority === "Critical" ? "critical" : "warning");
  log(s, name, trigger, "Success", details + " In-app notification posted (no email sent).", c.id);
  return ok(details);
}

export function flowSla(s: AppState, trigger = "Run Now"): Result {
  const name = "SLA Monitoring Flow";
  let breached = 0, atRisk = 0, fresh = 0;
  s.cases.filter(isOpen).forEach((c) => {
    const st = caseSla(s, c).state;
    if (st === "At Risk") atRisk++;
    if (st === "Breached") {
      breached++;
      if (!c.slaNotified) {
        c.slaNotified = true; fresh++;
        notify(s, `SLA breached: ${c.number}`, `${c.subject} missed its ${c.priority} first-response target.`, "warning");
        log(s, name, trigger, "Success", `${c.number} breached its first-response SLA.`, c.id);
      }
    }
  });
  const details = `Checked ${s.cases.filter(isOpen).length} open cases: ${breached} breached (${fresh} new), ${atRisk} at risk.`;
  log(s, name, trigger, fresh ? "Success" : "Skipped", details + (fresh ? "" : " No new breaches."));
  return ok(details);
}

export function flowReminder(s: AppState, trigger = "Run Now"): Result {
  const name = "Three-Day Reminder Flow";
  const at = now(s).getTime();
  let sent = 0;
  s.orders.forEach((o) => {
    if ((o.shipping === "Confirmed" || o.shipping === "Processing") && !o.reminderSentAt && new Date(o.date).getTime() + s.settings.reminderDays * DAY <= at) {
      o.reminderSentAt = nowIso(s); sent++;
      notify(s, `Order reminder: ${o.number}`, `Order still ${o.shipping} after ${s.settings.reminderDays} days — follow up with fulfilment.`);
      log(s, name, trigger, "Success", `In-app reminder for ${o.number} (simulated; no email/SMS sent).`, o.id);
    }
  });
  s.cases.forEach((c) => {
    if (c.followUpAt && !c.followUpDone && new Date(c.followUpAt).getTime() <= at) {
      c.followUpDone = true; sent++;
      note(s, c, "Simulated satisfaction follow-up triggered (no email sent).", "system");
      notify(s, `Satisfaction follow-up: ${c.number}`, "Record the customer's satisfaction rating on the case.");
      log(s, name, trigger, "Success", `Satisfaction follow-up due for ${c.number}.`, c.id);
    }
  });
  if (!sent) log(s, name, trigger, "Skipped", "No reminders due. Advance the demo clock to reach reminder dates.");
  return ok(sent ? `${sent} reminder(s) issued.` : "No reminders due.");
}

export function flowResolution(s: AppState, c: SupportCase, trigger: string): Result {
  const name = "Case Resolution Flow";
  if (c.status !== "Resolved" && c.status !== "Closed") { log(s, name, trigger, "Skipped", `${c.number} is not resolved.`, c.id); return ok("skipped"); }
  if (!c.resolutionNotes?.trim()) { log(s, name, trigger, "Failed", `${c.number} has no resolution notes.`, c.id, "Validation failed"); return fail("Resolution notes are required."); }
  if (c.followUpAt) { log(s, name, trigger, "Skipped", `${c.number} resolution already processed.`, c.id); return ok("skipped"); }
  c.resolvedAt ??= nowIso(s);
  c.firstResponseAt ??= c.resolvedAt;
  c.followUpAt = new Date(now(s).getTime() + DAY).toISOString();
  note(s, c, "Resolution recorded. Satisfaction follow-up scheduled in 24h (simulated).", "system");
  log(s, name, trigger, "Success", `${c.number} resolved; follow-up scheduled for ${c.followUpAt.slice(0, 16).replace("T", " ")}.`, c.id);
  return ok("Resolution processed");
}

export function flowRefund(s: AppState, c: SupportCase, trigger: string, type: ApprovalType = "Refund", reason?: string): Result {
  const name = "Refund Approval Flow";
  const existing = s.approvals.find((a) => a.caseId === c.id && a.status !== "Rejected");
  if (existing) { log(s, name, trigger, "Skipped", `${c.number} already has a ${existing.status} approval.`, c.id); return ok("skipped"); }
  const order = s.orders.find((o) => o.id === c.orderId);
  const ap: Approval = {
    id: uid("ap"), caseId: c.id, type, reason: reason ?? `${type} requested for ${c.number}${order ? ` (order ${order.number}, $${order.total})` : ""}.`,
    requestedBy: s.currentUserId, approverId: "u-appr", status: "Pending", createdAt: nowIso(s),
  };
  s.approvals.unshift(ap);
  if (order && type === "Refund") order.payment = "Refund Pending";
  note(s, c, `${type} approval request submitted to Meera Kapoor.`, "system");
  log(s, name, trigger, "Success", `Created pending ${type} approval for ${c.number}.`, c.id);
  audit(s, "Approval submitted", "Approval", ap.id, "Success", ap.reason);
  notify(s, `Approval pending for ${c.number}`, ap.reason);
  return ok("Approval submitted", ap);
}

export function flowWarranty(s: AppState, w: WarrantyClaim, trigger: string): Result {
  const name = "Warranty Claim Flow";
  const r = warrantyEligibility(s, w);
  if (w.warrantyStatus === r.status && w.eligibilityReason === r.reason && w.queueId) { log(s, name, trigger, "Skipped", `${w.number} unchanged (${r.status}).`, w.id); return ok("skipped"); }
  w.warrantyStatus = r.status;
  w.eligibilityReason = r.reason;
  w.queueId = r.status === "Ineligible" ? undefined : "q-warranty";
  const details = `${w.number}: ${r.status}. ${r.reason}${r.status === "Eligible" ? " Routed to Warranty Support." : r.status === "Requires Review" ? " Routed for manual review." : ""}`;
  log(s, name, trigger, "Success", details, w.id);
  audit(s, "Warranty claim reviewed", "Warranty Claim", w.id, "Success", details);
  return ok(details);
}

export function runAutomation(s: AppState, key: AutomationKey): Result {
  const g = guard(s, "automation.run", "run automations", "Automation");
  if (g) return g;
  const meta = AUTOMATIONS.find((a) => a.key === key)!;
  const before = s.logs.length;
  let res: Result = ok("");
  switch (key) {
    case "assign": s.cases.filter((c) => isOpen(c) && !c.agentId).forEach((c) => flowAssign(s, c, "Run Now")); break;
    case "priority": s.cases.filter((c) => isOpen(c) && (c.priority === "High" || c.priority === "Critical") && !c.urgent).forEach((c) => flowPriority(s, c, "Run Now")); break;
    case "sla": res = flowSla(s); break;
    case "reminder": res = flowReminder(s); break;
    case "resolution": s.cases.filter((c) => (c.status === "Resolved" || c.status === "Closed") && !c.followUpAt).forEach((c) => flowResolution(s, c, "Run Now")); break;
    case "refund": s.cases.filter((c) => isOpen(c) && c.category === "Refund").forEach((c) => flowRefund(s, c, "Run Now")); break;
    case "warranty": s.claims.forEach((w) => flowWarranty(s, w, "Run Now")); break;
  }
  const newLogs = s.logs.slice(0, s.logs.length - before);
  if (!newLogs.length) log(s, meta.name, "Run Now", "Skipped", "No eligible records.");
  const all = s.logs.slice(0, Math.max(1, s.logs.length - before));
  const succ = all.filter((l) => l.status === "Success").length, failed = all.filter((l) => l.status === "Failed").length;
  audit(s, "Automation executed", "Automation", key, "Success", `${meta.name}: ${succ} success, ${failed} failed, ${all.length - succ - failed} skipped.`);
  return ok(res.message || `${meta.name}: ${succ} updated, ${all.length - succ - failed} skipped, ${failed} failed.`, { success: succ, failed, skipped: all.length - succ - failed });
}

export function runAll(s: AppState): Result {
  const g = guard(s, "automation.run", "run automations", "Automation");
  if (g) return g;
  const parts = AUTOMATIONS.map((a) => runAutomation(s, a.key));
  const total = parts.reduce((a, p) => a + ((p.data as { success: number })?.success ?? 0), 0);
  return ok(`Ran ${AUTOMATIONS.length} automations — ${total} record update(s).`);
}

/* =================== CASES =================== */
export type CaseInput = Pick<SupportCase, "subject" | "description" | "customerId" | "origin" | "category" | "priority"> & { orderId?: string; productId?: string };

export function validateCase(s: AppState, i: CaseInput): Record<string, string> {
  const e: Record<string, string> = {};
  if (!i.subject?.trim()) e.subject = "Subject is required.";
  else if (i.subject.length > 140) e.subject = "Subject must be under 140 characters.";
  if (!i.description?.trim()) e.description = "Description is required.";
  if (!s.customers.some((c) => c.id === i.customerId)) e.customerId = "Select a valid customer.";
  if (i.orderId) {
    const o = s.orders.find((x) => x.id === i.orderId);
    if (!o) e.orderId = "Order not found.";
    else if (o.customerId !== i.customerId) e.orderId = "Order does not belong to this customer.";
    else if (i.productId && !o.lines.some((l) => l.productId === i.productId)) e.productId = "Product is not part of the selected order.";
  }
  if (i.productId && !s.products.some((p) => p.id === i.productId)) e.productId = "Product not found.";
  return e;
}

export function createCase(s: AppState, i: CaseInput): Result<SupportCase> {
  const g = guard(s, "case.create", "create cases", "Case");
  if (g) return g as Result<SupportCase>;
  const errs = validateCase(s, i);
  if (Object.keys(errs).length) return { ok: false, message: Object.values(errs)[0], data: undefined };
  const number = nextCaseNumber(s);
  s.caseSeq = parseInt(number.slice(3), 10);
  const at = nowIso(s);
  const c: SupportCase = {
    id: `case-${s.caseSeq}`, number, subject: i.subject.trim(), description: i.description.trim(), customerId: i.customerId,
    orderId: i.orderId || undefined, productId: i.productId || undefined, origin: i.origin, category: i.category, priority: i.priority,
    status: "New", createdAt: at, updatedAt: at, slaDeadline: slaDeadlineFor(s, at, i.priority), escalated: false, notes: [],
  };
  s.cases.unshift(c);
  audit(s, "Case created", "Case", c.id, "Success", `${number}: ${c.subject}`);
  flowAssign(s, c, "Case created");
  flowPriority(s, c, "Case created");
  if (c.category === "Refund") flowRefund(s, c, "Case created");
  return ok(`Case ${number} created`, c);
}

export function updateCase(s: AppState, id: string, patch: Partial<CaseInput>): Result {
  const g = guard(s, "case.edit", "edit cases", "Case", id);
  if (g) return g;
  const c = findCase(s, id);
  if (!c) return fail("Case not found.");
  const merged: CaseInput = { subject: c.subject, description: c.description, customerId: c.customerId, origin: c.origin, category: c.category, priority: c.priority, orderId: c.orderId, productId: c.productId, ...patch };
  const errs = validateCase(s, merged);
  if (Object.keys(errs).length) return fail(Object.values(errs)[0]);
  const prioChanged = merged.priority !== c.priority, catChanged = merged.category !== c.category;
  Object.assign(c, { ...merged, orderId: merged.orderId || undefined, productId: merged.productId || undefined });
  if (prioChanged) { c.slaDeadline = slaDeadlineFor(s, c.createdAt, c.priority); c.urgent = false; c.slaNotified = false; }
  touch(s, c);
  audit(s, "Case updated", "Case", id, "Success", `${c.number} updated`);
  if (prioChanged) flowPriority(s, c, "Priority changed");
  if (catChanged) flowAssign(s, c, "Category changed — reassignment", true);
  return ok(`${c.number} saved`);
}

export function setStatus(s: AppState, id: string, status: CaseStatus, notes?: string): Result {
  const g = guard(s, "case.edit", "change case status", "Case", id);
  if (g) return g;
  const c = findCase(s, id);
  if (!c) return fail("Case not found.");
  if (c.status === status) return fail(`Case is already ${status}.`);
  const prev = c.status;
  const wasClosed = !isOpen(c);
  if (status === "Resolved") {
    const n = (notes ?? c.resolutionNotes ?? "").trim();
    if (!n) return fail("Resolution notes are required to resolve a case.");
    c.resolutionNotes = n;
    if (notes) note(s, c, n, "resolution");
  }
  if (status === "Closed" && !c.resolutionNotes?.trim()) return fail("Add resolution notes (resolve the case) before closing.");
  if (wasClosed && status !== "Closed" && status !== "Resolved") {
    c.resolvedAt = undefined; c.followUpAt = undefined; c.followUpDone = undefined; c.rating = undefined;
    note(s, c, `Case reopened (was ${prev}).`, "system");
  }
  if (prev === "New" && !c.firstResponseAt) c.firstResponseAt = nowIso(s);
  c.status = status;
  if (status === "Escalated") c.escalated = true;
  touch(s, c);
  audit(s, status === "Resolved" ? "Case resolved" : "Status changed", "Case", id, "Success", `${c.number}: ${prev} → ${status}`);
  if (status === "Resolved") { c.resolvedAt = nowIso(s); flowResolution(s, c, "Status → Resolved"); }
  return ok(`${c.number} is now ${status}`);
}

export function assignCase(s: AppState, id: string, queueId: string, agentId?: string): Result {
  const g = guard(s, "case.assign", "assign cases", "Case", id);
  if (g) return g;
  const c = findCase(s, id);
  const q = s.queues.find((x) => x.id === queueId);
  if (!c || !q) return fail("Case or queue not found.");
  if (agentId) {
    const u = s.users.find((x) => x.id === agentId);
    if (!u || !u.active) return fail("Agent not found or inactive.");
    if (!q.members.includes(agentId)) return fail(`${u.name} is not a member of ${q.name}.`);
  }
  c.queueId = queueId; c.agentId = agentId || undefined;
  touch(s, c);
  const agent = s.users.find((u) => u.id === agentId);
  const d = `${c.number} manually assigned to ${q.name}${agent ? ` / ${agent.name}` : " (queue only)"}.`;
  note(s, c, d, "system");
  audit(s, "Case assigned", "Case", id, "Success", d);
  return ok(d);
}

export function runCaseAssignment(s: AppState, id: string): Result {
  const g = guard(s, "case.assign", "run case assignment", "Case", id);
  if (g) return g;
  const c = findCase(s, id);
  if (!c) return fail("Case not found.");
  const r = flowAssign(s, c, "Reassignment requested", false);
  return r.message === "skipped" ? ok(`${c.number} is already correctly assigned.`) : r;
}

export function addNote(s: AppState, id: string, text: string): Result {
  const g = guard(s, "case.edit", "add case notes", "Case", id);
  if (g) return g;
  const c = findCase(s, id);
  if (!c) return fail("Case not found.");
  if (!text.trim()) return fail("Note cannot be empty.");
  note(s, c, text.trim(), "internal");
  touch(s, c);
  audit(s, "Case updated", "Case", id, "Success", `Internal note added to ${c.number}`);
  return ok("Note added");
}

export function escalate(s: AppState, id: string, reason: string): Result {
  const g = guard(s, "case.edit", "escalate cases", "Case", id);
  if (g) return g;
  const c = findCase(s, id);
  if (!c) return fail("Case not found.");
  if (!isOpen(c)) return fail("Only open cases can be escalated.");
  if (!reason.trim()) return fail("An escalation reason is required.");
  if (c.status === "Escalated") return fail("Case is already escalated.");
  if (!c.firstResponseAt) c.firstResponseAt = nowIso(s);
  c.status = "Escalated"; c.escalated = true;
  note(s, c, `Escalated: ${reason.trim()}`, "system");
  touch(s, c);
  notify(s, `${c.number} escalated`, reason.trim(), "warning");
  audit(s, "Status changed", "Case", id, "Success", `${c.number} escalated: ${reason.trim()}`);
  return ok(`${c.number} escalated`);
}

export function deleteCase(s: AppState, id: string): Result {
  const g = guard(s, "admin", "delete cases", "Case", id);
  if (g) return g;
  const c = findCase(s, id);
  if (!c) return fail("Case not found.");
  s.cases = s.cases.filter((x) => x.id !== id);
  s.approvals = s.approvals.filter((a) => a.caseId !== id || a.status !== "Pending");
  audit(s, "Case deleted", "Case", id, "Success", `${c.number} deleted`);
  return ok(`${c.number} deleted`);
}

export function generateAI(s: AppState, id: string, kind: "summary" | "response"): Result<string> {
  const c = findCase(s, id);
  if (!c) return { ok: false, message: "Case not found." };
  const text = kind === "summary" ? summarize(s, c) : suggestResponse(s, c);
  audit(s, kind === "summary" ? "AI summary generated" : "AI response generated", "Case", id, "Success", `Simulated AI ${kind} for ${c.number}`);
  log(s, "Prompt Builder (simulated)", `Generate ${kind}`, "Success", `Mock AI produced a ${kind} draft for ${c.number}.`, id);
  return ok(`AI ${kind} draft generated (simulated)`, text);
}

export function applyAI(s: AppState, id: string, kind: "summary" | "response", text: string): Result {
  const g = guard(s, "case.edit", "apply AI output to cases", "Case", id);
  if (g) return g;
  const c = findCase(s, id);
  if (!c) return fail("Case not found.");
  if (!text.trim()) return fail("Nothing to apply.");
  if (kind === "summary") c.aiSummary = text;
  else {
    c.aiResponse = text;
    if (!c.firstResponseAt) c.firstResponseAt = nowIso(s);
    note(s, c, "Agent-approved AI reply logged to case (not sent externally).", "reply");
  }
  touch(s, c);
  audit(s, "Case updated", "Case", id, "Success", `Agent applied AI ${kind} to ${c.number}`);
  return ok(`AI ${kind} applied to ${c.number}`);
}

export function rateCase(s: AppState, id: string, rating: number): Result {
  const g = guard(s, "case.edit", "record satisfaction", "Case", id);
  if (g) return g;
  const c = findCase(s, id);
  if (!c) return fail("Case not found.");
  if (isOpen(c)) return fail("Satisfaction can only be recorded on resolved cases.");
  if (rating < 1 || rating > 5) return fail("Rating must be 1–5.");
  c.rating = rating; c.followUpDone = true;
  touch(s, c);
  audit(s, "Case updated", "Case", id, "Success", `${c.number} satisfaction ${rating}/5 recorded`);
  return ok(`Satisfaction ${rating}/5 recorded`);
}

export function requestApproval(s: AppState, id: string, type: ApprovalType, reason: string): Result {
  const g = guard(s, "case.edit", "submit approval requests", "Case", id);
  if (g) return g;
  const c = findCase(s, id);
  if (!c) return fail("Case not found.");
  if (!reason.trim()) return fail("A request reason is required.");
  const r = flowRefund(s, c, "Manual request", type, reason.trim());
  return r.message === "skipped" ? fail("This case already has an open or approved request.") : r;
}

/* =================== APPROVALS =================== */
export function decideApproval(s: AppState, id: string, approve: boolean, comments: string): Result {
  const g = guard(s, "approve", "approve or reject requests", "Approval", id);
  if (g) return g;
  const ap = s.approvals.find((a) => a.id === id);
  if (!ap) return fail("Approval not found.");
  const me = currentUser(s);
  if (ap.approverId !== me.id && me.role !== "Administrator") {
    audit(s, "Permission denied", "Approval", id, "Denied", `${me.name} is not the designated approver`);
    return fail(`Only the designated approver (${s.users.find((u) => u.id === ap.approverId)?.name}) or an administrator can decide this request.`);
  }
  if (ap.status !== "Pending") return fail(`This request was already ${ap.status.toLowerCase()}.`);
  if (!approve && !comments.trim()) return fail("Comments are required when rejecting.");
  const claim = s.claims.find((w) => w.id === ap.claimId);
  if (approve && claim && claim.warrantyStatus === "Ineligible") return fail("Ineligible warranty claims cannot be approved.");
  ap.status = approve ? "Approved" : "Rejected";
  ap.comments = comments.trim() || undefined;
  ap.decidedAt = nowIso(s); ap.decidedBy = me.id;
  const c = ap.caseId ? findCase(s, ap.caseId) : undefined;
  const order = c?.orderId ? s.orders.find((o) => o.id === c.orderId) : undefined;
  if (order && ap.type === "Refund") order.payment = approve ? "Refunded" : "Paid";
  if (order && ap.type === "Cancellation" && approve) { order.shipping = "Cancelled"; order.events.push({ at: nowIso(s), status: "Cancelled", note: "Cancelled after approval (simulated)" }); }
  if (c) {
    note(s, c, `${ap.type} request ${ap.status.toLowerCase()} by ${me.name}${ap.comments ? `: ${ap.comments}` : ""}.`, "system");
    if (c.status === "Waiting for Customer" || c.status === "New") c.status = "Working";
    touch(s, c);
  }
  if (claim) { claim.approvalStatus = ap.status; claim.decisionNotes = ap.comments ?? (approve ? "Approved" : ""); }
  audit(s, "Approval decided", "Approval", id, "Success", `${ap.type} ${ap.status} by ${me.name}`);
  return ok(`Request ${ap.status.toLowerCase()}`);
}

/* =================== CUSTOMERS / PRODUCTS / ORDERS =================== */
export type CustomerInput = Omit<Customer, "id" | "createdAt">;
export function validateCustomer(s: AppState, i: CustomerInput, id?: string) {
  const e: Record<string, string> = {};
  if (!i.name?.trim()) e.name = "Full name is required.";
  if (!/^\S+@\S+\.\S+$/.test(i.email ?? "")) e.email = "Enter a valid email.";
  else if (s.customers.some((c) => c.email.toLowerCase() === i.email.toLowerCase() && c.id !== id)) e.email = "Email already in use.";
  if (!i.phone?.trim()) e.phone = "Phone is required.";
  if (!i.country?.trim()) e.country = "Country is required.";
  return e;
}
export function saveCustomer(s: AppState, i: CustomerInput, id?: string): Result<Customer> {
  const g = guard(s, "customer.edit", "create or edit customers", "Customer", id);
  if (g) return g as Result<Customer>;
  const e = validateCustomer(s, i, id);
  if (Object.keys(e).length) return { ok: false, message: Object.values(e)[0] };
  if (id) {
    const c = s.customers.find((x) => x.id === id);
    if (!c) return { ok: false, message: "Customer not found." };
    Object.assign(c, i);
    audit(s, "Customer updated", "Customer", id, "Success", c.name);
    return ok("Customer saved", c);
  }
  const n = s.customers.length + 1;
  let cid = `c-${String(n).padStart(3, "0")}`;
  while (s.customers.some((c) => c.id === cid)) cid = uid("c");
  const c: Customer = { ...i, id: cid, createdAt: nowIso(s) };
  s.customers.unshift(c);
  audit(s, "Customer created", "Customer", c.id, "Success", c.name);
  return ok("Customer created", c);
}
export function customerRelations(s: AppState, id: string) {
  return { cases: s.cases.filter((c) => c.customerId === id).length, orders: s.orders.filter((o) => o.customerId === id).length, claims: s.claims.filter((w) => w.customerId === id).length };
}
export function deleteCustomer(s: AppState, id: string): Result {
  const g = guard(s, "customer.edit", "delete customers", "Customer", id);
  if (g) return g;
  const r = customerRelations(s, id);
  if (r.cases + r.orders + r.claims > 0) return fail(`Cannot delete: customer has ${r.cases} case(s), ${r.orders} order(s) and ${r.claims} claim(s). Mark them Inactive instead.`);
  s.customers = s.customers.filter((c) => c.id !== id);
  audit(s, "Customer deleted", "Customer", id, "Success", "Deleted");
  return ok("Customer deleted");
}

export function saveProduct(s: AppState, i: Omit<Product, "id">, id?: string): Result {
  const g = guard(s, "customer.edit", "edit products", "Product", id);
  if (g) return g;
  if (!i.name.trim() || !i.sku.trim()) return fail("Name and SKU are required.");
  if (s.products.some((p) => p.sku.toLowerCase() === i.sku.toLowerCase() && p.id !== id)) return fail("SKU must be unique.");
  if (i.price < 0 || i.stock < 0 || i.warrantyMonths < 0) return fail("Price, stock and warranty must be non-negative.");
  if (id) { const p = s.products.find((x) => x.id === id); if (!p) return fail("Not found"); Object.assign(p, i); }
  else s.products.push({ ...i, id: uid("p") });
  audit(s, id ? "Product updated" : "Product created", "Product", id, "Success", i.name);
  return ok("Product saved");
}
export function deleteProduct(s: AppState, id: string): Result {
  const g = guard(s, "customer.edit", "delete products", "Product", id);
  if (g) return g;
  if (s.orders.some((o) => o.lines.some((l) => l.productId === id)) || s.cases.some((c) => c.productId === id)) return fail("Product is referenced by orders or cases; set it to Discontinued instead.");
  s.products = s.products.filter((p) => p.id !== id);
  audit(s, "Product deleted", "Product", id, "Success", "Deleted");
  return ok("Product deleted");
}

export function createOrder(s: AppState, customerId: string, lines: { productId: string; qty: number }[]): Result<Order> {
  const g = guard(s, "customer.edit", "create orders", "Order");
  if (g) return g as Result<Order>;
  if (!s.customers.some((c) => c.id === customerId)) return { ok: false, message: "Select a valid customer." };
  const valid = lines.filter((l) => l.qty > 0 && s.products.some((p) => p.id === l.productId));
  if (!valid.length) return { ok: false, message: "Add at least one product." };
  const n = Math.max(...s.orders.map((o) => parseInt(o.number.slice(4), 10))) + 1;
  const at = nowIso(s);
  const o: Order = {
    id: uid("o"), customerId, number: `ORD-${n}`, date: at, lines: valid,
    total: valid.reduce((a, l) => a + (s.products.find((p) => p.id === l.productId)?.price ?? 0) * l.qty, 0),
    payment: "Paid", shipping: "Confirmed", tracking: `TRK${(n * 7919).toString().padStart(9, "0")}`,
    eta: new Date(now(s).getTime() + 6 * DAY).toISOString(), events: [{ at, status: "Confirmed", note: "Order confirmed" }],
  };
  s.orders.unshift(o);
  audit(s, "Order created", "Order", o.id, "Success", o.number);
  return ok(`Order ${o.number} created`, o);
}
export function advanceTracking(s: AppState, id: string): Result {
  const g = guard(s, "case.edit", "update order tracking", "Order", id);
  if (g) return g;
  const o = s.orders.find((x) => x.id === id);
  if (!o) return fail("Order not found.");
  if (o.shipping === "Delivered" || o.shipping === "Cancelled") return fail(`Order is ${o.shipping}.`);
  const idx = o.shipping === "Delayed" ? 3 : SHIPPING_FLOW.indexOf(o.shipping);
  o.shipping = SHIPPING_FLOW[Math.min(idx + 1, SHIPPING_FLOW.length - 1)];
  o.events.push({ at: nowIso(s), status: o.shipping, note: `Simulated carrier update: ${o.shipping}` });
  audit(s, "Order updated", "Order", id, "Success", `${o.number} → ${o.shipping} (simulated)`);
  return ok(`${o.number} is now ${o.shipping} (simulated update)`);
}
export function markDelayed(s: AppState, id: string): Result {
  const g = guard(s, "case.edit", "update order tracking", "Order", id);
  if (g) return g;
  const o = s.orders.find((x) => x.id === id);
  if (!o || o.shipping === "Delivered" || o.shipping === "Cancelled") return fail("Order cannot be marked delayed.");
  o.shipping = "Delayed";
  o.events.push({ at: nowIso(s), status: "Delayed", note: "Simulated carrier delay" });
  audit(s, "Order updated", "Order", id, "Success", `${o.number} delayed (simulated)`);
  return ok(`${o.number} marked delayed`);
}

/* =================== WARRANTY =================== */
export function createClaim(s: AppState, i: Pick<WarrantyClaim, "customerId" | "productId" | "orderId" | "purchaseDate" | "claimDate" | "reason">): Result<WarrantyClaim> {
  const g = guard(s, "warranty.manage", "create warranty claims", "Warranty Claim");
  if (g) return g as Result<WarrantyClaim>;
  const o = s.orders.find((x) => x.id === i.orderId);
  if (!s.customers.some((c) => c.id === i.customerId)) return { ok: false, message: "Select a valid customer." };
  if (!o || o.customerId !== i.customerId) return { ok: false, message: "Order must belong to the selected customer." };
  if (!s.products.some((p) => p.id === i.productId)) return { ok: false, message: "Select a product." };
  if (!i.reason.trim()) return { ok: false, message: "Claim reason is required." };
  if (!i.purchaseDate || !i.claimDate) return { ok: false, message: "Purchase and claim dates are required." };
  s.claimSeq += 1;
  const w: WarrantyClaim = { ...i, id: uid("w"), number: `WC-${s.claimSeq}`, warrantyStatus: "Pending Check", approvalStatus: "Not Submitted" };
  s.claims.unshift(w);
  audit(s, "Warranty claim created", "Warranty Claim", w.id, "Success", w.number);
  flowWarranty(s, w, "Claim created");
  return ok(`${w.number} created — ${w.warrantyStatus}`, w);
}
export function recheckClaim(s: AppState, id: string): Result {
  const g = guard(s, "warranty.manage", "review warranty claims", "Warranty Claim", id);
  if (g) return g;
  const w = s.claims.find((x) => x.id === id);
  if (!w) return fail("Claim not found.");
  w.queueId = undefined;
  return flowWarranty(s, w, "Claim updated");
}
export function submitClaim(s: AppState, id: string): Result {
  const g = guard(s, "warranty.manage", "submit warranty claims", "Warranty Claim", id);
  if (g) return g;
  const w = s.claims.find((x) => x.id === id);
  if (!w) return fail("Claim not found.");
  if (w.warrantyStatus === "Ineligible") return fail(`Ineligible claims cannot be submitted: ${w.eligibilityReason}`);
  if (w.warrantyStatus === "Pending Check") return fail("Run the eligibility check first.");
  if (w.approvalStatus !== "Not Submitted") return fail(`Claim is already ${w.approvalStatus}.`);
  w.approvalStatus = "Pending";
  const ap: Approval = { id: uid("ap"), claimId: w.id, type: "Warranty Replacement", reason: `${w.number}: ${w.reason} (${w.warrantyStatus})`, requestedBy: s.currentUserId, approverId: "u-mgr", status: "Pending", createdAt: nowIso(s) };
  s.approvals.unshift(ap);
  audit(s, "Approval submitted", "Approval", ap.id, "Success", ap.reason);
  return ok(`${w.number} submitted for approval`);
}

/* =================== KNOWLEDGE / TEMPLATES =================== */
export function saveArticle(s: AppState, i: Omit<Article, "id" | "updatedAt">, id?: string): Result {
  const g = guard(s, "kb.edit", "edit knowledge articles", "Article", id);
  if (g) return g;
  if (!i.title.trim() || !i.content.trim()) return fail("Title and content are required.");
  if (id) { const a = s.articles.find((x) => x.id === id); if (!a) return fail("Not found"); Object.assign(a, i, { updatedAt: nowIso(s) }); }
  else s.articles.unshift({ ...i, id: uid("kb"), updatedAt: nowIso(s) });
  audit(s, id ? "Article updated" : "Article created", "Article", id, "Success", i.title);
  return ok("Article saved");
}
export function togglePublish(s: AppState, id: string): Result {
  const g = guard(s, "kb.edit", "publish articles", "Article", id);
  if (g) return g;
  const a = s.articles.find((x) => x.id === id);
  if (!a) return fail("Not found");
  a.published = !a.published; a.updatedAt = nowIso(s);
  audit(s, a.published ? "Article published" : "Article unpublished", "Article", id, "Success", a.title);
  return ok(a.published ? "Published" : "Unpublished");
}
export function saveTemplate(s: AppState, i: Omit<PromptTemplate, "id">, id?: string): Result {
  const g = guard(s, "kb.edit", "manage prompt templates", "Prompt Template", id);
  if (g) return g;
  if (!i.name.trim() || !i.body.trim()) return fail("Name and prompt body are required.");
  if (id) { const t = s.templates.find((x) => x.id === id); if (!t) return fail("Not found"); Object.assign(t, i); }
  else s.templates.push({ ...i, id: uid("pt") });
  audit(s, "Prompt template saved", "Prompt Template", id, "Success", i.name);
  return ok("Template saved");
}

/* =================== USERS / SETTINGS =================== */
export function switchUser(s: AppState, userId: string): Result {
  const u = s.users.find((x) => x.id === userId);
  if (!u) return fail("User not found.");
  s.currentUserId = userId;
  audit(s, "Role switched", "User", userId, "Success", `Now acting as ${u.name} (${u.role})`);
  return ok(`Now acting as ${u.name} · ${u.role}`);
}
export function updateUser(s: AppState, id: string, patch: Partial<Pick<User, "role" | "active">>): Result {
  const g = guard(s, "admin", "manage users", "User", id);
  if (g) return g;
  const u = s.users.find((x) => x.id === id);
  if (!u) return fail("User not found.");
  if (id === s.currentUserId && (patch.active === false || (patch.role && patch.role !== "Administrator"))) return fail("You cannot demote or deactivate your own admin account.");
  Object.assign(u, patch);
  audit(s, "User updated", "User", id, "Success", `${u.name}: ${u.role}, ${u.active ? "active" : "inactive"}`);
  return ok(`${u.name} updated`);
}
export function updateQueueMembers(s: AppState, queueId: string, members: string[]): Result {
  const g = guard(s, "case.assign", "manage queue members", "Queue", queueId);
  if (g) return g;
  const q = s.queues.find((x) => x.id === queueId);
  if (!q) return fail("Queue not found.");
  q.members = members;
  audit(s, "Queue updated", "Queue", queueId, "Success", `${q.name}: ${members.length} member(s)`);
  return ok("Queue members updated");
}
export function updateSettings(s: AppState, patch: Partial<AppState["settings"]>): Result {
  const g = guard(s, "admin", "change settings");
  if (g) return g;
  Object.assign(s.settings, patch);
  audit(s, "Settings updated", "Settings", undefined, "Success", JSON.stringify(patch));
  return ok("Settings saved");
}
export function advanceClock(s: AppState, hours: number): Result {
  s.clockOffset += hours * 3600_000;
  audit(s, "Demo clock advanced", "System", undefined, "Success", `+${hours}h (offset ${(s.clockOffset / 3600_000).toFixed(1)}h)`);
  return ok(`Demo clock advanced by ${hours}h`);
}
export function resetClock(s: AppState): Result { s.clockOffset = 0; return ok("Demo clock reset to real time"); }
export function markAllRead(s: AppState): Result { s.notifications.forEach((n) => (n.read = true)); return ok("Notifications marked read"); }

/** Restore specific scenario records to their seeded state (upsert by ID — never duplicates). */
export function loadScenario(s: AppState, which: 1 | 2): Result<string> {
  const seed = buildSeed(Date.now() + s.clockOffset);
  const ids = which === 1 ? SCENARIO_1 : SCENARIO_2;
  const upsert = <T extends { id: string }>(arr: T[], src: T[], id: string) => {
    const rec = structuredClone(src.find((x) => x.id === id)!);
    const i = arr.findIndex((x) => x.id === id);
    if (i >= 0) arr[i] = rec; else arr.unshift(rec);
  };
  upsert(s.customers, seed.customers, ids.customerId);
  upsert(s.orders, seed.orders, ids.orderId);
  if ("productId" in ids) upsert(s.products, seed.products, ids.productId);
  upsert(s.cases, seed.cases, ids.caseId);
  if ("approvalId" in ids) {
    upsert(s.cases, seed.cases, "case-1005");
    upsert(s.orders, seed.orders, "o-1014");
    upsert(s.approvals, seed.approvals, ids.approvalId);
  }
  audit(s, "Demo scenario loaded", "Case", ids.caseId, "Success", which === 1 ? "Defective Wireless Headphones — Customer Support Journey" : "Delayed Order Escalation & Pending Refund");
  return ok(which === 1 ? "Scenario loaded: Priya Sharma's headphone case CS-1001" : "Scenario loaded: delayed order CS-1004 + pending refund", ids.caseId);
}

export function caseResolutionHours(c: SupportCase) {
  return c.resolvedAt ? (new Date(c.resolvedAt).getTime() - new Date(c.createdAt).getTime()) / 3600_000 : null;
}
