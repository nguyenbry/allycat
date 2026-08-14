/**
 * A Storage implementation that never throws.
 *
 * Two environments break plain `localStorage` access:
 *   - Server rendering, where `window` does not exist at all.
 *   - Safari Private Browsing and hardened privacy settings, where the object
 *     exists but reads/writes can throw (older Safari threw QuotaExceededError
 *     on every write once the private-mode quota was zero).
 *
 * Rather than let either case take down the page, fall back to an in-memory
 * map. State then lasts exactly as long as the tab — which is already the
 * ceiling in a private session, since the browser discards its storage when
 * the session ends.
 */

function createMemoryStorage(): Storage {
  const map = new Map<string, string>();

  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => Array.from(map.keys())[index] ?? null,
    removeItem: (key: string) => {
      map.delete(key);
    },
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  };
}

let memoryFallback: Storage | undefined;

function getMemoryFallback(): Storage {
  memoryFallback ??= createMemoryStorage();
  return memoryFallback;
}

/** True when localStorage can actually be read from and written to. */
export function isPersistentStorageAvailable(): boolean {
  if (typeof window === "undefined") return false;

  try {
    const probe = "__allycat_probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

/**
 * Wraps localStorage so a throwing implementation degrades to memory instead
 * of propagating. Each call is guarded individually because Safari can start
 * refusing writes partway through a session once its quota is exhausted.
 */
export function getSafeStorage(): Storage {
  if (typeof window === "undefined") return getMemoryFallback();

  let underlying: Storage;
  try {
    underlying = window.localStorage;
    // Touching the object is not enough; Safari only throws on real access.
    void underlying.length;
  } catch {
    return getMemoryFallback();
  }

  return {
    get length() {
      try {
        return underlying.length;
      } catch {
        return getMemoryFallback().length;
      }
    },
    clear: () => {
      // Always clear both, or a memory-only write would outlive a clear().
      getMemoryFallback().clear();

      try {
        underlying.clear();
      } catch {
        // nothing left to do; the memory copy is already gone
      }
    },
    getItem: (key: string) => {
      // Check the fallback whenever the real store has nothing: a previous
      // setItem may have been rejected (quota exhausted mid-session) and
      // landed in memory instead, and reading only `underlying` would then
      // report the value as missing.
      try {
        const value = underlying.getItem(key);
        if (value !== null) return value;
      } catch {
        // fall through to the memory copy
      }

      return getMemoryFallback().getItem(key);
    },
    key: (index: number) => {
      try {
        return underlying.key(index);
      } catch {
        return getMemoryFallback().key(index);
      }
    },
    removeItem: (key: string) => {
      // Same reasoning as clear(): remove from both copies.
      getMemoryFallback().removeItem(key);

      try {
        underlying.removeItem(key);
      } catch {
        // already removed from the memory copy
      }
    },
    setItem: (key: string, value: string) => {
      try {
        underlying.setItem(key, value);
      } catch {
        // Quota exhausted or writes blocked — keep it for this tab at least.
        getMemoryFallback().setItem(key, value);
      }
    },
  };
}
