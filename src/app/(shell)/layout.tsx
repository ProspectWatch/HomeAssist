import { BottomNav } from "@/components/nav/bottom-nav";
import { ToastProvider } from "@/components/shell/toast-context";
import { AppChrome } from "@/components/shell/app-shell-context";
import { getCurrentHouseholdId } from "@/lib/supabase/household";
import { getDepartments } from "@/lib/data/departments";
import { getAthletes } from "@/lib/data/athletes";

export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  const householdId = await getCurrentHouseholdId();
  const [departments, athletes] = await Promise.all([getDepartments(), getAthletes(householdId)]);

  return (
    <ToastProvider>
      <AppChrome departments={departments} athletes={athletes}>
        <div className="flex min-h-dvh flex-col">
          <main
            className="mx-auto flex w-full max-w-md flex-1 flex-col"
            style={{ paddingBottom: "calc(var(--bottom-nav-height) + env(safe-area-inset-bottom))" }}
          >
            {children}
          </main>
          <BottomNav />
        </div>
      </AppChrome>
    </ToastProvider>
  );
}
