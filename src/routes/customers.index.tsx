import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSim } from "@/lib/sim/store";
import { AutoPill, Empty, fmtDate, PageHeader, Panel, Pill, RecordLink, TableWrap, Td, Th, usePaged, useSort } from "@/components/app/kit";
import { CustomerFormDialog } from "@/components/app/forms";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/customers/")({
  head: () => seo("Customers", "Customer directory with related cases, orders and warranty claims."),
  component: Customers,
});

function Customers() {
  const { state } = useSim();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const list = useMemo(() => state.customers.filter((c) => `${c.name} ${c.email} ${c.phone}`.toLowerCase().includes(q.toLowerCase())), [state.customers, q]);
  const cnt = (id: string) => state.cases.filter((c) => c.customerId === id).length;
  const { sorted, th } = useSort(list, { key: "name", dir: "asc" }, { name: (c) => c.name, country: (c) => c.country, cases: (c) => cnt(c.id), since: (c) => c.since });
  const { slice, pager } = usePaged(sorted, 12);
  return (
    <>
      <PageHeader title="Customers" description="Fictional customer records." actions={<Button onClick={() => setOpen(true)}><UserPlus className="h-4 w-4" /> Add customer</Button>} />
      <Panel bodyClass="p-0">
        <div className="border-b p-4"><Input className="max-w-sm" placeholder="Search by name, email or phone…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search customers" /></div>
        {sorted.length === 0 ? <Empty title="No customers found" /> : (
          <TableWrap>
            <thead><tr><Th {...th("name")}>Name</Th><Th>Contact</Th><Th {...th("country")}>Country</Th><Th>Type</Th><Th>Status</Th><Th {...th("cases")}>Cases</Th><Th {...th("since")}>Since</Th></tr></thead>
            <tbody>{slice.map((c) => (
              <tr key={c.id}><Td><RecordLink to="/customers/$id" params={{ id: c.id }}>{c.name}</RecordLink></Td><Td className="text-xs">{c.email}<div className="text-muted-foreground">{c.phone}</div></Td><Td>{c.country}</Td><Td><Pill t={c.type === "VIP" ? "violet" : "neutral"}>{c.type}</Pill></Td><Td><AutoPill v={c.status} /></Td><Td>{cnt(c.id)}</Td><Td className="text-xs">{fmtDate(c.since)}</Td></tr>
            ))}</tbody>
          </TableWrap>)}
        {pager}
      </Panel>
      <CustomerFormDialog open={open} onOpenChange={setOpen} onSaved={(id) => navigate({ to: "/customers/$id", params: { id } })} />
    </>
  );
}
