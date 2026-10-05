import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Login | Mitarbeiter Portal" },
      { name: "description", content: "Melden Sie sich in Ihrem Mitarbeiter-Portal an, um Ihre Aufgaben und Termine zu verwalten." },
      { property: "og:title", content: "Login | Mitarbeiter Portal" },
      { property: "og:description", content: "Sicherer Zugang zum Portal." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginPage,
});

import { useState, useEffect } from "react";
import { useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/contexts/TenantContext";
import { translateAuthError } from "@/lib/auth-errors";
import { MailCheck, MessageCircle, Mail } from "lucide-react";
import PortalAuthShell from "@/components/portal/PortalAuthShell";
import { usePortalTheme } from "@/hooks/use-portal-theme";
import { useWhatsAppSupport } from "@/hooks/use-whatsapp-support";


const LOGIN_TIMEOUT_MS = 15000;
const PROFILE_CHECK_TIMEOUT_MS = 10000;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), ms);
  });

  return Promise.race([
    promise.finally(() => {
      if (timeoutId) clearTimeout(timeoutId);
    }),
    timeoutPromise,
  ]);
}

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [needsVerify, setNeedsVerify] = useState(false);
  const [resending, setResending] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { tenant } = useTenant();
  const t = usePortalTheme().tokens;
  const whatsapp = useWhatsAppSupport();
  const supportEmail = tenant?.company_email || null;
  useEffect(() => {
    const qs = new URLSearchParams(window.location.search).get("email");
    if (qs) setEmail(qs.trim().toLowerCase());
  }, []);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setNeedsVerify(false);
    setAuthError(null);
    let data: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>["data"] | null = null;
    let error: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>["error"] | null = null;
    try {
      const res = await withTimeout(
        supabase.auth.signInWithPassword({ email: email.trim(), password }),
        LOGIN_TIMEOUT_MS,
        "Der Login-Server antwortet gerade nicht. Bitte prüfe, ob das Backend läuft.",
      );
      data = res.data;
      error = res.error;
    } catch (e: any) {
      const description = translateAuthError(e?.message) ?? "Unerwarteter Fehler. Bitte später erneut versuchen.";
      setAuthError(description);
      toast({
        title: "Anmeldung fehlgeschlagen",
        description,
        variant: "destructive",
      });
      setLoading(false);
      return;
    } finally {
      setLoading(false);
    }
    if (error) {
      const msg = (error.message || "").toLowerCase();
      if (msg.includes("email not confirmed") || msg.includes("not confirmed")) {
        // Altes, halb angelegtes Konto: erneute Registrierung schaltet es frei.
        setNeedsVerify(true);
        setAuthError("Dein Konto ist noch nicht fertig angelegt. Bitte registriere dich einfach noch einmal mit derselben E-Mail – danach klappt die Anmeldung.");
        toast({ title: "Konto noch nicht fertig", description: "Du wirst zur Registrierung weitergeleitet." });
        setTimeout(() => navigate(`/register?email=${encodeURIComponent(email.trim())}`), 2000);
        return;
      }
      const description = translateAuthError(error.message);
      setAuthError(description);
      toast({ title: "Anmeldung fehlgeschlagen", description, variant: "destructive" });
      return;
    }
    if (data.user) {
      // E-Mail-Verifikation ist deaktiviert (GOTRUE_MAILER_AUTOCONFIRM=true).
      // Registrierung erfolgt über Invitation-Link – kein offener Signup.

      let profileRes: any;
      let roleRes: any;

      try {
        [profileRes, roleRes] = await withTimeout(
          Promise.all([
            supabase
              .from("profiles")
              .select("tenant_id, status, is_blocked")
              .eq("user_id", data.user.id)
              .maybeSingle(),
            supabase
              .from("user_roles")
              .select("role")
              .eq("user_id", data.user.id),
          ]),
          PROFILE_CHECK_TIMEOUT_MS,
          "Login erfolgreich, aber die Profilprüfung antwortet nicht. Bitte prüfe die Datenbank/API-Verbindung.",
        );
      } catch (e: any) {
        const description = e?.message ?? "Login erfolgreich, aber die Profilprüfung ist fehlgeschlagen.";
        setAuthError(description);
        toast({ title: "Profilprüfung fehlgeschlagen", description, variant: "destructive" });
        await supabase.auth.signOut();
        return;
      }

      if (profileRes.error || roleRes.error) {
        const description = profileRes.error?.message || roleRes.error?.message || "Profil oder Rolle konnte nicht geladen werden.";
        setAuthError(description);
        toast({ title: "Profilprüfung fehlgeschlagen", description, variant: "destructive" });
        await supabase.auth.signOut();
        return;
      }

      const profile = profileRes.data;
      const roles: string[] = (roleRes.data ?? []).map((r: { role: string }) => r.role);
      const isAdminUser = roles.includes("admin");
      const isStaffUser = roles.includes("admin_mitarbeiter");

      // Gesperrtes Konto: bewusst die normale Fehlermeldung — der Nutzer
      // soll von der Sperre nichts mitbekommen.
      if ((profile as any)?.is_blocked) {
        await supabase.auth.signOut();
        const description = "E-Mail oder Passwort ist falsch.";
        setAuthError(description);
        toast({ title: "Anmeldung fehlgeschlagen", description, variant: "destructive" });
        return;
      }

      if (profile?.status === "deaktiviert") {
        await supabase.auth.signOut();
        setAuthError("Dein Zugang wurde deaktiviert. Bitte kontaktiere deinen Ansprechpartner.");
        toast({ title: "Zugang deaktiviert", description: "Dein Zugang wurde deaktiviert. Bitte kontaktiere deinen Ansprechpartner.", variant: "destructive" });
        return;
      }

      if (!isAdminUser && tenant && profile && profile.tenant_id && profile.tenant_id !== tenant.id) {
        await supabase.auth.signOut();
        setAuthError("Bitte melde dich über deine Unternehmensseite an.");
        toast({ title: "Fehler", description: "Bitte melde dich über deine Unternehmensseite an.", variant: "destructive" });
        return;
      }

      if (isAdminUser) {
        navigate("/admin");
        return;
      }
      if (isStaffUser) {
        navigate("/admin/tasks");
        return;
      }
    }
    navigate("/dashboard");
  };

  const resendVerify = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || resending) return;
    const tenantId = tenant?.id;
    if (!tenantId) {
      toast({ title: "Fehler", description: "Tenant konnte nicht ermittelt werden. Bitte lade die Seite neu.", variant: "destructive" });
      return;
    }
    setResending(true);
    try {
      const { data, error } = await supabase.functions.invoke("resend-signup-confirmation", {
        body: { email: trimmedEmail, tenant_id: tenantId, redirect_to: `${window.location.origin}/auth/confirmed` },
      });
      if (error || (data as any)?.error) {
        toast({ title: "Fehler", description: (data as any)?.error ?? error?.message ?? "Versand fehlgeschlagen", variant: "destructive" });
      } else if ((data as any)?.already_confirmed) {
        toast({ title: "Bereits bestätigt", description: "Diese E-Mail ist schon aktiviert. Bitte melde dich an." });
      } else {
        toast({ title: "Bestätigungs-E-Mail versendet", description: `An ${trimmedEmail}` });
      }
    } finally {
      setResending(false);
    }
  };

  return (
    <PortalAuthShell
      title="Willkommen zurück"
      description="Melde dich an, um deine Aufträge, Termine und Dokumente zu verwalten."
    >
      {needsVerify && (
        <div className={t.warnBox}>
          <MailCheck className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
          <div className="space-y-1.5 flex-1">
            <p className={t.warnText}>Dein Konto ist noch nicht fertig angelegt. Du wirst gleich zur Registrierung weitergeleitet – bitte dort noch einmal mit derselben E-Mail abschließen.</p>
          </div>
        </div>
      )}

      {authError && !needsVerify && (
        <div className={t.errorBox} role="alert">
          {authError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <label htmlFor="email" className={t.label}>
            E-Mail-Adresse
          </label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@unternehmen.de"
            autoComplete="email"
            className={t.input}
            required
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="password" className={t.label}>
            Passwort
          </label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            className={t.input}
            required
          />
        </div>

        <Button type="submit" size="lg" className={t.primaryButton} disabled={loading}>
          {loading ? "Wird angemeldet…" : "Anmelden"}
        </Button>
      </form>

      <div className="rounded-lg border border-border/60 bg-muted/30 px-4 py-3 space-y-2">
        <p className="text-xs text-muted-foreground">
          Probleme beim Anmelden oder Passwort vergessen? Da unser eigener Mailversand deaktiviert
          ist, kommt keine automatische E-Mail — schreib uns einfach direkt:
        </p>
        <div className="flex flex-wrap gap-2">
          {whatsapp.enabled && whatsapp.href && (
            <a
              href={whatsapp.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300/60 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 transition-colors"
            >
              <MessageCircle className="h-3.5 w-3.5" /> Per WhatsApp schreiben
            </a>
          )}
          {supportEmail && (
            <a
              href={`mailto:${supportEmail}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
            >
              <Mail className="h-3.5 w-3.5" /> {supportEmail}
            </a>
          )}
          {!whatsapp.enabled && !supportEmail && (
            <span className="text-xs text-muted-foreground">Wende dich an deinen Ansprechpartner.</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className={`${t.dividerLabel} bg-transparent text-[11px] uppercase tracking-wider`}>Neu hier?</span>
        <span className="h-px flex-1 bg-border" />
      </div>


      <Button size="lg" variant="outline" className={t.secondaryButton} onClick={() => navigate("/register")}>
        Konto erstellen
      </Button>
    </PortalAuthShell>
  );
}

