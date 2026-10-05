import { Outlet, useLocation, useNavigate } from "@/lib/router-compat";
import { useAuth } from "@/contexts/AuthContext";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { LayoutGrid, Users, ClipboardList, CheckSquare, CalendarDays, Wallet, LogOut, MessageCircle, RotateCcw, History, Settings, Phone, Search, ShieldCheck, LayoutDashboard, Upload, Server, Handshake, BarChart3 } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AdminCommandPalette } from "@/components/AdminCommandPalette";
import { useAdminBadges } from "@/hooks/use-admin-badges";
import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type BadgeKey = "unreadChat" | "pendingKyc" | "newApplications";
type NavItem = {
  title: string;
  url: string;
  icon: typeof LayoutGrid;
  end?: boolean;
  badgeKey?: BadgeKey;
};
type NavGroup = { label: string; items: NavItem[] };

// Gruppierte Navigation – übersichtlicher als flache Liste.
const dashboardItem: NavItem = { title: "Dashboard", url: "/admin", icon: LayoutDashboard, end: true };

const navGroups: NavGroup[] = [
  {
    label: "Personen",
    items: [
      { title: "Bewerbungen", url: "/admin/bewerbungen", icon: Users, badgeKey: "newApplications" },
      { title: "Mitarbeiter", url: "/admin/mitarbeiter", icon: Users },
      { title: "Mitarbeiter-Termine", url: "/admin/appointments", icon: CalendarDays },
    ],
  },
  {
    label: "Auftragszuweisung",
    items: [
      { title: "Auftrags-Übersicht", url: "/admin/tasks", icon: ClipboardList },
      { title: "Prüfungen", url: "/admin/reviews", icon: CheckSquare },
      { title: "Uploads", url: "/admin/uploads", icon: Upload },
    ],
  },
  {
    label: "Kommunikation",
    items: [
      { title: "Chat", url: "/admin/chat", icon: MessageCircle, badgeKey: "unreadChat" },
      { title: "SMS", url: "/admin/sms", icon: Phone },
      { title: "WebID-Simulation", url: "/admin/webid-sim", icon: ShieldCheck },
    ],
  },
  {
    label: "Finanzen & Auswertung",
    items: [
      { title: "Transaktionen", url: "/admin/transactions", icon: Wallet },
      { title: "Statistiken", url: "/admin/statistiken", icon: BarChart3 },
    ],
  },
];

// Einstellungen liegen fest am unteren Rand – nicht in den aufklappbaren Gruppen.
const settingsItem: NavItem = { title: "Einstellungen", url: "/admin/settings", icon: Settings, end: true };

