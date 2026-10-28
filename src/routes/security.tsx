import { createFileRoute } from "@tanstack/react-router";
import { Check, Minus, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useSim } from "@/lib/sim/store";
import { switchUser, updateUser } from "@/lib/sim/actions";
import { currentUser, PERM_LABELS, ROLE_PERMS, type Perm } from "@/lib/sim/rules";
import { ROLES, type Role } from "@/lib/sim/types";
import { PageHeader, Panel, Pill, Select, TableWrap, Td, Th } from "@/components/app/kit";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/security")({
  head: () => seo("Users & Security", "Demo users, role switcher and permission matrix."),
  component: Security,
});

function Security() {
  const { state, run } = useSim();
  const me = currentUser(state);
  return (
    <>
      <PageHeader title="User Management & Security" description="Simulated roles and permissions enforced by a central authorization check on every protected action." />
      <div className="mb-4 flex gap-3 rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm">
        <ShieldAlert className="h-5 w-5 shrink-0 text-warning-foreground" />
        <p>Client-side role simulation is for demonstration only and is <b>not production-grade security</b>. Real deployments require server-side authentication and authorization.</p>
      </div>
      <Panel title="Demo users" description={`You are acting as ${me.name} (${me.role}).`} bodyClass="p-0">
        <TableWrap><thead><tr><Th>User</Th><Th>Title</Th><Th>Role</Th><Th>Active</Th><Th /></tr></thead>
          <tbody>{state.users.map((u) => (
            <tr key={u.id}><Td className="font-medium">{u.name}<div className="text-xs font-normal text-muted-foreground">{u.email}</div></Td><Td className="text-xs">{u.title}</Td>
              <Td><Select className="h-8 w-48" ariaLabel="Role" value={u.role} onChange={(v) => run(updateUser, u.id, { role: v as Role })} options={ROLES} /></Td>
              <Td><Switch checked={u.active} onCheckedChange={(v) => run(updateUser, u.id, { active: v })} aria-label="Active" /></Td>
              <Td className="text-right">{u.id === me.id ? <Pill t="blue">Current</Pill> : <Button size="sm" variant="outline" disabled={!u.active} onClick={() => run(switchUser, u.id)}>Act as</Button>}</Td></tr>))}
          </tbody></TableWrap>
      </Panel>
      <Panel className="mt-4" title="Permission matrix" bodyClass="p-0">
        <TableWrap><thead><tr><Th>Permission</Th>{ROLES.map((r) => <Th key={r} className="text-center">{r}</Th>)}</tr></thead>
          <tbody>{(Object.keys(PERM_LABELS) as Perm[]).map((p) => (
            <tr key={p}><Td className="text-xs font-medium">{PERM_LABELS[p]}</Td>{ROLES.map((r) => <Td key={r} className="text-center">{ROLE_PERMS[r].includes(p) ? <Check className="mx-auto h-4 w-4 text-success" /> : <Minus className="mx-auto h-4 w-4 text-muted-foreground/50" />}</Td>)}</tr>))}
          </tbody></TableWrap>
        <p className="border-t px-4 py-3 text-xs text-muted-foreground">Approvals additionally require being the request's designated approver (or Administrator). Denied attempts are written to the audit log.</p>
      </Panel>
    </>
  );
}
