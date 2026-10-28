import { useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import type { CaseStatus, Priority } from "@/lib/sim/types";
import type { SlaState } from "@/lib/sim/rules";
import { fmtDuration } from "@/lib/sim/rules";

export function PageHeader({ title, description, actions, crumbs }: { title: string; description?: string; actions?: ReactNode; crumbs?: { label: string; to?: string }[] }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {crumbs && (
          <nav aria-label="Breadcrumb" className="mb-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1">
                {c.to ? <a href={c.to} className="hover:text-primary hover:underline">{c.label}</a> : <span className="text-foreground">{c.label}</span>}
                {i < crumbs.length - 1 && <ChevronRight className="h-3 w-3" />}
              </span>
            ))}
          </nav>
        )}
        <h1 className="truncate text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, description, actions, children, className, bodyClass }: { title?: ReactNode; description?: string; actions?: ReactNode; children: ReactNode; className?: string; bodyClass?: string }) {
  return (
    <section className={cn("rounded-lg border bg-card shadow-card", className)}>
      {(title || actions) && (
        <header className="flex items-start justify-between gap-3 border-b px-4 py-3">
          <div>
            {title && <h2 className="text-sm font-semibold">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn("p-4", bodyClass)}>{children}</div>
    </section>
  );
}

const tone = {
  neutral: "bg-muted text-muted-foreground border-border",
  blue: "bg-primary/10 text-primary border-primary/20",
  green: "bg-success/10 text-success border-success/25",
  amber: "bg-warning/15 text-warning-foreground border-warning/30",
  red: "bg-destructive/10 text-destructive border-destructive/25",
  violet: "bg-ai/10 text-ai border-ai/25",
  sky: "bg-info/10 text-info border-info/25",
} as const;
export type Tone = keyof typeof tone;
export function Pill({ t = "neutral", children, className }: { t?: Tone; children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium", tone[t], className)}>{children}</span>;
}
const STATUS_TONE: Record<CaseStatus, Tone> = { New: "sky", Working: "blue", Escalated: "red", "Waiting for Customer": "amber", Resolved: "green", Closed: "neutral" };
export const StatusBadge = ({ status }: { status: CaseStatus }) => <Pill t={STATUS_TONE[status]}>{status}</Pill>;
const PRIO_TONE: Record<Priority, Tone> = { Critical: "red", High: "amber", Medium: "blue", Low: "neutral" };
export const PriorityBadge = ({ p }: { p: Priority }) => <Pill t={PRIO_TONE[p]}>{p}</Pill>;
export function SlaBadge({ state, ms }: { state: SlaState; ms: number }) {
  const t: Tone = state === "Met" ? "green" : state === "Breached" ? "red" : state === "At Risk" ? "amber" : "blue";
  const label = state === "Breached" ? (ms < 0 ? `Breached · ${fmtDuration(ms)}` : "Breached") : state === "On Track" || state === "At Risk" ? `${state} · ${fmtDuration(ms)} left` : "Met";
  return <Pill t={t}>{label}</Pill>;
}
export function toneFor(v: string): Tone {
  if (/approved|eligible$|success|delivered|paid|active|refunded|published/i.test(v)) return "green";
  if (/reject|ineligible|fail|cancel|denied|delayed|inactive|discontinued/i.test(v)) return "red";
  if (/pending|review|skipped|waiting/i.test(v)) return "amber";
  return "blue";
}
export const AutoPill = ({ v }: { v: string }) => <Pill t={toneFor(v)}>{v}</Pill>;

export function Kpi({ label, value, hint, icon, t = "blue" }: { label: string; value: ReactNode; hint?: string; icon?: ReactNode; t?: Tone }) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-card">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {icon && <span className={cn("rounded-md border p-1.5", tone[t])}>{icon}</span>}
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function Empty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <Inbox className="h-8 w-8 text-muted-foreground/60" />
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="max-w-sm text-xs text-muted-foreground">{hint}</p>}
      {action}
    </div>
  );
}

