import { createClient } from "@supabase/supabase-js";
import type { Database } from "../types/db";

const envUrl = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// In dev, route through the Vite proxy (same origin as the app) so the browser
// never has to reach 127.0.0.1:54321 directly — this avoids WSL/Windows
// localhost forwarding issues. In prod, use the configured URL as-is.
const url = import.meta.env.DEV ? `${window.location.origin}/supabase` : envUrl;

if (!url || !anonKey) {
  console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
}

export const supabase = createClient<Database>(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true },
});
