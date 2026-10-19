import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Mitarbeiter Portal | Anmeldung" },
    { name: "description", content: "Zugang zum Mitarbeiterportal für Aufträge, Arbeitsverträge und Nachrichten." },
    { property: "og:title", content: "Mitarbeiter Portal | Anmeldung" },
    { property: "og:description", content: "Anmeldung zum persönlichen Mitarbeiterportal." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  beforeLoad: () => {
    throw redirect({ to: "/login" });
  },
});
