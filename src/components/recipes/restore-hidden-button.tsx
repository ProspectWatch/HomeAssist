"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/shell/toast-context";
import { restoreHiddenRecipes } from "@/app/(shell)/shop/recipes/[id]/actions";

/**
 * Undo for a removed starter recipe.
 *
 * Removing one is a household-scoped hide rather than a delete, so it can be
 * undone — and a removal with no way back is a thing people hesitate over.
 * Only appears once something is actually hidden.
 */
export function RestoreHiddenButton({ count }: { count: number }) {
  const router = useRouter();
  const showToast = useToast();
  const [pending, startTransition] = React.useTransition();

  if (count === 0) return null;

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await restoreHiddenRecipes();
          if (!res.ok) showToast(res.message);
          else {
            showToast(count === 1 ? "Starter recipe restored" : `${count} starter recipes restored`);
            router.refresh();
          }
        })
      }
      className="cursor-pointer text-[11.5px] text-muted2 underline decoration-dotted underline-offset-2 disabled:opacity-50"
    >
      {count === 1 ? "1 starter recipe removed" : `${count} starter recipes removed`} — put them back
    </button>
  );
}
