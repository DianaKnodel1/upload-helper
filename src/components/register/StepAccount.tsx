import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowRight, UserPlus, LifeBuoy, Mail } from "lucide-react";
import { useTenant } from "@/contexts/TenantContext";

interface Props {
  firstName: string;
  lastName: string;
  email: string;
  setFirstName: (v: string) => void;
  setLastName: (v: string) => void;
  setEmail: (v: string) => void;
  onNext: () => void;
  loading: boolean;
}

export default function StepAccount({ firstName, lastName, email, setFirstName, setLastName, setEmail, onNext, loading }: Props) {
  const { tenant } = useTenant();
  const supportEmail = tenant?.company_email || null;
  return (
    <div className="space-y-5">
      <div className="text-center mb-6">
        <div className="h-14 w-14 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-3 shadow-lg shadow-primary/20">
          <UserPlus className="h-6 w-6 text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-heading font-bold text-foreground">Willkommen im Team!</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Noch rund 2 Minuten bis zum Start – Ihre Angaben sind bereits vorausgefüllt.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Vorname *</label>
          <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Max" className="h-11" />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Nachname *</label>
          <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Mustermann" className="h-11" />
        </div>
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">E-Mail *</label>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="max@beispiel.de" className="h-11" />
      </div>
      <p className="text-xs text-muted-foreground text-center">
        Ein Passwort legen Sie ganz am Ende fest – jetzt geht es erst einmal ohne weiter.
      </p>
      <Button onClick={onNext} disabled={loading} className="w-full h-12 text-base font-semibold gap-2">
        {loading ? "Bitte warten…" : "Los geht's"}
        {!loading && <ArrowRight className="h-4 w-4" />}
      </Button>

      <div className="pt-2 flex flex-col items-center gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <LifeBuoy className="h-3.5 w-3.5" />
          <span>Benötigen Sie Hilfe? Bei Problemen einfach melden:</span>
        </div>
        {supportEmail ? (
          <a
            href={`mailto:${supportEmail}?subject=${encodeURIComponent("Hilfe bei der Registrierung")}`}
            className="inline-flex items-center gap-1.5 text-primary hover:underline font-medium"
          >
            <Mail className="h-3.5 w-3.5" />
            {supportEmail}
          </a>
        ) : (
          <span>Wenden Sie sich an Ihren Ansprechpartner.</span>
        )}
      </div>
      <p className="text-center">
        <a href="/login" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Bereits ein Konto? → Anmelden</a>
      </p>
    </div>
  );
}
