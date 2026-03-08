import { createServerClient, type CookieOptions } from "@supabase/ssr";
import {
  createClient as createSupabaseClient,
  type SupabaseClient,
} from "@supabase/supabase-js";
import { cookies } from "next/headers";

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

// TODO: replace `any` with generated Database type from `supabase gen types`
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

export async function createServerSupabaseClient(): Promise<SupabaseClient<DB>> {
  const cookieStore = await cookies();

  return createServerClient<DB>(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
          }
        },
      },
    }
  );
}

// Singleton service role client (bypasses RLS — use carefully)
let _serviceClient: SupabaseClient<DB> | null = null;

export async function createServiceRoleClient(): Promise<SupabaseClient<DB>> {
  if (!_serviceClient) {
    _serviceClient = createSupabaseClient<DB>(
      requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY")
    );
  }
  return _serviceClient;
}
