"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import type { SortDirection } from "./use-table-controls";

export interface ServerPage<T> {
  rows: T[];
  total: number;
}

export interface ServerTableQuery {
  page: number;
  limit: number;
  search: string;
  sortBy: string | null;
  sortDir: SortDirection;
}

export interface ServerTableOptions<T> {
  /**
   * Fetches one page. Receives the current query plus an AbortSignal — the
   * hook cancels superseded requests so a slow page-1 response can never
   * overwrite a faster page-2 one.
   */
  fetchPage: (
    query: ServerTableQuery,
    signal: AbortSignal,
  ) => Promise<ServerPage<T>>;
  initialPageSize?: number;
  initialSortKey?: string | null;
  initialSortDirection?: SortDirection;
  /**
   * Extra filter values (status tab, type select, …). Changing any of these
   * refetches from page 1. Pass a stable object — usually a useMemo.
   */
  filters?: Record<string, string | number | undefined>;
  /** Debounce applied to the search box before it hits the network. */
  searchDelay?: number;
  /**
   * Remember page, page size, search, sort and scroll under this name for the
   * browser tab — so opening a row (edit, view) and coming back lands on the
   * same page, at the same row, instead of page 1.
   */
  persistKey?: string;
}

const STORE = 'pd-table:';

interface Stored {
  page?: number;
  pageSize?: number;
  search?: string;
  sortKey?: string | null;
  sortDirection?: SortDirection;
  scrollY?: number;
}

function readStored(key?: string): Stored {
  if (!key || typeof window === 'undefined') return {};
  try {
    return JSON.parse(sessionStorage.getItem(STORE + key) || '{}') as Stored;
  } catch {
    return {};
  }
}

function writeStored(key: string, patch: Stored) {
  try {
    sessionStorage.setItem(STORE + key, JSON.stringify({ ...readStored(key), ...patch }));
  } catch {
    // Storage blocked: the table simply starts on page 1.
  }
}

/**
 * useState that survives leaving the page and coming back in this tab — for a
 * list page's own filters (status tab, type select…), next to `persistKey`.
 */
export function useStoredState<T>(key: string, initial: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initial;
    try {
      const raw = sessionStorage.getItem(STORE + 'state:' + key);
      return raw === null ? initial : (JSON.parse(raw) as T);
    } catch {
      return initial;
    }
  });
  const set = useCallback(
    (v: T) => {
      setValue(v);
      try {
        sessionStorage.setItem(STORE + 'state:' + key, JSON.stringify(v));
      } catch {
        // ignore
      }
    },
    [key],
  );
  return [value, set];
}

export interface ServerTable<T> {
  /** Rows for the current page. */
  rows: T[];
  /** Total matching rows on the server, across all pages. */
  matchedCount: number;
  page: number;
  setPage: (page: number) => void;
  pageSize: number;
  setPageSize: (size: number) => void;
  totalPages: number;
  fromIndex: number;
  toIndex: number;
  search: string;
  setSearch: (value: string) => void;
  sortKey: string | null;
  sortDirection: SortDirection;
  toggleSort: (key: string) => void;
  resetFilters: () => void;
  /** True only for the very first load, when there is nothing to show yet. */
  loading: boolean;
  /** True while any refetch is in flight — keep the old rows and dim them. */
  refreshing: boolean;
  error: string | null;
  /** Refetch the current page. */
  reload: () => void;
  /**
   * Drop a row locally after a successful delete, so the table does not have
   * to round-trip just to lose one row.
   */
  removeRow: (predicate: (row: T) => boolean) => void;
  /** Patch a row in place after a successful update. */
  patchRow: (predicate: (row: T) => boolean, patch: Partial<T>) => void;
}

/**
 * Server-paginated table state.
 *
 * Deliberately exposes the same surface as `useTableControls` so the shared
 * PaginationBar / TableToolbar / table-state components work with either, and
 * a page can move from client to server paging without being rewritten.
 */
