"use client";

import * as React from "react";
import { useStore } from "zustand";
import { passwordStore } from "@/stores/password-store";

function unsubscribeNoop() {
  // Nothing to tear down: hydration happens once and never reverts.
}

/** Stable no-op subscription: whether we have hydrated never changes again. */
const neverChanges = () => unsubscribeNoop;

/**
 * Single source of truth for the app password.
 *
 * It must be this store and no other: `fetcher/fetch.ts` reads
 * `passwordStore.getState().password` directly when building the
 * `x-app-password` header, so any parallel copy of this value in component
 * state would gate the UI without ever reaching the server.
 *
 * `hydrated` guards against a server/client mismatch, since the value is
 * restored from localStorage only in the browser. It is derived through
 * useSyncExternalStore — returning false on the server and true on the
 * client — rather than an effect that calls setState.
 */
export function usePassword() {
  const password = useStore(passwordStore, (s) => s.password);
  const setPassword = useStore(passwordStore, (s) => s.setPassword);

  const hydrated = React.useSyncExternalStore(
    neverChanges,
    () => true,
    () => false
  );

  return { password, setPassword, hydrated };
}
