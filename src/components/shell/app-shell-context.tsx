"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { BottomSheet, SheetRow } from "@/components/ui/bottom-sheet";
import { AddWatchModal } from "@/components/shell/add-watch-modal";
import { AddSpecModal } from "@/components/shell/add-spec-modal";
import { AddUrlModal } from "@/components/shell/add-url-modal";
import { useToast } from "@/components/shell/toast-context";
import type { Department } from "@/lib/data/departments";
import type { Athlete } from "@/lib/data/athletes";

type AppShellContextValue = {
  openAddWatch: (mode: "watch" | "own", presetDept?: string) => void;
};

const AppShellContext = React.createContext<AppShellContextValue | null>(null);

export function useAppShell() {
  const ctx = React.useContext(AppShellContext);
  if (!ctx) throw new Error("useAppShell must be used within AppChrome");
  return ctx;
}

const HIDE_FAB_ON = ["/home", "/shop/list"];

export function AppChrome({
  departments,
  athletes,
  children,
}: {
  departments: Department[];
  athletes: Athlete[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const showToast = useToast();

  const [globalAddOpen, setGlobalAddOpen] = React.useState(false);
  const [watchModal, setWatchModal] = React.useState<{ mode: "watch" | "own"; dept?: string; url?: string } | null>(null);
  const [specOpen, setSpecOpen] = React.useState(false);
  const [urlOpen, setUrlOpen] = React.useState(false);

  const openAddWatch = React.useCallback((mode: "watch" | "own", presetDept?: string) => {
    setGlobalAddOpen(false);
    setWatchModal({ mode, dept: presetDept });
  }, []);

  const showFab = !HIDE_FAB_ON.includes(pathname);

  return (
    <AppShellContext.Provider value={{ openAddWatch }}>
      {children}

      {showFab ? (
        <button
          type="button"
          aria-label="Add"
          onClick={() => setGlobalAddOpen(true)}
          // Clears the bottom bar on a phone; on a tablet there is no bottom
          // bar to clear, so it sits in the corner where a floating action
          // button belongs.
          className="fixed right-4 bottom-[calc(var(--bottom-nav-height)+env(safe-area-inset-bottom)+0.75rem)] z-[110] flex h-[52px] w-[52px] cursor-pointer items-center justify-center rounded-full bg-ink text-2xl text-white shadow-[0_10px_24px_rgba(29,29,27,.35)] md:bottom-6"
        >
          <Plus className="h-6 w-6" />
        </button>
      ) : null}

      <BottomSheet open={globalAddOpen} onClose={() => setGlobalAddOpen(false)}>
        <SheetRow label="Add to Grocery List" onClick={() => { setGlobalAddOpen(false); router.push("/shop/list"); }} />
        <SheetRow label="Add Household Item" onClick={() => { setGlobalAddOpen(false); router.push("/rooms"); }} />
        <SheetRow label="Watch Product" onClick={() => openAddWatch("watch")} />
        <SheetRow label="Watch by Specs" onClick={() => { setGlobalAddOpen(false); setSpecOpen(true); }} />
        <SheetRow label="Add Owned Product" onClick={() => openAddWatch("own")} />
        <SheetRow
          label="Scan Receipt"
          onClick={() => {
            setGlobalAddOpen(false);
            router.push("/receipts");
            showToast("Camera would open here");
          }}
        />
        <SheetRow label="Paste Product Link" onClick={() => { setGlobalAddOpen(false); setUrlOpen(true); }} />
      </BottomSheet>

      {watchModal ? (
        <AddWatchModal
          onClose={() => setWatchModal(null)}
          departments={departments}
          athletes={athletes}
          initialMode={watchModal.mode}
          initialUrl={watchModal.url}
        />
      ) : null}
      {specOpen ? <AddSpecModal onClose={() => setSpecOpen(false)} /> : null}
      {urlOpen ? (
        <AddUrlModal
          onClose={() => setUrlOpen(false)}
          onFallbackToManual={(url) => {
            setUrlOpen(false);
            setWatchModal({ mode: "watch", url });
          }}
        />
      ) : null}
    </AppShellContext.Provider>
  );
}
