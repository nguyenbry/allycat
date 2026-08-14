"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Eye, EyeOff, KeyRound, LockKeyhole } from "lucide-react";
import { motion } from "motion/react";
import { usePassword } from "./use-password";

/**
 * The app password is Bryan's access control for the deployed site. Rather
 * than floating an easily-missed field in a corner, gate the whole UI on it —
 * on a phone that also keeps the primary surface uncluttered once unlocked.
 */
export function PasswordGate({ children }: React.PropsWithChildren) {
  const { password, hydrated } = usePassword();

  if (!hydrated) {
    return <div className="min-h-[100dvh]" />;
  }

  if (password.trim() === "") {
    return <UnlockScreen />;
  }

  return <>{children}</>;
}

function UnlockScreen() {
  const { setPassword } = usePassword();
  const [draft, setDraft] = React.useState("");
  const [reveal, setReveal] = React.useState(false);

  // The server rejects anything shorter than 8 characters outright.
  const tooShort = draft.trim().length > 0 && draft.trim().length < 8;
  const canSubmit = draft.trim().length >= 8;

  return (
    <main className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-6">
      <div
        aria-hidden
        className="from-jade-4 pointer-events-none absolute -top-40 left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-gradient-to-b to-transparent opacity-40 blur-3xl"
      />

      <motion.form
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) setPassword(draft.trim());
        }}
        className="relative z-10 flex w-full max-w-sm flex-col items-center gap-6"
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="bg-jade-3 text-jade-11 ring-jade-6 flex size-14 items-center justify-center rounded-2xl ring-1">
            <LockKeyhole className="size-7" />
          </div>
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-bold tracking-tight">allycat</h1>
            <p className="text-muted-foreground text-sm text-balance">
              Route optimizer for alleycat races. Enter the app password to
              continue.
            </p>
          </div>
        </div>

        <div className="flex w-full flex-col gap-2">
          <InputGroup>
            <InputGroupInput
              autoFocus
              type={reveal ? "text" : "password"}
              inputMode="text"
              autoComplete="current-password"
              placeholder="App password"
              aria-invalid={tooShort}
              aria-label="App password"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <InputGroupAddon>
              <KeyRound />
            </InputGroupAddon>
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                type="button"
                size="icon-xs"
                variant="ghost"
                aria-label={reveal ? "Hide password" : "Show password"}
                onClick={() => setReveal((x) => !x)}
              >
                {reveal ? <EyeOff /> : <Eye />}
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>

          <p className="text-muted-foreground min-h-4 px-1 text-xs">
            {tooShort ? "Must be at least 8 characters." : ""}
          </p>
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={!canSubmit}>
          Unlock
        </Button>
      </motion.form>
    </main>
  );
}
