import { createFileRoute, redirect } from "@tanstack/react-router";

// Das Lead-Postfach ist im gemeinsamen Postfach aufgegangen.
export const Route = createFileRoute("/admin/lead-postfach")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/postfach", replace: true });
  },
});
