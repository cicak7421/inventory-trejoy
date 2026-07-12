import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// PERINGATAN: hanya dipakai di server actions/route handlers, JANGAN pernah
// diimport dari client component. Service role key bisa bypass RLS sepenuhnya.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