export function useServerTable<T>({
  fetchPage,
  initialPageSize = 25,
  initialSortKey = null,
  initialSortDirection = "desc",
  filters,
  searchDelay = 350,
  persistKey,
}: ServerTableOptions<T>): ServerTable<T> {
  const [stored] = useState(() => readStored(persistKey));
  const [rows, setRows] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPageRaw] = useState(stored.page ?? 1);
  const [pageSize, setPageSizeRaw] = useState(stored.pageSize ?? initialPageSize);
  const [search, setSearchRaw] = useState(stored.search ?? "");
  const [sortKey, setSortKey] = useState<string | null>(
    stored.sortKey !== undefined ? stored.sortKey : initialSortKey,
  );
  const [sortDirection, setSortDirection] = useState<SortDirection>(
    stored.sortDirection ?? initialSortDirection,
  );

  // Remember where the table is, for a return to this page.
  useEffect(() => {
    if (persistKey) writeStored(persistKey, { page, pageSize, search, sortKey, sortDirection });
  }, [persistKey, page, pageSize, search, sortKey, sortDirection]);

  // …and how far down it was: kept while scrolling, put back once the rows are in.
  const restoreScroll = useRef(stored.scrollY ?? 0);
  useEffect(() => {
    if (!persistKey) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      clearTimeout(t);
      t = setTimeout(() => writeStored(persistKey, { scrollY: window.scrollY }), 150);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      clearTimeout(t);
      window.removeEventListener("scroll", onScroll);
    };
  }, [persistKey]);

  // `loading` covers the first paint; `refreshing` covers every later fetch so
  // the table can stay on screen instead of collapsing back to skeletons.
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const debouncedSearch = useDebounce(search, searchDelay);

  // Serialised so the effect depends on the filter *values*, not on the
  // identity of the object a caller rebuilt during render.
  const filterKey = JSON.stringify(filters ?? {});

  const hasLoadedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Cancel whatever is still in flight before starting the next request.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const run = async () => {
      if (hasLoadedRef.current) setRefreshing(true);
      setError(null);

      try {
        const result = await fetchPage(
          {
            page,
            limit: pageSize,
            search: debouncedSearch,
            sortBy: sortKey,
            sortDir: sortDirection,
          },
          controller.signal,
        );
        if (controller.signal.aborted) return;
        setRows(result.rows);
        setTotal(result.total);
        hasLoadedRef.current = true;
        const y = restoreScroll.current;
        if (y > 0) {
          restoreScroll.current = 0;
          // After the rows have painted.
          requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, y)));
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        // Axios surfaces cancellation as a rejection; it is not a failure.
        if ((err as { code?: string })?.code === "ERR_CANCELED") return;
        setError(
          (err as { response?: { data?: { message?: string } } })?.response
            ?.data?.message ??
            "Could not load this page. Check your connection and try again.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };

    void run();

    return () => controller.abort();
    // fetchPage is expected to be a useCallback; filterKey stands in for filters.
  }, [
    fetchPage,
    page,
    pageSize,
    debouncedSearch,
    sortKey,
    sortDirection,
    filterKey,
    reloadToken,
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // A delete or a filter change can put the current page past the end.
  // (Only once rows have loaded: before that the total is not known yet, and a
  // remembered page 3 must not be thrown away.)
  useEffect(() => {
    if (hasLoadedRef.current && !loading && page > totalPages) setPageRaw(totalPages);
  }, [page, totalPages, loading]);

  // Any filter or search change restarts at page 1.
  // (Compared by value, so a remembered page survives the first render and
  // React's double-run of effects in development.)
  const lastFilters = useRef(`${filterKey}|${debouncedSearch}`);
  useEffect(() => {
    const now = `${filterKey}|${debouncedSearch}`;
    if (lastFilters.current === now) return;
    lastFilters.current = now;
    setPageRaw(1);
  }, [filterKey, debouncedSearch]);

  const setSearch = useCallback((value: string) => setSearchRaw(value), []);

  const setPageSize = useCallback((size: number) => {
    setPageSizeRaw(size);
    setPageRaw(1);
  }, []);

  const toggleSort = useCallback((key: string) => {
    setPageRaw(1);
    setSortKey((currentKey) => {
      if (currentKey === key) {
        setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
        return currentKey;
      }
      setSortDirection("asc");
      return key;
    });
  }, []);

  const resetFilters = useCallback(() => {
    setSearchRaw("");
    setPageRaw(1);
  }, []);

  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  const removeRow = useCallback((predicate: (row: T) => boolean) => {
    setRows((previous) => previous.filter((row) => !predicate(row)));
    setTotal((previous) => Math.max(0, previous - 1));
  }, []);

  const patchRow = useCallback(
    (predicate: (row: T) => boolean, patch: Partial<T>) => {
      setRows((previous) =>
        previous.map((row) => (predicate(row) ? { ...row, ...patch } : row)),
      );
    },
    [],
  );

  return useMemo(
    () => ({
      rows,
      matchedCount: total,
      page,
      setPage: setPageRaw,
      pageSize,
      setPageSize,
      totalPages,
      fromIndex: total === 0 ? 0 : (page - 1) * pageSize + 1,
      toIndex: Math.min(page * pageSize, total),
      search,
      setSearch,
      sortKey,
      sortDirection,
      toggleSort,
      resetFilters,
      loading,
      refreshing,
      error,
      reload,
      removeRow,
      patchRow,
    }),
    [
      rows,
      total,
      page,
      pageSize,
      totalPages,
      search,
      setSearch,
      setPageSize,
      sortKey,
      sortDirection,
      toggleSort,
      resetFilters,
      loading,
      refreshing,
      error,
      reload,
      removeRow,
      patchRow,
    ],
  );
}
