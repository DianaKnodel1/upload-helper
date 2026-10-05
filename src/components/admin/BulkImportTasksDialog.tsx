import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { parseBulkTasks, MAX_TASKS, type ParsedTask } from "@/lib/task-bulk-import";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

const PLACEHOLDER = `--- AUFTRAG START ---
Titel: Beispiel-App testen
Beschreibung:
Kurze Beschreibung (mehrzeilig möglich).
Anleitung:
Schritt 1
Schritt 2
Vergütung: 12,50
Frage 1: Wie war dein erster Eindruck?
--- AUFTRAG ENDE ---`;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

export function BulkImportTasksDialog({ open, onOpenChange, onImported }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [tasks, setTasks] = useState<ParsedTask[] | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);

  const reset = () => { setText(""); setTasks(null); setErrors([]); };

  const check = () => {
    const res = parseBulkTasks(text);
    setTasks(res.tasks);
    setErrors(res.errors);
  };

  const runImport = async () => {
    if (!tasks || errors.length > 0 || tasks.length === 0) return;
    setImporting(true);
    let created = 0;
    for (const t of tasks) {
      const { data: tpl, error } = await supabase.from("task_templates").insert({
        title: t.title,
        description: t.description,
        instructions: t.instructions,
        compensation: t.compensation ?? 0,
        created_by: user!.id,
        image_url: t.imageUrl || null,
      }).select("id").single();
      if (error || !tpl) {
        toast({
          title: "Import abgebrochen",
          description: `Auftrag ${t.index}: ${error?.message ?? "Unbekannter Fehler"}${created > 0 ? ` (${created} bereits importiert)` : ""}`,
          variant: "destructive",
        });
        setImporting(false);
        onImported();
        return;
      }
      if (t.questions.length > 0) {
        await supabase.from("task_questions").insert(
          t.questions.map((q, i) => ({ task_template_id: tpl.id, question: q, sort_order: i })),
        );
      }
      created++;
    }
    setImporting(false);
    toast({ title: `${created} Aufträge erfolgreich importiert.` });
    reset();
    onOpenChange(false);
    onImported();
  };

  const valid = !!tasks && tasks.length > 0 && errors.length === 0;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-heading">Aufträge importieren</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Klartext einfügen – Blöcke zwischen „--- AUFTRAG START ---" und „--- AUFTRAG ENDE ---". Max. {MAX_TASKS} Aufträge, max. 10 Fragen je Auftrag.
          </p>
          <Textarea
            value={text}
            onChange={(e) => { setText(e.target.value); setTasks(null); setErrors([]); }}
            placeholder={PLACEHOLDER}
            rows={14}
            className="font-mono text-xs"
          />
          <Button variant="outline" size="sm" onClick={check} disabled={!text.trim()}>Aufträge prüfen</Button>

          {errors.length > 0 && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 space-y-1">
              <p className="text-xs font-medium text-destructive flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" /> {errors.length} Fehler – kein Import möglich
              </p>
              <ul className="text-xs text-destructive space-y-0.5 max-h-40 overflow-y-auto">
                {errors.map((e, i) => <li key={i}>• {e}</li>)}
              </ul>
            </div>
          )}

          {tasks && tasks.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-foreground flex items-center gap-1.5">
                {errors.length === 0 && <CheckCircle2 className="h-3.5 w-3.5 text-status-success" />}
                {tasks.length} {tasks.length === 1 ? "Auftrag" : "Aufträge"} erkannt
              </p>
              <div className="border rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">#</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Titel</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Vergütung</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Fragen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {tasks.map((t) => (
                      <tr key={t.index}>
                        <td className="px-3 py-1.5 text-muted-foreground">{t.index}</td>
                        <td className="px-3 py-1.5 text-foreground">{t.title || <span className="text-destructive">— fehlt —</span>}</td>
                        <td className="px-3 py-1.5">{t.compensation !== null ? `${t.compensation.toFixed(2)} €` : <span className="text-destructive">—</span>}</td>
                        <td className="px-3 py-1.5">{t.questions.length}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button size="sm" onClick={runImport} disabled={!valid || importing}>
            {importing ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Importiere…</> : `${tasks?.length ?? 0} Aufträge importieren`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
