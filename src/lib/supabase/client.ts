import { createBrowserClient } from "@supabase/ssr";

// Not parameterized with the generated `Database` type yet — there's no
// live Supabase project to run `supabase gen types` against (see
// src/types/database.ts). Call sites type-assert the shape they expect
// from each query instead; swap this back to `createBrowserClient<Database>`
// once real generated types exist.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
