import { useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard, LifeBuoy, Users, Package, ShoppingCart, ShieldCheck, BookOpen, Sparkles, Workflow, CheckSquare,
  Layers, BarChart3, Lock, ScrollText, Settings, PlayCircle, Bell, Search, Menu, PanelLeftClose, PanelLeftOpen, FlaskConical, Clock, FileCode2, Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useSim } from "@/lib/sim/store";
import { currentUser, now } from "@/lib/sim/rules";
import { markAllRead, switchUser } from "@/lib/sim/actions";
import { fmtDateTime, Pill } from "./kit";

const NAV = [
  { group: "Service", items: [
    { to: "/", label: "Overview", icon: LayoutDashboard },
    { to: "/cases", label: "Cases", icon: LifeBuoy },
    { to: "/customers", label: "Customers", icon: Users },
    { to: "/products", label: "Products", icon: Package },
    { to: "/orders", label: "Orders", icon: ShoppingCart },
    { to: "/warranty", label: "Warranty Claims", icon: ShieldCheck },
    { to: "/knowledge", label: "Knowledge Base", icon: BookOpen },
  ] },
  { group: "AI & Automation", items: [
    { to: "/assistant", label: "AI Assistant", icon: Sparkles },
    { to: "/prompts", label: "Prompt Templates", icon: FileCode2 },
    { to: "/automation", label: "Automation Center", icon: Workflow },
    { to: "/approvals", label: "Approval Requests", icon: CheckSquare },
    { to: "/queues", label: "Queues & Assignment", icon: Layers },
  ] },
  { group: "Insights & Admin", items: [
    { to: "/reports", label: "Reports & Analytics", icon: BarChart3 },
    { to: "/security", label: "Users & Security", icon: Lock },
    { to: "/audit", label: "Activity & Audit", icon: ScrollText },
    { to: "/settings", label: "Settings", icon: Settings },
    { to: "/employee", label: "AI Employee Demo", icon: Bot },
    { to: "/demo", label: "Demo Mode", icon: PlayCircle },
  ] },
] as const;

