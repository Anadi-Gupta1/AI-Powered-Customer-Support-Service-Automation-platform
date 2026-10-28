import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Bot, Copy, Send, Sparkles, User } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSim } from "@/lib/sim/store";
import { caseContext, caseKnowledge, draftUpdate, MOCK_PROVIDER, nextAction, searchKnowledge } from "@/lib/sim/ai";
import { applyAI, generateAI, addNote } from "@/lib/sim/actions";
import { AutoPill, Empty, money, PageHeader, Panel, Pill, PriorityBadge, RecordLink, Select, StatusBadge } from "@/components/app/kit";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/assistant")({
  head: () => seo("AI Assistant", "Simulated Agentforce-style support copilot using local case data."),
  component: Assistant,
});

type Msg = { id: number; role: "agent" | "ai"; text: string; kind?: "summary" | "response" | "update" | "info" };

function Assistant() {
  const { state, run } = useSim();
  const [caseId, setCaseId] = useState(state.cases.find((c) => c.status !== "Closed")?.id ?? "");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const idRef = useRef(1);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { setMsgs([]); }, [caseId]);
  useEffect(() => { endRef.current?.scrollIntoView({ block: "nearest" }); }, [msgs]);
  const c = state.cases.find((x) => x.id === caseId);
  const ctx = c ? caseContext(state, c) : null;

  const push = (m: Omit<Msg, "id">) => setMsgs((p) => [...p, { ...m, id: idRef.current++ }]);
  const ask = (label: string, fn: () => Omit<Msg, "id" | "role"> | null) => {
    if (!c) { toast.error("Select a case first."); return; }
    push({ role: "agent", text: label });
    setBusy(true);
    setTimeout(() => { const r = fn(); if (r) push({ role: "ai", ...r }); setBusy(false); }, 500);
  };
  const actions = {
    summary: () => ask("Generate a case summary", () => { const r = run(generateAI, c!.id, "summary"); return r.ok ? { text: r.data as string, kind: "summary" } : null; }),
    response: () => ask("Draft a customer response", () => { const r = run(generateAI, c!.id, "response"); return r.ok ? { text: r.data as string, kind: "response" } : null; }),
    next: () => ask("Recommend the next action", () => { const n = nextAction(state, c!); return { text: `Recommended next action: ${n.action}\nReason: ${n.reason}`, kind: "info" }; }),
    kb: () => ask("Search the knowledge base for this case", () => { const k = caseKnowledge(state, c!); return { text: k.length ? k.map((a) => `• ${a.title} — ${a.content.slice(0, 110)}…`).join("\n") : "No published articles match this case.", kind: "info" }; }),
    update: () => ask("Draft an internal case update", () => ({ text: draftUpdate(state, c!), kind: "update" })),
  };
  const free = () => {
    const t = input.trim(); if (!t) return; setInput("");
    const l = t.toLowerCase();
    if (/summar/.test(l)) return actions.summary();
    if (/respon|reply|email|draft/.test(l)) return actions.response();
    if (/next|recommend|should/.test(l)) return actions.next();
    ask(t, () => { const k = searchKnowledge(state, t); return { text: k.length ? `Relevant articles:\n${k.map((a) => `• ${a.title}`).join("\n")}` : "The mock assistant handles summaries, responses, next actions and knowledge search. Try one of the suggested prompts.", kind: "info" }; });
  };

  return (
    <>
      <PageHeader title="AI Assistant" description="Agent copilot simulating Agentforce / Prompt Builder behaviour. All output is generated locally and is a draft until an agent applies it."
        actions={<Pill t="violet"><Sparkles className="h-3 w-3" /> {MOCK_PROVIDER}</Pill>} />
      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <Panel bodyClass="flex h-[640px] flex-col p-0" title={<div className="flex items-center gap-2"><span>Case</span><Select ariaLabel="Select case" className="h-8 w-80" value={caseId} onChange={setCaseId} placeholder="Select a case…" options={state.cases.map((x) => ({ value: x.id, label: `${x.number} · ${x.subject}` }))} /></div>}>
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {msgs.length === 0 && <Empty title={c ? "Ask the assistant about this case" : "Select a case to begin"} hint="Use the suggested prompts below. Responses use this case's stored customer, order, product and approval data." />}
            {msgs.map((m) => (
              <div key={m.id} className={`flex gap-2 ${m.role === "agent" ? "justify-end" : ""}`}>
                {m.role === "ai" && <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ai/10 text-ai"><Bot className="h-4 w-4" /></span>}
                <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${m.role === "agent" ? "bg-primary text-primary-foreground" : "border border-ai/20 bg-ai/5"}`}>
                  {m.role === "ai" && <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold text-ai">AI suggestion (simulated){(m.kind === "response" || m.kind === "summary") && <Pill t="amber">Needs approval to apply</Pill>}</div>}
                  <pre className="whitespace-pre-wrap font-sans">{m.text}</pre>
                  {m.role === "ai" && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { navigator.clipboard?.writeText(m.text); toast.success("Copied"); }}><Copy className="h-3 w-3" /> Copy</Button>
                      {(m.kind === "summary" || m.kind === "response") && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => run(applyAI, c!.id, m.kind as "summary" | "response", m.text)}>Approve & apply to case</Button>}
                      {m.kind === "update" && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => run(addNote, c!.id, m.text)}>Add as internal note</Button>}
                    </div>)}
                </div>
                {m.role === "agent" && <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted"><User className="h-4 w-4" /></span>}
              </div>))}
            {busy && <p className="animate-pulse text-xs text-muted-foreground">Mock provider is composing a draft…</p>}
            <div ref={endRef} />
          </div>
          <div className="border-t p-3">
            <div className="mb-2 flex flex-wrap gap-1.5">
              <Button size="sm" variant="outline" className="h-7 text-xs" disabled={busy} onClick={actions.summary}>Generate Summary</Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" disabled={busy} onClick={actions.response}>Generate Response</Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" disabled={busy} onClick={actions.next}>Recommend Next Action</Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" disabled={busy} onClick={actions.kb}>Search Knowledge Base</Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" disabled={busy} onClick={actions.update}>Draft Case Update</Button>
            </div>
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); free(); }}>
              <Input placeholder="Ask e.g. “What should I do next?”" value={input} onChange={(e) => setInput(e.target.value)} aria-label="Message" />
              <Button type="submit" disabled={busy || !c} aria-label="Send"><Send className="h-4 w-4" /></Button>
            </form>
          </div>
        </Panel>
        <div className="space-y-4">
          {c && ctx ? <>
            <Panel title="Case" description="Existing system data">
              <RecordLink to="/cases/$id" params={{ id: c.id }}>{c.number}</RecordLink><p className="mt-1 text-sm">{c.subject}</p>
              <div className="mt-2 flex flex-wrap gap-1.5"><StatusBadge status={c.status} /><PriorityBadge p={c.priority} /><Pill>{c.category}</Pill></div>
              <p className="mt-3 rounded-md bg-muted p-2 text-xs"><span className="font-semibold">Customer said:</span> {c.description}</p>
            </Panel>
            <Panel title="Customer">
              {ctx.customer && <><RecordLink to="/customers/$id" params={{ id: ctx.customer.id }}>{ctx.customer.name}</RecordLink><p className="text-xs text-muted-foreground">{ctx.customer.email} · {ctx.customer.country} · {ctx.customer.type}</p></>}
            </Panel>
            <Panel title="Order & product">
              {ctx.order ? <div className="text-sm"><div className="flex justify-between"><RecordLink to="/orders/$id" params={{ id: ctx.order.id }}>{ctx.order.number}</RecordLink><AutoPill v={ctx.order.shipping} /></div><p className="text-xs text-muted-foreground">{money(ctx.order.total)} · {ctx.order.payment} · {ctx.order.tracking}</p></div> : <p className="text-xs text-muted-foreground">No order linked</p>}
              {ctx.product && <p className="mt-2 text-xs">{ctx.product.name} · {ctx.product.warrantyMonths}-month warranty</p>}
              {ctx.claim && <p className="mt-2 text-xs">Claim {ctx.claim.number}: <AutoPill v={ctx.claim.warrantyStatus} /></p>}
              {ctx.approvals.map((a) => <p key={a.id} className="mt-2 text-xs">{a.type} approval: <AutoPill v={a.status} /></p>)}
            </Panel>
          </> : <Panel><Empty title="No case selected" /></Panel>}
          <p className="px-1 text-xs text-muted-foreground">Prompts and outputs stay in this browser. Manage templates in <Link to="/prompts" className="text-primary hover:underline">Prompt Templates</Link>.</p>
        </div>
      </div>
    </>
  );
}
