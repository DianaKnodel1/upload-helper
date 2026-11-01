import { Outlet, useNavigate, useLocation } from "@/lib/router-compat";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { GuidedOnboarding, HeaderHelpButton } from "@/components/GuidedOnboarding";
import { OnboardingPopup } from "@/components/OnboardingPopup";
import {
  LayoutDashboard,
  Bell,
  ShieldCheck,
  FileSignature,
  CalendarDays,
  ClipboardList,
  UploadCloud,
  MessageSquare,
  Settings,
  LogOut,
} from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import FloatingChat from "@/components/FloatingChat";
import WhatsAppSupportButton from "@/components/WhatsAppSupportButton";
import { MissingPayrollDataBanner } from "@/components/MissingPayrollDataBanner";
import { GlassSidebar, GlassMobileMenuButton, type GlassNavGroup } from "@/components/GlassSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { EmployeeStatus } from "@/lib/status";
import { hasFullAccess } from "@/lib/employee-utils";
import { isLocalOrPreview } from "@/lib/domain-utils";

const ALWAYS_ALLOWED_PATHS = ["/dashboard", "/verification", "/contract", "/onboarding", "/chat", "/personal-data", "/payroll-data", "/settings", "/documents"];

// Mitbewerber-Navigation (1:1) – mit farbigen Icons
type NavItem = {
  title: string;
  url: string;
  icon: any;
  requiresActive: boolean;
  dot?: "orange" | "blue" | null;
};

function buildNavItems(opts: {
  kycPending: boolean;
  kycRejected: boolean;
  contractPending: boolean;
  smsVisible: boolean;
}): NavItem[] {
  const items: NavItem[] = [
    { title: "Übersicht", url: "/dashboard", icon: LayoutDashboard, requiresActive: false },
    { title: "Mitteilungen", url: "/notifications", icon: Bell, requiresActive: false },
  ];

  if (opts.kycPending || opts.kycRejected) {
    items.push({
      title: "Verifizierung",
      url: "/verification",
      icon: ShieldCheck,
      requiresActive: false,
      dot: "orange",
    });
  }

  if (opts.contractPending) {
    items.push({
      title: "Arbeitsvertrag",
      url: "/contract",
      icon: FileSignature,
      requiresActive: false,
      dot: "blue",
    });
  }

  items.push(
    { title: "Termin buchen", url: "/appointments", icon: CalendarDays, requiresActive: true },
    { title: "Aufträge", url: "/tasks", icon: ClipboardList, requiresActive: true },
  );

  if (opts.smsVisible) {
    items.push({ title: "SMS", url: "/sms", icon: MessageSquare, requiresActive: true });
  }

  items.push(
    { title: "Upload Center", url: "/documents", icon: UploadCloud, requiresActive: false },
    { title: "Einstellungen", url: "/settings", icon: Settings, requiresActive: false },
  );

  return items;
}

