"use client";

import { createStore } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { getSafeStorage } from "@/lib/safe-storage";

type PasswordStore = {
  password: string;
  setPassword: (password: string) => void;
};

/**
 * Persisted deliberately: this is the app password gate, and retyping it on
 * every reload while racing is not viable. Same-origin localStorage only.
 */
export const passwordStore = createStore<PasswordStore>()(
  persist(
    (set) => ({
      password: "",
      setPassword: (password: string) => set({ password }),
    }),
    {
      name: "allycat-password",
      // Degrades to memory under Safari Private Browsing instead of throwing.
      storage: createJSONStorage(() => getSafeStorage()),
    }
  )
);
