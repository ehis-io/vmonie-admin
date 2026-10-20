"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

interface State<T> {
  key: string | null;
  data: T | undefined;
  error: unknown;
}

export interface Resource<T> {
  data: T | undefined;
  error: unknown;
  loading: boolean;
  reload: () => void;
}

/**
 * GET `path` (or run `loader`) and keep the result. A null path fetches
 * nothing. Loading is derived from whether the stored result belongs to the
 * current request, so no state is set synchronously inside the effect.
 */
export function useResource<T>(
  path: string | null,
  loader?: (path: string) => Promise<T>,
): Resource<T> {
  const [nonce, setNonce] = useState(0);
  const [state, setState] = useState<State<T>>({
    key: null,
    data: undefined,
    error: undefined,
  });
  const requestKey = path === null ? null : `${path}#${nonce}`;

  useEffect(() => {
    if (path === null || requestKey === null) return;
    let live = true;
    const load = loader ?? ((p: string) => api.get<T>(p));
    load(path).then(
      (data) => live && setState({ key: requestKey, data, error: undefined }),
      (error: unknown) =>
        live && setState((s) => ({ key: requestKey, data: s.data, error })),
    );
    return () => {
      live = false;
    };
    // `loader` is expected to be stable for a given path.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, requestKey]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const current = state.key === requestKey;

  return {
    // Keep showing the previous data while a reload is in flight.
    data: state.data,
    error: current ? state.error : undefined,
    loading: path !== null && !current,
    reload,
  };
}
