import { setContactMarker, useContactMarkers, type ContactMarker } from "@/hooks/use-contact-markers";

const OPTIONS: { key: ContactMarker; label: string; cls: string }[] = [
  { key: "green", label: "Grün", cls: "bg-marker-green" },
  { key: "blue", label: "Blau", cls: "bg-marker-blue" },
];

/** Zwei Farbpunkte – ein Klick setzt die Markierung, erneuter Klick entfernt sie. */
export function ContactMarkerPicker({ appId, userId }: { appId?: string | null; userId?: string | null }) {
  const m = useContactMarkers();
  const id = appId ?? m.appIdForUser(userId);
  if (!id) return null;
  const current = m.forApp(id);
  return (
    <div className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      {OPTIONS.map((o) => {
        const active = current === o.key;
        return (
          <button
            key={o.key}
            type="button"
            title={active ? `${o.label} entfernen` : `Als ${o.label} markieren`}
            aria-pressed={active}
            onClick={() => setContactMarker(id, active ? null : o.key, userId)}
            className={`h-4 w-4 rounded-full border transition ${o.cls} ${active ? "ring-2 ring-offset-1 ring-offset-background ring-foreground/60 opacity-100" : "opacity-25 hover:opacity-70"}`}
          />
        );
      })}
    </div>
  );
}

/** Nur-Anzeige: farbiger Punkt (z. B. im Chat). */
export function ContactMarkerDot({ marker }: { marker: ContactMarker | null }) {
  if (!marker) return null;
  return (
    <span
      title={marker === "green" ? "Markierung Grün" : "Markierung Blau"}
      className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${marker === "green" ? "bg-marker-green" : "bg-marker-blue"}`}
    />
  );
}

/** Linker Farbstreifen für Tabellenzeilen. */
export function markerRowClass(marker: ContactMarker | null) {
  if (marker === "green") return "border-l-4 border-l-marker-green bg-marker-green/5";
  if (marker === "blue") return "border-l-4 border-l-marker-blue bg-marker-blue/5";
  return "border-l-4 border-l-transparent";
}
