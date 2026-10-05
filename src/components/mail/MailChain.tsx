import { useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  buildMailChain, formatWhen, mailLabel, STEP_STATE_STYLE,
  statusStyle, reasonLabel, isHarmlessReason, type MailEvent,
} from "@/lib/mail-chain";
import type { NextStep } from "@/lib/mail-next-step";

type Props = {
  applicationId: string;
  applicantName: string;
  events: MailEvent[];
  expected: { termin: boolean; zusage: boolean };
  /** Was das System als Nächstes versenden würde — rein informativ. */
  nextStep: NextStep;
  /** Veraltet: Versand ist deaktiviert, es gibt nichts mehr zu aktualisieren. */
  onRefresh?: () => void;
};

/**
 * Feste 4er-Kette (Bewerbung · Termin · Erinnerung · Zusage) pro Bewerber.
 * Rein lesend: Der eigene Mailversand ist komplett deaktiviert —
 * Terminbestätigung, Erinnerungen und SMS kommen ausschließlich von Calendly.
 * Die Historie bleibt sichtbar, damit alte Vorgänge nachvollziehbar bleiben.
 */
export function MailChain({ applicantName, events, expected, nextStep }: Props) {
  const [open, setOpen] = useState(false);
  const steps = buildMailChain(events, expected);

  const history = [...events].sort((a, b) => (b.at || "").localeCompare(a.at || ""));

  const summary = history.reduce(
    (acc, e) => {
      if (e.status === "sent") acc.sent++;
      else if (e.status === "stuck") acc.stuck++;
      else if (e.status === "duplicate") acc.duplicate++;
      else if (["failed", "dlq", "bounced", "complained"].includes(e.status)) acc.failed++;
      else acc.other++;
      return acc;
    },
    { sent: 0, failed: 0, stuck: 0, duplicate: 0, other: 0 },
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div className="flex flex-col items-start gap-0.5">
      <DialogTrigger asChild>
        <button
          type="button"
          className="text-left"
          aria-label={`Mail-Historie von ${applicantName} öffnen`}
        >
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            {steps.map((s) => {
              const st = STEP_STATE_STYLE[s.state];
              // Ruhige Darstellung: erledigte / nicht vorgesehene Schritte ohne
              // farbige Fläche — nur Probleme werden hervorgehoben.
              const quiet = s.state === "sent" || s.state === "na" || s.state === "duplicate";
              const title = s.event
                ? `${mailLabel(s.event.key)} · ${st.text} · ${formatWhen(s.event.at)}${s.event.error ? ` · ${s.event.error}` : ""}`
                : s.state === "na"
                  ? `${s.label}: nicht vorgesehen — ${nextStep.detail}`
                  : `${s.label}: ${st.text}`;
              return (
                <span
                  key={s.id}
                  className={
                    quiet
                      ? `inline-block text-[11px] ${
                          s.state === "sent"
                            ? "text-emerald-700 dark:text-emerald-400"
                            : "text-muted-foreground/60"
                        }`
                      : `inline-block px-1.5 py-0.5 rounded text-[11px] ${st.cls}`
                  }
                  title={title}
                >
                  {st.icon} {s.label}
                </span>
              );
            })}
          </span>
        </button>
      </DialogTrigger>
      <span
        className="text-[10px] truncate max-w-[320px] text-muted-foreground"
        title="Der eigene Mailversand ist deaktiviert. Terminbestätigung, Erinnerungen und SMS kommen von Calendly."
      >
        ✉ Eigener Versand aus — Termin-Mails kommen von Calendly
      </span>
      </div>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>E-Mail-Historie · {applicantName}</DialogTitle>
          <DialogDescription>
            Alle protokollierten E-Mails zu dieser Bewerbung, neueste zuerst.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-sky-300/60 bg-sky-50 dark:bg-sky-950/30 px-3 py-2">
          <p className="text-xs text-sky-800 dark:text-sky-200">
            Der eigene Mailversand ist deaktiviert. Terminbestätigung, Erinnerungen und SMS
            kommen ausschließlich von Calendly — hier ist nichts mehr zu versenden.
          </p>
        </div>

        {history.length > 0 && (
          <div className="flex flex-wrap gap-3 text-xs">
            <span className="text-emerald-700 dark:text-emerald-300">✓ {summary.sent} gesendet</span>
            <span className="text-rose-700 dark:text-rose-300">⚠ {summary.failed} fehlgeschlagen</span>
            <span className="text-orange-700 dark:text-orange-300">⏸ {summary.stuck} hängen geblieben</span>
            {summary.duplicate > 0 && (
              <span className="text-muted-foreground">⧉ {summary.duplicate} bereinigt</span>
            )}
            {summary.other > 0 && (
              <span className="text-muted-foreground">⏱ {summary.other} ohne Ergebnis</span>
            )}
          </div>
        )}

        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Für diesen Bewerber wurde bisher keine E-Mail protokolliert.
          </p>
        ) : (
          <div className="max-h-[55vh] overflow-y-auto divide-y">
            {history.map((e, i) => {
              const st = statusStyle(e.status);
              const harmless = isHarmlessReason(e.error);
              const errorText = e.error ? reasonLabel(e.error) : "";
              return (
                <div key={`${e.at}-${i}`} className="py-2.5 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{mailLabel(e.key)}</div>
                    <div className="text-xs text-muted-foreground">{formatWhen(e.at)}</div>
                    {errorText && (
                      <div
                        className={`text-xs mt-0.5 break-words ${harmless ? "text-muted-foreground" : "text-rose-600"}`}
                      >
                        {errorText}
                      </div>
                    )}
                  </div>
                  <span
                    className={`shrink-0 px-2 py-0.5 rounded text-xs ${
                      harmless
                        ? "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                        : st.cls
                    }`}
                  >
                    {st.icon} {st.text}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
