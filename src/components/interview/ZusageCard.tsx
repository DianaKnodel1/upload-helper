// Zusage-Screen: wird direkt im Portal angezeigt, sobald die KI eine Zusage
// erteilt hat — optisch angelehnt an die „Willkommen im Team"-E-Mail.
import { Button } from "@/components/ui/button";
import { UserPlus, MessageCircle, Send } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useWhatsAppSupport } from "@/hooks/use-whatsapp-support";
import { useTenant } from "@/contexts/TenantContext";
import { cn } from "@/lib/utils";

export function ZusageCard({
  company,
  primary,
  recruiter,
  firstName,
  registrationLink,
  loginHref,
  className,
  // mailFailed wird nicht mehr genutzt (Mail-loser Betrieb) — Prop bleibt
  // aus Kompatibilitaet bestehen und wird bewusst ignoriert.

}: {
  company: string;
  primary: string;
  recruiter: string;
  firstName?: string | null;
  /** Persönlicher Registrierungslink (mit Token) aus der Zusage-Mail. */
  registrationLink?: string | null;
  loginHref?: string;
  className?: string;
  /** true = die Zusage-Mail konnte nicht zugestellt werden → Link hier direkt nutzen. */
  mailFailed?: boolean;
}) {
  const login = loginHref || "/login";
  // Kein automatischer Redirect mehr: Die 8-Sekunden-Weiterleitung hat
  // Bewerber überrumpelt. Stattdessen klarer Button + WhatsApp-Hilfe.
  const whatsapp = useWhatsAppSupport();
  const waText = encodeURIComponent(
    `Hallo, ich bin ${firstName || ""} und habe gerade die Zusage bekommen – ich brauche kurz Hilfe bei der Registrierung.`.replace(/\s+/g, " ").trim(),
  );
  const waHref = whatsapp.href ? `${whatsapp.href}?text=${waText}` : null;
  // „Link sichern": der persönliche Registrierungslink wandert in den eigenen
  // WhatsApp-Verlauf des Bewerbers — damit ist er auch morgen noch auffindbar.
  const waLinkHref =
    whatsapp.href && registrationLink
      ? `${whatsapp.href}?text=${encodeURIComponent(
          `Mein persönlicher Registrierungslink: ${registrationLink}`,
        )}`
      : null;

  // Echter Ansprechpartner + Firmenangaben aus den Mandanten-Daten.
  // Fehlen sie, bleibt die Karte leer — kein Fake-Inhalt.
  const { tenant } = useTenant();
  const leaderName = (tenant as any)?.team_leader_name as string | undefined;
  const leaderTitle = (tenant as any)?.team_leader_title as string | undefined;
  const leaderAvatar = (tenant as any)?.team_leader_avatar_url as string | null | undefined;
  const leaderOnline = (tenant as any)?.team_leader_online ?? true;
  const companyAddress = (tenant as any)?.company_address as string | null | undefined;
  const companyCity = (tenant as any)?.company_city as string | null | undefined;
  const companyCeo = (tenant as any)?.company_ceo_name as string | null | undefined;
  const leaderInitials = (leaderName || "")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className={`bg-white dark:bg-slate-900 rounded-2xl border-2 p-6 sm:p-8 space-y-5 text-center shadow-lg ${className ?? ""}`}
      style={{ borderColor: primary }}
    >
      <div className="text-5xl leading-none">🎉</div>
      <div className="space-y-1">
        <h2 className="text-2xl font-bold leading-tight">Willkommen im Team!</h2>
        <p className="text-sm text-muted-foreground">Wir freuen uns, dass Sie dabei sind.</p>
      </div>

      <p className="text-[15px] text-foreground leading-relaxed">
        {firstName ? `${firstName}, Ihr` : "Ihr"} Profil hat uns überzeugt – lassen Sie uns direkt starten!
      </p>

      {leaderName && (
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-border p-4 flex items-center gap-3 text-left">
          <div className="relative shrink-0">
            <Avatar className="h-12 w-12 ring-2 ring-background">
              {leaderAvatar && <AvatarImage src={leaderAvatar} alt={leaderName} />}
              <AvatarFallback className="font-semibold text-sm text-white" style={{ background: primary }}>
                {leaderInitials}
              </AvatarFallback>
            </Avatar>
            <span
              className={cn(
                "absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full ring-2 ring-background",
                leaderOnline ? "bg-emerald-500" : "bg-muted-foreground/40",
              )}
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">
              Dein persönlicher Ansprechpartner
            </p>
            <p className="font-bold text-sm text-foreground truncate">{leaderName}</p>
            <p className="text-xs text-muted-foreground">
              {leaderOnline ? "● " : "○ "}Antwortet in der Regel innerhalb weniger Minuten
            </p>
          </div>
        </div>
      )}

      <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-border p-4 text-left">
        <p className="text-sm font-semibold mb-3">Wie geht es weiter?</p>
        <ol className="space-y-2.5">
          {[
            `Registrieren Sie sich im Mitarbeiterportal von ${company}`,
            "Führen Sie anschließend das Onboarding durch (Arbeitsvertrag & Personalausweis)",
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-foreground">
              <span
                className="h-6 w-6 shrink-0 rounded-full text-white text-xs font-semibold flex items-center justify-center"
                style={{ background: primary }}
              >
                {i + 1}
              </span>
              <span className="leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>
      </div>

      {registrationLink ? (
        <>
        <Button
          asChild
          size="lg"
          className="w-full font-semibold text-base h-12 shadow-md hover:shadow-lg transition-shadow"
          style={{ background: primary }}
        >
          <a href={registrationLink}>
            <UserPlus className="h-5 w-5 mr-2" />
            Jetzt registrieren – direkt hier abschließen
          </a>
        </Button>
        <p className="text-xs text-muted-foreground">
          Die Registrierung schließen Sie direkt hier ab – es dauert nur wenige
          Minuten. Sie müssen auf keine E-Mail warten.
        </p>
        {waLinkHref && (
          <Button asChild variant="outline" size="lg" className="w-full font-semibold text-sm h-11">
            <a href={waLinkHref} target="_blank" rel="noopener noreferrer">
              <Send className="h-4 w-4 mr-2" />
              Link per WhatsApp sichern (später weitermachen)
            </a>
          </Button>
        )}
        {waHref && (
          <Button asChild variant="ghost" size="lg" className="w-full font-semibold text-sm h-11">
            <a href={waHref} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4 mr-2" />
              Fragen? Schreib mir direkt per WhatsApp
            </a>
          </Button>
        )}
        </>
      ) : (
        <div className="space-y-3">
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 px-3 py-2 text-xs text-amber-800 dark:text-amber-200 text-left">
            Ihre Registrierung können wir hier gerade nicht automatisch öffnen.
            Melden Sie sich kurz bei uns – wir schicken Ihnen Ihren persönlichen
            Zugang sofort zu.
          </div>
          {waHref && (
            <Button asChild size="lg" className="w-full font-semibold text-base h-12" style={{ background: primary }}>
              <a href={waHref} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-5 w-5 mr-2" />
                Jetzt per WhatsApp melden
              </a>
            </Button>
          )}
        </div>
      )}


      <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-border p-4 text-left">
        <p className="text-sm font-semibold mb-2">Bitte bereithalten</p>
        <ul className="space-y-1.5 text-xs text-muted-foreground leading-relaxed">
          <li>
            <strong className="text-foreground">Personalausweis</strong> — zur
            Identitätsprüfung, wie bei jeder Anstellung
          </li>
          <li>
            <strong className="text-foreground">IBAN</strong> — für die Überweisung
            Ihres Gehalts
          </li>
          <li>
            <strong className="text-foreground">Steuer-ID</strong> — für die
            Lohnabrechnung, gesetzlich vorgeschrieben
          </li>
        </ul>
      </div>

      {(companyAddress || companyCeo) && (
        <div className="pt-3 border-t border-border text-left text-xs text-muted-foreground space-y-1">
          <p className="font-semibold text-foreground text-sm">Ihr Arbeitgeber: {company}</p>
          {companyAddress && (
            <p>
              {companyAddress}
              {companyCity ? `, ${companyCity}` : ""}
            </p>
          )}
          {companyCeo && <p>Geschäftsführung: {companyCeo}</p>}
        </div>
      )}

      <div className="pt-3 border-t border-border text-xs text-muted-foreground space-y-1">
        <p>Ich wünsche Ihnen einen erfolgreichen Start!</p>
        <p>
          Mit freundlichen Grüßen
          <br />
          <strong className="text-foreground">{recruiter}</strong>
          <br />
          HR Management · {company}
        </p>
        <p>
          Bereits registriert?{" "}
          <a href={login} className="underline hover:text-foreground">
            Zum Login
          </a>
        </p>
      </div>
    </div>
  );
}