export default function EmployeeLayout() {
  const { user, loading, isAdmin, signOut } = useAuth();
  const { tenant } = useTenant();
  const navigate = useNavigate();
  const location = useLocation();
  const [employeeStatus, setEmployeeStatus] = useState<EmployeeStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [kycPending, setKycPending] = useState(false);
  const [kycRejected, setKycRejected] = useState(false);
  const [contractPending, setContractPending] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [kycOpen, setKycOpen] = useState(false);
  const [checkedPath, setCheckedPath] = useState<string | null>(null);
  const [smsVisible, setSmsVisible] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate("/login");
    if (!loading && user && isAdmin) navigate("/admin");
  }, [user, loading, isAdmin, navigate]);

  // Self-Heal: Wenn der Mitarbeiter auf einer echten Portal-Subdomain eingeloggt
  // ist und sein profile.tenant_id NICHT zum Domain-Tenant passt, automatisch
  // korrigieren. Behebt Altbestand, der vor dem Subdomain-Tenant-Fix
  // registriert wurde (z.B. dgi-tenant statt kadermarketing-tenant).
  useEffect(() => {
    if (!user || !tenant?.id) return;
    if (isLocalOrPreview()) return; // niemals auf Preview/Localhost umhängen
    (async () => {
      const { data: prof } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (prof && prof.tenant_id !== tenant.id) {
        await supabase
          .from("profiles")
          .update({ tenant_id: tenant.id })
          .eq("user_id", user.id);
      }
    })();
  }, [user, tenant?.id]);

  useEffect(() => {
    if (!user) return;
    const path = location.pathname;
    Promise.all([
      supabase.from("profiles").select("status, contract_signed_at, onboarding_status").eq("user_id", user.id).maybeSingle(),
      supabase.from("kyc_verifications").select("status").eq("user_id", user.id).maybeSingle(),
    ]).then(([profileRes, kycRes]) => {
      setEmployeeStatus((profileRes.data?.status as EmployeeStatus) ?? null);
      setContractPending(!profileRes.data?.contract_signed_at);
      setOnboardingDone(profileRes.data?.onboarding_status === "abgeschlossen");
      const kycStatus = kycRes.data?.status;
      setKycRejected(kycStatus === "abgelehnt");
      setKycOpen(!kycStatus || kycStatus === "nicht_gestartet" || kycStatus === "abgelehnt");
      setCheckedPath(path);
      setKycPending(!kycStatus || kycStatus === "nicht_gestartet" || kycStatus === "in_pruefung");
      setStatusLoading(false);
    });
  }, [user, location.pathname]);

  // SMS tab visibility: visible as soon as the employee has at least one
  // active sms_assignment (no task linkage required).
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const refresh = async () => {
      const { data: assigns } = await supabase
        .from("sms_assignments")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .limit(1);
      if (!cancelled) setSmsVisible((assigns?.length ?? 0) > 0);
    };
    refresh();
    const interval = setInterval(refresh, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [user]);

  useEffect(() => {
    if (statusLoading || !employeeStatus) return;
    if (employeeStatus === "deaktiviert") navigate("/login");
  }, [employeeStatus, statusLoading, navigate]);

  useEffect(() => {
    if (statusLoading || !employeeStatus) return;
    if (hasFullAccess(employeeStatus)) return;
    // Pflicht-Ablauf offen: dort übernimmt die Ablauf-Weiterleitung (kein Ping-Pong).
    if (contractPending || kycOpen || !onboardingDone) return;
    const isAllowed = ALWAYS_ALLOWED_PATHS.some((p) => location.pathname.startsWith(p));
    if (!isAllowed) navigate("/dashboard");
  }, [location.pathname, employeeStatus, statusLoading, contractPending, kycOpen, onboardingDone, navigate]);

  // Pflicht-Ablauf nach der Registrierung: Vertrag -> Ausweis -> Einführung.
  // Jeder wird zum ersten offenen Schritt geleitet; der Chat bleibt erreichbar.
  useEffect(() => {
    if (statusLoading || !user) return;
    if (checkedPath !== location.pathname) return; // erst frischen Stand abwarten
    const target = contractPending ? "/contract" : kycOpen ? "/verification" : !onboardingDone ? "/onboarding" : null;
    if (!target) return;
    const p = location.pathname;
    if (p.startsWith(target) || p.startsWith("/chat")) return;
    navigate(target);
  }, [location.pathname, statusLoading, user, checkedPath, contractPending, kycOpen, onboardingDone, navigate]);

  if (loading || statusLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-primary/20 animate-pulse" />
          <p className="text-sm text-muted-foreground">Laden…</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const items = buildNavItems({ kycPending, kycRejected, contractPending, smsVisible });
  const isActive = hasFullAccess(employeeStatus);
  const groups: GlassNavGroup[] = [
    {
      items: items.map((i) => ({
        title: i.title,
        url: i.url,
        icon: i.icon,
        end: i.url === "/dashboard",
        locked: i.requiresActive && !isActive,
        dot: !!i.dot,
        tour: `nav-${i.url.replace("/", "")}`,
      })),
    },
  ];

  const brand = (
    <>
      {tenant?.logo_url ? (
        <img src={tenant.logo_url} alt="Logo" className="h-8 w-8 rounded-full object-contain bg-muted shrink-0" />
      ) : (
        <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground grid place-items-center text-sm font-bold shrink-0">M</div>
      )}
      <span className="text-sm font-semibold truncate min-w-0">Mitarbeiter-Portal</span>
    </>
  );

  const firstName = (user.user_metadata?.first_name as string | undefined) || "";

  return (
    <div className="glass-shell min-h-dvh flex flex-col lg:pl-24 xl:pl-28">
      <GlassBackdrop />
      <GlassSidebar brand={brand} groups={groups} tour="sidebar" />
      <header className="portal-header sticky top-0 z-30 px-3 sm:px-6 lg:pl-0 pt-3">
        <div className="glass-panel rounded-full min-h-14 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1 sm:gap-3 px-2 sm:px-3">
          <div className="flex items-center min-w-0 gap-1 sm:gap-2.5">
            <GlassMobileMenuButton />
            {tenant?.logo_url ? (
              <img src={tenant.logo_url} alt="Logo" className="hidden sm:block h-9 w-9 rounded-full object-contain bg-[var(--glass-pill)] shrink-0" />
            ) : (
              <div className="hidden sm:grid h-9 w-9 rounded-full bg-primary text-primary-foreground place-items-center text-sm font-semibold shrink-0">{(firstName || "M").charAt(0).toUpperCase()}</div>
            )}
            <span className="text-xs sm:text-sm font-medium truncate min-w-0">{firstName ? `Willkommen, ${firstName}` : "Mitarbeiter-Portal"}</span>
          </div>
          <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
            <HeaderHelpButton />
            <div data-tour="notifications"><NotificationBell /></div>
            <ThemeToggle compact />
            <Button variant="ghost" size="icon" onClick={signOut} title="Abmelden" aria-label="Abmelden"
              className="h-10 w-10 rounded-full bg-[var(--glass-pill)] text-[oklch(0.2_0.01_60)] hover:bg-[var(--glass-pill)] shrink-0">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>
      <MissingPayrollDataBanner />
      <main className="portal-content flex-1 min-w-0 px-3 sm:px-6 lg:pl-0 pt-4 pb-10">
        <div className="glass-stage rounded-[2rem] min-h-[calc(100dvh-8rem)] overflow-hidden">
          {!contractPending && !kycOpen && onboardingDone && <GuidedOnboarding />}
          <Outlet />
        </div>
      </main>
      <FloatingChat />
      <WhatsAppSupportButton />
    </div>
  );
}