function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { signOut, isAdmin } = useAuth();
  const badges = useAdminBadges();
  const { pathname } = useLocation();
  const groups = isAdmin ? navGroups : [];

  // Nur die Gruppe der aktuellen Seite ist offen — das hält die Sidebar ruhig.
  const activeGroup =
    groups.find((g) => g.items.some((i) => pathname === i.url || pathname.startsWith(i.url + "/")))?.label ?? groups[0].label;
  const [openGroups, setOpenGroups] = useState<string[]>([activeGroup]);
  useEffect(() => {
    setOpenGroups((prev) => (prev.includes(activeGroup) ? prev : [...prev, activeGroup]));
  }, [activeGroup]);
  const toggleGroup = (label: string) =>
    setOpenGroups((prev) => (prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]));

  const renderItem = (item: NavItem) => {
    const count = item.badgeKey ? badges[item.badgeKey] : 0;
    return (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton asChild>
          <NavLink
            to={item.url}
            end={item.end}
            className="sidebar-nav-link flex! flex-row! flex-nowrap! items-center! gap-2.5 px-2.5 h-auto! min-h-9 rounded-lg text-[12.5px] font-medium overflow-hidden whitespace-nowrap"
            activeClassName="active!"
          >
            <item.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.5} />
            {!collapsed && <span className="truncate min-w-0">{item.title}</span>}
            {count > 0 && (
              <span
                className={
                  collapsed
                    ? "sidebar-badge absolute top-1 right-1 inline-flex h-3.5 min-w-[14px] px-1 rounded-full text-[9px] font-semibold items-center justify-center leading-none"
                    : "sidebar-badge ml-auto inline-flex h-[18px] min-w-[18px] w-auto px-1.5 rounded-full text-[10px] font-semibold items-center justify-center leading-none shrink-0"
                }
              >
                {count > 99 ? "99+" : count}
              </span>
            )}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar">
      <SidebarContent className="flex flex-col h-full">
        {/* Brand */}
        <div className={collapsed ? "px-2 py-4 flex justify-center border-b border-sidebar-border" : "px-4 py-4 flex items-center gap-2.5 border-b border-sidebar-border"}>
          <div className="h-8 w-8 rounded-lg bg-primary grid place-items-center text-primary-foreground text-sm font-bold shrink-0">
            A
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight min-w-0">
              <span className="text-[15px] font-bold text-sidebar-foreground tracking-tight">
                {isAdmin ? "ADMIN" : "TEAM"}
              </span>
              <span className="text-[9px] font-medium tracking-[0.18em] uppercase text-muted-foreground">
                Management
              </span>
            </div>
          )}
        </div>

        {/* Dashboard solo */}
        {isAdmin && (
          <div className="px-2">
            <SidebarGroup className="py-0">
              <SidebarGroupContent>
                <SidebarMenu className="gap-0.5">{renderItem(dashboardItem)}</SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </div>
        )}

        {/* Gruppierte Navigation – einklappbar */}
        <div className="flex-1 overflow-y-auto px-2 pb-2">
          {groups.map((grp) => {
            const groupBadge = grp.items.reduce((sum, i) => sum + (i.badgeKey ? badges[i.badgeKey] : 0), 0);
            if (collapsed) {
              return (
                <SidebarGroup key={grp.label} className="py-1">
                  <SidebarGroupContent>
                    <SidebarMenu className="gap-0.5">{grp.items.map(renderItem)}</SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              );
            }
            const open = openGroups.includes(grp.label);
            return (
              <Collapsible key={grp.label} open={open} onOpenChange={() => toggleGroup(grp.label)}>
                <SidebarGroup className="py-1">
                  <CollapsibleTrigger className="w-full">
                    <SidebarGroupLabel className="w-full flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-sidebar-foreground/40 px-2.5 mb-1.5 mt-2 cursor-pointer hover:text-sidebar-foreground/70">
                      <span className="truncate">{grp.label}</span>
                      {!open && groupBadge > 0 && (
                        <span className="ml-1 inline-flex h-[15px] min-w-[15px] px-1 sidebar-badge rounded-full text-[9px] font-semibold items-center justify-center leading-none">
                          {groupBadge > 99 ? "99+" : groupBadge}
                        </span>
                      )}
                      <ChevronDown className={`ml-auto h-3.5 w-3.5 transition-transform ${open ? "" : "-rotate-90"}`} />
                    </SidebarGroupLabel>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarGroupContent>
                      <SidebarMenu className="gap-0.5">{grp.items.map(renderItem)}</SidebarMenu>
                    </SidebarGroupContent>
                  </CollapsibleContent>
                </SidebarGroup>
              </Collapsible>
            );
          })}
        </div>

        {/* Einstellungen + Logout */}
        <div className="border-t border-sidebar-border p-2">
          <SidebarMenu className="gap-0.5">
            {isAdmin && renderItem(settingsItem)}
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={signOut}
                className="text-sidebar-foreground/55 hover:text-sidebar-foreground hover:bg-sidebar-accent text-[12.5px] font-medium gap-3 py-2"
              >
                <LogOut className="h-[18px] w-[18px] shrink-0" strokeWidth={1.5} />
                {!collapsed && <span>Abmelden</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}

export default function AdminLayout() {
  const { user, isAdmin, canAccessAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Admin-Only: Mitarbeiter-Admin-Unterkonten sind deaktiviert (nur Hauptadmin erlaubt).
  useEffect(() => {
    if (!loading && !user) navigate("/login");
    if (!loading && user && !canAccessAdmin) navigate("/dashboard");
    if (!loading && user && canAccessAdmin && !isAdmin) navigate("/login");
  }, [user, isAdmin, canAccessAdmin, loading, pathname, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-primary/20 animate-pulse" />
          <p className="text-sm text-muted-foreground">Laden…</p>
        </div>
      </div>
    );
  }

  if (!user || !canAccessAdmin || !isAdmin) return null;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full admin-layout">
        <AdminSidebar />
        <div className="flex-1 flex flex-col min-w-0 bg-background">
          <header className="h-14 flex items-center border-b border-border bg-card px-4 sm:px-5 gap-3 shrink-0">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
            <div className="h-4 w-px bg-border" />
            <span className="text-[11px] font-heading font-semibold text-muted-foreground uppercase tracking-[0.18em]">
              Admin Panel
            </span>
            <button
              onClick={() => {
                // Synthetic Cmd+K
                window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
              }}
              className="ml-2 hidden sm:flex items-center gap-2.5 h-8 w-56 lg:w-64 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg bg-muted/40 px-3 transition-colors hover:border-ring"
              title="Schnellsuche"
            >
              <Search className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Suchen…</span>
              <kbd className="ml-auto text-[10px] border border-border rounded px-1.5 py-0.5 bg-background shrink-0">⌘K</kbd>
            </button>
            <div className="ml-auto">
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
          <AdminCommandPalette />
        </div>
      </div>
    </SidebarProvider>
  );
}