function NavList({ collapsed, onNav }: { collapsed?: boolean; onNav?: () => void }) {
  const { state } = useSim();
  const pending = state.approvals.filter((a) => a.status === "Pending").length;
  return (
    <nav className="flex-1 space-y-5 overflow-y-auto px-2 py-4" aria-label="Main">
      {NAV.map((g) => (
        <div key={g.group}>
          {!collapsed && <div className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{g.group}</div>}
          <ul className="space-y-0.5">
            {g.items.map((it) => (
              <li key={it.to}>
                <Link to={it.to} onClick={onNav} activeOptions={{ exact: it.to === "/" }} title={collapsed ? it.label : undefined}
                  className={cn("flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground", collapsed && "justify-center")}
                  activeProps={{ className: "bg-sidebar-accent font-medium text-sidebar-accent-foreground" }}>
                  <it.icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span className="flex-1 truncate">{it.label}</span>}
                  {!collapsed && it.to === "/approvals" && pending > 0 && <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">{pending}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function Brand({ collapsed }: { collapsed?: boolean }) {
  return (
    <Link to="/" className="flex h-14 items-center gap-2 border-b px-4">
      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground"><LifeBuoy className="h-4 w-4" /></span>
      {!collapsed && <span className="text-sm font-semibold leading-tight">ServiceFlow AI<span className="block text-[11px] font-normal text-muted-foreground">Support Automation</span></span>}
    </Link>
  );
}

function GlobalSearch() {
  const { state } = useSim();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (t.length < 2) return [];
    const cases = state.cases.filter((c) => `${c.number} ${c.subject}`.toLowerCase().includes(t)).slice(0, 5).map((c) => ({ k: c.id, label: `${c.number} · ${c.subject}`, type: "Case", go: () => navigate({ to: "/cases/$id", params: { id: c.id } }) }));
    const cus = state.customers.filter((c) => `${c.name} ${c.email} ${c.phone}`.toLowerCase().includes(t)).slice(0, 4).map((c) => ({ k: c.id, label: c.name, type: "Customer", go: () => navigate({ to: "/customers/$id", params: { id: c.id } }) }));
    const ords = state.orders.filter((o) => `${o.number} ${o.tracking}`.toLowerCase().includes(t)).slice(0, 3).map((o) => ({ k: o.id, label: `${o.number} · ${o.tracking}`, type: "Order", go: () => navigate({ to: "/orders/$id", params: { id: o.id } }) }));
    return [...cases, ...cus, ...ords];
  }, [q, state, navigate]);
  return (
    <Popover open={open && results.length > 0} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} placeholder="Search cases, customers, orders…" aria-label="Global search"
            className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        </div>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-1" onOpenAutoFocus={(e) => e.preventDefault()}>
        {results.map((r) => (
          <button key={r.type + r.k} onClick={() => { r.go(); setOpen(false); setQ(""); }} className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted">
            <span className="truncate">{r.label}</span><span className="text-xs text-muted-foreground">{r.type}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { state, run, runQuiet } = useSim();
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const me = currentUser(state);
  const unread = state.notifications.filter((n) => !n.read).length;
  const offsetH = state.clockOffset / 3600_000;

  return (
    <div className="flex min-h-screen bg-background">
      <aside className={cn("sticky top-0 hidden h-screen shrink-0 flex-col border-r bg-sidebar lg:flex", collapsed ? "w-16" : "w-60")}>
        <Brand collapsed={collapsed} />
        <NavList collapsed={collapsed} />
        <button onClick={() => setCollapsed(!collapsed)} className="flex items-center gap-2 border-t px-4 py-3 text-xs text-muted-foreground hover:text-foreground" aria-label="Toggle sidebar">
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <><PanelLeftClose className="h-4 w-4" /> Collapse</>}
        </button>
      </aside>
      <Sheet open={mobile} onOpenChange={setMobile}>
        <SheetContent side="left" className="flex w-64 flex-col p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Brand />
          <NavList onNav={() => setMobile(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-center gap-2 border-b border-warning/30 bg-warning/15 px-4 py-1 text-center text-[11px] font-semibold tracking-wide text-warning-foreground">
          <FlaskConical className="h-3.5 w-3.5" /> SIMULATION MODE — NO LIVE SALESFORCE CONNECTION
          {offsetH !== 0 && <span className="ml-2 inline-flex items-center gap-1 font-medium"><Clock className="h-3 w-3" /> Demo clock +{offsetH}h</span>}
        </div>
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-card/95 px-4 backdrop-blur">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobile(true)} aria-label="Open navigation"><Menu className="h-5 w-5" /></Button>
          <GlobalSearch />
          <div className="ml-auto flex items-center gap-1.5">
            <Pill t="amber" className="hidden md:inline-flex"><FlaskConical className="h-3 w-3" /> Simulation</Pill>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative" aria-label={`Notifications (${unread} unread)`}>
                  <Bell className="h-4 w-4" />
                  {unread > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">{unread}</span>}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <div className="flex items-center justify-between px-2 py-1.5">
                  <DropdownMenuLabel className="p-0">In-app notifications</DropdownMenuLabel>
                  <button className="text-xs text-primary hover:underline" onClick={() => runQuiet(markAllRead)}>Mark all read</button>
                </div>
                <DropdownMenuSeparator />
                <div className="max-h-80 overflow-y-auto">
                  {state.notifications.length === 0 && <p className="p-4 text-center text-xs text-muted-foreground">No notifications</p>}
                  {state.notifications.slice(0, 20).map((n) => (
                    <div key={n.id} className={cn("border-b px-3 py-2 last:border-0", !n.read && "bg-accent/50")}>
                      <div className="flex items-center gap-2 text-xs font-medium">
                        <span className={cn("h-1.5 w-1.5 rounded-full", n.level === "critical" ? "bg-destructive" : n.level === "warning" ? "bg-warning" : "bg-primary")} />{n.title}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">{fmtDateTime(n.at)}</p>
                    </div>
                  ))}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-muted" aria-label="Switch demo user">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{me.name.split(" ").map((p) => p[0]).join("")}</span>
                  <span className="hidden text-left text-xs leading-tight sm:block"><span className="block font-medium">{me.name}</span><span className="text-muted-foreground">{me.role}</span></span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>Act as demo user</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {state.users.filter((u) => u.active).map((u) => (
                  <DropdownMenuItem key={u.id} onClick={() => run(switchUser, u.id)} className={cn(u.id === me.id && "bg-accent")}>
                    <div className="text-xs"><div className="font-medium">{u.name}</div><div className="text-muted-foreground">{u.role}</div></div>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <p className="px-2 py-1.5 text-[11px] text-muted-foreground">Client-side role simulation for demonstration only. Demo time: {now(state).toLocaleString()}</p>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 md:px-6">{children}</main>
      </div>
    </div>
  );
}
