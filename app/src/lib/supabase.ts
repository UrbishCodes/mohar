import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * Supabase client for profiles + magic-link auth. Null when the env vars
 * are not configured, so the rest of the app keeps working and the profile
 * page can show a "not configured" notice instead of crashing.
 *
 * PKCE flow: magic links carry a single-use `code`, never session tokens.
 * The code is useless without the verifier kept in this browser's storage,
 * so a copied/pasted URL can't leak anyone's session. Tokens are exchanged
 * invisibly via the API instead of riding in the URL fragment.
 */
export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, { auth: { flowType: "pkce" } })
    : null;

export function isSupabaseConfigured(): boolean {
  return supabase !== null;
}
