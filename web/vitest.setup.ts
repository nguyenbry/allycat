import { beforeEach } from "vitest";

/**
 * Node 25 exposes a built-in Web Storage `localStorage` that requires the
 * `--localstorage-file` flag to work, and it shadows the one jsdom installs.
 * The result is a `localStorage` whose methods throw, which is neither what a
 * browser does nor what these tests mean to exercise.
 *
 * Install a straightforward in-memory Storage so tests see browser behaviour.
 * Tests that want a *broken* localStorage stub it themselves.
 */
class MemoryStorage implements Storage {
  private map = new Map<string, string>();

  get length() {
    return this.map.size;
  }

  clear() {
    this.map.clear();
  }

  getItem(key: string) {
    return this.map.get(key) ?? null;
  }

  key(index: number) {
    return Array.from(this.map.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.map.delete(key);
  }

  setItem(key: string, value: string) {
    this.map.set(key, String(value));
  }
}

function installLocalStorage() {
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    writable: true,
    value: new MemoryStorage(),
  });
}

installLocalStorage();

// Each test starts from an empty, working store even if a previous test
// replaced localStorage with a throwing stub.
beforeEach(() => {
  installLocalStorage();
});
