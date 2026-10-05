// Eigene Vorlagen für den Landing-Baukasten (Tabelle public.landing_templates).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function requireAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Admin-Rechte erforderlich");
}

const SectionSchema = z.object({
  id: z.string().max(60),
  type: z.string().max(40),
  data: z.record(z.string(), z.any()),
});

export const listLandingTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await requireAdmin(supabase, userId);
    const { data, error } = await supabase
      .from("landing_templates")
      .select("id, name, description, sections, style, updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { rows: data ?? [] };
  });

export const saveLandingTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().min(1).max(120),
        description: z.string().max(400).default(""),
        sections: z.array(SectionSchema).max(40),
        style: z.record(z.string(), z.any()).default({}),
      })
      .parse(raw ?? {})
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await requireAdmin(supabase, userId);
    const row = {
      name: data.name,
      description: data.description,
      sections: data.sections,
      style: data.style,
      created_by: userId,
      updated_at: new Date().toISOString(),
    };
    const q = data.id
      ? supabase.from("landing_templates").update(row).eq("id", data.id).select("id").maybeSingle()
      : supabase.from("landing_templates").insert(row).select("id").maybeSingle();
    const { data: res, error } = await q;
    if (error) throw new Error(error.message);
    return { id: res?.id as string };
  });

export const deleteLandingTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await requireAdmin(supabase, userId);
    const { error } = await supabase.from("landing_templates").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
