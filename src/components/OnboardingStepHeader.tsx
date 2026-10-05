import { TeamLeaderCard } from "@/components/TeamLeaderCard";

const LABELS = ["Vertrag", "Ausweis", "Einführung"];

/** Gemeinsame Kopfzeile der drei Pflichtschritte nach der Registrierung. */
export function OnboardingStepHeader({ step, reassurance }: { step: 1 | 2 | 3; reassurance?: string }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground text-center">
        Bitte nehmen Sie sich kurz Zeit für das Onboarding.
      </p>
      <p className="text-xs font-medium text-foreground text-center">
        Schritt {step} von 3 · {LABELS[step - 1]} · ca. 5 Minuten
      </p>
      {reassurance && (
        <p className="text-xs text-muted-foreground text-center max-w-xl mx-auto">{reassurance}</p>
      )}
      <div>
        <p className="text-xs text-muted-foreground mb-1.5">Fragen? Schreiben Sie Ihrem Teamleiter.</p>
        <TeamLeaderCard />
      </div>
    </div>
  );
}
