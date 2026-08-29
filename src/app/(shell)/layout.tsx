import { BottomNav } from "@/components/nav/bottom-nav";

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <main
        className="mx-auto flex w-full max-w-md flex-1 flex-col"
        style={{ paddingBottom: "calc(var(--bottom-nav-height) + env(safe-area-inset-bottom))" }}
      >
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
