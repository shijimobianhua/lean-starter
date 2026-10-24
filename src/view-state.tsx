import {
  createContext,
  useContext,
  useRef,
  useState,
  useCallback,
  type ReactNode,
  type SetStateAction,
  type Dispatch,
} from "react";

// Viewing choices live only as long as this App instance. No storage or health-data writes.
const Context = createContext<Map<string, unknown> | null>(null);
export function ViewStateProvider({ children }: { children: ReactNode }) {
  const store = useRef(new Map<string, unknown>());
  return <Context.Provider value={store.current}>{children}</Context.Provider>;
}
export function useHasViewState(key: string) {
  return useContext(Context)?.has(key) ?? false;
}
export function useViewState<T>(
  key: string | undefined,
  initial: T | (() => T),
): [T, Dispatch<SetStateAction<T>>] {
  const context = useContext(Context);
  const fallback = useRef(new Map<string, unknown>());
  const store = key ? (context ?? fallback.current) : fallback.current;
  const name = key ?? "local";
  const [value, setValue] = useState<T>(() =>
    store.has(name)
      ? (store.get(name) as T)
      : typeof initial === "function"
        ? (initial as () => T)()
        : initial,
  );
  const current = useRef(value);
  const set = useCallback<Dispatch<SetStateAction<T>>>(
    (action) => {
      const next =
        typeof action === "function"
          ? (action as (previous: T) => T)(current.current)
          : action;
      current.current = next;
      store.set(name, next);
      setValue(next);
    },
    [name, store],
  );
  return [value, set];
}
