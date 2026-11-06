// Picks the best match for a free-typed email: employee beats applicant,
// the selected sender company beats others, newest application wins.
export type AppRow = { id: string; full_name: string | null; tenant_id: string | null; user_id: string | null; created_at: string };
export type ProfileRow = { id: string; full_name: string | null; tenant_id: string | null; user_id: string | null; application_id: string | null };

export function pickRecipientMatch(apps: AppRow[], profiles: ProfileRow[], tenantId?: string | null) {
  const rank = <T extends { tenant_id: string | null }>(rows: T[]) =>
    [...rows].sort((a, b) => Number(b.tenant_id === tenantId) - Number(a.tenant_id === tenantId));
  const sortedApps = rank([...apps].sort((a, b) => b.created_at.localeCompare(a.created_at)));
  const prof = rank(profiles)[0];
  if (prof) {
    const app = sortedApps.find((a) => a.id === prof.application_id || (a.user_id && a.user_id === prof.user_id));
    return { type: "employee" as const, profile_id: prof.id, application_id: app?.id ?? null, name: prof.full_name ?? "", tenant_id: prof.tenant_id };
  }
  const app = sortedApps[0];
  if (app) return { type: "applicant" as const, profile_id: null, application_id: app.id, name: app.full_name ?? "", tenant_id: app.tenant_id };
  return null;
}
