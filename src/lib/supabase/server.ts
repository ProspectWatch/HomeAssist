import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Not parameterized with the generated `Database` type yet — see the note
// in client.ts. Call sites type-assert the shape they expect from each
// query instead.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component with no request context to write to.
            // Session refresh is handled in middleware instead — safe to ignore.
          }
        },
      },
    },
  );
}
