import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Keep translated text isolated from the icon React replaces while submitting. */
export function TaskSubmitButton({ submitting, onSubmit }: {
  submitting: boolean;
  onSubmit: () => void;
}) {
  return (
    <Button onClick={onSubmit} disabled={submitting} translate="no"
      className="w-full h-12 gap-2 text-sm font-semibold transition-all hover:scale-[1.01] active:scale-[0.99]">
      <span aria-hidden="true">
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      </span>
      <span>{submitting ? "Wird eingereicht…" : "Auftrag einreichen"}</span>
    </Button>
  );
}