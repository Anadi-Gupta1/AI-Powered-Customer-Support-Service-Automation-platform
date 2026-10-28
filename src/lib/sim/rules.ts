import type { AppState, Category, Priority, Role, SupportCase, WarrantyClaim, WarrantyStatus } from "./types";

export const HOUR = 3600_000;
export const DAY = 24 * HOUR;

export const now = (s: AppState) => new Date(Date.now() + s.clockOffset);
export const nowIso = (s: AppState) => now(s).toISOString();

let counter = 0;
export const uid = (p: string) => `${p}-${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export const isOpen = (c: SupportCase) => c.status !== "Resolved" && c.status !== "Closed";

/* ---------- Permissions (client-side simulation only) ---------- */
export type Perm =
  | "view" | "case.create" | "case.edit" | "case.assign" | "customer.view" | "customer.edit"
  | "warranty.manage" | "approve" | "automation.run" | "kb.edit" | "admin";
export const PERM_LABELS: Record<Perm, string> = {
  view: "View records", "case.create": "Create cases", "case.edit": "Edit cases", "case.assign": "Assign cases",
  "customer.view": "View customer info", "customer.edit": "Edit customers & catalog", "warranty.manage": "Manage warranty claims",
  approve: "Approve requests", "automation.run": "Run automations", "kb.edit": "Edit knowledge base", admin: "Manage users & settings",
};
export const ROLE_PERMS: Record<Role, Perm[]> = {
  Administrator: Object.keys(PERM_LABELS) as Perm[],
  "Support Manager": ["view", "case.create", "case.edit", "case.assign", "customer.view", "customer.edit", "warranty.manage", "approve", "automation.run", "kb.edit"],
  "Support Agent": ["view", "case.create", "case.edit", "customer.view"],
  "Warranty Specialist": ["view", "case.edit", "customer.view", "warranty.manage"],
  Approver: ["view", "customer.view", "approve"],
};
export const currentUser = (s: AppState) => s.users.find((u) => u.id === s.currentUserId) ?? s.users[0];
export const can = (s: AppState, p: Perm) => ROLE_PERMS[currentUser(s).role].includes(p);

/* ---------- Routing ---------- */
export const ROUTING: Record<Category, string> = {
  "Order Tracking": "q-order", "Shipping Delay": "q-order", Refund: "q-order",
  Warranty: "q-warranty", "Product Defect": "q-tech", Technical: "q-tech", General: "q-general",
};
export const routeQueue = (c: Category) => ROUTING[c] ?? "q-general";

export function pickAgent(s: AppState, queueId: string) {
  const q = s.queues.find((x) => x.id === queueId);
  if (!q) return undefined;
  const eligible = s.users.filter((u) => q.members.includes(u.id) && u.active && (u.role === "Support Agent" || u.role === "Warranty Specialist"));
  if (!eligible.length) return undefined;
  const load = (id: string) => s.cases.filter((c) => c.agentId === id && isOpen(c)).length;
  return [...eligible].sort((a, b) => load(a.id) - load(b.id) || a.id.localeCompare(b.id))[0];
}

/* ---------- SLA ---------- */
export type SlaState = "Met" | "Breached" | "At Risk" | "On Track";
export const slaDeadlineFor = (s: AppState, createdAt: string, p: Priority) =>
  new Date(new Date(createdAt).getTime() + s.settings.sla[p] * 60_000).toISOString();

export function slaStatus(c: SupportCase, at: Date, windowMin: number): { state: SlaState; msRemaining: number } {
  const deadline = new Date(c.slaDeadline).getTime();
  const responded = c.firstResponseAt ?? c.resolvedAt;
  if (responded) {
    const t = new Date(responded).getTime();
    return { state: t <= deadline ? "Met" : "Breached", msRemaining: deadline - t };
  }
  const rem = deadline - at.getTime();
  if (rem < 0) return { state: "Breached", msRemaining: rem };
  if (rem < windowMin * 60_000 * 0.25) return { state: "At Risk", msRemaining: rem };
  return { state: "On Track", msRemaining: rem };
}
export const caseSla = (s: AppState, c: SupportCase) => slaStatus(c, now(s), s.settings.sla[c.priority]);

export function fmtDuration(ms: number) {
  const a = Math.abs(ms);
  const d = Math.floor(a / DAY), h = Math.floor((a % DAY) / HOUR), m = Math.floor((a % HOUR) / 60_000);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  return `${m}m`;
}

/* ---------- Warranty ---------- */
export function addMonths(iso: string, months: number) {
  const d = new Date(iso);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}
export function warrantyEligibility(s: AppState, claim: Pick<WarrantyClaim, "productId" | "orderId" | "purchaseDate" | "claimDate">): { status: WarrantyStatus; reason: string } {
  const product = s.products.find((p) => p.id === claim.productId);
  const order = s.orders.find((o) => o.id === claim.orderId);
  if (!product || !order) return { status: "Requires Review", reason: "Product or order record could not be found." };
  if (!order.lines.some((l) => l.productId === product.id)) return { status: "Requires Review", reason: `Order ${order.number} does not contain ${product.name}; manual verification needed.` };
  const purchase = new Date(claim.purchaseDate), claimed = new Date(claim.claimDate);
  if (isNaN(purchase.getTime()) || isNaN(claimed.getTime())) return { status: "Requires Review", reason: "Purchase or claim date is invalid." };
  if (claimed < purchase) return { status: "Ineligible", reason: "Claim date is before the purchase date." };
  const expiry = addMonths(claim.purchaseDate, product.warrantyMonths);
  if (claimed <= expiry) return { status: "Eligible", reason: `Claimed within the ${product.warrantyMonths}-month warranty (expires ${expiry.toISOString().slice(0, 10)}).` };
  const over = Math.ceil((claimed.getTime() - expiry.getTime()) / DAY);
  if (over <= s.settings.warrantyGraceDays) return { status: "Requires Review", reason: `Warranty expired ${over} day(s) ago — within the ${s.settings.warrantyGraceDays}-day grace window, needs manual review.` };
  return { status: "Ineligible", reason: `Warranty expired ${expiry.toISOString().slice(0, 10)} (${over} days before the claim).` };
}

/* ---------- Metrics ---------- */
export function avgResolutionHours(cases: SupportCase[]) {
  const r = cases.filter((c) => c.resolvedAt);
  if (!r.length) return null;
  return r.reduce((a, c) => a + (new Date(c.resolvedAt!).getTime() - new Date(c.createdAt).getTime()), 0) / r.length / HOUR;
}
export function csat(cases: SupportCase[]) {
  const r = cases.filter((c) => typeof c.rating === "number");
  if (!r.length) return null;
  return r.reduce((a, c) => a + (c.rating ?? 0), 0) / r.length;
}
export const countBy = <T,>(items: T[], key: (t: T) => string | undefined) => {
  const m: Record<string, number> = {};
  items.forEach((i) => { const k = key(i) ?? "Unassigned"; m[k] = (m[k] ?? 0) + 1; });
  return Object.entries(m).map(([name, value]) => ({ name, value }));
};

export function nextCaseNumber(s: AppState) {
  const max = s.cases.reduce((m, c) => Math.max(m, parseInt(c.number.split("-")[1] ?? "0", 10) || 0), s.caseSeq);
  return `CS-${max + 1}`;
}

export function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => { const t = v == null ? "" : String(v); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}
