"use client";

import { createStore } from "zustand";

type PasswordStore = {
  password: string;
  setPassword: (password: string) => void;
};

export const passwordStore = createStore<PasswordStore>()((set) => ({
  password: "",
  setPassword: (password: string) => set({ password }),
}));
