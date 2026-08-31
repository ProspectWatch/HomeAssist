"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { joinHousehold } from "@/app/onboarding/actions";

export function JoinView({
  state,
  code,
}: {
  state: "ready" | "already-member" | "no-code";
  code?: string;
}) {
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const router = useRouter();

  function accept() {
    if (!code) return;
    setError(null);
    startTransition(async () => {
      const res = await joinHousehold(code);
      // joinHousehold redirects on success, so reaching here means it failed.
      if (res && !res.ok) setError(res.message);
      else router.refresh();
    });
  }

  return (
    <div className="shiplap-bg flex min-h-dvh flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="font-serif text-3xl text-ink">HomeAssist</h1>
        </div>

        <Card className="p-5 text-center">
          {state === "already-member" ? (
            <>
              <p className="text-[14px] font-semibold text-ink">You&apos;re already in a household</p>
              <p className="mt-1.5 text-[13px] text-muted">
                Nothing to join — you&apos;re all set.
              </p>
              <Button size="lg" className="mt-4 w-full" asChild>
                <Link href="/home">Go to HomeAssist</Link>
              </Button>
            </>
          ) : state === "no-code" ? (
            <>
              <p className="text-[14px] font-semibold text-ink">That link is missing its code</p>
              <p className="mt-1.5 text-[13px] text-muted">
                Ask whoever invited you to send the link again.
              </p>
              <Button size="lg" variant="ghost" className="mt-4 w-full" asChild>
                <Link href="/onboarding">Enter a code by hand</Link>
              </Button>
            </>
          ) : (
            <>
              <p className="text-[14px] font-semibold text-ink">Join the household</p>
              <p className="mt-1.5 text-[13px] text-muted">
                You&apos;ve been invited to share a HomeAssist household — the same list, pantry and
                receipts.
              </p>
              {error ? <p className="mt-3 text-[12.5px] text-[#b5482f]">{error}</p> : null}
              <Button size="lg" className="mt-4 w-full" disabled={pending} onClick={accept}>
                {pending ? "Joining…" : "Join"}
              </Button>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