export function Field({ label, required, error, children, hint }: { label: string; required?: boolean; error?: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium">{label}{required && <span className="text-destructive"> *</span>}</span>
      {children}
      {error ? <span className="block text-xs text-destructive">{error}</span> : hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

export function Select({ value, onChange, options, placeholder, className, ariaLabel }: { value: string; onChange: (v: string) => void; options: (string | { value: string; label: string })[]; placeholder?: string; className?: string; ariaLabel?: string }) {
  return (
    <select aria-label={ariaLabel} value={value} onChange={(e) => onChange(e.target.value)}
      className={cn("h-9 w-full rounded-md border border-input bg-card px-2.5 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => typeof o === "string" ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export function Confirm({ trigger, title, description, confirmLabel = "Confirm", onConfirm, destructive }: { trigger: ReactNode; title: string; description: string; confirmLabel?: string; onConfirm: () => void; destructive?: boolean }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>{title}</AlertDialogTitle><AlertDialogDescription>{description}</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className={destructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : undefined}>{confirmLabel}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function usePaged<T>(items: T[], size = 10) {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(items.length / size));
  const cur = Math.min(page, pages);
  const slice = useMemo(() => items.slice((cur - 1) * size, cur * size), [items, cur, size]);
  const pager = items.length > size ? (
    <div className="flex items-center justify-between border-t px-4 py-2 text-xs text-muted-foreground">
      <span>{(cur - 1) * size + 1}–{Math.min(cur * size, items.length)} of {items.length}</span>
      <div className="flex gap-1">
        <Button size="icon" variant="outline" className="h-7 w-7" aria-label="Previous page" disabled={cur <= 1} onClick={() => setPage(cur - 1)}><ChevronLeft className="h-4 w-4" /></Button>
        <Button size="icon" variant="outline" className="h-7 w-7" aria-label="Next page" disabled={cur >= pages} onClick={() => setPage(cur + 1)}><ChevronRight className="h-4 w-4" /></Button>
      </div>
    </div>
  ) : null;
  return { slice, pager, setPage };
}

export const Th = ({ children, className, onClick, active, dir }: { children?: ReactNode; className?: string; onClick?: () => void; active?: boolean; dir?: "asc" | "desc" }) => (
  <th className={cn("h-9 whitespace-nowrap px-3 text-left text-xs font-medium text-muted-foreground", onClick && "cursor-pointer select-none hover:text-foreground", className)} onClick={onClick} aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : undefined}>
    {children}{active && <span className="ml-1">{dir === "asc" ? "↑" : "↓"}</span>}
  </th>
);
export const Td = ({ children, className }: { children?: ReactNode; className?: string }) => <td className={cn("px-3 py-2.5 align-middle text-sm", className)}>{children}</td>;
export const TableWrap = ({ children }: { children: ReactNode }) => (
  <div className="overflow-x-auto"><table className="w-full border-collapse [&_tbody_tr]:border-t [&_tbody_tr:hover]:bg-muted/50">{children}</table></div>
);

export const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—");
export const fmtDateTime = (iso?: string) => (iso ? new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
export const money = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function download(name: string, content: string, type = "text/csv") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const RecordLink = ({ to, params, children }: { to: "/cases/$id" | "/customers/$id" | "/orders/$id"; params: { id: string }; children: ReactNode }) => (
  <Link to={to} params={params} className="font-medium text-primary hover:underline">{children}</Link>
);

export function useSort<T>(items: T[], initial: { key: string; dir: "asc" | "desc" }, getters: Record<string, (t: T) => string | number>) {
  const [sort, setSort] = useState(initial);
  const sorted = useMemo(() => {
    const g = getters[sort.key];
    if (!g) return items;
    return [...items].sort((a, b) => { const x = g(a), y = g(b); const r = x < y ? -1 : x > y ? 1 : 0; return sort.dir === "asc" ? r : -r; });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, sort]);
  const th = (key: string) => ({ onClick: () => setSort((s) => ({ key, dir: s.key === key && s.dir === "desc" ? "asc" : "desc" })), active: sort.key === key, dir: sort.dir });
  return { sorted, th };
}
