import { createFileRoute, useLocation } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useSim } from "@/lib/sim/store";
import { saveArticle, togglePublish } from "@/lib/sim/actions";
import { caseKnowledge } from "@/lib/sim/ai";
import type { Article } from "@/lib/sim/types";
import { Empty, Field, fmtDate, PageHeader, Panel, Pill, RecordLink, Select } from "@/components/app/kit";
import { SimpleDialog } from "@/components/app/forms";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/knowledge")({
  head: () => seo("Knowledge Base", "Searchable support articles used by agents and the AI assistant."),
  component: Knowledge,
});

type AInput = Omit<Article, "id" | "updatedAt">;

function Knowledge() {
  const { state, run } = useSim();
  const loc = useLocation();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [sel, setSel] = useState<string>(state.articles[0]?.id ?? "");
  const [dlg, setDlg] = useState<{ id?: string; f: AInput; kw: string } | null>(null);
  useEffect(() => { if (loc.hash && state.articles.some((a) => a.id === loc.hash)) setSel(loc.hash); }, [loc.hash, state.articles]);
  const cats = [...new Set(state.articles.map((a) => a.category))];
  const list = useMemo(() => state.articles.filter((a) => `${a.title} ${a.category} ${a.keywords.join(" ")}`.toLowerCase().includes(q.toLowerCase()) && (!cat || a.category === cat)), [state.articles, q, cat]);
  const a = state.articles.find((x) => x.id === sel);
  const related = a ? state.cases.filter((c) => caseKnowledge(state, c).some((k) => k.id === a.id)).slice(0, 6) : [];
  return (
    <>
      <PageHeader title="Knowledge Base" description="Fictional support articles. Only published articles appear in AI suggestions."
        actions={<Button onClick={() => setDlg({ f: { title: "", category: "General", keywords: [], content: "", published: true }, kw: "" })}><Plus className="h-4 w-4" /> New article</Button>} />
      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <Panel bodyClass="p-0">
          <div className="space-y-2 border-b p-3"><Input placeholder="Search title, category, keywords…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search articles" /><Select ariaLabel="Category" value={cat} onChange={setCat} placeholder="All categories" options={cats} /></div>
          {list.length === 0 ? <Empty title="No articles" /> : <ul className="max-h-[600px] overflow-y-auto">{list.map((x) => (
            <li key={x.id}><button onClick={() => setSel(x.id)} className={`w-full border-b px-4 py-2.5 text-left hover:bg-muted ${sel === x.id ? "bg-accent" : ""}`}>
              <div className="text-sm font-medium">{x.title}</div><div className="mt-0.5 flex gap-1.5 text-xs text-muted-foreground">{x.category}{!x.published && <Pill t="amber">Draft</Pill>}</div></button></li>))}
          </ul>}
        </Panel>
        {a ? (
          <Panel title={a.title} description={`${a.category} · updated ${fmtDate(a.updatedAt)}`}
            actions={<>
              <label className="flex items-center gap-2 text-xs">Published <Switch checked={a.published} onCheckedChange={() => run(togglePublish, a.id)} /></label>
              <Button size="sm" variant="outline" onClick={() => { const { id, updatedAt: _u, ...f } = a; setDlg({ id, f, kw: a.keywords.join(", ") }); }}><Pencil className="h-4 w-4" /> Edit</Button>
            </>}>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{a.content}</p>
            <div className="mt-4 flex flex-wrap gap-1">{a.keywords.map((k) => <Pill key={k}>{k}</Pill>)}</div>
            <div className="mt-6 border-t pt-4"><h3 className="mb-2 text-xs font-semibold">Related cases</h3>
              {related.length === 0 ? <p className="text-xs text-muted-foreground">No cases match this article.</p> : <ul className="space-y-1">{related.map((c) => <li key={c.id} className="text-sm"><RecordLink to="/cases/$id" params={{ id: c.id }}>{c.number}</RecordLink> <span className="text-muted-foreground">{c.subject}</span></li>)}</ul>}
            </div>
          </Panel>
        ) : <Panel><Empty title="Select an article" /></Panel>}
      </div>
      {dlg && <SimpleDialog open onOpenChange={(o) => !o && setDlg(null)} title={dlg.id ? "Edit article" : "New article"}
        onSubmit={() => { if (run(saveArticle, { ...dlg.f, keywords: dlg.kw.split(",").map((k) => k.trim().toLowerCase()).filter(Boolean) }, dlg.id).ok) setDlg(null); }}>
        <Field label="Title" required><Input value={dlg.f.title} onChange={(e) => setDlg({ ...dlg, f: { ...dlg.f, title: e.target.value } })} /></Field>
        <Field label="Category"><Input value={dlg.f.category} onChange={(e) => setDlg({ ...dlg, f: { ...dlg.f, category: e.target.value } })} /></Field>
        <Field label="Keywords" hint="Comma-separated"><Input value={dlg.kw} onChange={(e) => setDlg({ ...dlg, kw: e.target.value })} /></Field>
        <Field label="Content" required><Textarea rows={6} value={dlg.f.content} onChange={(e) => setDlg({ ...dlg, f: { ...dlg.f, content: e.target.value } })} /></Field>
      </SimpleDialog>}
    </>
  );
}
