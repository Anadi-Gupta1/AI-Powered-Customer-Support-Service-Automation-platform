import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSim } from "@/lib/sim/store";
import { deleteProduct, saveProduct } from "@/lib/sim/actions";
import type { Product } from "@/lib/sim/types";
import { AutoPill, Confirm, Empty, Field, money, PageHeader, Panel, Pill, Select, TableWrap, Td, Th, usePaged, useSort } from "@/components/app/kit";
import { SimpleDialog } from "@/components/app/forms";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/products")({
  head: () => seo("Products", "Product catalog with SKU, stock and warranty duration."),
  component: Products,
});

type PInput = Omit<Product, "id">;
const blank: PInput = { name: "", sku: "", category: "Audio", brand: "", price: 0, warrantyMonths: 12, stock: 0, status: "Active" };

function Products() {
  const { state, run } = useSim();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [dlg, setDlg] = useState<{ id?: string; f: PInput } | null>(null);
  const cats = [...new Set(state.products.map((p) => p.category))];
  const list = useMemo(() => state.products.filter((p) => `${p.name} ${p.sku} ${p.brand}`.toLowerCase().includes(q.toLowerCase()) && (!cat || p.category === cat)), [state.products, q, cat]);
  const { sorted, th } = useSort(list, { key: "name", dir: "asc" }, { name: (p) => p.name, price: (p) => p.price, stock: (p) => p.stock, warranty: (p) => p.warrantyMonths });
  const { slice, pager } = usePaged(sorted, 12);
  const set = <K extends keyof PInput>(k: K, v: PInput[K]) => dlg && setDlg({ ...dlg, f: { ...dlg.f, [k]: v } });
  return (
    <>
      <PageHeader title="Products" description="Catalog used for case linking and warranty checks." actions={<Button onClick={() => setDlg({ f: blank })}><Plus className="h-4 w-4" /> Add product</Button>} />
      <Panel bodyClass="p-0">
        <div className="flex flex-wrap gap-2 border-b p-4"><Input className="max-w-xs" placeholder="Search name, SKU, brand…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search products" /><Select className="w-44" ariaLabel="Category" value={cat} onChange={setCat} placeholder="All categories" options={cats} /></div>
        {sorted.length === 0 ? <Empty title="No products found" /> : <TableWrap>
          <thead><tr><Th {...th("name")}>Product</Th><Th>SKU</Th><Th>Category</Th><Th {...th("price")}>Price</Th><Th {...th("warranty")}>Warranty</Th><Th {...th("stock")}>Stock</Th><Th>Status</Th><Th /></tr></thead>
          <tbody>{slice.map((p) => (
            <tr key={p.id}><Td className="font-medium">{p.name}<div className="text-xs font-normal text-muted-foreground">{p.brand}</div></Td><Td className="font-mono text-xs">{p.sku}</Td><Td>{p.category}</Td><Td>{money(p.price)}</Td><Td>{p.warrantyMonths} mo</Td>
              <Td>{p.stock === 0 ? <Pill t="red">Out of stock</Pill> : p.stock < 50 ? <Pill t="amber">{p.stock} low</Pill> : p.stock}</Td><Td><AutoPill v={p.status} /></Td>
              <Td className="whitespace-nowrap text-right"><Button size="icon" variant="ghost" aria-label="Edit" onClick={() => { const { id, ...f } = p; setDlg({ id, f }); }}><Pencil className="h-4 w-4" /></Button>
                <Confirm destructive trigger={<Button size="icon" variant="ghost" aria-label="Delete"><Trash2 className="h-4 w-4" /></Button>} title={`Delete ${p.name}?`} description="Products referenced by orders or cases cannot be deleted." onConfirm={() => run(deleteProduct, p.id)} confirmLabel="Delete" /></Td></tr>
          ))}</tbody></TableWrap>}
        {pager}
      </Panel>
      {dlg && <SimpleDialog open onOpenChange={(o) => !o && setDlg(null)} title={dlg.id ? "Edit product" : "Add product"} onSubmit={() => { if (run(saveProduct, dlg.f, dlg.id).ok) setDlg(null); }}>
        <Field label="Name" required><Input value={dlg.f.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="SKU" required><Input value={dlg.f.sku} onChange={(e) => set("sku", e.target.value)} /></Field>
          <Field label="Brand"><Input value={dlg.f.brand} onChange={(e) => set("brand", e.target.value)} /></Field>
          <Field label="Category"><Input value={dlg.f.category} onChange={(e) => set("category", e.target.value)} /></Field>
          <Field label="Price (USD)"><Input type="number" min={0} value={dlg.f.price} onChange={(e) => set("price", Number(e.target.value))} /></Field>
          <Field label="Warranty (months)"><Input type="number" min={0} value={dlg.f.warrantyMonths} onChange={(e) => set("warrantyMonths", Number(e.target.value))} /></Field>
          <Field label="Stock"><Input type="number" min={0} value={dlg.f.stock} onChange={(e) => set("stock", Number(e.target.value))} /></Field>
          <Field label="Status"><Select value={dlg.f.status} onChange={(v) => set("status", v as PInput["status"])} options={["Active", "Discontinued"]} /></Field>
        </div>
      </SimpleDialog>}
    </>
  );
}
