// Placeholder for Supabase-generated types.
//
// Once the project exists, regenerate with:
//   npx supabase gen types typescript --project-id <project-ref> > src/types/database.ts
//
// Keeping a minimal shape here (rather than `any`) so `createClient<Database>()`
// type-checks before the real schema is provisioned.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
