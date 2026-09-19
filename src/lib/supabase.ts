import { createClient } from "@supabase/supabase-js";

// Keep the client constructible in local/demo builds where .env is absent.
// Requests will fail gracefully until real Supabase credentials are provided.
const supabaseUrl = import.meta.env["VITE_SUPABASE_URL"]?.trim() || "http://localhost:54321";
const supabaseAnonKey =
  import.meta.env["VITE_SUPABASE_ANON_KEY"]?.trim() || "local-development-anon-key";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
