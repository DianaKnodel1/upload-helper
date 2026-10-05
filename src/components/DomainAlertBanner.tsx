import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@/lib/router-compat";
import { AlertTriangle, ArrowRight } from "lucide-react";

interface ProblemDomain {
  domain: string;
  label: string | null;
  status: string;
  error: string | null;
  checked_at: string;
}

// Warn-Banner für das Admin-Dashboard: zeigt Domains, deren letzter
// Health-Check (Cron, alle 5 Min) "down" oder "no_landing" war.
// Rendert nichts, wenn alles ok ist oder die Tabelle noch nicht migriert ist.
export function DomainAlertBanner() {
  const [problems, setProblems] = useState<ProblemDomain[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { data, error } = await supabase
          .from("domain_check_results" as any)
          .select("domain,label,status,error,checked_at")
          .in("status", ["down", "no_landing"]);
        if (cancelled || error) return; // Migration evtl. noch ausstehend
        setDownSafe(data as unknown as ProblemDomain[]);
      } catch {
        // still ignorieren – Banner ist optional
      }
    };
    const setDownSafe = (rows: ProblemDomain[] | null) => setProblems(rows ?? []);
    void load();
    const interval = window.setInterval(load, 5 * 60 * 1000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, []);

  if (problems.length === 0) return null;

  const downCount = problems.filter((p) => p.status === "down").length;

  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/[0.04] p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-destructive">
            {downCount > 0
              ? `${downCount} Domain${downCount === 1 ? "" : "s"} nicht erreichbar`
              : `${problems.length} Domain${problems.length === 1 ? "" : "s"} ohne Landing Page`}
          </p>
          <ul className="mt-1.5 space-y-0.5">
            {problems.slice(0, 4).map((p) => (
              <li key={p.domain} className="text-xs text-foreground truncate">
                <code className="font-mono">{p.domain}</code>
                {p.label && <span className="text-muted-foreground"> · {p.label}</span>}
                <span className="text-muted-foreground">
                  {" "}· {p.status === "down" ? (p.error ?? "keine Antwort") : "keine Landing Page (404)"}
                </span>
              </li>
            ))}
            {problems.length > 4 && (
              <li className="text-xs text-muted-foreground">… und {problems.length - 4} weitere</li>
            )}
          </ul>
        </div>
        <button
          onClick={() => navigate("/admin/domains")}
          className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-destructive hover:underline"
        >
          Domain-Übersicht <ArrowRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
