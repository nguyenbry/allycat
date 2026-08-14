"use client";

import * as React from "react";
import { useStore } from "zustand";
import { passwordStore } from "@/stores/password-store";

/**
 * Single source of truth for the app password.
 *
 * It must be this store and no other: `fetcher/fetch.ts` reads
 * `passwordStore.getState().password` directly when building the
 * `x-app-password` header, so any parallel copy of this value in component
 * state would gate the UI without ever reaching the server.
 *
 * `hydrated` guards against a server/client mismatch, since the value is
 * restored from localStorage only in the browser.
 */
export function usePassword() {
  const password = useStore(passwordStore, (s) => s.password);
  const setPassword = useStore(passwordStore, (s) => s.setPassword);

  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    setHydrated(true);
  }, []);

  return { password, setPassword, hydrated };
}
