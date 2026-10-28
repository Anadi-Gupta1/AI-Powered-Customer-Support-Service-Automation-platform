import { describe, expect, it } from "vitest";
import { buildSeed } from "@/lib/sim/seed";
import * as A from "@/lib/sim/actions";
import { caseSla, warrantyEligibility, routeQueue, can } from "@/lib/sim/rules";
import { summarize, suggestResponse } from "@/lib/sim/ai";
import { validateState } from "@/lib/sim/store";
import { dashboardMetrics } from "@/lib/sim/metrics";
import type { AppState } from "@/lib/sim/types";

const fresh = (): AppState => buildSeed(Date.UTC(2026, 9, 28, 12));
const nc = { subject: "Test", description: "Desc", customerId: "c-001", origin: "Web" as const, category: "Warranty" as const, priority: "Low" as const };

describe("seed", () => {
  it("meets minimum counts", () => {
    const s = fresh();
    expect(s.customers.length).toBeGreaterThanOrEqual(12);
    expect(s.products.length).toBeGreaterThanOrEqual(10);
    expect(s.orders.length).toBeGreaterThanOrEqual(15);
    expect(s.cases.length).toBeGreaterThanOrEqual(15);
    expect(s.claims.length).toBeGreaterThanOrEqual(6);
    expect(s.articles.length).toBeGreaterThanOrEqual(10);
    expect(s.approvals.length).toBeGreaterThanOrEqual(4);
  });
});

describe("cases", () => {
  it("requires subject and valid customer", () => {
    const s = fresh();
    expect(A.createCase(s, { ...nc, subject: "" }).ok).toBe(false);
    expect(A.createCase(s, { ...nc, customerId: "nope" }).ok).toBe(false);
  });
  it("rejects an order belonging to another customer", () => {
    expect(A.createCase(fresh(), { ...nc, orderId: "o-1002" }).ok).toBe(false);
  });
  it("generates unique sequential case numbers", () => {
    const s = fresh();
    const a = A.createCase(s, nc).data!, b = A.createCase(s, nc).data!;
    expect(a.number).toBe("CS-1016");
    expect(b.number).toBe("CS-1017");
  });
  it("routes by category", () => {
    expect(routeQueue("Shipping Delay")).toBe("q-order");
    expect(routeQueue("Warranty")).toBe("q-warranty");
    expect(routeQueue("Product Defect")).toBe("q-tech");
    expect(routeQueue("General")).toBe("q-general");
    const s = fresh();
    const c = A.createCase(s, nc).data!;
    expect(c.queueId).toBe("q-warranty");
    expect(c.agentId).toBe("u-ws");
  });
  it("escalates critical cases automatically", () => {
    const s = fresh();
    const c = A.createCase(s, { ...nc, priority: "Critical" }).data!;
    expect(c.status).toBe("Escalated");
    expect(c.urgent).toBe(true);
  });
  it("requires resolution notes and records resolvedAt", () => {
    const s = fresh();
    expect(A.setStatus(s, "case-1001", "Resolved").ok).toBe(false);
    expect(A.setStatus(s, "case-1001", "Resolved", "Reset fixed it").ok).toBe(true);
    const c = s.cases.find((x) => x.id === "case-1001")!;
    expect(c.resolvedAt).toBeTruthy();
    expect(c.followUpAt).toBeTruthy();
  });
  it("dashboard metrics update after resolving", () => {
    const s = fresh();
    const before = dashboardMetrics(s, null).resolved;
    A.setStatus(s, "case-1001", "Resolved", "done");
    expect(dashboardMetrics(s, null).resolved).toBe(before + 1);
  });
});

describe("SLA", () => {
  it("breaches when time passes without response", () => {
    const s = fresh();
    const c = A.createCase(s, { ...nc, priority: "High" }).data!;
    expect(caseSla(s, c).state).toBe("On Track");
    A.advanceClock(s, 2);
    expect(caseSla(s, c).state).toBe("Breached");
  });
});

describe("warranty", () => {
  it("eligible inside period, review in grace window, ineligible after", () => {
    const s = fresh();
    const base = { productId: "p-001", orderId: "o-1001", purchaseDate: "2025-01-01" };
    expect(warrantyEligibility(s, { ...base, claimDate: "2025-12-01" }).status).toBe("Eligible");
    expect(warrantyEligibility(s, { ...base, claimDate: "2026-01-15" }).status).toBe("Requires Review");
    expect(warrantyEligibility(s, { ...base, claimDate: "2026-06-01" }).status).toBe("Ineligible");
  });
});

describe("approvals", () => {
  it("only the designated approver or admin can decide, once", () => {
    const s = fresh();
    A.switchUser(s, "u-a1");
    expect(A.decideApproval(s, "ap-1", true, "").ok).toBe(false);
    A.switchUser(s, "u-mgr");
    expect(A.decideApproval(s, "ap-1", true, "").ok).toBe(false);
    A.switchUser(s, "u-appr");
    expect(A.decideApproval(s, "ap-1", false, "").ok).toBe(false);
    expect(A.decideApproval(s, "ap-1", true, "ok").ok).toBe(true);
    expect(A.decideApproval(s, "ap-1", false, "again").ok).toBe(false);
    expect(s.audit.some((a) => a.outcome === "Denied")).toBe(true);
  });
});

describe("permissions", () => {
  it("agents cannot run automations", () => {
    const s = fresh();
    A.switchUser(s, "u-a1");
    expect(can(s, "automation.run")).toBe(false);
    expect(A.runAutomation(s, "sla").ok).toBe(false);
  });
});

describe("AI simulation", () => {
  it("uses real case data", () => {
    const s = fresh();
    const c = s.cases.find((x) => x.id === "case-1002")!;
    expect(suggestResponse(s, c)).toContain(s.orders.find((o) => o.id === "o-1002")!.tracking);
    expect(summarize(s, s.cases[0])).toContain("Priya Sharma");
  });
  it("never promises an unapproved refund", () => {
    const s = fresh();
    expect(suggestResponse(s, s.cases.find((x) => x.id === "case-1005")!)).toMatch(/no refund has been issued/);
  });
});

describe("automation & scenarios", () => {
  it("logs every run and avoids duplicate reminders", () => {
    const s = fresh();
    A.advanceClock(s, 96);
    A.runAutomation(s, "reminder");
    const n = s.notifications.length;
    A.runAutomation(s, "reminder");
    expect(s.notifications.length).toBe(n);
    expect(s.logs[0].automation).toBe("Three-Day Reminder Flow");
  });
  it("loading the scenario twice creates no duplicates", () => {
    const s = fresh();
    A.loadScenario(s, 1); A.loadScenario(s, 1);
    expect(s.cases.filter((c) => c.id === "case-1001").length).toBe(1);
    expect(s.customers.length).toBe(fresh().customers.length);
  });
  it("import validation rejects bad data", () => {
    expect(validateState({ foo: 1 }).ok).toBe(false);
    expect(validateState(JSON.parse(JSON.stringify(fresh()))).ok).toBe(true);
  });
});
