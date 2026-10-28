import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import type { AppState, Result } from "./types";
import { buildSeed, STORAGE_VERSION } from "./seed";

export const STORAGE_KEY = "support-sim:v" + STORAGE_VERSION;
const REQUIRED: (keyof AppState)[] = ["customers", "products", "orders", "cases", "claims", "articles", "approvals", "logs", "audit", "users", "queues", "templates", "notifications", "settings"];

export function validateState(x: unknown): { ok: true; state: AppState } | { ok: false; error: string } {
  if (!x || typeof x !== "object") return { ok: false, error: "Data is not an object." };
  const o = x as Record<string, unknown>;
  if (o.version !== STORAGE_VERSION) return { ok: false, error: `Unsupported data version (expected ${STORAGE_VERSION}).` };
  for (const k of REQUIRED) {
    if (k === "settings") { if (!o.settings || typeof o.settings !== "object") return { ok: false, error: "Missing settings." }; continue; }
    if (!Array.isArray(o[k])) return { ok: false, error: `Missing or invalid "${k}" list.` };
  }
  const st = o as unknown as AppState;
  const cust = new Set(st.customers.map((c) => c.id));
  const bad = st.cases.find((c) => !cust.has(c.customerId));
  if (bad) return { ok: false, error: `Case ${bad.number} references unknown customer ${bad.customerId}.` };
  if (!st.users.some((u) => u.id === st.currentUserId)) return { ok: false, error: "Current user not found." };
  return { ok: true, state: st };
}

export function loadState(): { state: AppState; recovered: boolean } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { state: buildSeed(), recovered: false };
    const v = validateState(JSON.parse(raw));
    if (v.ok) return { state: v.state, recovered: false };
  } catch { /* fall through */ }
  return { state: buildSeed(), recovered: true };
}

type Fn<A extends unknown[], R> = (s: AppState, ...a: A) => Result<R>;
interface Ctx {
  state: AppState;
  run: <A extends unknown[], R>(fn: Fn<A, R>, ...args: A) => Result<R>;
  runQuiet: <A extends unknown[], R>(fn: Fn<A, R>, ...args: A) => Result<R>;
  replace: (s: AppState, msg: string) => void;
}
const SimCtx = createContext<Ctx | null>(null);

export function SimProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState | null>(null);
  const ref = useRef<AppState | null>(null);

  useEffect(() => {
    const { state: s, recovered } = loadState();
    ref.current = s;
    setState(s);
    if (recovered) toast.warning("Stored demo data was invalid — restored the seeded demo environment.");
  }, []);
  useEffect(() => {
    if (!state) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { toast.error("Could not save to browser storage."); }
  }, [state]);

  const exec = useCallback(<A extends unknown[], R>(quiet: boolean, fn: Fn<A, R>, ...args: A): Result<R> => {
    if (!ref.current) return { ok: false, message: "Loading" };
    const draft = structuredClone(ref.current);
    let res: Result<R>;
    try { res = fn(draft, ...args); } catch (e) { res = { ok: false, message: e instanceof Error ? e.message : "Unexpected error" }; }
    ref.current = draft;
    setState(draft);
    if (!res.ok) toast.error(res.message);
    else if (!quiet) toast.success(res.message);
    return res;
  }, []);

  const replace = useCallback((s: AppState, msg: string) => { ref.current = s; setState(s); toast.success(msg); }, []);

  if (!state) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">Loading demo environment…</div>
    );
  }
  return (
    <SimCtx.Provider value={{ state, replace, run: (fn, ...a) => exec(false, fn, ...a), runQuiet: (fn, ...a) => exec(true, fn, ...a) }}>
      {children}
    </SimCtx.Provider>
  );
}

export function useSim() {
  const c = useContext(SimCtx);
  if (!c) throw new Error("useSim outside provider");
  return c;
}
