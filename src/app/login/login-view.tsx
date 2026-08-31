"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { MAX_CODE_LENGTH, isPlausibleSignInCode, normalizeSignInCode } from "@/lib/auth/sign-in-code";
import { sendMagicLink, verifyEmailCode } from "./actions";

export function LoginView({ initialError }: { initialError?: string }) {
  const [email, setEmail] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const [code, setCode] = React.useState("");
  const [codeError, setCodeError] = React.useState<string | null>(null);
  const router = useRouter();
  const [status, setStatus] = React.useState<{ kind: "sent" | "error"; message?: string } | null>(
    initialError ? { kind: "error", message: initialError } : null,
  );

  function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setCodeError(null);
    startTransition(async () => {
      const res = await verifyEmailCode(email, code);
      if (!res.ok) {
        setCodeError(res.message);
        return;
      }
      router.replace("/home");
      router.refresh();
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await sendMagicLink(email);
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
            <div className="py-1">
              <p className="text-center text-[14px] font-semibold text-ink">Check your email</p>
              <p className="mt-1.5 text-center text-[13px] text-muted">
                We sent a sign-in code and a link to {email}.
              </p>

              {/* The code works no matter where the email opens; the link only
                  works in this browser. */}
              <form onSubmit={submitCode} className="mt-4 flex flex-col gap-2">
                <label htmlFor="code" className="text-[12.5px] font-semibold text-ink">
                  Enter the code from the email
                </label>
                <Input
                  id="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]*"
                  maxLength={MAX_CODE_LENGTH}
                  placeholder="Code"
                  value={code}
                  onChange={(e) => setCode(normalizeSignInCode(e.target.value))}
                  className="text-center text-[20px] tracking-[0.4em]"
                />
                {codeError ? <p className="text-[12.5px] text-[#b5482f]">{codeError}</p> : null}
                <Button type="submit" size="lg" disabled={pending || !isPlausibleSignInCode(code)}>
                  {pending ? "Signing in…" : "Sign in"}
                </Button>
              </form>

              <p className="mt-3 text-center text-[11.5px] text-muted2">
                Tapping the link in the email works too — but only if it opens in this browser.
              </p>
              <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={() => setStatus(null)}>
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
