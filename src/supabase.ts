import { createClient } from "@supabase/supabase-js";

function readEnv(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

export const supabaseUrl = readEnv(import.meta.env.VITE_SUPABASE_URL);
const supabaseAnonKey = readEnv(import.meta.env.VITE_SUPABASE_ANON_KEY);

export const missingSupabaseEnvVars = [
  !supabaseUrl ? "VITE_SUPABASE_URL" : null,
  !supabaseAnonKey ? "VITE_SUPABASE_ANON_KEY" : null,
].filter((name): name is string => Boolean(name));

export const isSupabaseConfigured = missingSupabaseEnvVars.length === 0;

export const supabase = createClient(
  supabaseUrl ?? "https://example.supabase.co",
  supabaseAnonKey ?? "missing-anon-key",
  {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  }
);
