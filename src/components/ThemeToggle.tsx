import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/ThemeContext";

export function ThemeToggle({ variant = "ghost", compact = false }: { variant?: "ghost" | "outline"; compact?: boolean }) {
  const { theme, toggleTheme } = useTheme();
  return (
    <Button
      variant={variant}
      size="sm"
      onClick={toggleTheme}
      className={compact ? "h-11 w-11 shrink-0 rounded-full p-0" : "gap-2"}
      title={theme === "dark" ? "Hellen Modus aktivieren" : "Dunklen Modus aktivieren"}
      aria-label={theme === "dark" ? "Hellen Modus aktivieren" : "Dunklen Modus aktivieren"}
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      {!compact && <span className="text-sm">{theme === "dark" ? "Hell" : "Dunkel"}</span>}
    </Button>
  );
}
