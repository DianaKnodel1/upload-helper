import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/revisions")({
  component: AdminRevisionsPage,
});

import { useEffect, useState } from "react";
import { useNavigate } from "@/lib/router-compat";
import { useAdminData } from "@/contexts/AdminDataContext";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { RotateCcw, ArrowRight, Inbox } from "lucide-react";

interface FeedbackRow {
  id: string;
  assignment_id: string;
  step_number: number;
  comment: string;
  resolved: boolean;
  created_at: string;
}

function AdminRevisionsPage() {
  const { assignments, templates, getProfileForUser, loading } = useAdminData();
  const navigate = useNavigate();
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);
  const [resubmittedIds, setResubmittedIds] = useState<Set<string>>(new Set());
  const [fbLoading, setFbLoading] = useState(true);

  const revisionAssignments = assignments.filter((a) => a.status === "nachbesserung");
  // „Erneut eingereicht" = Status eingereicht, aber es existiert bereits
  // step_feedback → der Auftrag wurde früher abgelehnt oder zur
  // Nachbesserung markiert und danach erneut eingereicht.
  const resubmitted = assignments.filter(
    (a) => a.status === "eingereicht" && resubmittedIds.has(a.id),
  );

  useEffect(() => {
    const load = async () => {
      const eingereichtIds = assignments
        .filter((a) => a.status === "eingereicht")
        .map((a) => a.id);
      const jobs: Promise<void>[] = [];

      if (revisionAssignments.length > 0) {
        jobs.push((async () => {
          const { data } = await supabase
            .from("step_feedback")
            .select("*")
            .in("assignment_id", revisionAssignments.map((a) => a.id))
            .eq("resolved", false)
            .order("created_at", { ascending: false });
          setFeedback((data as FeedbackRow[]) ?? []);
        })());
      } else {
        setFeedback([]);
      }

      if (eingereichtIds.length > 0) {
        jobs.push((async () => {
          const { data } = await supabase
            .from("step_feedback")
            .select("assignment_id")
            .in("assignment_id", eingereichtIds)
            .limit(1000);
          setResubmittedIds(new Set(((data ?? []) as Array<{ assignment_id: string }>).map((r) => r.assignment_id)));
        })());
      } else {
        setResubmittedIds(new Set());
      }

      await Promise.all(jobs);
      setFbLoading(false);
    };
    if (!loading) load();
  }, [loading, assignments]);

  if (loading || fbLoading) return <div className="p-8 text-center text-muted-foreground animate-pulse">Laden…</div>;

  return (
    <div className="p-5 space-y-4">
      <div>
        <h1 className="text-lg font-heading font-bold text-foreground">Offene Nachbesserungen</h1>
        <p className="text-xs text-muted-foreground">{revisionAssignments.length} Aufgaben in Nachbesserung</p>
      </div>

      {revisionAssignments.length === 0 && resubmitted.length === 0 ? (
        <EmptyState icon={RotateCcw} title="Keine Nachbesserungen" description="Aktuell sind keine Aufgaben zur Nachbesserung offen." />
      ) : (
        <>
          {revisionAssignments.length > 0 && (
            <div className="space-y-3">
              {revisionAssignments.map((a) => {
                const tpl = templates.find((t) => t.id === a.task_template_id);
                const profile = getProfileForUser(a.user_id);
                const aFeedback = feedback.filter((f) => f.assignment_id === a.id);
                return (
                  <div key={a.id} className="border rounded-lg bg-card p-4 space-y-3 hover:border-primary/20 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground">{tpl?.title ?? "Aufgabe"}</p>
                        <p className="text-xs text-muted-foreground">{profile?.full_name ?? "Unbekannt"}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px] bg-status-pending/10 text-status-pending">Nachbesserung</Badge>
                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => navigate(`/admin/assignments/${a.id}`)}>
                          Prüfen <ArrowRight className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    {aFeedback.length > 0 && (
                      <div className="space-y-1.5 pl-3 border-l-2 border-status-pending/30">
                        {aFeedback.slice(0, 3).map((f) => (
                          <div key={f.id} className="text-xs">
                            <span className="text-muted-foreground">Schritt {f.step_number}:</span>{" "}
                            <span className="text-foreground">{f.comment || "Feedback"}</span>
                          </div>
                        ))}
                        {aFeedback.length > 3 && <p className="text-[11px] text-muted-foreground">+{aFeedback.length - 3} weitere</p>}
                      </div>
                    )}
                    {a.admin_comment && (
                      <p className="text-xs text-muted-foreground italic">„{a.admin_comment}"</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {resubmitted.length > 0 && (
            <div className="space-y-3 pt-4">
              <div>
                <h2 className="text-base font-heading font-semibold text-foreground flex items-center gap-2">
                  <Inbox className="h-4 w-4 text-primary" /> Erneut eingereicht
                </h2>
                <p className="text-xs text-muted-foreground">
                  Diese Aufträge wurden früher abgelehnt oder zur Nachbesserung markiert und danach erneut eingereicht.
                </p>
              </div>
              {resubmitted.map((a) => {
                const tpl = templates.find((t) => t.id === a.task_template_id);
                const profile = getProfileForUser(a.user_id);
                return (
                  <div key={a.id} className="border rounded-lg bg-card p-4 hover:border-primary/20 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground">{tpl?.title ?? "Aufgabe"}</p>
                        <p className="text-xs text-muted-foreground">{profile?.full_name ?? "Unbekannt"}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary">Erneut eingereicht</Badge>
                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => navigate(`/admin/assignments/${a.id}`)}>
                          Prüfen <ArrowRight className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
