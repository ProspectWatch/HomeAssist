import { BottomNav } from "@/components/nav/bottom-nav";
import { SideRail } from "@/components/nav/side-rail";
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
        {/* The column widens with the screen rather than staying phone-width
            in the middle of an iPad, and the bottom bar gives way to a side
            rail. --rail-width is 0 below the breakpoint, so the same padding
            calc is correct on a phone. */}
        <div className="flex min-h-dvh flex-col pl-(--rail-width)">
          <main className="mx-auto flex w-full max-w-md flex-1 flex-col pb-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom))] md:max-w-2xl md:pb-6 lg:max-w-4xl">
            {children}
          </main>
          <SideRail />
          <BottomNav />
        </div>
      </AppChrome>
    </ToastProvider>
  );
}
