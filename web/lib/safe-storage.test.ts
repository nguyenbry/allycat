import { afterEach, describe, expect, it, vi } from "vitest";
import { getSafeStorage, isPersistentStorageAvailable } from "./safe-storage";

/**
 * Replaces window.localStorage for one test. Safari Private Browsing is the
 * case that matters: the object exists but throws on access.
 */
function stubLocalStorage(impl: Partial<Storage> | (() => never)) {
  const original = Object.getOwnPropertyDescriptor(window, "localStorage");

  Object.defineProperty(window, "localStorage", {
    configurable: true,
    get: typeof impl === "function" ? impl : () => impl as Storage,
  });

  return () => {
    if (original) {
      Object.defineProperty(window, "localStorage", original);
    }
  };
}

const restores: (() => void)[] = [];

afterEach(() => {
  while (restores.length) restores.pop()?.();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("getSafeStorage", () => {
  it("round-trips through real localStorage when it works", () => {
    const storage = getSafeStorage();

    storage.setItem("k", "v");

    expect(storage.getItem("k")).toBe("v");
    expect(window.localStorage.getItem("k")).toBe("v");

    storage.removeItem("k");
    expect(storage.getItem("k")).toBeNull();
  });

  it("returns null for keys that were never set", () => {
    expect(getSafeStorage().getItem("nope")).toBeNull();
  });

  it("falls back to memory when reading localStorage throws", () => {
    restores.push(
      stubLocalStorage(() => {
        throw new Error("SecurityError: private mode");
      })
    );

    const storage = getSafeStorage();

    // Must not throw, and must still behave like storage for this tab.
    expect(() => storage.setItem("k", "v")).not.toThrow();
    expect(storage.getItem("k")).toBe("v");
  });

  it("falls back to memory when setItem throws mid-session", () => {
    // Safari can start refusing writes once its private-mode quota is gone,
    // after earlier writes in the same session succeeded.
    const backing = new Map<string, string>();

    restores.push(
      stubLocalStorage({
        get length() {
          return backing.size;
        },
        clear: () => backing.clear(),
        getItem: (k: string) => backing.get(k) ?? null,
        key: (i: number) => Array.from(backing.keys())[i] ?? null,
        removeItem: (k: string) => void backing.delete(k),
        setItem: () => {
          throw new Error("QuotaExceededError");
        },
      })
    );

    const storage = getSafeStorage();

    expect(() => storage.setItem("route", "payload")).not.toThrow();
    // The write went to memory, so it must still read back.
    expect(storage.getItem("route")).toBe("payload");
  });

  it("does not throw on clear, key, or length when the backing store throws", () => {
    restores.push(
      stubLocalStorage(() => {
        throw new Error("blocked");
      })
    );

    const storage = getSafeStorage();

    expect(() => storage.clear()).not.toThrow();
    expect(() => storage.key(0)).not.toThrow();
    expect(() => storage.length).not.toThrow();
    expect(() => storage.removeItem("x")).not.toThrow();
  });

  it("keeps one shared memory fallback across calls", () => {
    restores.push(
      stubLocalStorage(() => {
        throw new Error("blocked");
      })
    );

    getSafeStorage().setItem("shared", "yes");

    // A second call must see the first call's write, or persisted state would
    // silently reset between stores.
    expect(getSafeStorage().getItem("shared")).toBe("yes");
  });
});

describe("isPersistentStorageAvailable", () => {
  it("is true when localStorage accepts writes", () => {
    expect(isPersistentStorageAvailable()).toBe(true);
  });

  it("is false when localStorage throws", () => {
    restores.push(
      stubLocalStorage(() => {
        throw new Error("blocked");
      })
    );

    expect(isPersistentStorageAvailable()).toBe(false);
  });

  it("leaves no probe key behind", () => {
    isPersistentStorageAvailable();

    expect(window.localStorage.getItem("__allycat_probe__")).toBeNull();
  });
});
