"use client";

import { useActionState } from "react";
import {
  signInAction,
  signUpAction,
  signOutAction,
  type ActionResult,
} from "@/app/playground/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusPill } from "@/components/status-pill";
import { CallResult } from "@/components/playground/call-result";

export function AuthPanel({ currentEmail }: { currentEmail: string | null }) {
  const [signUpState, signUp, signingUp] = useActionState<
    ActionResult | null,
    FormData
  >(signUpAction, null);
  const [signInState, signIn, signingIn] = useActionState<
    ActionResult | null,
    FormData
  >(signInAction, null);
  const last = signInState ?? signUpState;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Session:</span>
        {currentEmail ? (
          <>
            <StatusPill tone="success">Signed in as {currentEmail}</StatusPill>
            <form action={signOutAction}>
              <Button type="submit" variant="outline" size="sm">
                Sign out
              </Button>
            </form>
          </>
        ) : (
          <StatusPill tone="neutral">Signed out</StatusPill>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <form
          action={signUp}
          className="space-y-2 rounded-xl border border-border bg-card p-4"
        >
          <div className="text-sm font-medium">Sign up</div>
          <Input name="email" type="email" placeholder="you@example.com" required />
          <Input name="password" type="password" placeholder="password" required />
          <Button type="submit" variant="outline" size="sm" disabled={signingUp}>
            {signingUp ? "…" : "auth.signUp()"}
          </Button>
        </form>
        <form
          action={signIn}
          className="space-y-2 rounded-xl border border-border bg-card p-4"
        >
          <div className="text-sm font-medium">Sign in</div>
          <Input name="email" type="email" placeholder="dev@example.com" required />
          <Input name="password" type="password" placeholder="password" required />
          <Button type="submit" size="sm" disabled={signingIn}>
            {signingIn ? "…" : "auth.signInWithPassword()"}
          </Button>
        </form>
      </div>

      {last && <CallResult code={last.code} result={last.result} ok={last.ok} />}
    </div>
  );
}
