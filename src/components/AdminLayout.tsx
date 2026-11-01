import { Outlet, useLocation, useNavigate } from "@/lib/router-compat";
import { useAuth } from "@/contexts/AuthContext";
import { LayoutGrid, Users, ClipboardList, CheckSquare, CalendarDays, Wallet, LogOut, MessageCircle, Settings, Phone, Search, ShieldCheck, LayoutDashboard, Upload, BarChart3 } from "lucide-react";
import { GlassSidebar, GlassMobileMenuButton, GlassBackdrop, GlassTabDock, type GlassNavGroup } from "@/components/GlassSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AdminCommandPalette } from "@/components/AdminCommandPalette";
import { useAdminBadges } from "@/hooks/use-admin-badges";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

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
      { title: "Lead-Mailing", url: "/admin/lead-mailing", icon: Upload },
      { title: "Lead-Postfach", url: "/admin/lead-postfach", icon: MessageCircle },
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

// Einstellungen liegen fest am unteren Rand der Sidebar.
const settingsItem: NavItem = { title: "Einstellungen", url: "/admin/settings", icon: Settings, end: true };

export default function AdminLayout() {
  const { user, isAdmin, canAccessAdmin, loading, signOut } = useAuth();
  const badges = useAdminBadges();
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

  const groups: GlassNavGroup[] = [
    { items: [{ ...dashboardItem }] },
    ...navGroups.map((g): GlassNavGroup => ({
      label: g.label,
      items: g.items.map((i) => ({ ...i, badge: i.badgeKey ? badges[i.badgeKey] : 0 })),
    })),
  ];

  const brand = (
    <>
      <div className="h-9 w-9 rounded-full bg-primary text-primary-foreground grid place-items-center text-sm font-bold shrink-0">A</div>
      <span className="text-sm font-semibold truncate">Admin-Portal</span>
    </>
  );
  const settingsActive = pathname.startsWith("/admin/settings");
  const name = (user.user_metadata?.first_name as string | undefined) || "Admin";

  return (
    <div className="glass-shell min-h-dvh flex flex-col admin-layout lg:pl-24 xl:pl-28">
      <GlassBackdrop />
      <GlassSidebar
        brand={brand}
        groups={groups}
        footer={
          <a href="/admin/settings" aria-label="Einstellungen" className={settingsActive ? "glass-rail-link glass-rail-link-active" : "glass-rail-link"}>
            <Settings className="h-[18px] w-[18px]" />
            <span className="glass-rail-tip">{settingsItem.title}</span>
          </a>
        }
      />
      <header className="portal-header sticky top-0 z-30 px-3 sm:px-6 lg:pl-0 pt-3">
        <div className="glass-panel rounded-full min-h-14 grid grid-cols-[auto_minmax(0,1fr)_auto_auto] sm:flex items-center gap-1 sm:gap-3 px-2 sm:px-3">
          <GlassMobileMenuButton />
          <div className="hidden sm:flex items-center gap-2.5 min-w-0">
            <div className="h-9 w-9 rounded-full bg-primary text-primary-foreground grid place-items-center text-sm font-semibold shrink-0">{name.charAt(0).toUpperCase()}</div>
            <span className="text-sm font-medium truncate">Willkommen, {name}</span>
          </div>
          <Button
            variant="ghost"
            onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
            className="min-w-0 sm:mx-auto flex items-center justify-start gap-2 h-10 w-full sm:w-64 lg:w-80 xl:w-96 text-xs text-muted-foreground rounded-full bg-muted px-2"
            title="Schnellsuche"
            aria-label="Schnellsuche öffnen"
          >
            <span className="h-6 w-6 rounded-full shrink-0 bg-[radial-gradient(circle_at_35%_30%,var(--glass-pill),var(--chart-4)_55%,var(--chart-1))]" aria-hidden />
            <span className="truncate">Suchen oder springen…</span>
            <kbd className="ml-auto hidden sm:inline text-[10px] border border-border rounded px-1.5 py-0.5 shrink-0">⌘K</kbd>
          </Button>
          <ThemeToggle compact />
          <Button variant="ghost" size="icon" onClick={signOut} title="Abmelden" aria-label="Abmelden"
            className="h-10 w-10 rounded-full bg-[var(--glass-pill)] text-[oklch(0.2_0.01_60)] hover:bg-[var(--glass-pill)] shrink-0">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>
      <main className="portal-content flex-1 min-w-0 px-3 sm:px-6 lg:pl-0 pt-4 pb-28">
        <div className="glass-stage rounded-[2rem] min-h-[calc(100dvh-9rem)] overflow-hidden">
          <Outlet />
        </div>
      </main>
      <GlassTabDock groups={groups} />
      <AdminCommandPalette />
    </div>
  );
}
