"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { sendMagicLink } from "./actions";

export function LoginView() {
  const [email, setEmail] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const [status, setStatus] = React.useState<{ kind: "sent" | "error"; message?: string } | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const origin = window.location.origin;
      const res = await sendMagicLink(email, origin);
      setStatus(res.ok ? { kind: "sent" } : { kind: "error", message: res.message });
    });
  }

  return (
    <div className="shiplap-bg flex min-h-dvh flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="font-serif text-3xl text-ink">HomeAssist</h1>
          <p className="mt-1.5 text-[13px] text-muted">The Brown Family household, all in one place.</p>
        </div>

        <Card className="p-5">
          {status?.kind === "sent" ? (
            <div className="py-2 text-center">
              <p className="text-[14px] font-semibold text-ink">Check your email</p>
              <p className="mt-1.5 text-[13px] text-muted">
                We sent a sign-in link to {email}. Open it on this device to continue.
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-4"
                onClick={() => setStatus(null)}
              >
                Use a different email
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-3">
              <div>
                <label htmlFor="email" className="mb-1.5 block text-[12.5px] font-semibold text-ink">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              {status?.kind === "error" ? (
                <p className="text-[12.5px] text-[#b5482f]">{status.message}</p>
              ) : null}
              <Button type="submit" size="lg" className="mt-1 w-full" disabled={pending}>
                {pending ? "Sending link…" : "Send sign-in link"}
              </Button>
              <p className="mt-1 text-center text-[11.5px] text-muted2">
                No password needed — we&apos;ll email you a one-time link.
              </p>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
