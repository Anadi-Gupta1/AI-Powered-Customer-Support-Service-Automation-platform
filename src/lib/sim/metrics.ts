import type { AppState, SupportCase } from "./types";
import { avgResolutionHours, caseSla, countBy, csat, DAY, isOpen, now } from "./rules";

export function inRange(s: AppState, iso: string, days: number | null) {
  if (days == null) return true;
  return new Date(iso).getTime() >= now(s).getTime() - days * DAY;
}

export function dashboardMetrics(s: AppState, days: number | null) {
  const cases = s.cases.filter((c) => inRange(s, c.createdAt, days));
  const today = now(s).toISOString().slice(0, 10);
  return {
    cases,
    total: cases.length,
    open: cases.filter(isOpen).length,
    resolved: cases.filter((c) => !isOpen(c)).length,
    escalated: cases.filter((c) => c.status === "Escalated").length,
    today: cases.filter((c) => c.createdAt.slice(0, 10) === today).length,
    avgRes: avgResolutionHours(cases),
    breaches: cases.filter((c) => caseSla(s, c).state === "Breached").length,
    csat: csat(cases),
    rated: cases.filter((c) => c.rating != null).length,
  };
}

export function trend(s: AppState, cases: SupportCase[], days: number) {
  const n = Math.min(days, 30);
  const end = now(s).getTime();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(end - (n - 1 - i) * DAY).toISOString().slice(0, 10);
    const rated = cases.filter((c) => c.resolvedAt?.slice(0, 10) === d && c.rating != null);
    return {
      name: d.slice(5),
      Created: cases.filter((c) => c.createdAt.slice(0, 10) === d).length,
      Resolved: cases.filter((c) => c.resolvedAt?.slice(0, 10) === d).length,
      CSAT: rated.length ? +(rated.reduce((a, c) => a + (c.rating ?? 0), 0) / rated.length).toFixed(2) : null,
    };
  });
}

export const byAgent = (s: AppState, cases: SupportCase[]) =>
  countBy(cases, (c) => s.users.find((u) => u.id === c.agentId)?.name ?? "Unassigned");
export { countBy };
