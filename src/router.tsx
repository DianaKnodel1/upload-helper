import { QueryClient } from "@tanstack/react-query";
import { createRouter, useRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

function DefaultErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();

  // Einmaliges automatisches Neuladen: fängt veraltete Seitenteile nach einem
  // Update und kurze Ladeverzögerungen direkt nach der Registrierung ab.
  if (typeof window !== "undefined") {
    try {
      console.error("[app-error]", error);
      const key = "auto_reload_after_error";
      const last = Number(sessionStorage.getItem(key) ?? 0);
      if (Date.now() - last > 30000) {
        sessionStorage.setItem(key, String(Date.now()));
        setTimeout(() => window.location.reload(), 300);
      }
    } catch {}
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Kurz hat etwas nicht geklappt</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Bitte lade die Seite neu. Hilft das nicht, melde dich einmal ab und wieder an.
        </p>
        {error?.message && (
          <p className="mt-4 break-words text-xs text-muted-foreground">Fehler: {error.message}</p>
        )}
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Neu laden
          </button>
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            Erneut versuchen
          </button>
          <a
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            Zum Portal
          </a>
        </div>
      </div>
    </div>
  );
}

export const getRouter = () => {
  const queryClient = new QueryClient();
  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: DefaultErrorComponent,
  });

  return router;
};
