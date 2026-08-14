import * as React from "react";

/**
 * Tracks a media query.
 *
 * Uses useSyncExternalStore rather than an effect that calls setState: the
 * match is external state, and reading it during render avoids the extra
 * render pass the old effect-based version caused on every mount.
 * The server snapshot is `false`, so SSR renders the narrow layout.
 */
export function useMediaQuery(query: string) {
  const subscribe = React.useCallback(
    (onStoreChange: () => void) => {
      const list = matchMedia(query);
      list.addEventListener("change", onStoreChange);
      return () => list.removeEventListener("change", onStoreChange);
    },
    [query]
  );

  return React.useSyncExternalStore(
    subscribe,
    () => matchMedia(query).matches,
    () => false
  );
}
