import type { SupabaseClient } from "@supabase/supabase-js";

/** Probe whether the `validation_results` table exists without throwing. */
export async function validationResultsReady(supabase: SupabaseClient): Promise<boolean> {
  try {
    const { error } = await supabase.from("validation_results").select("id").limit(1);
    if (error) {
      // PostgREST may not include code 42P01, so inspect message text as well
      const msg = String((error as any)?.message || "");
      if (msg.includes("validation_results") && msg.includes("does not exist")) return false;
      // Other errors: treat as not fatal, but do not retry insert here.
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Best-effort insert into validation_results. If the table is missing, returns a warning
 * and does not throw, so your API stays healthy until the migration is applied.
 */
export async function persistValidationResult(
  supabase: SupabaseClient,
  row: Record<string, any>
): Promise<{ ok: boolean; warning?: string }> {
  const ready = await validationResultsReady(supabase);
  if (!ready) {
    const warning = "validation_results table missing — run the migration in db/migrations/001_create_validation_results.sql";
    try { console.warn(warning); } catch {}
    return { ok: false, warning };
  }
  try {
    const { error } = await supabase.from("validation_results").insert(row as any);
    if (error) {
      const warning = `Could not insert validation result: ${String((error as any)?.message || error)}`;
      try { console.warn(warning); } catch {}
      return { ok: false, warning };
    }
    return { ok: true };
  } catch (e: unknown) {
    const warning = `Insert crashed: ${String(e?.message || e)}`;
    try { console.warn(warning); } catch {}
    return { ok: false, warning };
  }
}

