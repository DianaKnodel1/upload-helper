import minijob from "./contract-templates/minijob.txt?raw";
import teilzeit from "./contract-templates/teilzeit.txt?raw";
import vollzeit from "./contract-templates/vollzeit.txt?raw";

export const EMPLOYMENT_TYPES = ["minijob", "teilzeit", "vollzeit"] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

const STANDARD_TEMPLATES: Record<EmploymentType, string> = { minijob, teilzeit, vollzeit };

/** Standardvorlage mit Platzhaltern für die angegebene Beschäftigungsart. */
export function getStandardContractTemplate(employmentType: string): string {
  return STANDARD_TEMPLATES[employmentType as EmploymentType] ?? STANDARD_TEMPLATES.minijob;
}

/** Titel-Vorschlag für automatisch angelegte Vorlagen. */
export function standardContractTitle(employmentType: string): string {
  const label =
    employmentType === "minijob" ? "Minijob"
    : employmentType === "teilzeit" ? "Teilzeit"
    : employmentType === "vollzeit" ? "Vollzeit"
    : employmentType;
  return `Arbeitsvertrag ${label} (Standard)`;
}